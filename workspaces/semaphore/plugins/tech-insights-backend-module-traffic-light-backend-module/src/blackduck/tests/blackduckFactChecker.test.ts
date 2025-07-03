import { BlackDuckChecks } from '../blackduckFactChecker';

describe('BlackDuck Checks Configuration', () => {
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
    BlackDuckChecks.forEach(check => {
      requiredFields.forEach(field => {
        expect(check).toHaveProperty(field);
      });
    });
  });

  // Test: naming conventions for the fact checkers
  test('each check follows the naming conventions', () => {
    BlackDuckChecks.forEach(check => {
      // Check IDs follow the pattern 'blackduck-*'
      expect(check.id).toMatch(/^blackduck-/);

      // Check that annotation keys follow convention
      expect(check.annotationKeyThreshold).toMatch(
        /^tech-insights\.io\/blackduck-/,
      );
      expect(check.annotationKeyOperator).toMatch(
        /^tech-insights\.io\/blackduck-/,
      );

      // Check that all factIds arrays start with the correct retriever
      expect(check.factIds[0]).toBe('blackduck-fact-retriever');
    });
  });

  // Test: check if all security risk metrics are covered by the fact checkers
  test('checks cover expected security risk metrics', () => {
    // Verify that all security risk metrics are covered
    const expectedMetrics = [
      'security_risks_critical',
      'security_risks_high',
      'security_risks_medium',
    ];

    // Extract second factId (the actual metric being checked)
    const coveredMetrics = BlackDuckChecks.map(check => check.factIds[1]);

    // Ensure all expected metrics are covered
    expectedMetrics.forEach(metric => {
      expect(coveredMetrics).toContain(metric);
    });
  });

  // Test: verify specific check configurations
  test('blackduck critical security risk check is properly configured', () => {
    const criticalRiskCheck = BlackDuckChecks.find(
      check => check.id === 'blackduck-critical-security-risk',
    );

    expect(criticalRiskCheck).toBeDefined();
    expect(criticalRiskCheck?.type).toBe('number');
    expect(criticalRiskCheck?.factIds).toEqual([
      'blackduck-fact-retriever',
      'security_risks_critical',
    ]);
    expect(criticalRiskCheck?.name).toBe('BlackDuck Critical Security Risk');
    expect(criticalRiskCheck?.description).toContain('critical security risk');
  });

  test('blackduck high security risk check is properly configured', () => {
    const highRiskCheck = BlackDuckChecks.find(
      check => check.id === 'blackduck-high-security-risk',
    );

    expect(highRiskCheck).toBeDefined();
    expect(highRiskCheck?.type).toBe('number');
    expect(highRiskCheck?.factIds).toEqual([
      'blackduck-fact-retriever',
      'security_risks_high',
    ]);
    expect(highRiskCheck?.name).toBe('BlackDuck High Security Risk');
    expect(highRiskCheck?.description).toContain('high security risk');
  });

  test('blackduck medium security risk check is properly configured', () => {
    const mediumRiskCheck = BlackDuckChecks.find(
      check => check.id === 'blackduck-medium-security-risk',
    );

    expect(mediumRiskCheck).toBeDefined();
    expect(mediumRiskCheck?.type).toBe('number');
    expect(mediumRiskCheck?.factIds).toEqual([
      'blackduck-fact-retriever',
      'security_risks_medium',
    ]);
    expect(mediumRiskCheck?.name).toBe('BlackDuck Medium Security Risk');
    expect(mediumRiskCheck?.description).toContain('medium security risk');
  });

  // Test: annotation key consistency
  test('annotation keys are consistent with check id', () => {
    BlackDuckChecks.forEach(check => {
      const expectedThresholdKey = `tech-insights.io/${check.id}-threshold`;
      const expectedOperatorKey = `tech-insights.io/${check.id}-operator`;

      expect(check.annotationKeyThreshold).toBe(expectedThresholdKey);
      expect(check.annotationKeyOperator).toBe(expectedOperatorKey);
    });
  });

  // Test: factIds array structure
  test('factIds arrays have correct structure', () => {
    BlackDuckChecks.forEach(check => {
      expect(Array.isArray(check.factIds)).toBe(true);
      expect(check.factIds).toHaveLength(2);
      expect(typeof check.factIds[0]).toBe('string');
      expect(typeof check.factIds[1]).toBe('string');
    });
  });

  // Test: type field validation
  test('type field contains valid values', () => {
    const validTypes = ['percentage', 'number', 'boolean'];

    BlackDuckChecks.forEach(check => {
      expect(validTypes).toContain(check.type);
    });
  });

  // Test: all checks use number type (specific to BlackDuck security risks)
  test('all BlackDuck checks use number type for security risk counts', () => {
    BlackDuckChecks.forEach(check => {
      expect(check.type).toBe('number');
    });
  });

  // Test: description field validation
  test('description field is meaningful', () => {
    BlackDuckChecks.forEach(check => {
      expect(check.description).toBeTruthy();
      expect(check.description.length).toBeGreaterThan(10);
      expect(typeof check.description).toBe('string');
    });
  });

  // Test: verify all security risk severity levels are covered
  test('covers all security risk severity levels', () => {
    const severityLevels = ['critical', 'high', 'medium'];

    severityLevels.forEach(severity => {
      const checkExists = BlackDuckChecks.some(
        check =>
          check.id.includes(severity) && check.factIds[1].includes(severity),
      );
      expect(checkExists).toBe(true);
    });
  });

  // Test: ensure consistent naming pattern across all checks
  test('all checks follow consistent naming pattern', () => {
    BlackDuckChecks.forEach(check => {
      // Check name starts with "BlackDuck"
      expect(check.name).toMatch(/^BlackDuck/);

      // Check name contains security risk terminology
      expect(check.name).toMatch(/Security Risk$/);

      // Check description contains "security risk"
      expect(check.description.toLowerCase()).toContain('security risk');

      // Check description mentions BlackDuck
      expect(check.description).toContain('BlackDuck');
    });
  });

  // Test: verify expected number of checks
  test('has expected number of security risk checks', () => {
    expect(BlackDuckChecks).toHaveLength(3);
  });

  // Test: ensure no duplicate IDs
  test('all check IDs are unique', () => {
    const ids = BlackDuckChecks.map(check => check.id);
    const uniqueIds = [...new Set(ids)];
    expect(ids).toHaveLength(uniqueIds.length);
  });

  // Test: ensure no duplicate annotation keys
  test('all annotation keys are unique', () => {
    const thresholdKeys = BlackDuckChecks.map(
      check => check.annotationKeyThreshold,
    );
    const operatorKeys = BlackDuckChecks.map(
      check => check.annotationKeyOperator,
    );

    const uniqueThresholdKeys = [...new Set(thresholdKeys)];
    const uniqueOperatorKeys = [...new Set(operatorKeys)];

    expect(thresholdKeys).toHaveLength(uniqueThresholdKeys.length);
    expect(operatorKeys).toHaveLength(uniqueOperatorKeys.length);
  });
});
