import { DynamicThresholdCheck } from '../argusPanoptesFactChecker/service/dynamicThresholdFactChecker';

/**
 * Threshold checks for preproduction pipeline performance metrics
 * Used to determine traffic light status for deployment readiness
 */
export const preproductionPipelineChecks: DynamicThresholdCheck[] = [
  {
    // Success rate check - evaluates pipeline stability before production deployment
    id: 'preproduction-success-rate',
    name: 'Preproduction Pipeline Success Rate',
    type: 'percentage',
    factIds: ['githubPipelineStatusFactRetriever', 'successRate'],
    annotationKeyThreshold:
      'tech-insights.io/preproduction-success-rate-threshold',
    annotationKeyOperator:
      'tech-insights.io/preproduction-success-rate-operator',
    description:
      'Minimum pipeline success rate required for preproduction components',
  },
];
