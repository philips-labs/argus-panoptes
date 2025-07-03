import { azureBugsChecks } from '../azureDevOpsFactChecker';

describe('Azure Bugs Checks Configuration', () => {
  const requiredFields = [
    'id',
    'name',
    'type',
    'factIds',
    'annotationKeyThreshold',
    'annotationKeyOperator',
    'description',
  ];

  // Test: each check should have the required fields
  test('each check has all required fields', () => {
    azureBugsChecks.forEach(check => {
      requiredFields.forEach(field => {
        expect(check).toHaveProperty(field);
      });
    });
  });

  // Test: naming conventions for the fact checkers
  test('each check follows the naming conventions', () => {
    azureBugsChecks.forEach(check => {
      // Check IDs follow the pattern 'azure-*'
      expect(check.id).toMatch(/^azure-/);

      // Check that annotation keys follow convention
      expect(check.annotationKeyThreshold).toMatch(
        /^tech-insights\.io\/azure-/,
      );
      expect(check.annotationKeyOperator).toMatch(/^tech-insights\.io\/azure-/);

      // Check that all factIds arrays start with the correct retriever
      expect(check.factIds[0]).toBe('azure-devops-bugs-retriever');
    });
  });

  // Test: check if all metrics are covered by the fact checkers
  test('checks cover expected metrics', () => {
    // Verify that important Azure DevOps metrics are covered
    const expectedMetrics = ['azure_bug_count'];

    // Extract second factId (the actual metric being checked)
    const coveredMetrics = azureBugsChecks.map(check => check.factIds[1]);

    // Ensure all expected metrics are covered
    expectedMetrics.forEach(metric => {
      expect(coveredMetrics).toContain(metric);
    });
  });

  // Test: verify specific check configurations
  test('azure bugs check is properly configured', () => {
    const azureBugsCheck = azureBugsChecks.find(
      check => check.id === 'azure-bugs',
    );

    expect(azureBugsCheck).toBeDefined();
    expect(azureBugsCheck?.type).toBe('number');
    expect(azureBugsCheck?.factIds).toEqual([
      'azure-devops-bugs-retriever',
      'azure_bug_count',
    ]);
    expect(azureBugsCheck?.name).toBe('Azure Bugs');
    expect(azureBugsCheck?.description).toContain('Azure DevOps bugs');
  });

  // Test: annotation key consistency
  test('annotation keys are consistent with check id', () => {
    azureBugsChecks.forEach(check => {
      const expectedThresholdKey = `tech-insights.io/${check.id}-threshold`;
      const expectedOperatorKey = `tech-insights.io/${check.id}-operator`;

      expect(check.annotationKeyThreshold).toBe(expectedThresholdKey);
      expect(check.annotationKeyOperator).toBe(expectedOperatorKey);
    });
  });

  // Test: factIds array structure
  test('factIds arrays have correct structure', () => {
    azureBugsChecks.forEach(check => {
      expect(Array.isArray(check.factIds)).toBe(true);
      expect(check.factIds).toHaveLength(2);
      expect(typeof check.factIds[0]).toBe('string');
      expect(typeof check.factIds[1]).toBe('string');
    });
  });

  // Test: type field validation
  test('type field contains valid values', () => {
    const validTypes = ['percentage', 'number', 'boolean'];

    azureBugsChecks.forEach(check => {
      expect(validTypes).toContain(check.type);
    });
  });

  // Test: description field validation
  test('description field is meaningful', () => {
    azureBugsChecks.forEach(check => {
      expect(check.description).toBeTruthy();
      expect(check.description.length).toBeGreaterThan(10);
      expect(typeof check.description).toBe('string');
    });
  });

  // Test: validate that the configuration matches the fact retriever schema
  test('factIds match the fact retriever configuration', () => {
    azureBugsChecks.forEach(check => {
      // Ensure the retriever ID matches what's expected
      expect(check.factIds[0]).toBe('azure-devops-bugs-retriever');

      // Ensure the fact key matches the schema from the retriever
      expect(check.factIds[1]).toBe('azure_bug_count');
    });
  });

  // Test: ensure the check type aligns with the fact retriever schema
  test('check type aligns with fact retriever schema', () => {
    const azureBugsCheck = azureBugsChecks.find(
      check => check.id === 'azure-bugs',
    );

    // The fact retriever schema defines azure_bug_count as integer,
    // so the check type should be 'number'
    expect(azureBugsCheck?.type).toBe('number');
  });

  // Test: verify array is not empty
  test('azureBugsChecks array is not empty', () => {
    expect(azureBugsChecks).toBeDefined();
    expect(Array.isArray(azureBugsChecks)).toBe(true);
    expect(azureBugsChecks.length).toBeGreaterThan(0);
  });

  // Test: ensure unique check IDs
  test('all check IDs are unique', () => {
    const ids = azureBugsChecks.map(check => check.id);
    const uniqueIds = [...new Set(ids)];

    expect(ids.length).toBe(uniqueIds.length);
  });

  // Test: validate annotation key format
  test('annotation keys follow the correct domain pattern', () => {
    azureBugsChecks.forEach(check => {
      expect(check.annotationKeyThreshold).toMatch(
        /^tech-insights\.io\/[a-z-]+$/,
      );
      expect(check.annotationKeyOperator).toMatch(
        /^tech-insights\.io\/[a-z-]+$/,
      );
    });
  });
});
