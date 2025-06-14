import { DynamicThresholdCheck } from '../argusPanoptesFactChecker/service/dynamicThresholdFactChecker';

export const preproductionPipelineChecks: DynamicThresholdCheck[] = [
  {
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
