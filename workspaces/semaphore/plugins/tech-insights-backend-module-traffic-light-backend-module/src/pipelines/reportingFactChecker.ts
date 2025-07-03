import { DynamicThresholdCheck } from '../argusPanoptesFactChecker/service/dynamicThresholdFactChecker';

/**
 * Threshold checks for reporting pipeline metrics
 * Used to determine traffic light status for reporting system health
 */
export const reportingPipelineChecks: DynamicThresholdCheck[] = [
  {
    // Success rate check - evaluates reliability of report generation pipelines
    id: 'reporting-success-rate',
    name: 'Reporting Pipeline Success Rate',
    type: 'percentage',
    factIds: ['reportingPipelineStatusFactRetriever', 'successRate'],
    annotationKeyThreshold: 'tech-insights.io/reporting-success-rate-threshold',
    annotationKeyOperator: 'tech-insights.io/reporting-success-rate-operator',
    description:
      'Minimum pipeline success rate required for reporting components',
  },
];
