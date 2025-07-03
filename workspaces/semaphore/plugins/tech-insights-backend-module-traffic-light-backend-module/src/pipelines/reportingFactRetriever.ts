/**
 * Reporting Pipeline Fact Retriever
 * Collects metrics about GitHub Actions workflows used for reporting
 */
import {
  FactRetriever,
  TechInsightFact,
} from '@backstage-community/plugin-tech-insights-node';
import { Entity, stringifyEntityRef } from '@backstage/catalog-model';
import {
  WorkflowLastRunMetrics,
  ReportingPipelineStatusSummary,
  fetchWorkflowDefinitions,
  fetchLastRun,
  createGitHubHeaders,
  getRepositoryInfo,
  createPipelineFactRetrieverHandler,
} from './pipelineUtils';

// Configuration for reporting workflows
type ReportingWorkflowConfig = {
  include: string[];
};

/**
 * Helper to parse and validate the reporting workflow config from annotations
 */
function parseReportingConfig(
  entity: Entity,
  logger: Console,
): ReportingWorkflowConfig | null {
  // Check annotations for reporting workflows
  const annotation = entity.metadata.annotations?.['reporting/workflows'];
  if (!annotation) {
    return null;
  }
  try {
    const include = JSON.parse(annotation);
    if (Array.isArray(include) && include.length > 0) {
      return { include };
    }
  } catch (error) {
    if (error instanceof Error) {
      logger.warn(
        `Malformed 'reporting/workflows' annotation for entity ${stringifyEntityRef(
          entity,
        )}: ${error.message}`,
      );
    } else {
      logger.warn(
        `Malformed 'reporting/workflows' annotation for entity ${stringifyEntityRef(
          entity,
        )} with an unknown error.`,
      );
    }
    return null; // Ignore malformed JSON
  }
  return null;
}

/**
 * Helper to calculate the final summary metrics
 */
function calculateReportingMetrics(
  workflowMetrics: WorkflowLastRunMetrics[],
): ReportingPipelineStatusSummary {
  // Calculate success/failure counts and rate
  const successfulRuns = workflowMetrics.filter(
    m => m.lastRunStatus === 'success',
  ).length;
  const failedRuns = workflowMetrics.filter(
    m => m.lastRunStatus === 'failure',
  ).length;
  const totalWorkflows = workflowMetrics.length;
  const successRate =
    totalWorkflows > 0
      ? Math.round((successfulRuns / totalWorkflows) * 10000) / 100
      : 0;

  return {
    workflowMetrics,
    totalIncludedWorkflows: totalWorkflows,
    successfulRuns,
    failedRuns,
    successRate,
  };
}

/**
 * Process a single entity and extract reporting pipeline metrics
 */
async function processReportingEntity(
  entity: Entity,
  token?: string,
): Promise<ReportingPipelineStatusSummary | null> {
  const repoInfo = getRepositoryInfo(entity);
  if (!repoInfo) {
    return null;
  }

  const { owner, repoName } = repoInfo;
  const reportingConfig = parseReportingConfig(entity, console);
  if (!reportingConfig) {
    return null;
  }

  const headers = createGitHubHeaders(token);

  try {
    const loggerAdapter = {
      ...console,
      child: () => loggerAdapter,
    };
    const workflowDefinitions = await fetchWorkflowDefinitions(
      owner,
      repoName,
      headers,
      loggerAdapter,
    );
    if (!workflowDefinitions || workflowDefinitions.length === 0) {
      return null;
    }

    // Map workflow names to workflow IDs using the workflow definitions
    const workflowNameToIdMap = new Map<string, number>();
    workflowDefinitions.forEach(workflow => {
      workflowNameToIdMap.set(workflow.name, workflow.id);
    });

    // Get workflow IDs for the specified workflows
    const includedWorkflowIds = reportingConfig.include
      .map(name => workflowNameToIdMap.get(name))
      .filter((id): id is number => id !== undefined);

    if (includedWorkflowIds.length === 0) {
      return null;
    }

    // Fetch the target branch from the entity annotations file
    const targetBranch =
      entity.metadata.annotations?.['reporting/target-branch'] ?? 'main';

    const workflowMetricsPromises = includedWorkflowIds.map(
      async workflowId => {
        const lastRun = await fetchLastRun(
          owner,
          repoName,
          workflowId,
          targetBranch,
          headers,
        );
        if (!lastRun) return null;

        const workflowName =
          workflowDefinitions.find(w => w.id === workflowId)?.name ??
          `Workflow ID ${workflowId}`;
        let lastRunStatus: 'success' | 'failure' | 'unknown' = 'unknown';
        if (lastRun.status === 'completed') {
          lastRunStatus =
            lastRun.conclusion === 'success' ? 'success' : 'failure';
        }

        return {
          workflowName,
          lastRunStatus,
          lastRunDate: lastRun.created_at,
        };
      },
    );

    const workflowMetrics = (await Promise.all(workflowMetricsPromises)).filter(
      (m): m is WorkflowLastRunMetrics => m !== null,
    );

    return calculateReportingMetrics(workflowMetrics);
  } catch (error) {
    console.error(
      `Error processing reporting entity ${stringifyEntityRef(entity)}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return null;
  }
}

/**
 * Creates a fact retriever for Reporting pipeline metrics from Github Actions
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
   * Handler function that retrieves pipeline status metrics for relevant entities
   */
  async handler(ctx): Promise<TechInsightFact[]> {
    // Create a context with properly typed entityFilter
    const pipelineContext = {
      ...ctx,
      entityFilter: reportingPipelineStatusFactRetriever.entityFilter as Record<
        string,
        string
      >[],
    };
    return createPipelineFactRetrieverHandler(
      pipelineContext,
      processReportingEntity,
    );
  },
};
