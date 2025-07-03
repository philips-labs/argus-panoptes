/**
 * Azure DevOps fact checker for Traffic Light Backend Module
 *
 * This module defines threshold checks for Azure DevOps metrics that will be used
 * to evaluate if entities in the catalog meet specified criteria.
 */

import { DynamicThresholdCheck } from '../argusPanoptesFactChecker/service/dynamicThresholdFactChecker';

/**
 * Configuration array for Azure DevOps bug count threshold checks.
 * These checks are used to evaluate if entities meet specified thresholds for Azure DevOps bugs.
 *
 * @type {DynamicThresholdCheck[]} - Array of check configurations for Azure bugs
 */
export const azureBugsChecks: DynamicThresholdCheck[] = [
  {
    // Unique identifier for this check
    id: 'azure-bugs',

    // Display name for this check in UIs
    name: 'Azure Bugs',

    // Data type of the metric being evaluated (supports 'number', 'boolean', etc.)
    type: 'number',

    // IDs of the facts this check depends on - must match fact IDs returned by fact retrievers
    factIds: ['azure-devops-bugs-retriever', 'azure_bug_count'],

    // Annotation key used to store/retrieve the threshold value from entity metadata
    annotationKeyThreshold: 'tech-insights.io/azure-bugs-threshold',

    // Annotation key used to store/retrieve the comparison operator from entity metadata
    annotationKeyOperator: 'tech-insights.io/azure-bugs-operator',

    // Human-readable description of what this check evaluates
    description: 'Maximum number of Azure DevOps bugs allowed',
  },
];
