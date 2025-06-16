import {
  FactRetriever,
  TechInsightFact,
} from '@backstage-community/plugin-tech-insights-node';
import { CatalogClient } from '@backstage/catalog-client';
import { JsonObject } from '@backstage/types';

// Represents a single workflow run from Github Actions API
type WorkflowRun = {
  name: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  head_branch: string;
  workflow_id: number;
};

// Represents a workflow definition from GitHub API
type WorkflowDefinition = {
  id: number;
  name: string;
  path: string;
};

// Metrics for each each workflow
type WorkflowMetrics = {
  name: string;
  totalRuns: number;
  successRuns: number;
  failureRuns: number;
  successRate: number;
};

// Defines an interface for foundation pipeline status metrics
interface PipelineStatusSummary extends JsonObject {
  totalWorkflowRunsCount: number;
  uniqueWorkflowsCount: number;
  successWorkflowRunsCount: number;
  failureWorkflowRunsCount: number;
  successRate: number;
  workflowMetrics: Record<string, WorkflowMetrics>;
}

/**
 * Creates a fact retriever for Foundation pipeline metrics from Github Actions.
 *
 * This retriever queries GitHub Actions workflow data for specified entity of type 'component'.
 *
 * @returns A FactRetriever that collects pipeline status metrics
 */
export const foundationPipelineStatusFactRetriever: FactRetriever = {
  id: 'foundationPipelineStatusFactRetriever',
  version: '0.1.0',
  entityFilter: [{ kind: 'component' }],
  schema: {
    totalWorkflowRunsCount: {
      type: 'integer',
      description: 'Total number of workflow runs on main branch',
    },
    uniqueWorkflowsCount: {
      type: 'integer',
      description:
        'Number of unique workflows that have runs (matching GitHub UI)',
    },
    successWorkflowRunsCount: {
      type: 'integer',
      description: 'Number of successful workflow runs',
    },
    failureWorkflowRunsCount: {
      type: 'integer',
      description: 'Number of failed workflow runs',
    },
    successRate: {
      type: 'float',
      description: 'Success rate percentage of workflows (0-100)',
    },
    workflowMetrics: {
      type: 'object',
      description: 'Detailed metrics for each individual workflow',
    },
  },

  /**
   * Handler function that retrieves pipeline status metrics for relevant entities.
   *
   * @param ctx - Context object containing configuration, logger, and other services
   * @returns Array of entity facts with pipeline status metrics
   */
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
    } catch (e) {
      return [];
    }

    // Get catalog access token for fetching entities
    const { token: catalogToken } = await auth.getPluginRequestToken({
      onBehalfOf: await auth.getOwnServiceCredentials(),
      targetPluginId: 'catalog',
    });

    const catalogClient = new CatalogClient({ discoveryApi: discovery });

    // Fetch entities matching the provided filter
    const { items: entities } = await catalogClient.getEntities(
      { filter: entityFilter },
      { token: catalogToken },
    );

    // Filter entities that have GitHub repositories
    const githubEntities = entities.filter(entity => {
      const slug = entity.metadata.annotations?.['github.com/project-slug'];
      return !!slug;
    });

    // Process each Github-enabled component
    const results = await Promise.all(
      githubEntities.map(async entity => {
        // Parse the github repo information from entity annotations
        const projectSlug =
          entity.metadata.annotations?.['github.com/project-slug'] || '';
        const [owner, repoName] = projectSlug.split('/');

        if (!owner || !repoName) {
          return null;
        }

        // API calls to get the workflow definitions first
        const workflowsApiUrl = `https://api.github.com/repos/${owner}/${repoName}/actions/workflows`;

        const headers: Record<string, string> = {
          Accept: 'application/vnd.github.v3+json',
        };

        if (token) {
          headers.Authorization = `token ${token}`;
        }

        // Workflow definition to get accurate unique workflow counts
        let workflowDefinitions: WorkflowDefinition[] = [];

        try {
          const workflowsResponse = await fetch(workflowsApiUrl, { headers });

          if (workflowsResponse.ok) {
            const workflowsData = await workflowsResponse.json();
            workflowDefinitions = workflowsData.workflows || [];
          }
        } catch (error: any) {
          // If fetching workflow definitions fails, proceed without them.
          // The retriever can still function by deriving workflow names from runs.
        }

        // Fetch all workflow runs from the main branch using pagination
        const apiUrl = `https://api.github.com/repos/${owner}/${repoName}/actions/runs?branch=main&per_page=100`;

        try {
          let page = 1;
          let hasMorePages = true;
          let allRuns: WorkflowRun[] = [];
          const maxPages = 30; // Limit to 30 pages to avoid excessive API calls

          // Paginate through all workflow runs
          while (hasMorePages && page <= maxPages) {
            const pageUrl = `${apiUrl}&page=${page}`;

            const response = await fetch(pageUrl, {
              method: 'GET',
              headers,
            });

            if (!response.ok) {
              break;
            }

            const data = await response.json();
            const pageRuns = data.workflow_runs as WorkflowRun[];

            allRuns = [...allRuns, ...pageRuns];

            // To check if we need to fetch more pages
            if (pageRuns.length < 100) {
              hasMorePages = false;
            } else {
              // Check for Link header with 'next' relation to confirm more pages
              const linkHeader = response.headers.get('Link');
              hasMorePages = linkHeader
                ? linkHeader.includes('rel="next"')
                : false;
            }

            page++;
          }

          // Filter for only main branch runs
          const mainBranchRuns = allRuns.filter(
            run => run.head_branch === 'main',
          );
          allRuns = mainBranchRuns;

          // Handle case where no workflow runs are found and return early with empty data
          if (allRuns.length === 0) {
            return {
              entity: {
                kind: entity.kind,
                namespace: entity.metadata.namespace || 'default',
                name: entity.metadata.name,
              },
              facts: {
                totalWorkflowRunsCount: 0,
                uniqueWorkflowsCount: workflowDefinitions.length, // Use actual definition count
                successWorkflowRunsCount: 0,
                failureWorkflowRunsCount: 0,
                successRate: 0,
                workflowMetrics: {},
              } as PipelineStatusSummary,
            } as TechInsightFact;
          }

          // Count all workflow runs on main branch
          const totalWorkflowRunsCount = allRuns.length;

          // Unique workflows
          const uniqueWorkflowsCount =
            workflowDefinitions.length > 0
              ? workflowDefinitions.length
              : new Set(allRuns.map(run => run.workflow_id)).size;

          // Count successful and failed runs
          const successWorkflowRunsCount = allRuns.filter(
            run => run.status === 'completed' && run.conclusion === 'success',
          ).length;

          const failureWorkflowRunsCount = allRuns.filter(
            run => run.status === 'completed' && run.conclusion === 'failure',
          ).length;

          // Calculate success rate
          const completedRuns =
            successWorkflowRunsCount + failureWorkflowRunsCount;
          const successRate =
            completedRuns > 0
              ? Math.round((successWorkflowRunsCount / completedRuns) * 100)
              : 0;

          // Detailed metrics for each individual workflow (stored in a dictionary)
          const workflowMetrics: Record<string, WorkflowMetrics> = {};

          // Map workflow IDs to workflow names using the workflow definitions
          const workflowIdToName = new Map<number, string>();
          workflowDefinitions.forEach(workflow => {
            workflowIdToName.set(workflow.id, workflow.name);
          });

          // Group runs by workflow ID
          const runsByWorkflowId = new Map<number, WorkflowRun[]>();
          allRuns.forEach(run => {
            const workflowRuns = runsByWorkflowId.get(run.workflow_id) || [];
            workflowRuns.push(run);
            runsByWorkflowId.set(run.workflow_id, workflowRuns);
          });

          // Calculate metrics for each workflow
          runsByWorkflowId.forEach((runs, workflowId) => {
            const workflowName =
              workflowIdToName.get(workflowId) ||
              runs[0]?.name ||
              `workflow-${workflowId}`;

            const totalRuns = runs.length;
            const successRuns = runs.filter(
              run => run.status === 'completed' && run.conclusion === 'success',
            ).length;
            const failureRuns = runs.filter(
              run => run.status === 'completed' && run.conclusion === 'failure',
            ).length;

            const workflowCompletedRuns = successRuns + failureRuns;
            const workflowSuccessRate =
              workflowCompletedRuns > 0
                ? Math.round((successRuns / workflowCompletedRuns) * 100)
                : 0;

            // Create safe key for the metrics object from workflow name
            const safeKey = workflowName.replace(/[^a-zA-Z0-9]/g, '_');

            workflowMetrics[safeKey] = {
              name: workflowName,
              totalRuns,
              successRuns,
              failureRuns,
              successRate: workflowSuccessRate,
            };
          });

          // Construct pipelines status summary object
          const pipelineSummary: PipelineStatusSummary = {
            totalWorkflowRunsCount,
            uniqueWorkflowsCount,
            successWorkflowRunsCount,
            failureWorkflowRunsCount,
            successRate,
            workflowMetrics,
          };

          // Return the fact result object for this repo
          return {
            entity: {
              kind: entity.kind,
              namespace: entity.metadata.namespace || 'default',
              name: entity.metadata.name,
            },
            facts: pipelineSummary,
          } as TechInsightFact;
        } catch (error: any) {
          return null;
        }
      }),
    );

    // Filter out null results and return valid pipeline metrics
    const validResults = results.filter(
      (r): r is TechInsightFact => r !== null,
    );
    return validResults;
  },
};
