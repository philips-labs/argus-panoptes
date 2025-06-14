import { DynamicThresholdCheck } from '../argusPanoptesFactChecker/service/dynamicThresholdFactChecker';

export const reportingPipelineChecks: DynamicThresholdCheck[] = [
  {
    id: 'reporting-success-rate',
    name: 'Reporting Pipeline Success Rate',
    type: 'percentage',
    factIds: ['reportingPipelineStatusFactRetriever', 'overallSuccessRate'],
    annotationKeyThreshold: 'tech-insights.io/reporting-success-rate-threshold',
    annotationKeyOperator: 'tech-insights.io/reporting-success-rate-operator',
    description:
      'Minimum pipeline success rate required for reporting components',
  },
];
