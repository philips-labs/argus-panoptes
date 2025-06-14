/***/
/**
 * The traffic-light-backend-module backend module for the tech-insights plugin.
 *
 * @packageDocumentation
 */

export { default } from './module';

// Export types needed by other modules
export type {
    DynamicThresholdResult,
    DynamicThresholdCheck,
  } from './argusPanoptesFactChecker/service/dynamicThresholdFactChecker';