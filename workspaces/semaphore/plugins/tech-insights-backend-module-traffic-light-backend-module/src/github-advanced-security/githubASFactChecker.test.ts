import { githubAdvancedSecuritychecks } from './githubASFactChecker';

describe('GitHub Advanced Security Checks Configuration', () => {
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
    githubAdvancedSecuritychecks.forEach(check => {
      requiredFields.forEach(field => {
        expect(check).toHaveProperty(field);
      });
    });
  });

  // Test: naming conventions for the fact checkers
  test('each check follows the naming conventions', () => {
    githubAdvancedSecuritychecks.forEach(check => {
      // Check that annotation keys follow convention
      expect(check.annotationKeyThreshold).toMatch(
        /^tech-insights\.io\/github-advanced-security-/,
      );
      expect(check.annotationKeyOperator).toMatch(
        /^tech-insights\.io\/github-advanced-security-/,
      );

      // Check that all factIds arrays start with the correct retriever
      expect(check.factIds[0]).toBe('githubAdvancedSecurityFactRetriever');
    });
  });

  // Test: check if all metrics are covered by the fact checkers
  test('checks cover expected security metrics', () => {
    // Verify that important security metrics are covered
    const expectedMetrics = [
      'criticalCount',
      'highCount',
      'mediumCount',
      'lowCount',
      'openSecretScanningAlertCount',
    ];

    // Extract second factId (the actual metric being checked)
    const coveredMetrics = githubAdvancedSecuritychecks.map(
      check => check.factIds[1],
    );

    // Ensure all expected metrics are covered
    expectedMetrics.forEach(metric => {
      expect(coveredMetrics).toContain(metric);
    });
  });

  // Test: verify specific check configurations
  test('critical count check is properly configured', () => {
    const criticalCheck = githubAdvancedSecuritychecks.find(
      check => check.id === 'critical-count',
    );

    expect(criticalCheck).toBeDefined();
    expect(criticalCheck?.type).toBe('number');
    expect(criticalCheck?.factIds).toEqual([
      'githubAdvancedSecurityFactRetriever',
      'criticalCount',
    ]);
    expect(criticalCheck?.name).toBe('Critical Scans Count');
    expect(criticalCheck?.description).toContain('critical scans count');
  });

  test('high count check is properly configured', () => {
    const highCheck = githubAdvancedSecuritychecks.find(
      check => check.id === 'high-count',
    );

    expect(highCheck).toBeDefined();
    expect(highCheck?.type).toBe('number');
    expect(highCheck?.factIds).toEqual([
      'githubAdvancedSecurityFactRetriever',
      'highCount',
    ]);
    expect(highCheck?.name).toBe('High Scans Count');
    expect(highCheck?.description).toContain('high scans count');
  });

  test('medium count check is properly configured', () => {
    const mediumCheck = githubAdvancedSecuritychecks.find(
      check => check.id === 'medium-count',
    );

    expect(mediumCheck).toBeDefined();
    expect(mediumCheck?.type).toBe('number');
    expect(mediumCheck?.factIds).toEqual([
      'githubAdvancedSecurityFactRetriever',
      'mediumCount',
    ]);
    expect(mediumCheck?.name).toBe('Medium Scans Count');
    expect(mediumCheck?.description).toContain('medium scans count');
  });

  test('low count check is properly configured', () => {
    const lowCheck = githubAdvancedSecuritychecks.find(
      check => check.id === 'low-count',
    );

    expect(lowCheck).toBeDefined();
    expect(lowCheck?.type).toBe('number');
    expect(lowCheck?.factIds).toEqual([
      'githubAdvancedSecurityFactRetriever',
      'lowCount',
    ]);
    expect(lowCheck?.name).toBe('Low Scans Count');
    expect(lowCheck?.description).toContain('low scans count');
  });

  test('secret scanning alert check is properly configured', () => {
    const secretCheck = githubAdvancedSecuritychecks.find(
      check => check.id === 'open-secret-scanning-alert-count',
    );

    expect(secretCheck).toBeDefined();
    expect(secretCheck?.type).toBe('number');
    expect(secretCheck?.factIds).toEqual([
      'githubAdvancedSecurityFactRetriever',
      'openSecretScanningAlertCount',
    ]);
    expect(secretCheck?.name).toBe('Secret Scans Count');
    expect(secretCheck?.description).toContain('secret scans count');
  });

  // Test: annotation key consistency with check configuration
  test('annotation keys match expected patterns', () => {
    const expectedAnnotations = {
      'critical-count': {
        threshold:
          'tech-insights.io/github-advanced-security-critical-count-threshold',
        operator:
          'tech-insights.io/github-advanced-security-critical-count-operator',
      },
      'high-count': {
        threshold:
          'tech-insights.io/github-advanced-security-high-count-threshold',
        operator:
          'tech-insights.io/github-advanced-security-high-count-operator',
      },
      'medium-count': {
        threshold:
          'tech-insights.io/github-advanced-security-medium-count-threshold',
        operator:
          'tech-insights.io/github-advanced-security-medium-count-operator',
      },
      'low-count': {
        threshold:
          'tech-insights.io/github-advanced-security-low-count-threshold',
        operator:
          'tech-insights.io/github-advanced-security-low-count-operator',
      },
      'open-secret-scanning-alert-count': {
        threshold:
          'tech-insights.io/github-advanced-security-secrets-threshold',
        operator: 'tech-insights.io/github-advanced-security-secrets-operator',
      },
    };

    githubAdvancedSecuritychecks.forEach(check => {
      const expectedAnnotation =
        expectedAnnotations[check.id as keyof typeof expectedAnnotations];
      expect(expectedAnnotation).toBeDefined();
      expect(check.annotationKeyThreshold).toBe(expectedAnnotation.threshold);
      expect(check.annotationKeyOperator).toBe(expectedAnnotation.operator);
    });
  });

  // Test: factIds array structure
  test('factIds arrays have correct structure', () => {
    githubAdvancedSecuritychecks.forEach(check => {
      expect(Array.isArray(check.factIds)).toBe(true);
      expect(check.factIds).toHaveLength(2);
      expect(typeof check.factIds[0]).toBe('string');
      expect(typeof check.factIds[1]).toBe('string');
    });
  });

  // Test: type field validation
  test('type field contains valid values', () => {
    const validTypes = ['percentage', 'number', 'boolean'];

    githubAdvancedSecuritychecks.forEach(check => {
      expect(validTypes).toContain(check.type);
    });
  });

  // Test: all checks use number type (specific to security counts)
  test('all security checks use number type', () => {
    githubAdvancedSecuritychecks.forEach(check => {
      expect(check.type).toBe('number');
    });
  });

  // Test: description field validation
  test('description field is meaningful', () => {
    githubAdvancedSecuritychecks.forEach(check => {
      expect(check.description).toBeTruthy();
      expect(check.description.length).toBeGreaterThan(10);
      expect(typeof check.description).toBe('string');
      expect(check.description).toContain('GitHub Advanced Security');
    });
  });

  // Test: check IDs are unique
  test('all check IDs are unique', () => {
    const ids = githubAdvancedSecuritychecks.map(check => check.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  // Test: check names are unique
  test('all check names are unique', () => {
    const names = githubAdvancedSecuritychecks.map(check => check.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  // Test: verify expected number of checks
  test('has expected number of security checks', () => {
    expect(githubAdvancedSecuritychecks).toHaveLength(5);
  });

  // Test: security severity levels coverage
  test('covers all security severity levels', () => {
    const severityChecks = [
      'critical-count',
      'high-count',
      'medium-count',
      'low-count',
    ];
    const checkIds = githubAdvancedSecuritychecks.map(check => check.id);

    severityChecks.forEach(severityCheck => {
      expect(checkIds).toContain(severityCheck);
    });
  });

  // Test: secret scanning check exists
  test('includes secret scanning check', () => {
    const secretScanningCheck = githubAdvancedSecuritychecks.find(
      check => check.id === 'open-secret-scanning-alert-count',
    );
    expect(secretScanningCheck).toBeDefined();
  });
});
