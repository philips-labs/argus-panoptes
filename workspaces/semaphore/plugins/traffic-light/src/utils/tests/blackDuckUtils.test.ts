import {
  BlackDuckUtils,
  DEFAULT_METRICS,
  DEFAULT_CHECKS,
} from '../blackDuckUtils';
import { TechInsightsApi } from '@backstage/plugin-tech-insights';
import { CompoundEntityRef, Entity } from '@backstage/catalog-model';
import {
  DynamicThresholdResult,
  DynamicThresholdCheck,
} from '@internal/plugin-tech-insights-backend-module-traffic-light-backend-module';

// Mock the TechInsightsApi
const mockTechInsightsApi = {
  getFacts: jest.fn(),
  getCheckResultRenderers: jest.fn(),
  getAllChecks: jest.fn(),
  runChecks: jest.fn(),
  runBulkChecks: jest.fn(),
  getFactSchemas: jest.fn(),
} as jest.Mocked<TechInsightsApi>;

// Helper function to create mock check results that match the DynamicThresholdResult format
const createMockCheckResult = (
  id: string,
  result: boolean,
): DynamicThresholdResult => ({
  check: {
    id,
    name: `${id} Check`,
    type: 'dynamic-threshold',
    factIds: ['blackduck-fact-retriever', 'security_risks_critical'],
    annotationKeyThreshold: 'blackduck.threshold',
    annotationKeyOperator: 'blackduck.operator',
    description: `Check for ${id}`,
  } as DynamicThresholdCheck,
  facts: {
    'blackduck-fact-retriever': {
      id: 'blackduck-fact-retriever',
      type: 'integer',
      description: 'BlackDuck security facts',
      value: result ? 1 : 0,
    },
  },
  result,
});

// Mock entity references
const mockEntityRef: CompoundEntityRef = {
  kind: 'Component',
  namespace: 'default',
  name: 'test-service',
};

describe('BlackDuckUtils', () => {
  let blackDuckUtils: BlackDuckUtils;

  beforeEach(() => {
    blackDuckUtils = new BlackDuckUtils();
    jest.clearAllMocks();
  });

  describe('getBlackDuckFacts', () => {
    it('should return parsed metrics when facts are available', async () => {
      const mockFacts = {
        security_risks_critical: '5',
        security_risks_high: '10',
        security_risks_medium: '2',
      };

      mockTechInsightsApi.getFacts.mockResolvedValue({
        'blackduck-fact-retriever': {
          timestamp: '2023-10-01T00:00:00Z',
          version: '1.0.0',
          facts: mockFacts,
        },
      });

      const result = await blackDuckUtils.getBlackDuckFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(mockTechInsightsApi.getFacts).toHaveBeenCalledWith(mockEntityRef, [
        'blackduck-fact-retriever',
      ]);
      expect(result).toEqual({
        security_risks_critical: 5,
        security_risks_high: 10,
        security_risks_medium: 2,
      });
    });

    it('should handle missing facts gracefully', async () => {
      const mockFacts = {
        security_risks_critical: '5',
        security_risks_high: null,
        security_risks_medium: null,
      };

      mockTechInsightsApi.getFacts.mockResolvedValue({
        'blackduck-fact-retriever': {
          timestamp: '2023-10-01T00:00:00Z',
          version: '1.0.0',
          facts: mockFacts,
        },
      });

      const result = await blackDuckUtils.getBlackDuckFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual({
        security_risks_critical: 5,
        security_risks_high: 0,
        security_risks_medium: 0,
      });
    });

    it('should return default metrics when no facts are found', async () => {
      mockTechInsightsApi.getFacts.mockResolvedValue({
        'blackduck-fact-retriever': {
          timestamp: '2023-10-01T00:00:00Z',
          version: '1.0.0',
          facts: {},
        },
      });

      const result = await blackDuckUtils.getBlackDuckFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual(DEFAULT_METRICS);
    });

    it('should return default metrics when response is undefined', async () => {
      mockTechInsightsApi.getFacts.mockResolvedValue({});

      const result = await blackDuckUtils.getBlackDuckFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual(DEFAULT_METRICS);
    });

    it('should return default metrics when API throws an error', async () => {
      mockTechInsightsApi.getFacts.mockRejectedValue(new Error('API Error'));

      const result = await blackDuckUtils.getBlackDuckFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual(DEFAULT_METRICS);
    });

    it('should handle non-numeric values appropriately', async () => {
      const mockFacts = {
        security_risks_critical: 'not-a-number',
        security_risks_high: '',
        security_risks_medium: 'invalid',
      };

      mockTechInsightsApi.getFacts.mockResolvedValue({
        'blackduck-fact-retriever': {
          timestamp: '2023-10-01T00:00:00Z',
          version: '1.0.0',
          facts: mockFacts,
        },
      });

      const result = await blackDuckUtils.getBlackDuckFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual({
        security_risks_critical: 0,
        security_risks_high: 0,
        security_risks_medium: 0,
      });
    });
  });

  describe('getBlackDuckChecks', () => {
    it('should return correct check results when all checks are present and true', async () => {
      const mockCheckResults = [
        createMockCheckResult('blackduck-critical-security-risk', true),
        createMockCheckResult('blackduck-high-security-risk', true),
        createMockCheckResult('blackduck-medium-security-risk', true),
      ];

      mockTechInsightsApi.runChecks.mockResolvedValue(mockCheckResults);

      const result = await blackDuckUtils.getBlackDuckChecks(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual({
        criticalSecurityCheck: true,
        highSecurityCheck: true,
        mediumSecurityCheck: true,
      });
      expect(mockTechInsightsApi.runChecks).toHaveBeenCalledWith(mockEntityRef);
    });

    it('should return default checks when no check results are found', async () => {
      mockTechInsightsApi.runChecks.mockResolvedValue([]);

      const result = await blackDuckUtils.getBlackDuckChecks(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual(DEFAULT_CHECKS);
      expect(mockTechInsightsApi.runChecks).toHaveBeenCalledWith(mockEntityRef);
    });

    it('should return default metrics when API throws an error', async () => {
      mockTechInsightsApi.getFacts.mockRejectedValue(new Error('API Error'));

      const result = await blackDuckUtils.getBlackDuckChecks(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual(DEFAULT_CHECKS);
    });
  });

  describe('getTop5CriticalBlackDuckRepos', () => {
    const createMockEntity = (name: string): Entity => ({
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: { name, namespace: 'default' },
      spec: { type: 'service' },
    });

    it('should prioritize repositories with critical security risks', async () => {
      const entities = [
        createMockEntity('service-1'),
        createMockEntity('service-2'),
        createMockEntity('service-3'),
      ];

      mockTechInsightsApi.getFacts
        .mockResolvedValueOnce({
          'blackduck-fact-retriever': {
            timestamp: '2023-10-01T00:00:00Z',
            version: '1.0.0',
            facts: {
              security_risks_critical: '3',
              security_risks_high: '2',
              security_risks_medium: '1',
            },
          },
        })
        .mockResolvedValueOnce({
          'blackduck-fact-retriever': {
            timestamp: '2023-10-01T00:00:00Z',
            version: '1.0.0',
            facts: {
              security_risks_critical: '1',
              security_risks_high: '1',
              security_risks_medium: '1',
            },
          },
        })
        .mockResolvedValueOnce({
          'blackduck-fact-retriever': {
            timestamp: '2023-10-01T00:00:00Z',
            version: '1.0.0',
            facts: {
              security_risks_critical: '5',
              security_risks_high: '2',
              security_risks_medium: '1',
            },
          },
        });

      const result = await blackDuckUtils.getTop5CriticalBlackDuckRepos(
        mockTechInsightsApi,
        entities,
      );

      expect(result).toHaveLength(3);
      // Failed quality gates should come first
      expect(result[0].entity.name).toBe('service-3');
      expect(result[0].security_risks_critical).toBe(5);
      expect(result[1].entity.name).toBe('service-1');
      expect(result[1].security_risks_critical).toBe(3);
      // Then repositories with vulnerabilities
      expect(result[2].entity.name).toBe('service-2');
      expect(result[2].security_risks_critical).toBe(1);
    });

    it('should prioritize by high security risks whencritical security risks are equal', async () => {
      const entities = [
        createMockEntity('low-risks'),
        createMockEntity('high-risks'),
        createMockEntity('medium-risks'),
      ];

      mockTechInsightsApi.getFacts
        .mockResolvedValueOnce({
          'blackduck-fact-retriever': {
            timestamp: '2023-10-01T00:00:00Z',
            version: '1.0.0',
            facts: {
              security_risks_critical: '0',
              security_risks_high: '1',
              security_risks_medium: '1',
            },
          },
        })
        .mockResolvedValueOnce({
          'blackduck-fact-retriever': {
            timestamp: '2023-10-01T00:00:00Z',
            version: '1.0.0',
            facts: {
              security_risks_critical: '0',
              security_risks_high: '7',
              security_risks_medium: '1',
            },
          },
        })
        .mockResolvedValueOnce({
          'blackduck-fact-retriever': {
            timestamp: '2023-10-01T00:00:00Z',
            version: '1.0.0',
            facts: {
              security_risks_critical: '0',
              security_risks_high: '2',
              security_risks_medium: '1',
            },
          },
        });

      const result = await blackDuckUtils.getTop5CriticalBlackDuckRepos(
        mockTechInsightsApi,
        entities,
      );

      expect(result).toHaveLength(3);
      expect(result[0].entity.name).toBe('high-risks');
      expect(result[0].security_risks_high).toBe(7);
      expect(result[1].entity.name).toBe('medium-risks');
      expect(result[1].security_risks_high).toBe(2);
      expect(result[2].entity.name).toBe('low-risks');
      expect(result[2].security_risks_high).toBe(1);
    });

    it('should prioritize by medium security risks when high security risks are equal', async () => {
      const entities = [
        createMockEntity('low-risks'),
        createMockEntity('high-risks'),
        createMockEntity('medium-risks'),
      ];

      mockTechInsightsApi.getFacts
        .mockResolvedValueOnce({
          'blackduck-fact-retriever': {
            timestamp: '2023-10-01T00:00:00Z',
            version: '1.0.0',
            facts: {
              security_risks_critical: '0',
              security_risks_high: '0',
              security_risks_medium: '1',
            },
          },
        })
        .mockResolvedValueOnce({
          'blackduck-fact-retriever': {
            timestamp: '2023-10-01T00:00:00Z',
            version: '1.0.0',
            facts: {
              security_risks_critical: '0',
              security_risks_high: '0',
              security_risks_medium: '10',
            },
          },
        })
        .mockResolvedValueOnce({
          'blackduck-fact-retriever': {
            timestamp: '2023-10-01T00:00:00Z',
            version: '1.0.0',
            facts: {
              security_risks_critical: '0',
              security_risks_high: '0',
              security_risks_medium: '5',
            },
          },
        });

      const result = await blackDuckUtils.getTop5CriticalBlackDuckRepos(
        mockTechInsightsApi,
        entities,
      );

      expect(result).toHaveLength(3);
      expect(result[0].entity.name).toBe('high-risks');
      expect(result[0].security_risks_medium).toBe(10);
      expect(result[1].entity.name).toBe('medium-risks');
      expect(result[1].security_risks_medium).toBe(5);
      expect(result[2].entity.name).toBe('low-risks');
      expect(result[2].security_risks_medium).toBe(1);
    });

    it('should limit results to 5 repositories', async () => {
      const entities = Array.from({ length: 10 }, (_, i) =>
        createMockEntity(`service-${i}`),
      );

      // Mock all entities to have failed quality gates
      mockTechInsightsApi.getFacts.mockResolvedValue({
        'blackduck-fact-retriever': {
          timestamp: '2023-10-01T00:00:00Z',
          version: '1.0.0',
          facts: {
            security_risks_critical: '2',
            security_risks_high: '2',
            security_risks_medium: '2',
          },
        },
      });

      const result = await blackDuckUtils.getTop5CriticalBlackDuckRepos(
        mockTechInsightsApi,
        entities,
      );

      expect(result).toHaveLength(5);
    });

    it('should handle API errors gracefully', async () => {
      const entities = [createMockEntity('failing-service')];

      mockTechInsightsApi.getFacts.mockRejectedValue(new Error('API Error'));

      const result = await blackDuckUtils.getTop5CriticalBlackDuckRepos(
        mockTechInsightsApi,
        entities,
      );

      expect(result).toHaveLength(1);
      expect(result[0].entity.name).toBe('failing-service');
      expect(result[0].security_risks_critical).toBe(0);
      expect(result[0].security_risks_high).toBe(0);
      expect(result[0].security_risks_medium).toBe(0);
    });

    it('should handle empty entities array', async () => {
      const result = await blackDuckUtils.getTop5CriticalBlackDuckRepos(
        mockTechInsightsApi,
        [],
      );

      expect(result).toHaveLength(0);
      expect(mockTechInsightsApi.getFacts).not.toHaveBeenCalled();
    });

    it('should handle mixed scenarios with complex prioritization', async () => {
      const entities = [
        createMockEntity('perfect-repo'), // No issues
        createMockEntity('critical'), // Many critical security issues
        createMockEntity('high'), // Many high security issues
        createMockEntity('medium'), // Many medium security issues
        createMockEntity('another-critical'), // Another with many critical issues
      ];

      mockTechInsightsApi.getFacts
        .mockResolvedValueOnce({
          'blackduck-fact-retriever': {
            timestamp: '2023-10-01T00:00:00Z',
            version: '1.0.0',
            facts: {
              security_risks_critical: '0',
              security_risks_high: '0',
              security_risks_medium: '0',
            },
          },
        })
        .mockResolvedValueOnce({
          'blackduck-fact-retriever': {
            timestamp: '2023-10-01T00:00:00Z',
            version: '1.0.0',
            facts: {
              security_risks_critical: '10',
              security_risks_high: '2',
              security_risks_medium: '1',
            },
          },
        })
        .mockResolvedValueOnce({
          'blackduck-fact-retriever': {
            timestamp: '2023-10-01T00:00:00Z',
            version: '1.0.0',
            facts: {
              security_risks_critical: '0',
              security_risks_high: '7',
              security_risks_medium: '5',
            },
          },
        })
        .mockResolvedValueOnce({
          'blackduck-fact-retriever': {
            timestamp: '2023-10-01T00:00:00Z',
            version: '1.0.0',
            facts: {
              security_risks_critical: '0',
              security_risks_high: '0',
              security_risks_medium: '20',
            },
          },
        })
        .mockResolvedValueOnce({
          'blackduck-fact-retriever': {
            timestamp: '2023-10-01T00:00:00Z',
            version: '1.0.0',
            facts: {
              security_risks_critical: '5',
              security_risks_high: '6',
              security_risks_medium: '8',
            },
          },
        });

      const result = await blackDuckUtils.getTop5CriticalBlackDuckRepos(
        mockTechInsightsApi,
        entities,
      );

      expect(result).toHaveLength(5);

      // First should be critical security issues
      expect(result[0].entity.name).toBe('critical');
      expect(result[0].security_risks_critical).toBe(10);
      expect(result[1].entity.name).toBe('another-critical');
      expect(result[1].security_risks_critical).toBe(5);

      // Then high security issues
      expect(result[2].entity.name).toBe('high');
      expect(result[2].security_risks_high).toBe(7);

      // Then medium security issues
      expect(result[3].entity.name).toBe('medium');
      expect(result[3].security_risks_medium).toBe(20);

      // Then perfect repo
      expect(result[4].entity.name).toBe('perfect-repo');
    });
  });
});
