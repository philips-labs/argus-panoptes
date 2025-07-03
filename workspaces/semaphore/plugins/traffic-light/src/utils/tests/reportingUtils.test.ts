import {
  ReportingUtils,
  ReportingPipelineMetrics,
  ReportingPipelineChecks,
} from '../reportingUtils';
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
    factIds: ['reportingPipelineStatusFactRetriever'],
    description: `Check for ${id}`,
  },
  facts: {
    reportingPipelineStatusFactRetriever: {
      id: 'reportingPipelineStatusFactRetriever',
      type: 'integer' as const,
      description: 'Reporting pipeline status facts',
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
const DEFAULT_METRICS: ReportingPipelineMetrics = {
  workflowMetrics: {},
  totalIncludedWorkflows: 0,
  successfulRuns: 0,
  failedRuns: 0,
  successRate: 0,
};

const DEFAULT_CHECKS: ReportingPipelineChecks = {
  successRateCheck: false,
};

describe('ReportingUtils', () => {
  let reportingUtils: ReportingUtils;

  beforeEach(() => {
    reportingUtils = new ReportingUtils();
    jest.clearAllMocks();
  });

  describe('getReportingPipelineFacts', () => {
    it('should return parsed facts when data is available', async () => {
      const mockFacts = {
        workflowMetrics: {
          'workflow-1': {
            name: 'CI Pipeline',
            runs: 50,
            successes: 45,
            failures: 5,
          },
          'workflow-2': {
            name: 'Deploy Pipeline',
            runs: 30,
            successes: 28,
            failures: 2,
          },
        },
        totalIncludedWorkflows: 2,
        successfulRuns: 73,
        failedRuns: 7,
        successRate: 91.25,
      };

      mockTechInsightsApi.getFacts.mockResolvedValue({
        reportingPipelineStatusFactRetriever: {
          timestamp: '2023-10-01T00:00:00Z',
          version: '1.0.0',
          facts: mockFacts,
        },
      });

      const result = await reportingUtils.getReportingPipelineFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(mockTechInsightsApi.getFacts).toHaveBeenCalledWith(mockEntityRef, [
        'reportingPipelineStatusFactRetriever',
      ]);
      expect(result).toEqual({
        workflowMetrics: mockFacts.workflowMetrics,
        totalIncludedWorkflows: 2,
        successfulRuns: 73,
        failedRuns: 7,
        successRate: 91.25,
      });
    });

    it('should handle missing facts gracefully', async () => {
      const mockFacts = {
        workflowMetrics: {
          'workflow-1': {
            name: 'Test Pipeline',
            runs: 25,
            successes: 20,
            failures: 5,
          },
        },
        totalIncludedWorkflows: null,
        successfulRuns: 20,
        failedRuns: '',
        successRate: 'not-a-number',
      };

      mockTechInsightsApi.getFacts.mockResolvedValue({
        reportingPipelineStatusFactRetriever: {
          timestamp: '2023-10-01T00:00:00Z',
          version: '1.0.0',
          facts: mockFacts,
        },
      });

      const result = await reportingUtils.getReportingPipelineFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual({
        workflowMetrics: mockFacts.workflowMetrics,
        totalIncludedWorkflows: 0,
        successfulRuns: 20,
        failedRuns: 0,
        successRate: NaN, // Number('not-a-number') returns NaN
      });
    });

    it('should return default metrics when no facts are found', async () => {
      mockTechInsightsApi.getFacts.mockResolvedValue({
        reportingPipelineStatusFactRetriever: {
          timestamp: '2023-10-01T00:00:00Z',
          version: '1.0.0',
          facts: {},
        },
      });

      const result = await reportingUtils.getReportingPipelineFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual(DEFAULT_METRICS);
    });

    it('should return default metrics when response is undefined', async () => {
      mockTechInsightsApi.getFacts.mockResolvedValue({});

      const result = await reportingUtils.getReportingPipelineFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual(DEFAULT_METRICS);
    });

    it('should return default metrics when API throws an error', async () => {
      mockTechInsightsApi.getFacts.mockRejectedValue(new Error('API Error'));

      const result = await reportingUtils.getReportingPipelineFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual(DEFAULT_METRICS);
    });

    it('should handle non-numeric values appropriately', async () => {
      const mockFacts = {
        workflowMetrics: 'invalid-object',
        totalIncludedWorkflows: 'not-a-number',
        successfulRuns: '',
        failedRuns: 'invalid',
        successRate: '85.5',
      };

      mockTechInsightsApi.getFacts.mockResolvedValue({
        reportingPipelineStatusFactRetriever: {
          timestamp: '2023-10-01T00:00:00Z',
          version: '1.0.0',
          facts: mockFacts,
        },
      });

      const result = await reportingUtils.getReportingPipelineFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual({
        workflowMetrics: expect.any(String), // Object('invalid-object') creates a String object
        totalIncludedWorkflows: NaN, // Number('not-a-number') returns NaN
        successfulRuns: 0, // Number('') returns 0
        failedRuns: NaN, // Number('invalid') returns NaN
        successRate: 85.5, // Number('85.5') returns 85.5
      });
    });

    it('should handle null workflowMetrics gracefully', async () => {
      const mockFacts = {
        workflowMetrics: null,
        totalIncludedWorkflows: 5,
        successfulRuns: 100,
        failedRuns: 10,
        successRate: 90.9,
      };

      mockTechInsightsApi.getFacts.mockResolvedValue({
        reportingPipelineStatusFactRetriever: {
          timestamp: '2023-10-01T00:00:00Z',
          version: '1.0.0',
          facts: mockFacts,
        },
      });

      const result = await reportingUtils.getReportingPipelineFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual({
        workflowMetrics: {},
        totalIncludedWorkflows: 5,
        successfulRuns: 100,
        failedRuns: 10,
        successRate: 90.9,
      });
    });
  });

  describe('getReportingPipelineChecks', () => {
    it('should return correct check results when success rate check is present and true', async () => {
      const mockCheckResults = [
        createMockCheckResult('reporting-success-rate', true),
      ];

      mockTechInsightsApi.runChecks.mockResolvedValue(mockCheckResults);

      const result = await reportingUtils.getReportingPipelineChecks(
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
        createMockCheckResult('reporting-success-rate', false),
      ];

      mockTechInsightsApi.runChecks.mockResolvedValue(mockCheckResults);

      const result = await reportingUtils.getReportingPipelineChecks(
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

      const result = await reportingUtils.getReportingPipelineChecks(
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

      const result = await reportingUtils.getReportingPipelineChecks(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual(DEFAULT_CHECKS);
      expect(mockTechInsightsApi.runChecks).toHaveBeenCalledWith(mockEntityRef);
    });

    it('should return default checks when API throws an error', async () => {
      mockTechInsightsApi.runChecks.mockRejectedValue(new Error('API Error'));

      const result = await reportingUtils.getReportingPipelineChecks(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual(DEFAULT_CHECKS);
    });

    it('should handle multiple checks with only success rate check being relevant', async () => {
      const mockCheckResults = [
        createMockCheckResult('unrelated-check-1', true),
        createMockCheckResult('reporting-success-rate', true),
        createMockCheckResult('unrelated-check-2', false),
      ];

      mockTechInsightsApi.runChecks.mockResolvedValue(mockCheckResults);

      const result = await reportingUtils.getReportingPipelineChecks(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual({
        successRateCheck: true,
      });
    });
  });

  describe('edge cases and integration scenarios', () => {
    it('should handle facts with zero values correctly', async () => {
      const mockFacts = {
        workflowMetrics: {},
        totalIncludedWorkflows: 0,
        successfulRuns: 0,
        failedRuns: 0,
        successRate: 0,
      };

      mockTechInsightsApi.getFacts.mockResolvedValue({
        reportingPipelineStatusFactRetriever: {
          timestamp: '2023-10-01T00:00:00Z',
          version: '1.0.0',
          facts: mockFacts,
        },
      });

      const result = await reportingUtils.getReportingPipelineFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual({
        workflowMetrics: {},
        totalIncludedWorkflows: 0,
        successfulRuns: 0,
        failedRuns: 0,
        successRate: 0,
      });
    });

    it('should handle large numbers correctly', async () => {
      const mockFacts = {
        workflowMetrics: {
          'high-volume-workflow': {
            name: 'High Volume Pipeline',
            runs: 10000,
            successes: 9950,
            failures: 50,
          },
        },
        totalIncludedWorkflows: 1,
        successfulRuns: 9950,
        failedRuns: 50,
        successRate: 99.5,
      };

      mockTechInsightsApi.getFacts.mockResolvedValue({
        reportingPipelineStatusFactRetriever: {
          timestamp: '2023-10-01T00:00:00Z',
          version: '1.0.0',
          facts: mockFacts,
        },
      });

      const result = await reportingUtils.getReportingPipelineFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual({
        workflowMetrics: mockFacts.workflowMetrics,
        totalIncludedWorkflows: 1,
        successfulRuns: 9950,
        failedRuns: 50,
        successRate: 99.5,
      });
    });

    it('should handle decimal success rates correctly', async () => {
      const mockFacts = {
        workflowMetrics: {},
        totalIncludedWorkflows: 3,
        successfulRuns: 67,
        failedRuns: 33,
        successRate: 67.0,
      };

      mockTechInsightsApi.getFacts.mockResolvedValue({
        reportingPipelineStatusFactRetriever: {
          timestamp: '2023-10-01T00:00:00Z',
          version: '1.0.0',
          facts: mockFacts,
        },
      });

      const result = await reportingUtils.getReportingPipelineFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result.successRate).toBe(67.0);
    });
  });
});
