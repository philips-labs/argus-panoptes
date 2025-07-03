import { CompoundEntityRef } from '@backstage/catalog-model';
import { TechInsightsApi } from '@backstage/plugin-tech-insights';

/**
 * Metrics returned by Foundation pipeline (GitHub Actions) for a Backstage enity.
 */
export interface FoundationPipelineMetrics {
  totalWorkflowRunsCount: number;
  uniqueWorkflowsCount: number;
  successWorkflowRunsCount: number;
  failureWorkflowRunsCount: number;
  successRate: number;
}

/**
 * Boolean check results we care about.
 */
export interface FoundationPipelineChecks {
  successRateCheck: boolean;
}

/**
 * A small utility for providing safe default objects when Foundation pipeline returns no data or an error is thrown.
 */
const DEFAULT_METRICS: FoundationPipelineMetrics = {
  totalWorkflowRunsCount: 0,
  uniqueWorkflowsCount: 0,
  successWorkflowRunsCount: 0,
  failureWorkflowRunsCount: 0,
  successRate: 0,
};

/**
 * A small utility for providing safe default objects when Foundation pipeline checks return no data or an error is thrown.
 */
const DEFAULT_CHECKS: FoundationPipelineChecks = {
  successRateCheck: false,
};

/**
 * A convenience wrapper around {@link TechInsightsApi} for reading and
 * evaluating Foundation‑pipeline data.
 */
export class FoundationUtils {
  /**
   * Fetches Foundation pipeline facts for a given entity using the Tech Insights API.
   * Returns metrics like total workflow runs, unique workflows, success count, failure count, and success rate.
   *
   * @param api - The TechInsightsApi instance used to fetch facts.
   * @param entity - The entity reference for which to fetch Foundation pipeline facts.
   * @returns An object containing Foundation pipeline metrics for the entity.
   */
  async getFoundationPipelineFacts(
    api: TechInsightsApi,
    entity: CompoundEntityRef,
  ): Promise<FoundationPipelineMetrics> {
    try {
      // fetch Foundation pipeline facts for the given entity
      const response = await api.getFacts(entity, [
        'foundationPipelineStatusFactRetriever',
      ]);

      const facts = response?.foundationPipelineStatusFactRetriever?.facts;

      if (!facts) {
        return { ...DEFAULT_METRICS };
      }

      return {
        totalWorkflowRunsCount: Number(facts.totalWorkflowRunsCount ?? 0),
        uniqueWorkflowsCount: Number(facts.uniqueWorkflowsCount ?? 0),
        successWorkflowRunsCount: Number(facts.successWorkflowRunsCount ?? 0),
        failureWorkflowRunsCount: Number(facts.failureWorkflowRunsCount ?? 0),
        successRate: Number(facts.successRate ?? 0),
      };
    } catch {
      return { ...DEFAULT_METRICS };
    }
  }

  /**
   * Runs checks on Foundation pipeline facts for a given entity using the Tech Insights API.
   * Returns the results from the checks.
   *
   * @param api - The TechInsightsApi instance used to fetch facts.
   * @param entity - The entity reference for which to fetch Foundation pipeline facts.
   * @returns An object containing the results of the checks.
   */
  async getFoundationPipelineChecks(
    api: TechInsightsApi,
    entity: CompoundEntityRef,
  ): Promise<FoundationPipelineChecks> {
    try {
      // fetch Foundation pipeline checks for the given entity
      const checkResults = await api.runChecks(entity);

      const successRateCheck = checkResults.find(
        r => r.check.id === 'foundation-success-rate',
      );

      if (checkResults.length === 0) {
        return { ...DEFAULT_CHECKS };
      }

      return {
        successRateCheck: successRateCheck?.result === true,
      };
    } catch {
      return { ...DEFAULT_CHECKS };
    }
  }
}
