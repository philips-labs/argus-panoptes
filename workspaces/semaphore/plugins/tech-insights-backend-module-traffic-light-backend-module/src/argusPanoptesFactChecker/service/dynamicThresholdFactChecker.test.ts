import {
  DynamicThresholdFactChecker,
  DynamicThresholdCheck,
  DynamicThresholdFactCheckerFactory,
} from './dynamicThresholdFactChecker';
import { TechInsightsStore } from '@backstage-community/plugin-tech-insights-node';
import { CatalogApi } from '@backstage/catalog-client';
import { LoggerService } from '@backstage/backend-plugin-api';
import { Entity } from '@backstage/catalog-model';

// Mock implementations
jest.mock('@backstage/catalog-client');
jest.mock('@backstage-community/plugin-tech-insights-node');

describe('DynamicThresholdFactChecker', () => {
  // Common test variables
  const mockCatalogApi = {
    getEntityByRef: jest.fn(),
    getEntities: jest.fn(),
    getEntitiesByRefs: jest.fn(),
    queryEntities: jest.fn(),
    getEntityAncestors: jest.fn(),
    removeEntityByUid: jest.fn(),
    validateEntity: jest.fn(),
    addLocation: jest.fn(),
    getLocationById: jest.fn(),
    getLocationByRef: jest.fn(),
    removeLocationById: jest.fn(),
    getOriginLocationByEntity: jest.fn(),
  } as unknown as jest.Mocked<CatalogApi>;

  // Mocking the TechInsightsStore
  const mockRepository = {
    getLatestFactsByIds: jest.fn(),
    insertFacts: jest.fn(),
    getEntities: jest.fn(),
    getFactsBetweenTimestampsByIds: jest.fn(),
    insertFactSchema: jest.fn(),
    getLatestSchemas: jest.fn(),
  } as jest.Mocked<TechInsightsStore>;

  // Mocking the LoggerService
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(),
  } as jest.Mocked<LoggerService>;

  // Sample checks for testing
  const sampleChecks: DynamicThresholdCheck[] = [
    {
      id: 'test-check-1',
      name: 'Test Check 1',
      type: 'dynamic-threshold',
      factIds: ['test-fact-retriever', 'test-fact-1'],
      annotationKeyThreshold: 'backstage.io/test-threshold',
      annotationKeyOperator: 'backstage.io/test-operator',
      description: 'Test dynamic threshold check',
    },
    {
      id: 'test-check-2',
      name: 'Test Check 2',
      type: 'dynamic-threshold',
      factIds: ['test-fact-retriever', 'test-fact-2'],
      annotationKeyThreshold: 'backstage.io/another-threshold',
      annotationKeyOperator: 'backstage.io/another-operator',
      description: 'Another test dynamic threshold check',
    },
  ];

  let factChecker: DynamicThresholdFactChecker;

  beforeEach(() => {
    jest.clearAllMocks();
    factChecker = new DynamicThresholdFactChecker(
      mockCatalogApi,
      mockRepository,
      mockLogger,
      sampleChecks,
    );
  });

  describe('runChecks', () => {
    // Sample entity reference and entities for testing
    const testEntityRef = 'component:default/test-component';
    const testComponentEntity: Entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: 'test-component',
        namespace: 'default',
      },
      spec: {
        type: 'service',
        system: 'test-system',
      },
    };

    // Sample system entity with annotations for testing
    const testSystemEntity: Entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'System',
      metadata: {
        name: 'test-system',
        namespace: 'default',
        annotations: {
          'backstage.io/test-threshold': '80',
          'backstage.io/test-operator': 'greaterThan',
          'backstage.io/another-threshold': '10',
          'backstage.io/another-operator': 'lessThan',
        },
      },
      spec: {},
    };

    // Test: error is thrown when entity is not found
    test('throws error when entity not found', async () => {
      mockCatalogApi.getEntityByRef.mockResolvedValueOnce(undefined);

      await expect(factChecker.runChecks(testEntityRef)).rejects.toThrow(
        `Entity not found: ${testEntityRef}`,
      );
    });

    // TestL error is thrown when system name is not specified
    test('throws error when component does not specify a system', async () => {
      const entityWithoutSystem = {
        ...testComponentEntity,
        spec: { type: 'service' },
      };
      mockCatalogApi.getEntityByRef.mockResolvedValueOnce(entityWithoutSystem);

      await expect(factChecker.runChecks(testEntityRef)).rejects.toThrow(
        `Component test-component does not specify a system.`,
      );
    });

    // Test: error is thrown when system entity is not found
    test('throws error when system entity not found', async () => {
      mockCatalogApi.getEntityByRef
        .mockResolvedValueOnce(testComponentEntity)
        .mockResolvedValueOnce(undefined);

      await expect(factChecker.runChecks(testEntityRef)).rejects.toThrow(
        `System entity 'test-system' not found in catalog.`,
      );
    });

    // Test: a warning is logged when the system entity does not have the required annotations
    test('handles missing threshold annotation', async () => {
      // System entity without threshold annotation
      const systemEntityWithoutThreshold = {
        ...testSystemEntity,
        metadata: {
          ...testSystemEntity.metadata,
          annotations: {},
        },
      };

      mockCatalogApi.getEntityByRef
        .mockResolvedValueOnce(testComponentEntity)
        .mockResolvedValueOnce(systemEntityWithoutThreshold);

      mockRepository.getLatestFactsByIds.mockResolvedValueOnce({
        'test-fact-retriever': {
          id: 'test-fact-retriever',
          entity: {
            kind: 'Component',
            name: 'test-component',
            namespace: 'default',
          },
          facts: {
            'test-fact-1': 85,
          },
        },
      });

      const results = await factChecker.runChecks(testEntityRef);

      expect(results).toHaveLength(2);
      expect(results[0].result).toBe(false); // Should fail due to missing threshold
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    // Test: greaterThan operator returns true when value is greater than threshold
    describe('operator tests with numeric values', () => {
      beforeEach(() => {
        mockCatalogApi.getEntityByRef
          .mockResolvedValueOnce(testComponentEntity)
          .mockResolvedValueOnce(testSystemEntity);
      });

      test('evaluates greaterThan operator correctly', async () => {
        mockRepository.getLatestFactsByIds.mockResolvedValueOnce({
          'test-fact-retriever': {
            id: 'test-fact-retriever',
            entity: {
              kind: 'Component',
              name: 'test-component',
              namespace: 'default',
            },
            facts: {
              'test-fact-1': 85, // Should pass: 85 > 80
            },
          },
        });

        const results = await factChecker.runChecks(testEntityRef, [
          'test-check-1',
        ]);

        expect(results).toHaveLength(1);
        expect(results[0].result).toBe(true);
        expect(results[0].facts['test-fact-retriever'].value).toBe(85);
      });

      // Test: greaterThan operator returns false when value is less than or equal to the threshold
      test('greaterThan operator returns false when value is less than or equal to the threshold', async () => {
        mockRepository.getLatestFactsByIds.mockResolvedValueOnce({
          'test-fact-retriever': {
            id: 'test-fact-retriever',
            entity: {
              kind: 'Component',
              name: 'test-component',
              namespace: 'default',
            },
            facts: {
              'test-fact-1': 80, // Should fail: 80 == 80, not greater
            },
          },
        });

        const results = await factChecker.runChecks(testEntityRef, [
          'test-check-1',
        ]);

        expect(results).toHaveLength(1);
        expect(results[0].result).toBe(false);
      });

      // Test: greaterThanInclusive operator returns true when value is greater than or equal to the threshold
      test('evaluates greaterThanInclusive operator correctly', async () => {
        // Override the operator for this test
        const systemEntityWithInclusive = {
          ...testSystemEntity,
          metadata: {
            ...testSystemEntity.metadata,
            annotations: {
              ...testSystemEntity.metadata.annotations,
              'backstage.io/test-operator': 'greaterThanInclusive',
            },
          },
        };

        mockCatalogApi.getEntityByRef
          .mockReset()
          .mockResolvedValueOnce(testComponentEntity)
          .mockResolvedValueOnce(systemEntityWithInclusive);

        mockRepository.getLatestFactsByIds.mockResolvedValueOnce({
          'test-fact-retriever': {
            id: 'test-fact-retriever',
            entity: {
              kind: 'Component',
              name: 'test-component',
              namespace: 'default',
            },
            facts: {
              'test-fact-1': 80, // Should pass: 80 >= 80
            },
          },
        });

        const results = await factChecker.runChecks(testEntityRef, [
          'test-check-1',
        ]);

        expect(results).toHaveLength(1);
        expect(results[0].result).toBe(true);
      });

      // Test: lessThan operator returns true when value is less than the threshold
      test('evaluates lessThan operator correctly', async () => {
        mockRepository.getLatestFactsByIds.mockResolvedValueOnce({
          'test-fact-retriever': {
            id: 'test-fact-retriever',
            entity: {
              kind: 'Component',
              name: 'test-component',
              namespace: 'default',
            },
            facts: {
              'test-fact-2': 5, // Should pass: 5 < 10
            },
          },
        });

        const results = await factChecker.runChecks(testEntityRef, [
          'test-check-2',
        ]);

        expect(results).toHaveLength(1);
        expect(results[0].result).toBe(true);
      });

      // Test: lessThan operator returns false when value is greater than or equal to the threshold
      test('lessThan operator returns false when value is greater than or equal to threshold', async () => {
        mockRepository.getLatestFactsByIds.mockResolvedValueOnce({
          'test-fact-retriever': {
            id: 'test-fact-retriever',
            entity: {
              kind: 'Component',
              name: 'test-component',
              namespace: 'default',
            },
            facts: {
              'test-fact-2': 10, // Should fail: 10 == 10, not less
            },
          },
        });

        const results = await factChecker.runChecks(testEntityRef, [
          'test-check-2',
        ]);

        expect(results).toHaveLength(1);
        expect(results[0].result).toBe(false);
      });

      // Test: lessThanInclusive operator returns true when value is less than or equal to the threshold
      test('evaluates lessThanInclusive operator correctly', async () => {
        // Override the operator for this test
        const systemEntityWithInclusive = {
          ...testSystemEntity,
          metadata: {
            ...testSystemEntity.metadata,
            annotations: {
              ...testSystemEntity.metadata.annotations,
              'backstage.io/another-operator': 'lessThanInclusive',
            },
          },
        };

        mockCatalogApi.getEntityByRef
          .mockReset()
          .mockResolvedValueOnce(testComponentEntity)
          .mockResolvedValueOnce(systemEntityWithInclusive);

        mockRepository.getLatestFactsByIds.mockResolvedValueOnce({
          'test-fact-retriever': {
            id: 'test-fact-retriever',
            entity: {
              kind: 'Component',
              name: 'test-component',
              namespace: 'default',
            },
            facts: {
              'test-fact-2': 10, // Should pass: 10 <= 10
            },
          },
        });

        const results = await factChecker.runChecks(testEntityRef, [
          'test-check-2',
        ]);

        expect(results).toHaveLength(1);
        expect(results[0].result).toBe(true);
      });

      // Test: equal operator returns true when value is equal to the threshold
      test('evaluates equal operator correctly with numbers when equality is satisfied', async () => {
        // Override the operator for this test
        const systemEntityWithEqualOp = {
          ...testSystemEntity,
          metadata: {
            ...testSystemEntity.metadata,
            annotations: {
              ...testSystemEntity.metadata.annotations,
              'backstage.io/test-operator': 'equal',
            },
          },
        };

        mockCatalogApi.getEntityByRef
          .mockReset()
          .mockResolvedValueOnce(testComponentEntity)
          .mockResolvedValueOnce(systemEntityWithEqualOp);

        mockRepository.getLatestFactsByIds.mockResolvedValueOnce({
          'test-fact-retriever': {
            id: 'test-fact-retriever',
            entity: {
              kind: 'Component',
              name: 'test-component',
              namespace: 'default',
            },
            facts: {
              'test-fact-1': 80, // Should pass: 80 == 80
            },
          },
        });

        const results = await factChecker.runChecks(testEntityRef, [
          'test-check-1',
        ]);

        expect(results).toHaveLength(1);
        expect(results[0].result).toBe(true);
      });

      // Test: equal operator returns false when value is not equal to the threshold
      test('evaluates equal operator correctly with numbers when equality is not satisfied', async () => {
        // Override the operator for this test
        const systemEntityWithEqualOp = {
          ...testSystemEntity,
          metadata: {
            ...testSystemEntity.metadata,
            annotations: {
              ...testSystemEntity.metadata.annotations,
              'backstage.io/test-operator': 'equal',
            },
          },
        };

        mockCatalogApi.getEntityByRef
          .mockReset()
          .mockResolvedValueOnce(testComponentEntity)
          .mockResolvedValueOnce(systemEntityWithEqualOp);

        mockRepository.getLatestFactsByIds.mockResolvedValueOnce({
          'test-fact-retriever': {
            id: 'test-fact-retriever',
            entity: {
              kind: 'Component',
              name: 'test-component',
              namespace: 'default',
            },
            facts: {
              'test-fact-1': 83, // Should not pass: 83 !== 80
            },
          },
        });

        const results = await factChecker.runChecks(testEntityRef, [
          'test-check-1',
        ]);

        expect(results).toHaveLength(1);
        expect(results[0].result).toBe(false);
      });

      // Test: notEqual operator returns true when value is not equal to the threshold
      test('evaluates notEqual operator correctly with numbers when the values are not equal', async () => {
        // Override the operator for this test
        const systemEntityWithNotEqualOp = {
          ...testSystemEntity,
          metadata: {
            ...testSystemEntity.metadata,
            annotations: {
              ...testSystemEntity.metadata.annotations,
              'backstage.io/test-operator': 'notEqual',
            },
          },
        };

        mockCatalogApi.getEntityByRef
          .mockReset()
          .mockResolvedValueOnce(testComponentEntity)
          .mockResolvedValueOnce(systemEntityWithNotEqualOp);

        mockRepository.getLatestFactsByIds.mockResolvedValueOnce({
          'test-fact-retriever': {
            id: 'test-fact-retriever',
            entity: {
              kind: 'Component',
              name: 'test-component',
              namespace: 'default',
            },
            facts: {
              'test-fact-1': 85, // Should pass: 85 != 80
            },
          },
        });

        const results = await factChecker.runChecks(testEntityRef, [
          'test-check-1',
        ]);

        expect(results).toHaveLength(1);
        expect(results[0].result).toBe(true);
      });

      // Test: notEqual operator returns false when value is equal to the threshold
      test('evaluates notEqual operator correctly with numbers when the values are equal', async () => {
        // Override the operator for this test
        const systemEntityWithNotEqualOp = {
          ...testSystemEntity,
          metadata: {
            ...testSystemEntity.metadata,
            annotations: {
              ...testSystemEntity.metadata.annotations,
              'backstage.io/test-operator': 'notEqual',
            },
          },
        };

        mockCatalogApi.getEntityByRef
          .mockReset()
          .mockResolvedValueOnce(testComponentEntity)
          .mockResolvedValueOnce(systemEntityWithNotEqualOp);

        mockRepository.getLatestFactsByIds.mockResolvedValueOnce({
          'test-fact-retriever': {
            id: 'test-fact-retriever',
            entity: {
              kind: 'Component',
              name: 'test-component',
              namespace: 'default',
            },
            facts: {
              'test-fact-1': 80, // Should not pass: 80 == 80
            },
          },
        });

        const results = await factChecker.runChecks(testEntityRef, [
          'test-check-1',
        ]);

        expect(results).toHaveLength(1);
        expect(results[0].result).toBe(false);
      });
    });

    // Tests for string value thresholds
    describe('string value tests', () => {
      const systemEntityWithStringThreshold = {
        ...testSystemEntity,
        metadata: {
          ...testSystemEntity.metadata,
          annotations: {
            'backstage.io/test-threshold': 'production',
            'backstage.io/test-operator': 'equal',
          },
        },
      };

      beforeEach(() => {
        mockCatalogApi.getEntityByRef
          .mockResolvedValueOnce(testComponentEntity)
          .mockResolvedValueOnce(systemEntityWithStringThreshold);
      });

      // Test: equal operator returns true when string value is equal to the threshold
      test('evaluates equal operator correctly with strings', async () => {
        mockRepository.getLatestFactsByIds.mockResolvedValueOnce({
          'test-fact-retriever': {
            id: 'test-fact-retriever',
            entity: {
              kind: 'Component',
              name: 'test-component',
              namespace: 'default',
            },
            facts: {
              'test-fact-1': 'production', // Should pass: 'production' === 'production'
            },
          },
        });

        const results = await factChecker.runChecks(testEntityRef, [
          'test-check-1',
        ]);

        expect(results).toHaveLength(1);
        expect(results[0].result).toBe(true);
        expect(results[0].facts['test-fact-retriever'].value).toBe(
          'production',
        );
      });

      // Test: equal operator returns false when string value is not equal to the threshold
      test('equal operator correctly with strings evaluation', async () => {
        mockRepository.getLatestFactsByIds.mockResolvedValueOnce({
          'test-fact-retriever': {
            id: 'test-fact-retriever',
            entity: {
              kind: 'Component',
              name: 'test-component',
              namespace: 'default',
            },
            facts: {
              'test-fact-1': 'development', // Should not pass: 'development' !== 'production'
            },
          },
        });

        const results = await factChecker.runChecks(testEntityRef, [
          'test-check-1',
        ]);

        expect(results).toHaveLength(1);
        expect(results[0].result).toBe(false);
        expect(results[0].facts['test-fact-retriever'].value).toBe(
          'development',
        );
      });

      // Test: notEqual operator returns true when string value is not equal to the threshold
      test('notEqual operator correctly with strings evaluation', async () => {
        const systemEntityWithNotEqualOp = {
          ...systemEntityWithStringThreshold,
          metadata: {
            ...systemEntityWithStringThreshold.metadata,
            annotations: {
              ...systemEntityWithStringThreshold.metadata.annotations,
              'backstage.io/test-operator': 'notEqual',
            },
          },
        };

        mockCatalogApi.getEntityByRef
          .mockReset()
          .mockResolvedValueOnce(testComponentEntity)
          .mockResolvedValueOnce(systemEntityWithNotEqualOp);

        mockRepository.getLatestFactsByIds.mockResolvedValueOnce({
          'test-fact-retriever': {
            id: 'test-fact-retriever',
            entity: {
              kind: 'Component',
              name: 'test-component',
              namespace: 'default',
            },
            facts: {
              'test-fact-1': 'development', // Should pass: 'development' !== 'production'
            },
          },
        });

        const results = await factChecker.runChecks(testEntityRef, [
          'test-check-1',
        ]);

        expect(results).toHaveLength(1);
        expect(results[0].result).toBe(true);
      });

      // Test: notEqual operator returns false when string value is equal to the threshold
      test('checks notEqual operator correctly with strings', async () => {
        const systemEntityWithNotEqualOp = {
          ...systemEntityWithStringThreshold,
          metadata: {
            ...systemEntityWithStringThreshold.metadata,
            annotations: {
              ...systemEntityWithStringThreshold.metadata.annotations,
              'backstage.io/test-operator': 'notEqual',
            },
          },
        };

        mockCatalogApi.getEntityByRef
          .mockReset()
          .mockResolvedValueOnce(testComponentEntity)
          .mockResolvedValueOnce(systemEntityWithNotEqualOp);

        mockRepository.getLatestFactsByIds.mockResolvedValueOnce({
          'test-fact-retriever': {
            id: 'test-fact-retriever',
            entity: {
              kind: 'Component',
              name: 'test-component',
              namespace: 'default',
            },
            facts: {
              'test-fact-1': 'production', // Should not pass: 'production' == 'production'
            },
          },
        });

        const results = await factChecker.runChecks(testEntityRef, [
          'test-check-1',
        ]);

        expect(results).toHaveLength(1);
        expect(results[0].result).toBe(false);
      });
    });

    describe('special value handling', () => {
      beforeEach(() => {
        mockCatalogApi.getEntityByRef
          .mockResolvedValueOnce(testComponentEntity)
          .mockResolvedValueOnce(testSystemEntity);
      });

      // Test: checker returns false when fact value is undefined
      test('handles undefined fact values correctly', async () => {
        mockRepository.getLatestFactsByIds.mockResolvedValueOnce({
          'test-fact-retriever': {
            id: 'test-fact-retriever',
            entity: {
              kind: 'Component',
              name: 'test-component',
              namespace: 'default',
            },
            facts: {
              // test-fact-1 is missing
            },
          },
        });

        const results = await factChecker.runChecks(testEntityRef, [
          'test-check-1',
        ]);

        expect(results).toHaveLength(1);
        expect(results[0].result).toBe(false);
      });

      // Test: checker handles array fact values correctly
      test('handles array fact values', async () => {
        mockRepository.getLatestFactsByIds.mockResolvedValueOnce({
          'test-fact-retriever': {
            id: 'test-fact-retriever',
            entity: {
              kind: 'Component',
              name: 'test-component',
              namespace: 'default',
            },
            facts: {
              'test-fact-1': ['item1', 'item2'], // Array value
            },
          },
        });

        const results = await factChecker.runChecks(testEntityRef, [
          'test-check-1',
        ]);

        // Arrays should be converted to strings for the facts output
        expect(results[0].facts['test-fact-retriever'].value).toBe(
          'item1,item2',
        );
        // But the check should fail as we can't compare array to number
        expect(results[0].result).toBe(false);
      });

      // Test: checker handles empty array fact values correctly
      test('handles empty array fact values', async () => {
        mockRepository.getLatestFactsByIds.mockResolvedValueOnce({
          'test-fact-retriever': {
            id: 'test-fact-retriever',
            entity: {
              kind: 'Component',
              name: 'test-component',
              namespace: 'default',
            },
            facts: {
              'test-fact-1': [], // Empty array
            },
          },
        });

        const results = await factChecker.runChecks(testEntityRef, [
          'test-check-1',
        ]);

        // Empty arrays should remain as empty arrays
        expect(results[0].facts['test-fact-retriever'].value).toEqual([]);
        // But the check should fail
        expect(results[0].result).toBe(false);
      });

      // Test: checker handles unknown operators gracefully
      test('handles unknown operators', async () => {
        const systemEntityWithInvalidOp = {
          ...testSystemEntity,
          metadata: {
            ...testSystemEntity.metadata,
            annotations: {
              ...testSystemEntity.metadata.annotations,
              'backstage.io/test-operator': 'invalidOperator',
            },
          },
        };

        mockCatalogApi.getEntityByRef
          .mockReset()
          .mockResolvedValueOnce(testComponentEntity)
          .mockResolvedValueOnce(systemEntityWithInvalidOp);

        mockRepository.getLatestFactsByIds.mockResolvedValueOnce({
          'test-fact-retriever': {
            id: 'test-fact-retriever',
            entity: {
              kind: 'Component',
              name: 'test-component',
              namespace: 'default',
            },
            facts: {
              'test-fact-1': 85,
            },
          },
        });

        const results = await factChecker.runChecks(testEntityRef, [
          'test-check-1',
        ]);

        expect(results).toHaveLength(1);
        expect(results[0].result).toBe(false); // Unknown operator should default to false
      });

      // Test: checker handles invalid threshold value
      test('handles invalid threshold value', async () => {
        const systemEntityWithInvalidThreshold = {
          ...testSystemEntity,
          metadata: {
            ...testSystemEntity.metadata,
            annotations: {
              ...testSystemEntity.metadata.annotations,
              'backstage.io/test-threshold': 'not-a-number', // For a numeric comparison
            },
          },
        };

        mockCatalogApi.getEntityByRef
          .mockReset()
          .mockResolvedValueOnce(testComponentEntity)
          .mockResolvedValueOnce(systemEntityWithInvalidThreshold);

        mockRepository.getLatestFactsByIds.mockResolvedValueOnce({
          'test-fact-retriever': {
            id: 'test-fact-retriever',
            entity: {
              kind: 'Component',
              name: 'test-component',
              namespace: 'default',
            },
            facts: {
              'test-fact-1': 85, // Numeric value
            },
          },
        });

        const results = await factChecker.runChecks(testEntityRef, [
          'test-check-1',
        ]);

        expect(results).toHaveLength(1);
        expect(results[0].result).toBe(false); // Should fail due to type mismatch
      });
    });

    // Test: checker filters checks by provided checkIds
    test('filters checks by provided checkIds', async () => {
      mockCatalogApi.getEntityByRef
        .mockResolvedValueOnce(testComponentEntity)
        .mockResolvedValueOnce(testSystemEntity);

      mockRepository.getLatestFactsByIds.mockResolvedValueOnce({
        'test-fact-retriever': {
          id: 'test-fact-retriever',
          entity: {
            kind: 'Component',
            name: 'test-component',
            namespace: 'default',
          },
          facts: {
            'test-fact-1': 85,
            'test-fact-2': 5,
          },
        },
      });

      const results = await factChecker.runChecks(testEntityRef, [
        'test-check-1',
      ]);

      expect(results).toHaveLength(1);
      expect(results[0].check.id).toBe('test-check-1');
    });
  });

  describe('validate', () => {
    // Test: validate method for well-formed checks
    test('returns valid for a well-formed check', async () => {
      const result = await factChecker.validate(sampleChecks[0]);
      expect(result.valid).toBe(true);
      expect(result.message).toBeUndefined();
    });

    // Test: validate method for checks with missing required fields
    test('returns invalid for a check missing factIds', async () => {
      const invalidCheck = { ...sampleChecks[0], factIds: [] };
      const result = await factChecker.validate(invalidCheck);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('must have a valid factId');
    });

    // Test: validate method for checks with invalid factIds
    test('returns invalid for a check missing annotationKeyThreshold', async () => {
      const invalidCheck = { ...sampleChecks[0], annotationKeyThreshold: '' };
      const result = await factChecker.validate(invalidCheck);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('must have a valid factId');
    });

    // Test: validate method for checks with invalid annotationKeyOperator
    test('returns invalid for a check missing annotationKeyOperator', async () => {
      const invalidCheck = { ...sampleChecks[0], annotationKeyOperator: '' };
      const result = await factChecker.validate(invalidCheck);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('must have a valid factId');
    });
  });

  describe('getChecks', () => {
    // Test: getChecks method returns all configured checks
    test('returns all configured checks', async () => {
      const checks = await factChecker.getChecks();
      expect(checks).toEqual(sampleChecks);
      expect(checks).toHaveLength(2);
    });
  });

  describe('DynamicThresholdFactCheckerFactory', () => {
    // Test: factory constructs a DynamicThresholdFactChecker with provided options
    test('constructs a DynamicThresholdFactChecker with provided options', () => {
      const factory = new DynamicThresholdFactCheckerFactory({
        checks: sampleChecks,
        logger: mockLogger,
        catalogApi: mockCatalogApi,
      });

      const checker = factory.construct(mockRepository);

      expect(checker).toBeInstanceOf(DynamicThresholdFactChecker);
    });
  });
});
