import {
  FactRetriever,
  TechInsightFact,
} from '@backstage-community/plugin-tech-insights-node';
import { CatalogClient } from '@backstage/catalog-client';
import { JsonObject } from '@backstage/types';

// To include the workflows defined in the catalog entity annotations
type ReportingWorkflowConfig = {
  include: string[];
};

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

// Metrics for the last run of each workflow
interface WorkflowLastRunMetrics extends JsonObject {
  workflowName: string;
  lastRunStatus: 'success' | 'failure' | 'unknown';
  lastRunDate: string;
}

// Defines an interface for reporting pipeline status metrics based on last runs
interface ReportingPipelineStatusSummary extends JsonObject {
  workflowMetrics: WorkflowLastRunMetrics[];
  totalIncludedWorkflows: number;
  successfulRuns: number;
  failedRuns: number;
  successRate: number;
}

/**
 * Creates a fact retriever for Reporting pipeline metrics from Github Actions.
 *
 * This retriever queries GitHub Actions workflow data for specified entity of type 'component',
 * focusing only on the last run of each workflow in the reporting/workflows annotation.
 *
 * @returns A FactRetriever that collects pipeline status metrics based on last runs
 */
export const reportingPipelineStatusFactRetriever: FactRetriever = {
  id: 'reportingPipelineStatusFactRetriever',
  version: '0.2.0',
  entityFilter: [{ kind: 'component' }],
  schema: {
    workflowMetrics: {
      type: 'object',
      description:
        'Last run metrics for each reporting workflow as JSON object',
    },
    totalIncludedWorkflows: {
      type: 'integer',
      description: 'Total number of workflows included in reporting',
    },
    successfulRuns: {
      type: 'integer',
      description: 'Number of workflows with successful last runs',
    },
    failedRuns: {
      type: 'integer',
      description: 'Number of workflows with failed last runs',
    },
    successRate: {
      type: 'float',
      description: 'Success rate based on last runs of included workflows',
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

        const reportingWorkflowConfig: ReportingWorkflowConfig = {
          include: [],
        };

        // Check annotations for reporting workflows
        const reportingWorkflowsAnnotation =
          entity.metadata.annotations?.['reporting/workflows'];
        if (!reportingWorkflowsAnnotation) {
          return null;
        }

        try {
          const parsedWorkflows = JSON.parse(reportingWorkflowsAnnotation);
          if (Array.isArray(parsedWorkflows)) {
            reportingWorkflowConfig.include = parsedWorkflows as string[];
          }
        } catch (error) {
          return null;
        }

        if (reportingWorkflowConfig.include.length === 0) {
          return null;
        }

        // Workflow definition to get accurate unique workflow counts
        const workflowsApiUrl = `https://api.github.com/repos/${owner}/${repoName}/actions/workflows`;
        let workflowDefinitions: WorkflowDefinition[] = [];

        const headers: Record<string, string> = {
          Accept: 'application/vnd.github.v3+json',
        };

        if (token) {
          headers.Authorization = `token ${token}`;
        }

        try {
          const workflowsResponse = await fetch(workflowsApiUrl, { headers });

          if (workflowsResponse.ok) {
            const workflowsData = await workflowsResponse.json();
            workflowDefinitions = workflowsData.workflows || [];
          } else {
            return null;
          }
        } catch (error: any) {
          return null;
        }

        // Map workflow names to workflow IDs using the workflow definitions
        const workflowNameToIdMap = new Map<string, number>();
        workflowDefinitions.forEach(workflow => {
          workflowNameToIdMap.set(workflow.name, workflow.id);
        });

        // Get workflow IDs for the specified workflows
        const includedWorkflowIds: number[] = [];
        reportingWorkflowConfig.include.forEach(workflowName => {
          const workflowId = workflowNameToIdMap.get(workflowName);
          if (workflowId) {
            includedWorkflowIds.push(workflowId);
          }
        });

        if (includedWorkflowIds.length === 0) {
          return null;
        }

        // Get the last run for each specified workflow
        const workflowMetrics: WorkflowLastRunMetrics[] = [];

        try {
          for (const workflowId of includedWorkflowIds) {
            // Fetch the target branch from the entity annotations file
            const targetBranch =
              entity.metadata.annotations?.['reporting/target-branch'] ||
              'main';
            // Fetch the most recent run for this specific workflow on main branch
            const workflowRunsUrl = `https://api.github.com/repos/${owner}/${repoName}/actions/workflows/${workflowId}/runs?branch=${targetBranch}&per_page=1`;

            const response = await fetch(workflowRunsUrl, {
              method: 'GET',
              headers,
            });

            if (!response.ok) {
              continue;
            }

            const data = await response.json();
            const runs = data.workflow_runs as WorkflowRun[];

            if (runs.length === 0) {
              continue;
            }

            const lastRun = runs[0]; // Most recent run
            const workflowName =
              workflowDefinitions.find(w => w.id === workflowId)?.name ||
              `Workflow ID ${workflowId}`;

            let lastRunStatus: 'success' | 'failure' | 'unknown';
            if (
              lastRun.status === 'completed' &&
              lastRun.conclusion === 'success'
            ) {
              lastRunStatus = 'success';
            } else if (
              lastRun.status === 'completed' &&
              lastRun.conclusion !== 'success'
            ) {
              lastRunStatus = 'failure';
            } else {
              lastRunStatus = 'unknown';
            }

            workflowMetrics.push({
              workflowName,
              lastRunStatus,
              lastRunDate: lastRun.created_at,
            });
          }

          // Calculate success/failure counts and rate
          const successfulRuns = workflowMetrics.filter(
            metric => metric.lastRunStatus === 'success',
          ).length;
          const failedRuns = workflowMetrics.filter(
            metric => metric.lastRunStatus === 'failure',
          ).length;
          const totalWorkflows = workflowMetrics.length;
          const successRate =
            totalWorkflows > 0
              ? Math.round((successfulRuns / totalWorkflows) * 10000) / 100
              : 0;

          // Construct pipelines status summary object
          const reportingSummary: ReportingPipelineStatusSummary = {
            workflowMetrics,
            totalIncludedWorkflows: totalWorkflows,
            successfulRuns,
            failedRuns,
            successRate,
          };

          // Return the fact result object for this repo
          return {
            entity: {
              kind: entity.kind,
              namespace: entity.metadata.namespace || 'default',
              name: entity.metadata.name,
            },
            facts: reportingSummary,
          } as TechInsightFact;
        } catch (error: any) {
          return null;
        }
      }),
    );

    // Filter null results and ensure they match TechInsightFact type
    const validResults = results.filter(
      (r): r is TechInsightFact => r !== null,
    );
    return validResults;
  },
};
