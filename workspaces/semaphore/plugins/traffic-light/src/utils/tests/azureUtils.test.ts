import {
  AzureUtils,
  AzureDevOpsBugMetrics,
  AzureDevOpsBugChecks,
} from '../azureUtils';
import { TechInsightsApi } from '@backstage/plugin-tech-insights';
import { CompoundEntityRef } from '@backstage/catalog-model';

// Mock TechInsightsApi
const mockTechInsightsApi: jest.Mocked<TechInsightsApi> = {
  getFacts: jest.fn(),
  runChecks: jest.fn(),
  getCheckResultRenderers: jest.fn(),
  getAllChecks: jest.fn(),
  runBulkChecks: jest.fn(),
  getFactSchemas: jest.fn(),
};

// Mock entity reference
const mockEntityRef: CompoundEntityRef = {
  kind: 'Component',
  namespace: 'default',
  name: 'test-service',
};

const createMockCheckResult = (id: string, result: boolean | null = true) => ({
  check: {
    id,
    type: 'boolean',
    name: `${id} Check`,
    description: `Check for ${id}`,
    factIds: ['azure-devops-bugs-retriever'],
  },
  result,
  facts: {
    'azure-devops-bugs-retriever': {
      id: 'azure-devops-bugs-retriever',
      type: 'integer' as const,
      description: 'Azure bug count',
      value: result === true ? 1 : 0,
    },
  },
});

const DEFAULT_METRICS: AzureDevOpsBugMetrics = {
  azureBugCount: 0,
};

const DEFAULT_CHECKS: AzureDevOpsBugChecks = {
  bugCountCheck: false,
};

describe('AzureUtils', () => {
  let azureUtils: AzureUtils;

  beforeEach(() => {
    azureUtils = new AzureUtils();
    jest.clearAllMocks();
  });

  describe('getAzureDevOpsBugFacts', () => {
    it('returns parsed bug count when facts are present', async () => {
      mockTechInsightsApi.getFacts.mockResolvedValue({
        'azure-devops-bugs-retriever': {
          timestamp: '2025-01-01T00:00:00Z',
          version: '1.0.0',
          facts: {
            azure_bug_count: 42,
          },
        },
      });

      const result = await azureUtils.getAzureDevOpsBugFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );
      expect(result).toEqual({ azureBugCount: 42 });
    });

    it('handles missing facts gracefully', async () => {
      mockTechInsightsApi.getFacts.mockResolvedValue({
        'azure-devops-bugs-retriever': {
          timestamp: '2025-01-01T00:00:00Z',
          version: '1.0.0',
          facts: {},
        },
      });

      const result = await azureUtils.getAzureDevOpsBugFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );
      expect(result).toEqual(DEFAULT_METRICS);
    });

    it('handles undefined response', async () => {
      mockTechInsightsApi.getFacts.mockResolvedValue({});
      const result = await azureUtils.getAzureDevOpsBugFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );
      expect(result).toEqual(DEFAULT_METRICS);
    });

    it('handles API errors gracefully', async () => {
      mockTechInsightsApi.getFacts.mockRejectedValue(
        new Error('Failed to fetch'),
      );
      const result = await azureUtils.getAzureDevOpsBugFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );
      expect(result).toEqual(DEFAULT_METRICS);
    });

    it('coerces non-numeric bug count values to number', async () => {
      mockTechInsightsApi.getFacts.mockResolvedValue({
        'azure-devops-bugs-retriever': {
          timestamp: '2025-01-01T00:00:00Z',
          version: '1.0.0',
          facts: {
            azure_bug_count: '13',
          },
        },
      });

      const result = await azureUtils.getAzureDevOpsBugFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );
      expect(result).toEqual({ azureBugCount: 13 });
    });

    it('handles undefined bug count value', async () => {
      mockTechInsightsApi.getFacts.mockResolvedValue({
        'azure-devops-bugs-retriever': {
          timestamp: '2025-01-01T00:00:00Z',
          version: '1.0.0',
          facts: {},
        },
      });

      const result = await azureUtils.getAzureDevOpsBugFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );
      expect(result).toEqual(DEFAULT_METRICS);
    });
  });

  describe('getAzureDevOpsBugChecks', () => {
    it('returns check result when bug check is true', async () => {
      mockTechInsightsApi.runChecks.mockResolvedValue([
        createMockCheckResult('azure-bugs', true),
      ]);

      const result = await azureUtils.getAzureDevOpsBugChecks(
        mockTechInsightsApi,
        mockEntityRef,
      );
      expect(result).toEqual({ bugCountCheck: true });
    });

    it('returns check result when bug check is false', async () => {
      mockTechInsightsApi.runChecks.mockResolvedValue([
        createMockCheckResult('azure-bugs', false),
      ]);

      const result = await azureUtils.getAzureDevOpsBugChecks(
        mockTechInsightsApi,
        mockEntityRef,
      );
      expect(result).toEqual({ bugCountCheck: false });
    });

    it('returns default check when check is missing', async () => {
      mockTechInsightsApi.runChecks.mockResolvedValue([
        createMockCheckResult('some-other-check', true),
      ]);

      const result = await azureUtils.getAzureDevOpsBugChecks(
        mockTechInsightsApi,
        mockEntityRef,
      );
      expect(result).toEqual(DEFAULT_CHECKS);
    });

    it('returns default check when check result is undefined', async () => {
      const mockResult = createMockCheckResult('azure-bugs', null);
      mockTechInsightsApi.runChecks.mockResolvedValue([mockResult]);

      const result = await azureUtils.getAzureDevOpsBugChecks(
        mockTechInsightsApi,
        mockEntityRef,
      );
      expect(result).toEqual(DEFAULT_CHECKS);
    });

    it('returns default check on error', async () => {
      mockTechInsightsApi.runChecks.mockRejectedValue(
        new Error('Run check failed'),
      );
      const result = await azureUtils.getAzureDevOpsBugChecks(
        mockTechInsightsApi,
        mockEntityRef,
      );
      expect(result).toEqual(DEFAULT_CHECKS);
    });

    it('handles multiple checks with azure-bugs being relevant', async () => {
      mockTechInsightsApi.runChecks.mockResolvedValue([
        createMockCheckResult('some-check', false),
        createMockCheckResult('azure-bugs', true),
      ]);

      const result = await azureUtils.getAzureDevOpsBugChecks(
        mockTechInsightsApi,
        mockEntityRef,
      );
      expect(result).toEqual({ bugCountCheck: true });
    });
  });
});
