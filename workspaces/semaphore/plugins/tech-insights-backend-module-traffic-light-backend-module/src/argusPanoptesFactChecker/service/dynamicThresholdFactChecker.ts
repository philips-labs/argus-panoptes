import {
  FactChecker,
  TechInsightsStore,
} from '@backstage-community/plugin-tech-insights-node';
import { FactResponse } from '@backstage-community/plugin-tech-insights-common';
import { CatalogApi } from '@backstage/catalog-client';
import { LoggerService } from '@backstage/backend-plugin-api';
import { stringifyEntityRef } from '@backstage/catalog-model';

/**
 * Type describing a dynamic threshold check.
 * Each check has an id, name, type, factIds (array: first element is fact retriever ID, and second elemnt is the specific fact), annotationKey (for threshold), and description.
 */
export type DynamicThresholdCheck = {
  id: string;
  name: string;
  type: string;
  factIds: string[];
  annotationKeyThreshold: string;
  annotationKeyOperator: string;
  description: string;
};

/**
 * Type describing the result of a dynamic threshold check.
 * Contains the check definition, the facts used, and the boolean result.
 */
export type DynamicThresholdResult = {
  check: DynamicThresholdCheck;
  facts: FactResponse;
  result: boolean;
};

/**
 * Helper function to evaluate the check condition.
 * This isolates the complex switch statement, reducing the cognitive complexity of the main handler.
 */
function evaluateCheckCondition(
  operator: string | undefined,
  rawValue: any,
  threshold: any,
): boolean {
  const isNumber = typeof rawValue === 'number';
  const isString = typeof rawValue === 'string';

  switch (operator) {
    case 'greaterThan':
      return (
        rawValue !== undefined &&
        isNumber &&
        typeof threshold === 'number' &&
        rawValue > threshold
      );
    case 'greaterThanInclusive':
      return (
        rawValue !== undefined &&
        isNumber &&
        typeof threshold === 'number' &&
        rawValue >= threshold
      );
    case 'lessThan':
      return (
        rawValue !== undefined &&
        isNumber &&
        typeof threshold === 'number' &&
        rawValue < threshold
      );
    case 'lessThanInclusive':
      return (
        rawValue !== undefined &&
        isNumber &&
        typeof threshold === 'number' &&
        rawValue <= threshold
      );
    case 'equal':
      return (
        rawValue !== undefined &&
        (isNumber || isString) &&
        rawValue === threshold
      );
    case 'notEqual':
      return (
        rawValue !== undefined &&
        (isNumber || isString) &&
        rawValue !== threshold
      );
    default:
      return false; // Default to false if operator is not recognized
  }
}

/**
 * Helper function to format the fact value for the response.
 */
function formatFactValue(rawValue: any): number | string | [] {
  if (typeof rawValue === 'number' || typeof rawValue === 'string') {
    return rawValue;
  }
  if (Array.isArray(rawValue)) {
    return rawValue.length === 0 ? [] : String(rawValue);
  }
  return String(rawValue); // fallback
}

/**
 * Implements a FactChecker that evaluates dynamic threshold checks for catalog entities.
 * It fetches the entity, retrieves the relevant facts, and compares them to thresholds
 * defined in entity annotations.
 */
export class DynamicThresholdFactChecker
  implements FactChecker<DynamicThresholdCheck, DynamicThresholdResult>
{
  constructor(
    private readonly catalogApi: CatalogApi,
    private readonly repository: TechInsightsStore,
    private readonly logger: LoggerService,
    private readonly checks: DynamicThresholdCheck[],
  ) {}

  // Run checks for a given entity
  async runChecks(
    entityRef: string,
    checkIds?: string[],
  ): Promise<DynamicThresholdResult[]> {
    const entity = await this.catalogApi.getEntityByRef(entityRef);
    if (!entity) {
      throw new Error(`Entity not found: ${entityRef}`);
    }

    // Extract system name from entity spec
    const systemName = entity.spec?.system;
    if (typeof systemName !== 'string' || !systemName) {
      throw new Error(
        `The 'spec.system' field for entity '${stringifyEntityRef(
          entity,
        )}' is missing, empty, or not a string.`,
      );
    }

    // Fetch the system entity from the catalog
    const systemEntity = await this.catalogApi.getEntityByRef({
      kind: 'System',
      namespace: entity.metadata.namespace ?? 'default',
      name: systemName,
    });

    if (!systemEntity) {
      throw new Error(`System entity '${systemName}' not found in catalog.`);
    }

    // Filter checks to run by checkIds if provided
    const checksToRun = this.checks.filter(
      c => !checkIds || checkIds.includes(c.id),
    );
    // Retrieve the latest facts for all relevant factIds
    const factValues = await this.repository.getLatestFactsByIds(
      checksToRun.map(c => c.factIds).flat(),
      entityRef,
    );

    // Evaluate each check and return the results
    return await Promise.all(
      checksToRun.map(async check => {
        // Get the threshold value from the system entity annotation
        const thresholdStr =
          systemEntity.metadata.annotations?.[check.annotationKeyThreshold];
        const thresholdNumber = parseFloat(thresholdStr ?? 'NaN');
        const threshold = isNaN(thresholdNumber)
          ? thresholdStr
          : thresholdNumber;

        // If threshold is missing or invalid, log a warning and return result: false
        if (threshold === undefined) {
          this.logger.warn(
            `Missing or invalid threshold for ${check.id} on entity ${entityRef} part of system ${systemName}, threshold is ${thresholdStr}`,
          );
          return {
            check,
            facts: {},
            result: false,
          };
        }

        // Retrieve the fact value to check
        const factId = check.factIds[0];
        const factContainer = factValues[factId];
        const rawValue = factContainer?.facts?.[check.factIds[1]];
        this.logger.warn(
          `[DEBUG] fact keys: ${Object.keys(factContainer?.facts || {}).join(
            ', ',
          )}`,
        );

        const operator =
          systemEntity.metadata.annotations?.[check.annotationKeyOperator];
        const result = evaluateCheckCondition(operator, rawValue, threshold);

        // Log the result of the check
        this.logger.info(
          `The result from the check is ${result} for ${
            check.id
          } on entity ${entityRef} part of system ${systemName}, threshold is ${operator} ${threshold} with type ${typeof threshold}, rawValue is ${JSON.stringify(
            rawValue,
          )}`,
        );

        const fact: FactResponse[string] = {
          id: factId,
          type: typeof rawValue === 'number' ? 'integer' : 'string',
          description: `Fact for ${factId}`,
          value: formatFactValue(rawValue),
        };

        return {
          check,
          facts: { [factId]: fact },
          result,
        };
      }),
    );
  }

  /**
   * Validates that a check has the required fields.
   * @param check - The check to validate.
   * @returns An object with a boolean 'valid' and an optional message.
   */
  async validate(check: DynamicThresholdCheck) {
    const valid = Boolean(
      check.factIds.length !== 0 &&
        check.annotationKeyThreshold &&
        check.annotationKeyOperator,
    );
    return {
      valid,
      ...(valid
        ? {}
        : {
            message:
              'Each check must have a valid factId, annotationKeyThreshold and annotationKeyOperator.',
          }),
    };
  }

  /**
   * Returns all checks managed by this fact checker.
   * @returns Promise resolving to an array of DynamicThresholdCheck objects.
   */
  async getChecks(): Promise<DynamicThresholdCheck[]> {
    return this.checks;
  }
}

/**
 * Options to construct a DynamicThresholdFactCheckerFactory.
 */
export interface DynamicThresholdFactCheckerFactoryOptions {
  checks: DynamicThresholdCheck[]; // Define check metadata (e.g., id, annotationKey, factIds)
  logger: LoggerService;
  catalogApi: CatalogApi;
}

// Factory for creating DynamicThresholdFactChecker instances.
export class DynamicThresholdFactCheckerFactory {
  private readonly checks: DynamicThresholdCheck[];
  private readonly logger: LoggerService;
  private readonly catalogApi: CatalogApi;

  constructor(options: DynamicThresholdFactCheckerFactoryOptions) {
    this.checks = options.checks;
    this.logger = options.logger;
    this.catalogApi = options.catalogApi;
  }

  /**
   * Constructs a new DynamicThresholdFactChecker using the provided TechInsightsStore.
   */
  construct(repository: TechInsightsStore) {
    return new DynamicThresholdFactChecker(
      this.catalogApi,
      repository,
      this.logger,
      this.checks,
    );
  }
}
