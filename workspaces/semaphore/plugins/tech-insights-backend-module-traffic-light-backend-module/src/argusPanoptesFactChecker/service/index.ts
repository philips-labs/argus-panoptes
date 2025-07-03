/**
 * Dynamic Threshold Fact Checker Exports
 * Re-exports the main components for configurable threshold checks
 */

// Primary classes for creating and using threshold-based fact checkers
export {
  DynamicThresholdFactCheckerFactory, // Factory for creating checkers with specific configurations
  DynamicThresholdFactChecker, // Implementation that evaluates facts against thresholds
} from './dynamicThresholdFactChecker';

// Type exports for configuration options
export type { DynamicThresholdFactCheckerFactoryOptions } from './dynamicThresholdFactChecker';
