/**
 * Foundation Pipeline Fact Retriever
 * Collects metrics about GitHub Actions workflows used for foundation builds
 */
import {
  FactRetriever,
  TechInsightFact,
} from '@backstage-community/plugin-tech-insights-node';
import { Entity } from '@backstage/catalog-model';
import {
  WorkflowRun,
  WorkflowDefinition,
  WorkflowMetrics,
  FoundationPipelineStatusSummary,
  fetchWorkflowDefinitions,
  fetchAllWorkflowRuns,
  createGitHubHeaders,
  getRepositoryInfo,
  createPipelineFactRetrieverHandler,
} from './pipelineUtils';

/**
 * Helper function to calculate workflow metrics from the fetched workflow data
 */
function calculateWorkflowMetrics(
  allRuns: WorkflowRun[],
  workflowDefinitions: WorkflowDefinition[],
): FoundationPipelineStatusSummary {
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
  const completedRuns = successWorkflowRunsCount + failureWorkflowRunsCount;
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
      workflowIdToName.get(workflowId) ??
      runs[0]?.name ??
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

  return {
    totalWorkflowRunsCount,
    uniqueWorkflowsCount,
    successWorkflowRunsCount,
    failureWorkflowRunsCount,
    successRate,
    workflowMetrics,
  };
}

/**
 * Process a single entity and extract foundation pipeline metrics
 */
async function processFoundationEntity(
  entity: Entity,
  token?: string,
): Promise<FoundationPipelineStatusSummary | null> {
  const repoInfo = getRepositoryInfo(entity);
  if (!repoInfo) {
    return null;
  }

  const { owner, repoName } = repoInfo;
  const headers = createGitHubHeaders(token);

  try {
    const loggerAdapter = {
      ...console,
      child: () => loggerAdapter,
    };

    const [workflowDefinitions, allRuns] = await Promise.all([
      fetchWorkflowDefinitions(owner, repoName, headers, loggerAdapter),
      fetchAllWorkflowRuns(owner, repoName, headers),
    ]);

    if (allRuns.length === 0) {
      return {
        totalWorkflowRunsCount: 0,
        uniqueWorkflowsCount: workflowDefinitions.length,
        successWorkflowRunsCount: 0,
        failureWorkflowRunsCount: 0,
        successRate: 0,
        workflowMetrics: {},
      };
    }

    // Construct pipelines status summary object
    return calculateWorkflowMetrics(allRuns, workflowDefinitions);
  } catch (error) {
    // Log the error before returning null
    console.error(
      `Error processing foundation entity ${entity.metadata.name}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return null;
  }
}

/**
 * Creates a fact retriever for Foundation pipeline metrics from Github Actions
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
   * Handler function that retrieves pipeline status metrics for relevant entities
   */
  async handler(ctx): Promise<TechInsightFact[]> {
    // Create a context with properly typed entityFilter
    const pipelineContext = {
      ...ctx,
      entityFilter:
        foundationPipelineStatusFactRetriever.entityFilter as Record<
          string,
          string
        >[],
    };
    return createPipelineFactRetrieverHandler(
      pipelineContext,
      processFoundationEntity,
    );
  },
};
