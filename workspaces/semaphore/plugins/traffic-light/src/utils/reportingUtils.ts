import { CompoundEntityRef } from '@backstage/catalog-model';
import { TechInsightsApi } from '@backstage/plugin-tech-insights';

/**
 * Metrics returned by Reporting pipeline (Github Actions) for a Backstage entity.
 */
export interface ReportingPipelineMetrics {
  workflowMetrics: object;
  totalIncludedWorkflows: number;
  successfulRuns: number;
  failedRuns: number;
  successRate: number;
}

/**
 * Boolean check results we care about.
 */
export interface ReportingPipelineChecks {
  successRateCheck: boolean;
}

/**
 * A small utility for providing safe default objects when Reporting pipeline returns no data or an error is thrown.
 */
const DEFAULT_METRICS: ReportingPipelineMetrics = {
  workflowMetrics: {},
  totalIncludedWorkflows: 0,
  successfulRuns: 0,
  failedRuns: 0,
  successRate: 0,
};

/**
 * A small utility for providing safe default objects when Reporting pipeline checks return no data or an error is thrown.
 */
const DEFAULT_CHECKS: ReportingPipelineChecks = {
  successRateCheck: false,
};

/**
 * A convenience wrapper around {@link TechInsightsApi} for reading and
 * evaluating Reporting‑pipeline data.
 */
export class ReportingUtils {
  // constructor() {}

  /**
   * Fetches Reporting pipeline facts for a given entity using the Tech Insights API.
   * Returns metrics like total workflow runs, unique workflows, success count, failure count, and success rate.
   *
   * @param api - The TechInsightsApi instance used to fetch facts.
   * @param entity - The entity reference for which to fetch Reporting pipeline facts.
   * @returns An object containing Reporting pipeline metrics for the entity.
   */
  async getReportingPipelineFacts(
    api: TechInsightsApi,
    entity: CompoundEntityRef,
  ): Promise<ReportingPipelineMetrics> {
    try {
      // Fetch Reporting pipeline facts for the given entity
      const response = await api.getFacts(entity, [
        'reportingPipelineStatusFactRetriever',
      ]);

      const facts = response?.reportingPipelineStatusFactRetriever?.facts;

      if (!facts) {
        return { ...DEFAULT_METRICS };
      }

      return {
        workflowMetrics: Object(facts.workflowMetrics ?? {}),
        totalIncludedWorkflows: Number(facts.totalIncludedWorkflows ?? 0),
        successfulRuns: Number(facts.successfulRuns ?? 0),
        failedRuns: Number(facts.failedRuns ?? 0),
        successRate: Number(facts.successRate ?? 0),
      };
    } catch (error) {
      return { ...DEFAULT_METRICS };
    }
  }

  /**
   * Runs checks on Reporting pipeline facts for a given entity using the Tech Insights API.
   * Returns the results from the checks.
   *
   * @param api - The TechInsightsApi instance used to fetch facts.
   * @param entity - The entity reference for which to fetch Reporting pipeline facts.
   * @returns An object containing the results of the checks.
   */
  async getReportingPipelineChecks(
    api: TechInsightsApi,
    entity: CompoundEntityRef,
  ): Promise<ReportingPipelineChecks> {
    try {
      // Fetch Reporting pipeline checks for the given entity
      const checkResults = await api.runChecks(entity);

      const successRateCheck = checkResults.find(
        r => r.check.id === 'reporting-success-rate',
      );

      if (checkResults.length === 0) {
        return { ...DEFAULT_CHECKS };
      }

      return {
        successRateCheck: successRateCheck?.result === true,
      };
    } catch (error) {
      return { ...DEFAULT_CHECKS };
    }
  }
}
