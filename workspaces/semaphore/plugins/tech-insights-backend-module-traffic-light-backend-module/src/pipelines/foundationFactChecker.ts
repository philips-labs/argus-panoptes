import { DynamicThresholdCheck } from '../argusPanoptesFactChecker/service/dynamicThresholdFactChecker';

export const foundationPipelineChecks: DynamicThresholdCheck[] = [
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
