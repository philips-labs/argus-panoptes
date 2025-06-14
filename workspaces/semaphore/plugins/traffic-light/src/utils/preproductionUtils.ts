import { CompoundEntityRef } from '@backstage/catalog-model';
import { TechInsightsApi } from '@backstage/plugin-tech-insights';

/**
 * Fetches Pre-production pipeline facts for a given entity using the Tech Insights API.
 * Returns the following metrics: total workflow runs count, unique workflows, success count, failure count, and success metrics.
 *
 * @param api - The TechInsightsApi instance used to fetch facts.
 * @param entity - The entity reference for which to fetch Preproduction pipeline facts.
 * @returns An object containing Preproduction pipeline metrics for the entity.
 * Shape of the metrics object returned by the GitHub‑pipeline TechInsights retriever.
 */
export interface PreproductionPipelineMetrics {
  totalWorkflowRunsCount: number;
  uniqueWorkflowsCount: number;
  successWorkflowRunsCount: number;
  failureWorkflowRunsCount: number;
  successRate: number;
}

/**
 * Boolean check results we care about.
 */
export interface PreproductionPipelineChecks {
  successRateCheck: boolean;
}

/**
 * A small utility for providing safe default objects when Preproduction pipeline returns no data or an error is thrown.
 */
const DEFAULT_METRICS: PreproductionPipelineMetrics = {
  totalWorkflowRunsCount: 0,
  uniqueWorkflowsCount: 0,
  successWorkflowRunsCount: 0,
  failureWorkflowRunsCount: 0,
  successRate: 0,
};

/**
 * A small utility for providing safe default objects when Preproduction pipeline checks return no data or an error is thrown.
 */
const DEFAULT_CHECKS: PreproductionPipelineChecks = {
  successRateCheck: false,
};

/**
 * **PreproductionPipelineInsightsService**
 *
 * A tiny wrapper around {@link TechInsightsApi} that gives you a strongly‑typed
 * way to fetch & evaluate pre‑production workflow data collected by the
 * `githubPipelineStatusFactRetriever` retriever.
 */
export class PreproductionUtils {
  // constructor() {}

  /**
   * Fetches Pre-production pipeline facts for a given entity using the Tech Insights API.
   * Returns the following metrics: total workflow runs count, unique workflows, success count, failure count, and success metrics.
   *
   * @param api - The TechInsightsApi instance used to fetch facts.
   * @param entity - The entity reference for which to fetch Preproduction pipeline facts.
   * @returns An object containing Preproduction pipeline metrics for the entity.
   */
  async getPreproductionPipelineFacts(
    api: TechInsightsApi,
    entity: CompoundEntityRef,
  ): Promise<PreproductionPipelineMetrics> {
    try {
      // Fetch facts from the Tech Insights API for the given entity and retriever
      const response = await api.getFacts(entity, [
        'githubPipelineStatusFactRetriever',
      ]);

      // Extract the facts object from the response
      const facts = response?.githubPipelineStatusFactRetriever?.facts;

      // If no facts are found, log an error and return default values
      if (!facts) {
        return { ...DEFAULT_METRICS };
      }

      // Return the parsed facts, converting to appropriate types and providing defaults
      return {
        totalWorkflowRunsCount: Number(facts.totalWorkflowRunsCount ?? 0),
        uniqueWorkflowsCount: Number(facts.uniqueWorkflowsCount ?? 0),
        successWorkflowRunsCount: Number(facts.successWorkflowRunsCount ?? 0),
        failureWorkflowRunsCount: Number(facts.failureWorkflowRunsCount ?? 0),
        successRate: Number(facts.successRate ?? 0),
      };
    } catch (error) {
      // Return default values if an error occurs
      return { ...DEFAULT_METRICS };
    }
  }

  /**
   * Runs checks on Preproduction pipeline facts for a given entity using the Tech Insights API.
   * Returns the results from the checks.
   *
   * @param api - The TechInsightsApi instance used to fetch facts.
   * @param entity - The entity reference for which to fetch Preproduction pipeline facts.
   * @returns An object containing Preproduction pipeline metrics for the entity.
   */
  async getPreproductionPipelineChecks(
    api: TechInsightsApi,
    entity: CompoundEntityRef,
  ): Promise<PreproductionPipelineChecks> {
    try {
      // Fetch Foundation pipeline checks for the given entity
      const checkResults = await api.runChecks(entity);

      // Extract the results of each checks
      const successRateCheck = checkResults.find(
        r => r.check.id === 'preproduction-success-rate',
      );

      // If no check results are found, log an error and return default values
      if (checkResults.length === 0) {
        return { ...DEFAULT_CHECKS };
      }

      // Return the parsed facts, converting to appropriate types and providing defaults
      return {
        successRateCheck: successRateCheck?.result === true,
      };
    } catch (error) {
      // Return default values if an error occurs
      return { ...DEFAULT_CHECKS };
    }
  }
}
