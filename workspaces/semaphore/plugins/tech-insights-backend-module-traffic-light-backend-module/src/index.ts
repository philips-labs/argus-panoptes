/**
 * The traffic-light-backend-module backend module for the tech-insights plugin.
 *
 * @packageDocumentation
 */

// Main module export - registers fact retrievers and checkers
export { default } from './module';

// Public type exports for configuration
export type {
  DynamicThresholdResult, // Result of a threshold check evaluation
  DynamicThresholdCheck, // Configuration for a threshold-based check
} from './argusPanoptesFactChecker/service/dynamicThresholdFactChecker';

// Pre-configured checkers for common metrics
export { preproductionPipelineChecks } from './pipelines/preproductionFactChecker';
export { reportingPipelineChecks } from './pipelines/reportingFactChecker';
export { githubAdvancedSecuritychecks } from './github-advanced-security/githubASFactChecker';

// Utility class for authenticated catalog operations
export { AuthenticatedCatalogApi } from './authenticatedCatalogApi';
