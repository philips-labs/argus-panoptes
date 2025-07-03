import { FactRetriever } from '@backstage-community/plugin-tech-insights-node';
import { LoggerService } from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';
import { CatalogClient } from '@backstage/catalog-client';
import { loadOctokit } from './octokitLoader';

/**
 * Creates a fact retriever that fetches Dependabot security alert counts
 *
 * @param config - Backstage application configuration
 * @param logger - Logging service
 * @returns A configured FactRetriever for Dependabot security alerts
 */
export const createDependabotFactRetriever = (
  config: Config,
  logger: LoggerService,
): FactRetriever => {
  return {
    // Unique identifier for this fact retriever
    id: 'dependabotFactRetriever',
    // Version of this fact retriever implementation
    version: '0.3.0',
    // Only process Component entities
    entityFilter: [{ kind: 'Component' }],
    // Define the schema for collected facts
    schema: {
      critical: {
        type: 'integer',
        description: 'Number of critical severity Dependabot alerts',
      },
      high: {
        type: 'integer',
        description: 'Number of high severity Dependabot alerts',
      },
      medium: {
        type: 'integer',
        description: 'Number of medium severity Dependabot alerts',
      },
    },
    // Handler function that performs the actual data collection
    handler: async ({ discovery, auth }) => {
      // Get GitHub token from Backstage configuration
      const githubConfigs = config.getOptionalConfigArray(
        'integrations.github',
      );
      const githubToken = githubConfigs?.[0]?.getOptionalString('token');
      if (!githubToken) {
        logger.error('Missing GitHub token in config');
        return [];
      }

      // Get catalog API token for authenticated requests
      const { token: catalogToken } = await auth.getPluginRequestToken({
        onBehalfOf: await auth.getOwnServiceCredentials(),
        targetPluginId: 'catalog',
      });

      // Initialize catalog client and fetch all Component entities
      const catalogClient = new CatalogClient({ discoveryApi: discovery });
      const { items: entities } = await catalogClient.getEntities(
        { filter: [{ kind: 'Component' }] },
        { token: catalogToken },
      );

      // Initialize GitHub API client with authentication token
      const Octokit = await loadOctokit();
      const octokit = new Octokit({ auth: githubToken });

      // Process each entity in parallel to fetch its alerts
      const results = await Promise.all(
        entities.map(async entity => {
          // Get GitHub repository information from entity annotation
          const repoUrl =
            entity.metadata.annotations?.['github.com/project-slug'];
          if (!repoUrl) return null;

          // Extract owner and repo name from the repository URL
          const [owner, name] = repoUrl.split('/');
          try {
            // Fetch Dependabot alerts from GitHub API
            const alertsResponse = await octokit.request(
              'GET /repos/{owner}/{repo}/dependabot/alerts',
              { owner, repo: name, per_page: 100 },
            );

            // Filter for only open alerts
            const openAlerts = alertsResponse.data.filter(
              (a: { state: string }) => a.state === 'open',
            );

            // Count alerts by severity level
            let critical = 0;
            let high = 0;
            let medium = 0;

            for (const alert of openAlerts) {
              const severity = alert.security_advisory?.severity?.toLowerCase();
              if (severity === 'critical') critical++;
              else if (severity === 'high') high++;
              else if (severity === 'moderate' || severity === 'medium')
                medium++;
            }

            // Log summary of found alerts
            logger.info(
              `${entity.metadata.name} → critical: ${critical}, high: ${high}, medium: ${medium}`,
            );

            // Return entity reference and collected facts
            return {
              entity: {
                name: entity.metadata.name,
                kind: entity.kind,
                namespace: entity.metadata.namespace ?? 'default',
              },
              facts: {
                critical: critical,
                high: high,
                medium: medium,
              },
            };
          } catch (e) {
            // Log errors but continue processing other entities
            logger.warn(`Failed to fetch alerts for ${repoUrl}: ${e}`);
            return null;
          }
        }),
      );

      // Filter out nulls from entities that couldn't be processed
      return results.filter(Boolean) as NonNullable<
        Awaited<ReturnType<FactRetriever['handler']>>
      >;
    },
  };
};
