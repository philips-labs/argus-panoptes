import { Config } from '@backstage/config/index';
import { FactRetriever } from '@backstage-community/plugin-tech-insights-node';
import { CatalogClient } from '@backstage/catalog-client';

// Define an interface for the SonarCloud measure
interface SonarCloudMeasure {
  metric: string; // Name of the metric (e.g., 'bugs', 'code_smells', 'vulnerabilities')
  value: string; // Value of the metric, a number in string format
  bestValue?: boolean; // Indicates if this is the best possible value for the metric
}

// Interface for SonarCloud quality gate response
interface SonarQualityGateCondition {
  status: string;
  metricKey: string;
  comparator: string;
  errorThreshold: string;
  actualValue: string;
}

interface SonarQualityGateResponse {
  projectStatus: {
    status: 'OK' | 'ERROR' | 'WARN';
    conditions: SonarQualityGateCondition[];
    periods: unknown[];
    ignoredConditions: boolean;
  };
}

/**
 * Creates a fact retriever for SonarCloud metrics.
 *
 * This retriever fetches code quality metrics from SonarCloud for components
 * that have SonarCloud integration enabled via annotations.
 *
 * @param config - The application configuration object
 * @returns A configured FactRetriever that will collect SonarCloud metrics
 */
export const createSonarCloudFactRetriever = (
  config: Config,
): FactRetriever => {
  return {
    id: 'sonarcloud-fact-retriever',
    version: '1.0',
    entityFilter: [{ kind: 'component' }], // Only process entities of kind 'component'
    schema: {
      // Define the schema for the facts this retriever provides
      bugs: {
        type: 'integer',
        description: 'Number of bugs detected by SonarCloud',
      },
      code_smells: {
        type: 'integer',
        description: 'Number of code smells detected by SonarCloud',
      },
      vulnerabilities: {
        type: 'integer',
        description: 'Number of vulnerabilities detected',
      },
      code_coverage: {
        type: 'float',
        description: 'Percentage of code coverage from SonarCloud',
      },
      quality_gate: {
        type: 'string',
        description: 'Quality gate status from SonarCloud',
      },
    },
    /**
     * Handler function that retrieves SonarCloud metrics for relevant entities.
     *
     * @param ctx - Context object containing configuration, and other services
     * @returns Array of entity facts with SonarCloud metrics
     */
    handler: async ctx => {
      const {
        // config: appConfig,
        discovery,
        auth,
        entityFilter,
      } = ctx;

      // Get SonarCloud-specific configuration
      const sonarcloudConfig = config.getConfig('sonarcloud');
      const token = sonarcloudConfig.getString('token');

      // Get authentication token for catalog access
      const { token: catalogToken } = await auth.getPluginRequestToken({
        onBehalfOf: await auth.getOwnServiceCredentials(),
        targetPluginId: 'catalog',
      });

      // Create a catalog client to fetch entities
      const catalogClient = new CatalogClient({ discoveryApi: discovery });

      // Fetch all entities matching the filter
      const { items: entities } = await catalogClient.getEntities(
        { filter: entityFilter },
        { token: catalogToken },
      );

      // Filter for entities that have SonarCloud integration enabled
      // via the 'sonarcloud.io/enabled' and 'sonarcloud.io/project-key' annotations
      // in the respective repo's catalog-info.yaml file.
      const sonarcloudEntities = entities.filter(
        entity =>
          entity.metadata.annotations?.['sonarcloud.io/enabled'] === 'true' &&
          entity.metadata.annotations?.['sonarcloud.io/project-key'],
      );

      // Prepare the basic authentication token for SonarCloud API requests
      const basicAuthToken = Buffer.from(`${token}:`).toString('base64');
      const requestHeaders = {
        Authorization: `Basic ${basicAuthToken}`,
      };

      // Process each entity with SonarCloud enabled
      const results = await Promise.all(
        sonarcloudEntities.map(async entity => {
          const projectKey =
            entity.metadata.annotations?.['sonarcloud.io/project-key'];

          // Call SonarCloud API to get metrics for the project
          const response = await fetch(
            `https://sonarcloud.io/api/measures/component?component=${projectKey}&metricKeys=bugs,code_smells,vulnerabilities,coverage`,
            {
              headers: requestHeaders,
            },
          );

          // Call SonarCloud API to get Quality Gate metrics for the project
          const responseQG = await fetch(
            `https://sonarcloud.io/api/qualitygates/project_status?projectKey=${projectKey}`,
            {
              headers: requestHeaders,
            },
          );

          // Handle API error responses
          if (!response.ok || !responseQG.ok) {
            return null;
          }

          // Parse response data
          const data = await response.json();

          // Parse response data for Quality Gate
          const dataQG = await responseQG.json();

          // Extract specific metrics from the response
          const measures = data.component.measures as SonarCloudMeasure[];

          // Extract Quality Gate status
          const qgStatus = (dataQG as SonarQualityGateResponse).projectStatus
            .status;

          // Facts object to be returned
          const facts = {
            bugs: parseInt(
              measures.find((m: SonarCloudMeasure) => m.metric === 'bugs')
                ?.value ?? '0',
              10,
            ),
            code_smells: parseInt(
              measures.find(
                (m: SonarCloudMeasure) => m.metric === 'code_smells',
              )?.value ?? '0',
              10,
            ),
            vulnerabilities: parseInt(
              measures.find(
                (m: SonarCloudMeasure) => m.metric === 'vulnerabilities',
              )?.value ?? '0',
              10,
            ),
            code_coverage: parseFloat(
              measures.find((m: SonarCloudMeasure) => m.metric === 'coverage')
                ?.value ?? '0',
            ),
            quality_gate: qgStatus,
          };

          // Return facts associated with this entity
          return {
            entity: {
              name: entity.metadata.name,
              namespace: entity.metadata.namespace ?? 'default',
              kind: entity.kind,
            },
            facts: facts,
          };
        }),
      );

      // Filter out null results (failed requests)
      return results.filter(Boolean) as Array<{
        entity: { kind: string; namespace: string; name: string };
        facts: {
          bugs: number;
          code_smells: number;
          vulnerabilities: number;
          code_coverage: number;
          quality_gate: string;
        };
      }>;
    },
  };
};
