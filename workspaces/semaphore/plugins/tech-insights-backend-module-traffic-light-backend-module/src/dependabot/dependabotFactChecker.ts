/**
 * Dependabot Alert Threshold Configuration
 *
 * This module defines the threshold checks for Dependabot security alerts in the Traffic Light
 * visualization. It configures how the system should evaluate the number of security alerts
 * at different severity levels (critical, high, medium) and determine the traffic light color.
 *
 * Each check defines:
 * - How to identify and name the check
 * - Which facts to retrieve for evaluation
 * - Where to find threshold values and comparison operators in entity annotations
 */
import { DynamicThresholdCheck } from '../argusPanoptesFactChecker/service/dynamicThresholdFactChecker';

/**
 * Array of threshold check configurations for Dependabot security alerts
 * These checks are used to evaluate if entities meet specified thresholds for
 * different severity levels of Dependabot security alerts.
 */
export const DependabotChecks: DynamicThresholdCheck[] = [
  /**
   * Critical severity Dependabot alert check
   *
   * Evaluates if the number of critical severity alerts is within acceptable limits.
   * Critical alerts represent the most severe vulnerabilities that require immediate attention.
   */
  {
    // Unique identifier for this check
    id: 'dependabot-critical-alerts',

    // Display name shown in UIs
    name: 'Dependabot Critical Alerts Count',

    // Data type for comparison (number of alerts)
    type: 'number',

    // References the fact retriever ID and the specific fact key for critical alerts
    factIds: ['dependabotFactRetriever', 'critical'],

    // Entity annotation key that stores the threshold value
    annotationKeyThreshold:
      'tech-insights.io/dependabot-critical-alert-threshold',

    // Entity annotation key that stores the comparison operator
    annotationKeyOperator: 'tech-insights.io/dependabot-operator',

    // Human-readable description of this check's purpose
    description: 'Maximum number of critical Dependabot alerts allowed',
  },
  /**
   * High severity Dependabot alert check
   *
   * Evaluates if the number of high severity alerts is within acceptable limits.
   * High severity alerts represent significant vulnerabilities that should be addressed soon.
   */
  {
    id: 'dependabot-high-alerts',
    name: 'Dependabot High Alerts Count',
    type: 'number',
    factIds: ['dependabotFactRetriever', 'high'],
    annotationKeyThreshold: 'tech-insights.io/dependabot-high-alert-threshold',
    annotationKeyOperator: 'tech-insights.io/dependabot-operator',
    description: 'Maximum number of high Dependabot alerts allowed',
  },

  /**
   * Medium severity Dependabot alert check
   *
   * Evaluates if the number of medium severity alerts is within acceptable limits.
   * Medium severity alerts represent moderate vulnerabilities that should be addressed
   * as part of regular maintenance cycles.
   */
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
