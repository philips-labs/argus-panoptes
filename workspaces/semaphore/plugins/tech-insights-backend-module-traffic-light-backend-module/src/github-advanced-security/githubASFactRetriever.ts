/**
 * This file reads a GitHub token from config, uses Octokit to fetch GitHub Advanced Security data
 * Returns security findings in a structured way that Tech Insights can consume
 */
import {
  FactRetriever,
  TechInsightFact,
} from '@backstage-community/plugin-tech-insights-node';
import { CatalogClient } from '@backstage/catalog-client';
import { JsonObject } from '@backstage/types';
import { loadOctokit } from '../dependabot/octokitLoader'; // Adjust the import path as needed

// Define interfaces for the security findings as JSON-compatible types
interface CodeScanningFinding extends JsonObject {
  severity: string;
  description: string;
  direct_link: string;
  created_at: string;
}

// Dictionary structure for security findings where the key is the alert number/id
// This way we store all the issues per repository
interface CodeScanningFindingsDict extends JsonObject {
  [alertId: string]: CodeScanningFinding;
}

/**
 * This FactRetriever queries GitHub Advanced Security data for specified repositories
 * and returns detailed security findings for code scanning alerts and counts for secret scanning
 */
export const githubAdvancedSecurityFactRetriever: FactRetriever = {
  // Identifier for this fact retriever
  id: 'githubAdvancedSecurityFactRetriever',
  version: '0.2.0',
  // Entity filter to specify which entities this retriever applies to
  entityFilter: [{ kind: 'component' }],
  // Defines the structure of the facts returned
  schema: {
    criticalCount: {
      type: 'integer',
      description: 'Number of critical Code Scanning alerts',
    },
    highCount: {
      type: 'integer',
      description: 'Number of high Code Scanning alerts',
    },
    mediumCount: {
      type: 'integer',
      description: 'Number of medium Code Scanning alerts',
    },
    lowCount: {
      type: 'integer',
      description: 'Number of low Code Scanning alerts',
    },
    openCodeScanningAlertCount: {
      type: 'integer',
      description: 'Number of open Code Scanning alerts',
    },
    openSecretScanningAlertCount: {
      type: 'integer',
      description: 'Number of open Secret Scanning alerts',
    },
    secretScanningAlerts: {
      type: 'object',
      description:
        'Dictionary of basic secret scanning findings keyed by alert ID',
    },
    codeScanningAlerts: {
      type: 'object',
      description: 'Dictionary of code scanning findings keyed by alert ID',
    },
  },

  // Main logic of the retriever
  async handler({
    config,
    entityFilter,
    auth,
    discovery,
  }): Promise<TechInsightFact[]> {
    // Retrieve GitHub token from config
    let token: string | undefined;
    try {
      const githubConfigs = config.getOptionalConfigArray(
        'integrations.github',
      );
      const githubConfig = githubConfigs?.[0];
      token = githubConfig?.getOptionalString('token');
    } catch {
      return [];
    }

    // Get catalog access token for fetching entities
    const { token: catalogToken } = await auth.getPluginRequestToken({
      onBehalfOf: await auth.getOwnServiceCredentials(),
      targetPluginId: 'catalog',
    });

    // Instantiate the CatalogClient
    const catalogClient = new CatalogClient({ discoveryApi: discovery });

    // Fetch the list of entities matching the entityFilter
    const { items: entities } = await catalogClient.getEntities(
      { filter: entityFilter },
      { token: catalogToken },
    );

    // Filter entities that have GitHub repositories
    const githubEntities = entities.filter(entity => {
      return entity.metadata.annotations?.['github.com/project-slug'];
    });

    const Octokit = await loadOctokit();
    const octokit = new Octokit({ auth: token });

    // Process each entity with GitHub integration
    const results = await Promise.all(
      githubEntities.map(async entity => {
        // Extract owner and repo from the 'github.com/project-slug' annotation
        const projectSlug =
          entity.metadata.annotations?.['github.com/project-slug'] ?? '';
        const [owner, repo] = projectSlug.split('/');

        try {
          // Fetch Code Scanning alerts
          const codeScanningResponse = await octokit.request(
            'GET /repos/{owner}/{repo}/code-scanning/alerts',
            {
              owner,
              repo,
              state: 'open',
              per_page: 100,
            },
          );

          // Also fetch Secret Scanning alerts (just for count and descriptions)
          const secretScanningResponse = await octokit.request(
            'GET /repos/{owner}/{repo}/secret-scanning/alerts',
            {
              owner,
              repo,
              state: 'open',
              per_page: 100,
            },
          );

          // Process code scanning alerts to extract only the required information
          const codeScanningAlerts: CodeScanningFindingsDict = {};

          codeScanningResponse.data.forEach(
            (alert: {
              number: number;
              rule?: {
                security_severity_level?: string;
                description?: string;
                name?: string;
              };
              created_at?: string;
              most_recent_instance?: {
                location?: { path?: string; start_line?: number };
                commit_sha?: string;
              };
            }) => {
              // Extract necessary information for code scanning alerts
              const alertId = `code-${alert.number}`;
              const instance = alert.most_recent_instance;
              const location = instance?.location;
              const start_line = location?.start_line ?? 1; // Default to line 1 if not provided

              // Create finding with only the requested fields
              const finding: CodeScanningFinding = {
                severity: alert.rule?.security_severity_level ?? 'unknown',
                description:
                  alert.rule?.description ??
                  alert.rule?.name ??
                  'No description available',
                created_at: alert.created_at ?? '',
                direct_link: `https://github.com/${owner}/${repo}/blob/${instance?.commit_sha}/${location?.path}#L${start_line}`,
              };

              // Add to dictionary with alert number as the key
              codeScanningAlerts[alertId] = finding;
            },
          );

          // Process secret scanning alerts to create a dictionary with only the requested fields
          const secretScanningAlerts: CodeScanningFindingsDict = {};

          secretScanningResponse.data.forEach(
            (alert: {
              number: number;
              secret_type?: string;
              created_at?: string;
              html_url?: string;
            }) => {
              const alertId = `secret-${alert.number}`;

              // Create a simplified finding with just basic information
              secretScanningAlerts[alertId] = {
                severity: 'high', // Secret scanning alerts are typically high severity
                description: `Secret of type ${
                  alert.secret_type ?? 'unknown'
                } found`,
                created_at: alert.created_at ?? '',
                direct_link: alert.html_url ?? '',
              };
            },
          );

          const severityCounts = {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
          };

          Object.values(codeScanningAlerts).forEach(alert => {
            const severityLower = alert.severity.toLowerCase();

            // Count by severity
            switch (severityLower) {
              case 'critical':
                severityCounts.critical++;
                break;
              case 'high':
                severityCounts.high++;
                break;
              case 'medium':
                severityCounts.medium++;
                break;
              case 'low':
                severityCounts.low++;
                break;
              default:
                break;
            }
          });

          // Return the fact result object for this repository as a TechInsightFact
          return {
            entity: {
              kind: entity.kind,
              namespace: entity.metadata.namespace ?? 'default',
              name: entity.metadata.name,
            },
            facts: {
              openCodeScanningAlertCount:
                Object.keys(codeScanningAlerts).length,
              openSecretScanningAlertCount:
                Object.keys(secretScanningAlerts).length,
              // Store counts for each severity level
              criticalCount: severityCounts.critical,
              highCount: severityCounts.high,
              mediumCount: severityCounts.medium,
              lowCount: severityCounts.low,
              // Store alerts directly in the facts object
              codeScanningAlerts: codeScanningAlerts as JsonObject,
              secretScanningAlerts: secretScanningAlerts as JsonObject,
            },
          } as TechInsightFact;
        } catch {
          return null;
        }
      }),
    );

    // Filter null results and ensure they match TechInsightFact type
    return results.filter((r): r is TechInsightFact => r !== null);
  },
};
