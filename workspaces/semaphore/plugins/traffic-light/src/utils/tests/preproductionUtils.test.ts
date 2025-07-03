import {
  PreproductionUtils,
  PreproductionPipelineMetrics,
  PreproductionPipelineChecks,
} from '../preproductionUtils';
import { TechInsightsApi } from '@backstage/plugin-tech-insights';
import { CompoundEntityRef } from '@backstage/catalog-model';

// Mock the TechInsightsApi
const mockTechInsightsApi = {
  getFacts: jest.fn(),
  getCheckResultRenderers: jest.fn(),
  getAllChecks: jest.fn(),
  runChecks: jest.fn(),
  runBulkChecks: jest.fn(),
  getFactSchemas: jest.fn(),
} as jest.Mocked<TechInsightsApi>;

// Helper function to create mock check results
const createMockCheckResult = (id: string, result: boolean) => ({
  check: {
    id,
    name: `${id} Check`,
    type: 'dynamic-threshold',
    factIds: ['githubPipelineStatusFactRetriever'],
    description: `Check for ${id}`,
  },
  facts: {
    githubPipelineStatusFactRetriever: {
      id: 'githubPipelineStatusFactRetriever',
      type: 'integer' as const,
      description: 'GitHub pipeline status facts',
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

// Default values for testing
const DEFAULT_METRICS: PreproductionPipelineMetrics = {
  totalWorkflowRunsCount: 0,
  uniqueWorkflowsCount: 0,
  successWorkflowRunsCount: 0,
  failureWorkflowRunsCount: 0,
  successRate: 0,
};

const DEFAULT_CHECKS: PreproductionPipelineChecks = {
  successRateCheck: false,
};

describe('PreproductionUtils', () => {
  let preproductionUtils: PreproductionUtils;

  beforeEach(() => {
    preproductionUtils = new PreproductionUtils();
    jest.clearAllMocks();
  });

  describe('getPreproductionPipelineFacts', () => {
    it('should return parsed facts when data is available', async () => {
      const mockFacts = {
        totalWorkflowRunsCount: 150,
        uniqueWorkflowsCount: 8,
        successWorkflowRunsCount: 135,
        failureWorkflowRunsCount: 15,
        successRate: 90.0,
      };

      mockTechInsightsApi.getFacts.mockResolvedValue({
        githubPipelineStatusFactRetriever: {
          timestamp: '2023-10-01T00:00:00Z',
          version: '1.0.0',
          facts: mockFacts,
        },
      });

      const result = await preproductionUtils.getPreproductionPipelineFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(mockTechInsightsApi.getFacts).toHaveBeenCalledWith(mockEntityRef, [
        'githubPipelineStatusFactRetriever',
      ]);
      expect(result).toEqual({
        totalWorkflowRunsCount: 150,
        uniqueWorkflowsCount: 8,
        successWorkflowRunsCount: 135,
        failureWorkflowRunsCount: 15,
        successRate: 90.0,
      });
    });

    it('should handle missing facts gracefully', async () => {
      const mockFacts = {
        totalWorkflowRunsCount: 100,
        uniqueWorkflowsCount: null,
        successWorkflowRunsCount: 85,
        failureWorkflowRunsCount: '',
        successRate: 'not-a-number',
      };

      mockTechInsightsApi.getFacts.mockResolvedValue({
        githubPipelineStatusFactRetriever: {
          timestamp: '2023-10-01T00:00:00Z',
          version: '1.0.0',
          facts: mockFacts,
        },
      });

      const result = await preproductionUtils.getPreproductionPipelineFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual({
        totalWorkflowRunsCount: 100,
        uniqueWorkflowsCount: 0,
        successWorkflowRunsCount: 85,
        failureWorkflowRunsCount: 0,
        successRate: NaN, // Number('not-a-number') returns NaN
      });
    });

    it('should return default metrics when no facts are found', async () => {
      mockTechInsightsApi.getFacts.mockResolvedValue({
        githubPipelineStatusFactRetriever: {
          timestamp: '2023-10-01T00:00:00Z',
          version: '1.0.0',
          facts: {},
        },
      });

      const result = await preproductionUtils.getPreproductionPipelineFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual(DEFAULT_METRICS);
    });

    it('should return default metrics when response is undefined', async () => {
      mockTechInsightsApi.getFacts.mockResolvedValue({});

      const result = await preproductionUtils.getPreproductionPipelineFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual(DEFAULT_METRICS);
    });

    it('should return default metrics when API throws an error', async () => {
      mockTechInsightsApi.getFacts.mockRejectedValue(new Error('API Error'));

      const result = await preproductionUtils.getPreproductionPipelineFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual(DEFAULT_METRICS);
    });

    it('should handle non-numeric values appropriately', async () => {
      const mockFacts = {
        totalWorkflowRunsCount: 'not-a-number',
        uniqueWorkflowsCount: '',
        successWorkflowRunsCount: 'invalid',
        failureWorkflowRunsCount: '25',
        successRate: '78.5',
      };

      mockTechInsightsApi.getFacts.mockResolvedValue({
        githubPipelineStatusFactRetriever: {
          timestamp: '2023-10-01T00:00:00Z',
          version: '1.0.0',
          facts: mockFacts,
        },
      });

      const result = await preproductionUtils.getPreproductionPipelineFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual({
        totalWorkflowRunsCount: NaN, // Number('not-a-number') returns NaN
        uniqueWorkflowsCount: 0, // Number('') returns 0
        successWorkflowRunsCount: NaN, // Number('invalid') returns NaN
        failureWorkflowRunsCount: 25, // Number('25') returns 25
        successRate: 78.5, // Number('78.5') returns 78.5
      });
    });

    it('should handle zero values correctly', async () => {
      const mockFacts = {
        totalWorkflowRunsCount: 0,
        uniqueWorkflowsCount: 0,
        successWorkflowRunsCount: 0,
        failureWorkflowRunsCount: 0,
        successRate: 0,
      };

      mockTechInsightsApi.getFacts.mockResolvedValue({
        githubPipelineStatusFactRetriever: {
          timestamp: '2023-10-01T00:00:00Z',
          version: '1.0.0',
          facts: mockFacts,
        },
      });

      const result = await preproductionUtils.getPreproductionPipelineFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual({
        totalWorkflowRunsCount: 0,
        uniqueWorkflowsCount: 0,
        successWorkflowRunsCount: 0,
        failureWorkflowRunsCount: 0,
        successRate: 0,
      });
    });

    it('should handle large numbers correctly', async () => {
      const mockFacts = {
        totalWorkflowRunsCount: 50000,
        uniqueWorkflowsCount: 25,
        successWorkflowRunsCount: 49500,
        failureWorkflowRunsCount: 500,
        successRate: 99.0,
      };

      mockTechInsightsApi.getFacts.mockResolvedValue({
        githubPipelineStatusFactRetriever: {
          timestamp: '2023-10-01T00:00:00Z',
          version: '1.0.0',
          facts: mockFacts,
        },
      });

      const result = await preproductionUtils.getPreproductionPipelineFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual({
        totalWorkflowRunsCount: 50000,
        uniqueWorkflowsCount: 25,
        successWorkflowRunsCount: 49500,
        failureWorkflowRunsCount: 500,
        successRate: 99.0,
      });
    });

    it('should handle decimal success rates correctly', async () => {
      const mockFacts = {
        totalWorkflowRunsCount: 333,
        uniqueWorkflowsCount: 5,
        successWorkflowRunsCount: 300,
        failureWorkflowRunsCount: 33,
        successRate: 90.09,
      };

      mockTechInsightsApi.getFacts.mockResolvedValue({
        githubPipelineStatusFactRetriever: {
          timestamp: '2023-10-01T00:00:00Z',
          version: '1.0.0',
          facts: mockFacts,
        },
      });

      const result = await preproductionUtils.getPreproductionPipelineFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result.successRate).toBe(90.09);
    });
  });

  describe('getPreproductionPipelineChecks', () => {
    it('should return correct check results when success rate check is present and true', async () => {
      const mockCheckResults = [
        createMockCheckResult('preproduction-success-rate', true),
      ];

      mockTechInsightsApi.runChecks.mockResolvedValue(mockCheckResults);

      const result = await preproductionUtils.getPreproductionPipelineChecks(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual({
        successRateCheck: true,
      });
      expect(mockTechInsightsApi.runChecks).toHaveBeenCalledWith(mockEntityRef);
    });

    it('should return correct check results when success rate check is present and false', async () => {
      const mockCheckResults = [
        createMockCheckResult('preproduction-success-rate', false),
      ];

      mockTechInsightsApi.runChecks.mockResolvedValue(mockCheckResults);

      const result = await preproductionUtils.getPreproductionPipelineChecks(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual({
        successRateCheck: false,
      });
      expect(mockTechInsightsApi.runChecks).toHaveBeenCalledWith(mockEntityRef);
    });

    it('should return default checks when success rate check is not found', async () => {
      const mockCheckResults = [
        createMockCheckResult('other-check', true),
        createMockCheckResult('another-check', false),
      ];

      mockTechInsightsApi.runChecks.mockResolvedValue(mockCheckResults);

      const result = await preproductionUtils.getPreproductionPipelineChecks(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual({
        successRateCheck: false,
      });
      expect(mockTechInsightsApi.runChecks).toHaveBeenCalledWith(mockEntityRef);
    });

    it('should return default checks when no check results are found', async () => {
      mockTechInsightsApi.runChecks.mockResolvedValue([]);

      const result = await preproductionUtils.getPreproductionPipelineChecks(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual(DEFAULT_CHECKS);
      expect(mockTechInsightsApi.runChecks).toHaveBeenCalledWith(mockEntityRef);
    });

    it('should return default checks when API throws an error', async () => {
      mockTechInsightsApi.runChecks.mockRejectedValue(new Error('API Error'));

      const result = await preproductionUtils.getPreproductionPipelineChecks(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual(DEFAULT_CHECKS);
    });

    it('should handle multiple checks with only success rate check being relevant', async () => {
      const mockCheckResults = [
        createMockCheckResult('unrelated-check-1', true),
        createMockCheckResult('preproduction-success-rate', true),
        createMockCheckResult('unrelated-check-2', false),
      ];

      mockTechInsightsApi.runChecks.mockResolvedValue(mockCheckResults);

      const result = await preproductionUtils.getPreproductionPipelineChecks(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual({
        successRateCheck: true,
      });
    });

    it('should handle check result with undefined result', async () => {
      const mockCheckResults = [
        {
          ...createMockCheckResult('preproduction-success-rate', false),
          result: null,
        },
      ];

      mockTechInsightsApi.runChecks.mockResolvedValue(mockCheckResults);

      const result = await preproductionUtils.getPreproductionPipelineChecks(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual({
        successRateCheck: false,
      });
    });
  });

  describe('edge cases and integration scenarios', () => {
    it('should handle facts with undefined values', async () => {
      const mockFacts = {
        totalWorkflowRunsCount: null,
        uniqueWorkflowsCount: null,
        successWorkflowRunsCount: null,
        failureWorkflowRunsCount: null,
        successRate: null,
      };

      mockTechInsightsApi.getFacts.mockResolvedValue({
        githubPipelineStatusFactRetriever: {
          timestamp: '2023-10-01T00:00:00Z',
          version: '1.0.0',
          facts: mockFacts,
        },
      });

      const result = await preproductionUtils.getPreproductionPipelineFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual({
        totalWorkflowRunsCount: 0,
        uniqueWorkflowsCount: 0,
        successWorkflowRunsCount: 0,
        failureWorkflowRunsCount: 0,
        successRate: 0,
      });
    });

    it('should handle perfect success rate', async () => {
      const mockFacts = {
        totalWorkflowRunsCount: 100,
        uniqueWorkflowsCount: 5,
        successWorkflowRunsCount: 100,
        failureWorkflowRunsCount: 0,
        successRate: 100.0,
      };

      mockTechInsightsApi.getFacts.mockResolvedValue({
        githubPipelineStatusFactRetriever: {
          timestamp: '2023-10-01T00:00:00Z',
          version: '1.0.0',
          facts: mockFacts,
        },
      });

      const result = await preproductionUtils.getPreproductionPipelineFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual({
        totalWorkflowRunsCount: 100,
        uniqueWorkflowsCount: 5,
        successWorkflowRunsCount: 100,
        failureWorkflowRunsCount: 0,
        successRate: 100.0,
      });
    });

    it('should handle complete failure rate', async () => {
      const mockFacts = {
        totalWorkflowRunsCount: 50,
        uniqueWorkflowsCount: 3,
        successWorkflowRunsCount: 0,
        failureWorkflowRunsCount: 50,
        successRate: 0.0,
      };

      mockTechInsightsApi.getFacts.mockResolvedValue({
        githubPipelineStatusFactRetriever: {
          timestamp: '2023-10-01T00:00:00Z',
          version: '1.0.0',
          facts: mockFacts,
        },
      });

      const result = await preproductionUtils.getPreproductionPipelineFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual({
        totalWorkflowRunsCount: 50,
        uniqueWorkflowsCount: 3,
        successWorkflowRunsCount: 0,
        failureWorkflowRunsCount: 50,
        successRate: 0.0,
      });
    });
  });
});
