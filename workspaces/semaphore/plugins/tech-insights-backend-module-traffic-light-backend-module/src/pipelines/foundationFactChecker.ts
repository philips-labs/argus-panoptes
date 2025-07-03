import { DynamicThresholdCheck } from '../argusPanoptesFactChecker/service/dynamicThresholdFactChecker';

/**
 * Array of threshold check configurations for foundation pipeline metrics
 * These checks evaluate if foundation components meet specified criteria for
 * pipeline stability and reliability.
 */
export const foundationPipelineChecks: DynamicThresholdCheck[] = [
  /**
   * Foundation Pipeline Success Rate Check
   *
   * Evaluates if the pipeline success rate meets the minimum required threshold.
   * A high success rate indicates reliable build processes and stable foundation components.
   *
   * @property {string} id - Unique identifier for this check
   * @property {string} name - Display name for this check
   * @property {string} type - Data type for comparison (percentage)
   * @property {string[]} factIds - References to fact retriever and specific metric
   * @property {string} annotationKeyThreshold - Entity annotation key for threshold value
   * @property {string} annotationKeyOperator - Entity annotation key for comparison operator
   * @property {string} description - Human-readable purpose of this check
   */
  {
    id: 'foundation-success-rate',
    name: 'Foundation Pipeline Success Rate',
    type: 'percentage',
    factIds: ['foundationPipelineStatusFactRetriever', 'successRate'],
    annotationKeyThreshold:
      'tech-insights.io/foundation-success-rate-threshold',
    annotationKeyOperator: 'tech-insights.io/foundation-success-rate-operator',
    description:
      'Minimum pipeline success rate required for foundation components',
  },

  /**
   * Foundation Pipeline Maximum Failures Check
   *
   * Evaluates if the number of failed pipeline runs is below the maximum allowed threshold.
   * Keeping failure counts low ensures foundation components remain reliable and stable.
   *
   * @property {string} id - Unique identifier for this check
   * @property {string} name - Display name for this check
   * @property {string} type - Data type for comparison (number)
   * @property {string[]} factIds - References to fact retriever and specific metric
   * @property {string} annotationKeyThreshold - Entity annotation key for threshold value
   * @property {string} annotationKeyOperator - Entity annotation key for comparison operator
   * @property {string} description - Human-readable purpose of this check
   */
  {
    id: 'foundation-max-failures',
    name: 'Foundation Pipeline Max Failures',
    type: 'number',
    factIds: [
      'foundationPipelineStatusFactRetriever',
      'failureWorkflowRunsCount',
    ],
    annotationKeyThreshold:
      'tech-insights.io/foundation-max-failures-threshold',
    annotationKeyOperator: 'tech-insights.io/foundation-max-failures-operator',
    description:
      'Maximum number of failed workflow runs allowed for foundation components',
  },
];
