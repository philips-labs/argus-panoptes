import { Config } from '@backstage/config';
import { FactRetriever } from '@backstage-community/plugin-tech-insights-node';
import { CatalogClient } from '@backstage/catalog-client';

type META = {
  allow: [];
  href: string;
  links: [];
};

// Define the types for Black Duck project and version details
type BD_PROJECT_DETAIL = {
  name: string;
  projectLevelAdjustments: string;
  cloneCategories: [];
  customSignatureEnabled: string;
  customSignatureDepth: string;
  deepLicenseDataEnabled: string;
  snippetAdjustmentApplied: string;
  licenseConflictsEnabled: string;
  projectGroup: string;
  createdAt: string;
  createdBy: string;
  createdByUser: string;
  updatedAt: string;
  updatedBy: string;
  updatedByUser: string;
  source: string;
  _meta: META;
};

type BD_VERISON_DETAIL = {
  versionName: string;
  phase: string;
  distribution: string;
  license: [];
  createdAt: string;
  createdBy: string;
  createdByUser: string;
  settingUpdatedAt: string;
  settingUpdatedBy: string;
  settingUpdatedByUser: string;
  source: string;
  _meta: META;
};

// Define the type for the Black Duck REST API response
type BD_REST_API_RESPONSE<T> = {
  totalCount: number;
  items: T[];
  appliedFilters: [];
  _meta: META;
};

/**
 * Creates a fact retriever for Black Duck security risk metrics.
 *
 * @param config - The Backstage application configuration
 * @returns A FactRetriever for Black Duck
 */
export const createBlackDuckFactRetriever = (config: Config): FactRetriever => {
  return {
    // define the fact retriever schema
    id: 'blackduck-fact-retriever',
    version: '1.0',
    entityFilter: [{ kind: 'component' }],
    schema: {
      security_risks_critical: {
        type: 'integer',
        description: 'Number of critical security risks found by Black Duck',
      },
      security_risks_high: {
        type: 'integer',
        description: 'Number of high severity security risks',
      },
      security_risks_medium: {
        type: 'integer',
        description: 'Number of medium severity security risks',
      },
    },
    handler: async ctx => {
      const { discovery, auth, entityFilter } = ctx;

      // Get the Black Duck configuration
      const blackduckConfig = config.getConfig('blackduck');
      const apiToken = blackduckConfig.getString('token');
      const host = blackduckConfig.getString('host'); // e.g., 'https://your-blackduck-instance.com'

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

      // Filter for entities that have BlackDuck integration enabled
      // via the 'blackduck.io/enabled', 'blackduck.io/project-name' and 'blackduck.io/project-version' annotations
      // in the respective repo's catalog-info.yaml file.
      const blackduckEntities = entities.filter(
        entity =>
          entity.metadata.annotations?.['blackduck.io/enabled'] === 'true' &&
          entity.metadata.annotations?.['blackduck.io/project-name'] &&
          entity.metadata.annotations?.['blackduck.io/project-version'],
      );

      // Process each entity with BlackDuck enabled
      const results = await Promise.all(
        blackduckEntities.map(async entity => {
          // Extract project name and version from annotations
          const projectName =
            entity.metadata.annotations?.['blackduck.io/project-name'];
          const projectVersion =
            entity.metadata.annotations?.['blackduck.io/project-version'];

          try {
            // Retrieve the project from Black Duck
            const projectQuery = `name:${projectName}`;
            const projectRes = await fetch(
              `${host}/projects?limit=999&q=${encodeURIComponent(
                projectQuery,
              )}`,
              {
                method: 'GET',
                headers: {
                  Authorization: `Bearer ${apiToken}`,
                  Accept:
                    'application/vnd.blackducksoftware.project-detail-4+json',
                  'Content-Type': 'application/json',
                },
              },
            );

            // Show an error if the project is not retrieved successfully
            if (!projectRes.ok) {
              return null;
            }

            // Parse the project response
            const project =
              (await projectRes.json()) as BD_REST_API_RESPONSE<BD_PROJECT_DETAIL>;

            // Find the project detail by name
            const projectDetail = project.items.find(
              item => item.name === projectName,
            );

            // If projectDetail is not found, log an error
            if (projectDetail === undefined) {
              return null;
            }

            // Retrieve the project version from Black Duck
            const versionQuery = `versionName:${projectVersion}`;
            const versionRes = await fetch(
              `${
                projectDetail._meta.href
              }/versions?limit=999&q=${encodeURIComponent(versionQuery)}`,
              {
                method: 'GET',
                headers: {
                  Authorization: `Bearer ${apiToken}`,
                  Accept:
                    'application/vnd.blackducksoftware.project-detail-5+json',
                  'Content-Type': 'application/json',
                },
              },
            );

            // Show an error if the project versionis not retrieved successfully
            if (!versionRes.ok) {
              return null;
            }

            // Parse the version response
            // Parse the version response with the correct generic type
            const version =
              (await versionRes.json()) as BD_REST_API_RESPONSE<BD_VERISON_DETAIL>;

            // Find the version detail by version name
            const versionDetail = version.items.find(
              item => item.versionName === projectVersion,
            );
            // If versionDetail is not found, log an error
            if (versionDetail === undefined) {
              return null;
            }

            // Fetch the risk profile for the project version
            const risk_profile_url = `${versionDetail._meta.href}/risk-profile`;
            const riskProfileRes: any = await fetch(risk_profile_url, {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${apiToken}`,
                // Accept: 'application/vnd.blackducksoftware.component-detail-5+json',
                'Content-Type': 'application/json',
              },
            });

            // Show an error if the risk profile is not retrieved successfully
            if (!riskProfileRes.ok) {
              return null;
            }

            // Parse the risk profile response
            const riskProfile = await riskProfileRes.json();

            // Extract security risk facts from the risk profile
            const facts = {
              security_risks_critical:
                riskProfile?.categories.SECURITY.CRITICAL ?? 0,
              security_risks_high: riskProfile?.categories.SECURITY.HIGH ?? 0,
              security_risks_medium:
                riskProfile?.categories.SECURITY.MEDIUM ?? 0,
            };

            // Return the facts associated with this entity
            return {
              entity: {
                name: entity.metadata.name,
                namespace: entity.metadata.namespace ?? 'default',
                kind: entity.kind,
              },
              facts,
            };
          } catch {
            return null;
          }
        }),
      );

      return results.filter(Boolean) as Array<{
        entity: { kind: string; namespace: string; name: string };
        facts: {
          security_risks_critical: number;
          security_risks_high: number;
          security_risks_medium: number;
        };
      }>;
    },
  };
};
