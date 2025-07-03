import { reportingPipelineChecks } from '../reportingFactChecker';

describe('Reporting Pipeline Checks Configuration', () => {
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
    reportingPipelineChecks.forEach(check => {
      requiredFields.forEach(field => {
        expect(check).toHaveProperty(field);
      });
    });
  });

  // Test: naming conventions for the fact checkers
  test('each check follows the naming conventions', () => {
    reportingPipelineChecks.forEach(check => {
      // Check IDs follow the pattern 'reporting-*'
      expect(check.id).toMatch(/^reporting-/);

      // Check that annotation keys follow convention
      expect(check.annotationKeyThreshold).toMatch(
        /^tech-insights\.io\/reporting-/,
      );
      expect(check.annotationKeyOperator).toMatch(
        /^tech-insights\.io\/reporting-/,
      );

      // Check that all factIds arrays start with the correct retriever
      expect(check.factIds[0]).toBe('reportingPipelineStatusFactRetriever');
    });
  });

  // Test: check if all metrics are covered by the fact checkers
  test('checks cover expected metrics', () => {
    // Verify that important reporting pipeline metrics are covered
    const expectedMetrics = ['successRate'];

    // Extract second factId (the actual metric being checked)
    const coveredMetrics = reportingPipelineChecks.map(
      check => check.factIds[1],
    );

    // Ensure all expected metrics are covered
    expectedMetrics.forEach(metric => {
      expect(coveredMetrics).toContain(metric);
    });
  });

  // Test: verify specific check configurations
  test('reporting success rate check is properly configured', () => {
    const successRateCheck = reportingPipelineChecks.find(
      check => check.id === 'reporting-success-rate',
    );

    expect(successRateCheck).toBeDefined();
    expect(successRateCheck?.type).toBe('percentage');
    expect(successRateCheck?.factIds).toEqual([
      'reportingPipelineStatusFactRetriever',
      'successRate',
    ]);
    expect(successRateCheck?.name).toBe('Reporting Pipeline Success Rate');
    expect(successRateCheck?.description).toContain('pipeline success rate');
  });

  // Test: annotation key consistency
  test('annotation keys are consistent with check id', () => {
    reportingPipelineChecks.forEach(check => {
      const expectedThresholdKey = `tech-insights.io/${check.id}-threshold`;
      const expectedOperatorKey = `tech-insights.io/${check.id}-operator`;

      expect(check.annotationKeyThreshold).toBe(expectedThresholdKey);
      expect(check.annotationKeyOperator).toBe(expectedOperatorKey);
    });
  });

  // Test: factIds array structure
  test('factIds arrays have correct structure', () => {
    reportingPipelineChecks.forEach(check => {
      expect(Array.isArray(check.factIds)).toBe(true);
      expect(check.factIds).toHaveLength(2);
      expect(typeof check.factIds[0]).toBe('string');
      expect(typeof check.factIds[1]).toBe('string');
    });
  });

  // Test: type field validation
  test('type field contains valid values', () => {
    const validTypes = ['percentage', 'number', 'boolean'];

    reportingPipelineChecks.forEach(check => {
      expect(validTypes).toContain(check.type);
    });
  });

  // Test: description field validation
  test('description field is meaningful', () => {
    reportingPipelineChecks.forEach(check => {
      expect(check.description).toBeTruthy();
      expect(check.description.length).toBeGreaterThan(10);
      expect(typeof check.description).toBe('string');
    });
  });
});
