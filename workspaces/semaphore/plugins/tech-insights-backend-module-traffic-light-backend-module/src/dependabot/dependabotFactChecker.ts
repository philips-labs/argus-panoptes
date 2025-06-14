import { DynamicThresholdCheck } from '../argusPanoptesFactChecker/service/dynamicThresholdFactChecker';

export const DependabotChecks: DynamicThresholdCheck[] = [
  {
    id: 'dependabot-critical-alerts',
    name: 'Dependabot Critical Alerts Count',
    type: 'number',
    factIds: ['dependabotFactRetriever', 'critical'],
    annotationKeyThreshold:
      'tech-insights.io/dependabot-critical-alert-threshold',
    annotationKeyOperator: 'tech-insights.io/dependabot-operator',
    description: 'Maximum number of critical Dependabot alerts allowed',
  },
  {
    id: 'dependabot-high-alerts',
    name: 'Dependabot High Alerts Count',
    type: 'number',
    factIds: ['dependabotFactRetriever', 'high'],
    annotationKeyThreshold: 'tech-insights.io/dependabot-high-alert-threshold',
    annotationKeyOperator: 'tech-insights.io/dependabot-operator',
    description: 'Maximum number of high Dependabot alerts allowed',
  },
  {
    id: 'dependabot-medium-alerts',
    name: 'Dependabot Medium Alerts Count',
    type: 'number',
    factIds: ['dependabotFactRetriever', 'medium'],
    annotationKeyThreshold:
      'tech-insights.io/dependabot-medium-alert-threshold',
    annotationKeyOperator: 'tech-insights.io/dependabot-operator',
    description: 'Maximum number of medium Dependabot alerts allowed',
  },
];
