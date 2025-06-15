import { DynamicThresholdCheck } from '../argusPanoptesFactChecker/service/dynamicThresholdFactChecker';

export const azureBugsChecks: DynamicThresholdCheck[] = [
  {
    id: 'azure-bugs',
    name: 'Azure Bugs',
    type: 'number',
    factIds: ['azure-devops-bugs-retriever', 'azure_bug_count'],
    annotationKeyThreshold: 'tech-insights.io/azure-bugs-threshold',
    annotationKeyOperator: 'tech-insights.io/azure-bugs-operator',
    description: 'Maximum number of Azure DevOps bugs allowed',
  },
];
