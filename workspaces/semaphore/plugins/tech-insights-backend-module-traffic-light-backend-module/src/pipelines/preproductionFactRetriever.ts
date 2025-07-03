/**
 * Preproduction Pipeline Fact Retriever
 * Collects metrics about GitHub Actions workflows used for preproduction deployments
 */
import {
  FactRetriever,
  TechInsightFact,
} from '@backstage-community/plugin-tech-insights-node';
import { Entity } from '@backstage/catalog-model';
import {
  WorkflowRun,
  WorkflowDefinition,
  PipelineStatusSummary,
  fetchWorkflowDefinitions,
  fetchAllWorkflowRuns,
  createGitHubHeaders,
  getRepositoryInfo,
  createPipelineFactRetrieverHandler,
} from './pipelineUtils';

// Configuration for workflow exclusion patterns
type WorkflowConfig = {
  excludePatterns: string[];
};

/**
 * Helper function to check if a workflow name matches any of the exclude patterns
 */
function shouldExcludeWorkflow(
  workflowName: string,
  excludePatterns: string[],
): boolean {
  return excludePatterns.some(pattern => {
    try {
      const regex = new RegExp(pattern, 'i'); // case-insensitive matching
      return regex.test(workflowName);
    } catch {
      return workflowName.toLowerCase().includes(pattern.toLowerCase());
    }
  });
}

/**
 * Helper function to parse workflow configuration from entity annotations
 */
function parseWorkflowConfig(entity: Entity): WorkflowConfig {
  const workflowConfig: WorkflowConfig = { excludePatterns: [] };
  // Check annotations for workflow patterns to exclude
  const excludeAnnotation =
    entity.metadata.annotations?.['preproduction/exclude'];
  if (excludeAnnotation) {
    try {
      const excludeList = JSON.parse(excludeAnnotation);
      if (Array.isArray(excludeList)) {
        workflowConfig.excludePatterns = excludeList as string[];
      }
    } catch {
      // Malformed JSON is ignored, proceed with no exclusions.
    }
  }
  return workflowConfig;
}

/**
 * Helper function to calculate all metrics from the fetched workflow data
 */
function calculatePreproductionMetrics(
  allRuns: WorkflowRun[],
  workflowDefinitions: WorkflowDefinition[],
  workflowConfig: WorkflowConfig,
): PipelineStatusSummary {
  const excludedWorkflowIds = workflowDefinitions
    .filter(workflow =>
      shouldExcludeWorkflow(workflow.name, workflowConfig.excludePatterns),
    )
    .map(workflow => workflow.id);

  // Filter out excluded workflow runs for success/failure calculations
  const nonExcludedRuns = allRuns.filter(
    run => !excludedWorkflowIds.includes(run.workflow_id),
  );

  // Calculate success and failure runs from the non-excluded runs
  const successWorkflowRunsCount = nonExcludedRuns.filter(
    run => run.status === 'completed' && run.conclusion === 'success',
  ).length;

  const failureWorkflowRunsCount = nonExcludedRuns.filter(
    run => run.status === 'completed' && run.conclusion === 'failure',
  ).length;

  // Calculate success rate as percentage
  const totalCompletedRuns =
    successWorkflowRunsCount + failureWorkflowRunsCount;
  const successRate =
    totalCompletedRuns > 0
      ? parseFloat(
          ((successWorkflowRunsCount / totalCompletedRuns) * 100).toFixed(2),
        )
      : 0;

  return {
    totalWorkflowRunsCount: allRuns.length,
    uniqueWorkflowsCount:
      workflowDefinitions.length > 0
        ? workflowDefinitions.length
        : new Set(allRuns.map(run => run.workflow_id)).size,
    successWorkflowRunsCount,
    failureWorkflowRunsCount,
    successRate,
  };
}

/**
 * Process a single entity and extract preproduction pipeline metrics
 */
async function processPreproductionEntity(
  entity: Entity,
  token?: string,
): Promise<PipelineStatusSummary | null> {
  const repoInfo = getRepositoryInfo(entity);
  if (!repoInfo) {
    return null;
  }

  const { owner, repoName } = repoInfo;
  const workflowConfig = parseWorkflowConfig(entity);
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
      };
    }

    return calculatePreproductionMetrics(
      allRuns,
      workflowDefinitions,
      workflowConfig,
    );
  } catch (error) {
    console.error(
      `Error processing preproduction entity ${entity.metadata.name}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return null;
  }
}

/**
 * Creates a fact retriever for Pre-production pipeline metrics from GitHub Actions
 */
export const githubPipelineStatusFactRetriever: FactRetriever = {
  id: 'githubPipelineStatusFactRetriever',
  version: '0.2.0', // Bumped version to reflect regex support
  entityFilter: [{ kind: 'component' }],
  schema: {
    totalWorkflowRunsCount: {
      type: 'integer',
      description:
        'Total number of workflow runs on main branch (including excluded)',
    },
    uniqueWorkflowsCount: {
      type: 'integer',
      description:
        'Number of unique workflows that have runs (matching GitHub UI)',
    },
    successWorkflowRunsCount: {
      type: 'integer',
      description:
        'Number of successful workflow runs (excluding workflows matching exclude patterns)',
    },
    failureWorkflowRunsCount: {
      type: 'integer',
      description:
        'Number of failed workflow runs (excluding workflows matching exclude patterns)',
    },
    successRate: {
      type: 'float',
      description:
        'Success rate percentage (0-100) of workflow runs (excluding workflows matching exclude patterns)',
    },
  },

  /**
   * Handler function that retrieves pipeline status metrics for relevant entities
   */
  async handler(ctx): Promise<TechInsightFact[]> {
    const pipelineContext = {
      ...ctx,
      entityFilter: githubPipelineStatusFactRetriever.entityFilter as Record<
        string,
        string
      >[],
    };
    return createPipelineFactRetrieverHandler(
      pipelineContext,
      processPreproductionEntity,
    );
  },
};
