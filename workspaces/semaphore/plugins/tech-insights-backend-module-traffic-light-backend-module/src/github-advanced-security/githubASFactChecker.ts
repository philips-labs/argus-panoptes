import { DynamicThresholdCheck } from '../argusPanoptesFactChecker/service/dynamicThresholdFactChecker';

export const githubAdvancedSecuritychecks: DynamicThresholdCheck[] = [
  {
    // Critical scans count check
    id: 'critical-count',
    name: 'Critical Scans Count',
    type: 'number',
    factIds: ['githubAdvancedSecurityFactRetriever', 'criticalCount'],
    annotationKeyThreshold:
      'tech-insights.io/github-advanced-security-critical-count-threshold',
    annotationKeyOperator:
      'tech-insights.io/github-advanced-security-critical-count-operator',
    description:
      'Maximum allowed critical scans count from GitHub Advanced Security',
  },
  {
    // High scans count check
    id: 'high-count',
    name: 'High Scans Count',
    type: 'number',
    factIds: ['githubAdvancedSecurityFactRetriever', 'highCount'],
    annotationKeyThreshold:
      'tech-insights.io/github-advanced-security-high-count-threshold',
    annotationKeyOperator:
      'tech-insights.io/github-advanced-security-high-count-operator',
    description:
      'Maximum allowed high scans count from GitHub Advanced Security',
  },
  {
    // Medium scans count check
    id: 'medium-count',
    name: 'Medium Scans Count',
    type: 'number',
    factIds: ['githubAdvancedSecurityFactRetriever', 'mediumCount'],
    annotationKeyThreshold:
      'tech-insights.io/github-advanced-security-medium-count-threshold',
    annotationKeyOperator:
      'tech-insights.io/github-advanced-security-medium-count-operator',
    description:
      'Maximum allowed medium scans count from GitHub Advanced Security',
  },
  {
    // Low scans count check
    id: 'low-count',
    name: 'Low Scans Count',
    type: 'number',
    factIds: ['githubAdvancedSecurityFactRetriever', 'lowCount'],
    annotationKeyThreshold:
      'tech-insights.io/github-advanced-security-low-count-threshold',
    annotationKeyOperator:
      'tech-insights.io/github-advanced-security-low-count-operator',
    description:
      'Maximum allowed low scans count from GitHub Advanced Security',
  },
  {
    // Secret scans count check
    id: 'open-secret-scanning-alert-count',
    name: 'Secret Scans Count',
    type: 'number',
    factIds: [
      'githubAdvancedSecurityFactRetriever',
      'openSecretScanningAlertCount',
    ],
    annotationKeyThreshold:
      'tech-insights.io/github-advanced-security-secrets-threshold',
    annotationKeyOperator:
      'tech-insights.io/github-advanced-security-secrets-operator',
    description:
      'Maximum allowed secret scans count from GitHub Advanced Security',
  },
];
