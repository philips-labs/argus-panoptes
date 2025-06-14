import { DynamicThresholdCheck } from '../argusPanoptesFactChecker/service/dynamicThresholdFactChecker';

export const BlackDuckChecks: DynamicThresholdCheck[] = [
  {
    // BlackDuck critical security risk check
    id: 'blackduck-critical-security-risk',
    name: 'BlackDuck Critical Security Risk',
    type: 'number',
    factIds: ['blackduck-fact-retriever', 'security_risks_critical'],
    annotationKeyThreshold:
      'tech-insights.io/blackduck-critical-security-risk-threshold',
    annotationKeyOperator:
      'tech-insights.io/blackduck-critical-security-risk-operator',
    description: 'Maximum allowed critical security risk from BlackDuck',
  },
  {
    // BlackDuck high security risk check
    id: 'blackduck-high-security-risk',
    name: 'BlackDuck High Security Risk',
    type: 'number',
    factIds: ['blackduck-fact-retriever', 'security_risks_high'],
    annotationKeyThreshold:
      'tech-insights.io/blackduck-high-security-risk-threshold',
    annotationKeyOperator:
      'tech-insights.io/blackduck-high-security-risk-operator',
    description: 'Maximum allowed high security risk from BlackDuck',
  },
  {
    // BlackDuck medium security risk check
    id: 'blackduck-medium-security-risk',
    name: 'BlackDuck Medium Security Risk',
    type: 'number',
    factIds: ['blackduck-fact-retriever', 'security_risks_medium'],
    annotationKeyThreshold:
      'tech-insights.io/blackduck-medium-security-risk-threshold',
    annotationKeyOperator:
      'tech-insights.io/blackduck-medium-security-risk-operator',
    description: 'Maximum allowed medium security risk from BlackDuck',
  },
];
