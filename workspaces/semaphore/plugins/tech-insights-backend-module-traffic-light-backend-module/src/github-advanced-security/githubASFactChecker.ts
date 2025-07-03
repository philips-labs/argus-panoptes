import { DynamicThresholdCheck } from '../argusPanoptesFactChecker/service/dynamicThresholdFactChecker';

/**
 * A helper function to generate a DynamicThresholdCheck configuration for a given severity.
 * This reduces code duplication by creating the check object from a template.
 *
 * @param severity - The severity level for the check (e.g., 'critical', 'high').
 * @param factId - The specific fact ID for this severity count.
 * @returns A DynamicThresholdCheck object.
 */
const createSecurityCheck = (
  severity: string,
  factId: string,
): DynamicThresholdCheck => {
  // Capitalize the first letter of the severity for the 'name' field.
  const capitalizedSeverity =
    severity.charAt(0).toUpperCase() + severity.slice(1);
  return {
    id: `${severity}-count`,
    name: `${capitalizedSeverity} Scans Count`,
    type: 'number',
    factIds: ['githubAdvancedSecurityFactRetriever', factId],
    annotationKeyThreshold: `tech-insights.io/github-advanced-security-${severity}-count-threshold`,
    annotationKeyOperator: `tech-insights.io/github-advanced-security-${severity}-count-operator`,
    description: `Maximum allowed ${severity} scans count from GitHub Advanced Security`,
  };
};

/**
 * An array of threshold checks for GitHub Advanced Security scan results.
 * It evaluates if components meet specified security criteria for different severity levels.
 */
export const githubAdvancedSecuritychecks: DynamicThresholdCheck[] = [
  // Generate checks for each severity level using the helper function.
  createSecurityCheck('critical', 'criticalCount'),
  createSecurityCheck('high', 'highCount'),
  createSecurityCheck('medium', 'mediumCount'),
  createSecurityCheck('low', 'lowCount'),

  // The check for secret scanning is unique and is defined separately.
  {
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
