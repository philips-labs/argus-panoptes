import {
  FactChecker,
  TechInsightsStore,
} from '@backstage-community/plugin-tech-insights-node';
import { FactResponse } from '@backstage-community/plugin-tech-insights-common';
import { CatalogApi } from '@backstage/catalog-client';
import { LoggerService } from '@backstage/backend-plugin-api';

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

  /**
   * Helper function to format fact value with correct typing
   */
  private formatFactValue(
    value: unknown,
    isNumeric: boolean,
  ): string | number | boolean | [] {
    if (isNumeric && typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    if (Array.isArray(value)) {
      return value.length === 0 ? [] : String(value);
    }

    // Fallback to string for any other type
    return String(value);
  }

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
    if (!systemName) {
      throw new Error(
        `Component ${entity.metadata.name} does not specify a system.`,
      );
    }

    // Fetch the system entity from the catalog
    const systemEntity = await this.catalogApi.getEntityByRef({
      kind: 'System',
      namespace: entity.metadata.namespace || 'default',
      name: typeof systemName === 'string' ? systemName : String(systemName),
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
        const thresholdNumber = parseFloat(thresholdStr || 'NaN');
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
          `🔥[DEBUG] fact keys: ${Object.keys(factContainer?.facts || {}).join(
            ', ',
          )}`,
        );

        const operator =
          systemEntity.metadata.annotations?.[check.annotationKeyOperator];
        const isNumber = typeof rawValue === 'number';
        const isString = typeof rawValue === 'string';

        // Evaluate the check based on the operator and the threshold
        let result: boolean = false;
        switch (operator) {
          case 'greaterThan':
            result =
              rawValue !== undefined &&
              isNumber &&
              typeof threshold === 'number' &&
              rawValue > threshold;
            break;
          case 'greaterThanInclusive':
            result =
              rawValue !== undefined &&
              isNumber &&
              typeof threshold === 'number' &&
              rawValue >= threshold;
            break;
          case 'lessThan':
            result =
              rawValue !== undefined &&
              isNumber &&
              typeof threshold === 'number' &&
              rawValue < threshold;
            break;
          case 'lessThanInclusive':
            result =
              rawValue !== undefined &&
              isNumber &&
              typeof threshold === 'number' &&
              rawValue <= threshold;
            break;
          case 'equal':
            result =
              rawValue !== undefined &&
              (isNumber || isString) &&
              rawValue === threshold;
            break;
          case 'notEqual':
            result =
              rawValue !== undefined &&
              (isNumber || isString) &&
              rawValue !== threshold;
            break;
          default:
            result = false; // Default to false if operator is not recognized
        }

        // Log the result of the check
        this.logger.info(
          `The result from the check is ${result} for ${
            check.id
          } on entity ${entityRef} part of system ${systemName}, threshold is ${operator} ${threshold} with type ${typeof threshold}, rawValue is ${rawValue}`,
        );

        // Format fact correctly
        const fact: FactResponse[string] = {
          id: factId,
          type: isNumber ? 'integer' : 'string',
          description: `Fact for ${factId}`,
          value: this.formatFactValue(rawValue, isNumber),
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
