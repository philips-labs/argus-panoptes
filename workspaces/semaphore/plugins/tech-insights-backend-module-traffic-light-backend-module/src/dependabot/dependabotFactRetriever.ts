import { FactRetriever } from '@backstage-community/plugin-tech-insights-node';
import { LoggerService } from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';
import { CatalogClient } from '@backstage/catalog-client';

export const createDependabotFactRetriever = (
  config: Config,
  logger: LoggerService,
): FactRetriever => {
  return {
    id: 'dependabotFactRetriever',
    version: '0.3.0',
    entityFilter: [{ kind: 'Component' }],
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
    handler: async ({ discovery, auth }) => {
      const githubConfigs = config.getOptionalConfigArray(
        'integrations.github',
      );
      const githubToken = githubConfigs?.[0]?.getOptionalString('token');
      if (!githubToken) {
        logger.error('Missing GitHub token in config');
        return [];
      }

      const { token: catalogToken } = await auth.getPluginRequestToken({
        onBehalfOf: await auth.getOwnServiceCredentials(),
        targetPluginId: 'catalog',
      });

      const catalogClient = new CatalogClient({ discoveryApi: discovery });
      const { items: entities } = await catalogClient.getEntities(
        { filter: [{ kind: 'Component' }] },
        { token: catalogToken },
      );

      const Octokit = (await import('@octokit/rest')).Octokit;
      const octokit = new Octokit({ auth: githubToken });

      const results = await Promise.all(
        entities.map(async entity => {
          const repoUrl =
            entity.metadata.annotations?.['github.com/project-slug'];
          if (!repoUrl) return null;

          const [owner, name] = repoUrl.split('/');
          try {
            const alertsResponse = await octokit.request(
              'GET /repos/{owner}/{repo}/dependabot/alerts',
              { owner, repo: name, per_page: 100 },
            );

            const openAlerts = alertsResponse.data.filter(
              a => a.state === 'open',
            );

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

            logger.info(
              `✅ ${entity.metadata.name} → critical: ${critical}, high: ${high}, medium: ${medium}`,
            );

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
            logger.warn(`Failed to fetch alerts for ${repoUrl}: ${e}`);
            return null;
          }
        }),
      );

      return results.filter(Boolean) as NonNullable<
        Awaited<ReturnType<FactRetriever['handler']>>
      >;
    },
  };
};
