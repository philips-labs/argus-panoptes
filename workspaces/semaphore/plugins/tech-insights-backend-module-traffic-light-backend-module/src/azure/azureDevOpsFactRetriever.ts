/**
 * Azure DevOps Fact Retriever Module
 *
 * This module provides functionality to retrieve bug counts from Azure DevOps for components
 * in the Backstage catalog. It uses the Azure DevOps REST API to query saved WIQL queries
 * that return work items representing bugs.
 */
import { FactRetriever } from '@backstage-community/plugin-tech-insights-node';
import { Entity } from '@backstage/catalog-model';
import { CatalogClient } from '@backstage/catalog-client';

/**
 * Azure DevOps Bugs Fact Retriever
 *
 * Retrieves bug count information from Azure DevOps for catalog components.
 * Components must have the following annotations to be included:
 *   - azure.com/organization: The Azure DevOps organization
 *   - azure.com/project: The Azure DevOps project
 *   - azure.com/bugs-query-id: ID of a saved WIQL query that returns bugs
 */
export const createAzureDevOpsBugsRetriever: FactRetriever = {
  // Unique identifier for this fact retriever
  id: 'azure-devops-bugs-retriever',
  // Version of this fact retriever implementation
  version: '1.0',
  // Only process component entities
  entityFilter: [{ kind: 'component' }],
  // Define the schema for facts that this retriever produces
  schema: {
    azure_bug_count: {
      type: 'integer',
      description: 'Number of Azure DevOps bugs from WIQL query',
    },
  },
  // Handler that retrieves bug count facts from Azure DevOps
  handler: async ctx => {
    // Get authentication token for the catalog
    const { token } = await ctx.auth.getPluginRequestToken({
      onBehalfOf: await ctx.auth.getOwnServiceCredentials(),
      targetPluginId: 'catalog',
    });
    // Create catalog client to fetch entities
    const client = new CatalogClient({ discoveryApi: ctx.discovery });

    // Array to store fetched entities
    let entities: Entity[] = [];

    // Fetch all component entities from the catalog
    try {
      const response = await client.getEntities(
        { filter: { kind: 'Component' } },
        { token },
      );
      entities = response.items ?? [];
    } catch (e) {
      console.error(`Failed to fetch entities: ${e}`);
      return [];
    }

    // Get Azure DevOps configuration including the Personal Access Token
    const azureConfigs =
      ctx.config.getOptionalConfigArray('integrations.azure');
    const azureConfig = azureConfigs?.[0];
    const pat = azureConfig?.getOptionalString('token');

    // Log a warning if the Azure PAT is not defined
    if (!pat) {
      console.error('Azure DevOps token is not defined.');
    }

    // Array to store fact results for all entities
    const results = [];

    // Process each entity to retrieve Azure DevOps bug counts
    for (const entity of entities) {
      const annotations = entity.metadata.annotations ?? {};

      // Extract required Azure DevOps information from entity annotations
      const organization = annotations['azure.com/organization'];
      const project = annotations['azure.com/project'];
      const bugsQueryId = annotations['azure.com/bugs-query-id'];

      // Skip processing and return null data if required annotations are missing or no PAT
      if (!organization || !project || !bugsQueryId || !pat) {
        results.push({
          entity: {
            name: entity.metadata.name,
            namespace: entity.metadata.namespace ?? 'default',
            kind: entity.kind,
          },
          facts: {
            azure_bug_count: null,
          },
        });
        continue;
      }

      // Encode PAT for Basic Authentication
      const encodedPat = Buffer.from(`:${pat}`).toString('base64');

      try {
        // Call the Azure DevOps API to retrieve the WIQL query results
        // WIQL = Work Item Query Language - a SQL-like language for querying work items
        const response = await fetch(
          `https://dev.azure.com/${organization}/${project}/_apis/wit/wiql/${bugsQueryId}?api-version=7.0`,
          {
            method: 'GET',
            headers: {
              Authorization: `Basic ${encodedPat}`,
              Accept: 'application/json',
            },
          },
        );

        // Handle API error responses
        if (!response.ok) {
          console.error(
            `Failed to fetch WIQL results for ${entity.metadata.name}: ${response.statusText}`,
          );
          continue;
        }

        // Parse response and count the number of work items (bugs)
        const data = await response.json();
        const bugs = data.workItems ?? [];
        const bugCount = bugs.length;

        // Store the bug count fact with entity information
        results.push({
          entity: {
            name: entity.metadata.name,
            namespace: entity.metadata.namespace ?? 'default',
            kind: entity.kind,
          },
          facts: {
            azure_bug_count: bugCount,
          },
        });
      } catch (err) {
        // Log errors but continue processing other entities
        console.error(
          `Error retrieving bugs for ${entity.metadata.name}: ${err}`,
        );
      }
    }

    // Return all collected facts
    return results;
  },
};
