import { foundationPipelineChecks } from '../foundationFactChecker';

describe('Foundation Pipeline Checks Configuration', () => {
  const requiredFields = [
    'id',
    'name',
    'type',
    'factIds',
    'annotationKeyThreshold',
    'annotationKeyOperator',
    'description',
  ];

  it('each check has all required fields', () => {
    foundationPipelineChecks.forEach(check => {
      requiredFields.forEach(field => {
        expect(check).toHaveProperty(field);
      });
    });
  });

  it('each check follows naming conventions', () => {
    foundationPipelineChecks.forEach(check => {
      expect(check.id).toMatch(/^foundation-/);
      expect(check.annotationKeyThreshold).toMatch(
        /^tech-insights\.io\/foundation-/,
      );
      expect(check.annotationKeyOperator).toMatch(
        /^tech-insights\.io\/foundation-/,
      );
      expect(check.factIds[0]).toBe('foundationPipelineStatusFactRetriever');
    });
  });

  it('checks cover expected metrics', () => {
    const expectedMetrics = ['successRate', 'failureWorkflowRunsCount'];
    const coveredMetrics = foundationPipelineChecks.map(
      check => check.factIds[1],
    );
    expectedMetrics.forEach(metric => {
      expect(coveredMetrics).toContain(metric);
    });
  });

  it('success rate check is properly configured', () => {
    const check = foundationPipelineChecks.find(
      c => c.id === 'foundation-success-rate',
    );
    expect(check).toBeDefined();
    expect(check?.type).toBe('percentage');
    expect(check?.factIds).toEqual([
      'foundationPipelineStatusFactRetriever',
      'successRate',
    ]);
    expect(check?.name).toBe('Foundation Pipeline Success Rate');
    expect(check?.description).toMatch(/pipeline success rate/i);
  });

  it('max failures check is properly configured', () => {
    const check = foundationPipelineChecks.find(
      c => c.id === 'foundation-max-failures',
    );
    expect(check).toBeDefined();
    expect(check?.type).toBe('number');
    expect(check?.factIds).toEqual([
      'foundationPipelineStatusFactRetriever',
      'failureWorkflowRunsCount',
    ]);
    expect(check?.name).toBe('Foundation Pipeline Max Failures');
    expect(check?.description).toMatch(/failed workflow runs/i);
  });

  it('annotation keys match check id', () => {
    foundationPipelineChecks.forEach(check => {
      const expectedThreshold = `tech-insights.io/${check.id}-threshold`;
      const expectedOperator = `tech-insights.io/${check.id}-operator`;
      expect(check.annotationKeyThreshold).toBe(expectedThreshold);
      expect(check.annotationKeyOperator).toBe(expectedOperator);
    });
  });

  it('factIds are a [retriever, metric] string array', () => {
    foundationPipelineChecks.forEach(check => {
      expect(Array.isArray(check.factIds)).toBe(true);
      expect(check.factIds.length).toBe(2);
      expect(typeof check.factIds[0]).toBe('string');
      expect(typeof check.factIds[1]).toBe('string');
    });
  });

  it('type is a valid value', () => {
    const validTypes = ['percentage', 'number', 'boolean'];
    foundationPipelineChecks.forEach(check => {
      expect(validTypes).toContain(check.type);
    });
  });

  it('description is a non-empty string with meaningful content', () => {
    foundationPipelineChecks.forEach(check => {
      expect(typeof check.description).toBe('string');
      expect(check.description.length).toBeGreaterThan(10);
    });
  });
});
