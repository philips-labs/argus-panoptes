import { DependabotChecks } from './dependabotFactChecker';

describe('Dependabot Checks Configuration', () => {
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
    DependabotChecks.forEach(check => {
      requiredFields.forEach(field => {
        expect(check).toHaveProperty(field);
      });
    });
  });

  // Test: naming conventions for the fact checkers
  test('each check follows the naming conventions', () => {
    DependabotChecks.forEach(check => {
      // Check IDs follow the pattern 'dependabot-*'
      expect(check.id).toMatch(/^dependabot-/);

      // Check that annotation keys follow convention
      expect(check.annotationKeyThreshold).toMatch(
        /^tech-insights\.io\/dependabot-/,
      );
      expect(check.annotationKeyOperator).toMatch(
        /^tech-insights\.io\/dependabot-/,
      );

      // Check that all factIds arrays start with the correct retriever
      expect(check.factIds[0]).toBe('dependabotFactRetriever');
    });
  });

  // Test: check if all metrics are covered by the fact checkers
  test('checks cover expected Dependabot severity metrics', () => {
    // Verify that important Dependabot severity metrics are covered
    const expectedMetrics = ['critical', 'high', 'medium'];

    // Extract second factId (the actual metric being checked)
    const coveredMetrics = DependabotChecks.map(check => check.factIds[1]);

    // Ensure all expected metrics are covered
    expectedMetrics.forEach(metric => {
      expect(coveredMetrics).toContain(metric);
    });
  });

  // Test: verify specific check configurations
  test('critical alerts check is properly configured', () => {
    const criticalCheck = DependabotChecks.find(
      check => check.id === 'dependabot-critical-alerts',
    );

    expect(criticalCheck).toBeDefined();
    expect(criticalCheck?.type).toBe('number');
    expect(criticalCheck?.factIds).toEqual([
      'dependabotFactRetriever',
      'critical',
    ]);
    expect(criticalCheck?.name).toBe('Dependabot Critical Alerts Count');
    expect(criticalCheck?.description).toContain('critical Dependabot alerts');
  });

  test('high alerts check is properly configured', () => {
    const highCheck = DependabotChecks.find(
      check => check.id === 'dependabot-high-alerts',
    );

    expect(highCheck).toBeDefined();
    expect(highCheck?.type).toBe('number');
    expect(highCheck?.factIds).toEqual(['dependabotFactRetriever', 'high']);
    expect(highCheck?.name).toBe('Dependabot High Alerts Count');
    expect(highCheck?.description).toContain('high Dependabot alerts');
  });

  test('medium alerts check is properly configured', () => {
    const mediumCheck = DependabotChecks.find(
      check => check.id === 'dependabot-medium-alerts',
    );

    expect(mediumCheck).toBeDefined();
    expect(mediumCheck?.type).toBe('number');
    expect(mediumCheck?.factIds).toEqual(['dependabotFactRetriever', 'medium']);
    expect(mediumCheck?.name).toBe('Dependabot Medium Alerts Count');
    expect(mediumCheck?.description).toContain('medium Dependabot alerts');
  });

  // Test: annotation key consistency with check configuration
  test('annotation keys match expected patterns', () => {
    const expectedAnnotations = {
      'dependabot-critical-alerts': {
        threshold: 'tech-insights.io/dependabot-critical-alert-threshold',
        operator: 'tech-insights.io/dependabot-operator',
      },
      'dependabot-high-alerts': {
        threshold: 'tech-insights.io/dependabot-high-alert-threshold',
        operator: 'tech-insights.io/dependabot-operator',
      },
      'dependabot-medium-alerts': {
        threshold: 'tech-insights.io/dependabot-medium-alert-threshold',
        operator: 'tech-insights.io/dependabot-operator',
      },
    };

    DependabotChecks.forEach(check => {
      const expectedAnnotation =
        expectedAnnotations[check.id as keyof typeof expectedAnnotations];
      expect(expectedAnnotation).toBeDefined();
      expect(check.annotationKeyThreshold).toBe(expectedAnnotation.threshold);
      expect(check.annotationKeyOperator).toBe(expectedAnnotation.operator);
    });
  });

  // Test: all checks use the same operator annotation key
  test('all checks use the same operator annotation key', () => {
    const expectedOperatorKey = 'tech-insights.io/dependabot-operator';

    DependabotChecks.forEach(check => {
      expect(check.annotationKeyOperator).toBe(expectedOperatorKey);
    });
  });

  // Test: factIds array structure
  test('factIds arrays have correct structure', () => {
    DependabotChecks.forEach(check => {
      expect(Array.isArray(check.factIds)).toBe(true);
      expect(check.factIds).toHaveLength(2);
      expect(typeof check.factIds[0]).toBe('string');
      expect(typeof check.factIds[1]).toBe('string');
    });
  });

  // Test: type field validation
  test('type field contains valid values', () => {
    const validTypes = ['percentage', 'number', 'boolean'];

    DependabotChecks.forEach(check => {
      expect(validTypes).toContain(check.type);
    });
  });

  // Test: all checks use number type (specific to alert counts)
  test('all Dependabot checks use number type', () => {
    DependabotChecks.forEach(check => {
      expect(check.type).toBe('number');
    });
  });

  // Test: description field validation
  test('description field is meaningful', () => {
    DependabotChecks.forEach(check => {
      expect(check.description).toBeTruthy();
      expect(check.description.length).toBeGreaterThan(10);
      expect(typeof check.description).toBe('string');
      expect(check.description).toContain('Dependabot');
    });
  });

  // Test: check IDs are unique
  test('all check IDs are unique', () => {
    const ids = DependabotChecks.map(check => check.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  // Test: check names are unique
  test('all check names are unique', () => {
    const names = DependabotChecks.map(check => check.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  // Test: verify expected number of checks
  test('has expected number of Dependabot checks', () => {
    expect(DependabotChecks).toHaveLength(3);
  });

  // Test: severity levels coverage
  test('covers main security severity levels', () => {
    const severityChecks = [
      'dependabot-critical-alerts',
      'dependabot-high-alerts',
      'dependabot-medium-alerts',
    ];
    const checkIds = DependabotChecks.map(check => check.id);

    severityChecks.forEach(severityCheck => {
      expect(checkIds).toContain(severityCheck);
    });
  });

  // Test: severity metrics mapping
  test('severity levels map correctly to metrics', () => {
    const severityMapping = {
      'dependabot-critical-alerts': 'critical',
      'dependabot-high-alerts': 'high',
      'dependabot-medium-alerts': 'medium',
    };

    DependabotChecks.forEach(check => {
      const expectedMetric =
        severityMapping[check.id as keyof typeof severityMapping];
      expect(check.factIds[1]).toBe(expectedMetric);
    });
  });

  // Test: naming consistency in check names
  test('check names follow consistent pattern', () => {
    DependabotChecks.forEach(check => {
      expect(check.name).toMatch(/^Dependabot .+ Alerts Count$/);
    });
  });

  // Test: description consistency
  test('descriptions follow consistent pattern', () => {
    DependabotChecks.forEach(check => {
      expect(check.description).toMatch(
        /^Maximum number of .+ Dependabot alerts allowed$/,
      );
    });
  });

  // Test: threshold annotation keys are severity-specific
  test('threshold annotation keys are severity-specific', () => {
    const expectedThresholdPatterns = {
      'dependabot-critical-alerts': /critical-alert-threshold$/,
      'dependabot-high-alerts': /high-alert-threshold$/,
      'dependabot-medium-alerts': /medium-alert-threshold$/,
    };

    DependabotChecks.forEach(check => {
      const expectedPattern =
        expectedThresholdPatterns[
          check.id as keyof typeof expectedThresholdPatterns
        ];
      expect(check.annotationKeyThreshold).toMatch(expectedPattern);
    });
  });
});
