import {
  GithubAdvancedSecurityUtils,
  GitHubSecurityFacts,
  GitHubSecurityChecks,
} from '../githubAdvancedSecurityUtils';
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
    factIds: ['githubAdvancedSecurityFactRetriever'],
    description: `Check for ${id}`,
  },
  facts: {
    githubAdvancedSecurityFactRetriever: {
      id: 'githubAdvancedSecurityFactRetriever',
      type: 'integer' as const,
      description: 'GitHub Advanced Security facts',
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
const DEFAULT_FACTS: GitHubSecurityFacts = {
  criticalCount: 0,
  highCount: 0,
  mediumCount: 0,
  lowCount: 0,
  openCodeScanningAlertCount: 0,
  openSecretScanningAlertCount: 0,
  codeScanningAlerts: {},
  secretScanningAlerts: {},
};

const DEFAULT_CHECKS: GitHubSecurityChecks = {
  criticalCheck: false,
  highCheck: false,
  mediumCheck: false,
  lowCheck: false,
  secretCheck: false,
};

describe('GithubAdvancedSecurityUtils', () => {
  let githubUtils: GithubAdvancedSecurityUtils;

  beforeEach(() => {
    githubUtils = new GithubAdvancedSecurityUtils();
    jest.clearAllMocks();
  });

  describe('getGitHubSecurityFacts', () => {
    it('should return parsed facts when data is available', async () => {
      const mockFacts = {
        criticalCount: 5,
        highCount: 10,
        mediumCount: 15,
        lowCount: 2,
        openCodeScanningAlertCount: 32,
        openSecretScanningAlertCount: 7,
        codeScanningAlerts: {
          'code-1': {
            severity: 'critical',
            description: 'SQL injection vulnerability',
            direct_link:
              'https://github.com/owner/repo/blob/abc123/src/app.js#L42',
            created_at: '2023-01-01T00:00:00Z',
          },
        },
        secretScanningAlerts: {
          'secret-1': {
            severity: 'high',
            description: 'GitHub token exposed',
            html_url:
              'https://github.com/owner/repo/security/secret-scanning/1',
            created_at: '2023-01-01T00:00:00Z',
          },
        },
      };

      mockTechInsightsApi.getFacts.mockResolvedValue({
        githubAdvancedSecurityFactRetriever: {
          timestamp: '2023-10-01T00:00:00Z',
          version: '1.0.0',
          facts: mockFacts,
        },
      });

      const result = await githubUtils.getGitHubSecurityFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(mockTechInsightsApi.getFacts).toHaveBeenCalledWith(mockEntityRef, [
        'githubAdvancedSecurityFactRetriever',
      ]);
      expect(result).toEqual({
        criticalCount: 5,
        highCount: 10,
        mediumCount: 15,
        lowCount: 2,
        openCodeScanningAlertCount: 32,
        openSecretScanningAlertCount: 7,
        codeScanningAlerts: mockFacts.codeScanningAlerts,
        secretScanningAlerts: mockFacts.secretScanningAlerts,
      });
    });

    it('should handle missing facts gracefully', async () => {
      const mockFacts = {
        criticalCount: 5,
        highCount: null,
        mediumCount: 0,
        lowCount: '',
        openCodeScanningAlertCount: 'not-a-number',
        openSecretScanningAlertCount: 3,
        codeScanningAlerts: {},
        secretScanningAlerts: {},
      };

      mockTechInsightsApi.getFacts.mockResolvedValue({
        githubAdvancedSecurityFactRetriever: {
          timestamp: '2023-10-01T00:00:00Z',
          version: '1.0.0',
          facts: mockFacts,
        },
      });

      const result = await githubUtils.getGitHubSecurityFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual({
        criticalCount: 5,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        openCodeScanningAlertCount: 0,
        openSecretScanningAlertCount: 3,
        codeScanningAlerts: {},
        secretScanningAlerts: {},
      });
    });

    it('should return default facts when no facts are found', async () => {
      mockTechInsightsApi.getFacts.mockResolvedValue({
        githubAdvancedSecurityFactRetriever: {
          timestamp: '2023-10-01T00:00:00Z',
          version: '1.0.0',
          facts: {},
        },
      });

      const result = await githubUtils.getGitHubSecurityFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual(DEFAULT_FACTS);
    });

    it('should return default facts when response is undefined', async () => {
      mockTechInsightsApi.getFacts.mockResolvedValue({});

      const result = await githubUtils.getGitHubSecurityFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual(DEFAULT_FACTS);
    });

    it('should return default facts when API throws an error', async () => {
      mockTechInsightsApi.getFacts.mockRejectedValue(new Error('API Error'));

      const result = await githubUtils.getGitHubSecurityFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual(DEFAULT_FACTS);
    });

    it('should handle non-numeric values appropriately', async () => {
      const mockFacts = {
        criticalCount: 'not-a-number',
        highCount: '',
        mediumCount: 'invalid',
        lowCount: '5',
        openCodeScanningAlertCount: 'NaN',
        openSecretScanningAlertCount: 3,
        codeScanningAlerts: {},
        secretScanningAlerts: {},
      };

      mockTechInsightsApi.getFacts.mockResolvedValue({
        githubAdvancedSecurityFactRetriever: {
          timestamp: '2023-10-01T00:00:00Z',
          version: '1.0.0',
          facts: mockFacts,
        },
      });

      const result = await githubUtils.getGitHubSecurityFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual({
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 5,
        openCodeScanningAlertCount: 0,
        openSecretScanningAlertCount: 3,
        codeScanningAlerts: {},
        secretScanningAlerts: {},
      });
    });
  });

  describe('getGitHubSecurityChecks', () => {
    it('should return correct check results when all checks are present and true', async () => {
      const mockCheckResults = [
        createMockCheckResult('critical-count', true),
        createMockCheckResult('high-count', true),
        createMockCheckResult('medium-count', false),
        createMockCheckResult('low-count', false),
        createMockCheckResult('open-secret-scanning-alert-count', true),
      ];

      mockTechInsightsApi.runChecks.mockResolvedValue(mockCheckResults);

      const result = await githubUtils.getGitHubSecurityChecks(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual({
        criticalCheck: true,
        highCheck: true,
        mediumCheck: false,
        lowCheck: false,
        secretCheck: true,
      });
      expect(mockTechInsightsApi.runChecks).toHaveBeenCalledWith(mockEntityRef);
    });

    it('should return default checks when no check results are found', async () => {
      mockTechInsightsApi.runChecks.mockResolvedValue([]);

      const result = await githubUtils.getGitHubSecurityChecks(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual(DEFAULT_CHECKS);
      expect(mockTechInsightsApi.runChecks).toHaveBeenCalledWith(mockEntityRef);
    });

    it('should return default checks when API throws an error', async () => {
      mockTechInsightsApi.runChecks.mockRejectedValue(new Error('API Error'));

      const result = await githubUtils.getGitHubSecurityChecks(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual(DEFAULT_CHECKS);
    });
  });

  describe('getGitHubSecurityData', () => {
    it('should return combined facts and checks when both are successful', async () => {
      const mockFacts = {
        criticalCount: 3,
        highCount: 7,
        mediumCount: 12,
        lowCount: 5,
        openCodeScanningAlertCount: 27,
        openSecretScanningAlertCount: 7,
        codeScanningAlerts: {
          'code-1': {
            severity: 'high',
            description: 'XSS vulnerability',
            direct_link:
              'https://github.com/owner/repo/blob/def456/src/utils.js#L15',
            created_at: '2023-01-02T00:00:00Z',
          },
        },
        secretScanningAlerts: {},
      };

      const mockCheckResults = [
        createMockCheckResult('critical-count', true),
        createMockCheckResult('high-count', true),
        createMockCheckResult('medium-count', false),
        createMockCheckResult('low-count', false),
        createMockCheckResult('open-secret-scanning-alert-count', true),
      ];

      mockTechInsightsApi.getFacts.mockResolvedValue({
        githubAdvancedSecurityFactRetriever: {
          timestamp: '2023-10-01T00:00:00Z',
          version: '1.0.0',
          facts: mockFacts,
        },
      });

      mockTechInsightsApi.runChecks.mockResolvedValue(mockCheckResults);

      const result = await githubUtils.getGitHubSecurityData(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual({
        criticalCount: 3,
        highCount: 7,
        mediumCount: 12,
        lowCount: 5,
        openCodeScanningAlertCount: 27,
        openSecretScanningAlertCount: 7,
        codeScanningAlerts: mockFacts.codeScanningAlerts,
        secretScanningAlerts: mockFacts.secretScanningAlerts,
        criticalCheck: true,
        highCheck: true,
        mediumCheck: false,
        lowCheck: false,
        secretCheck: true,
      });

      expect(mockTechInsightsApi.getFacts).toHaveBeenCalledWith(mockEntityRef, [
        'githubAdvancedSecurityFactRetriever',
      ]);
      expect(mockTechInsightsApi.runChecks).toHaveBeenCalledWith(mockEntityRef);
    });

    it('should return defaults when both APIs fail', async () => {
      mockTechInsightsApi.getFacts.mockRejectedValue(
        new Error('Facts API Error'),
      );
      mockTechInsightsApi.runChecks.mockRejectedValue(
        new Error('Checks API Error'),
      );

      const result = await githubUtils.getGitHubSecurityData(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual({
        ...DEFAULT_FACTS,
        ...DEFAULT_CHECKS,
      });
    });

    it('should handle partial failures gracefully', async () => {
      const mockFacts = {
        criticalCount: 1,
        highCount: 2,
        mediumCount: 3,
        lowCount: 4,
        openCodeScanningAlertCount: 10,
        openSecretScanningAlertCount: 1,
        codeScanningAlerts: {},
        secretScanningAlerts: {},
      };

      mockTechInsightsApi.getFacts.mockResolvedValue({
        githubAdvancedSecurityFactRetriever: {
          timestamp: '2023-10-01T00:00:00Z',
          version: '1.0.0',
          facts: mockFacts,
        },
      });

      mockTechInsightsApi.runChecks.mockRejectedValue(
        new Error('Checks API Error'),
      );

      const result = await githubUtils.getGitHubSecurityData(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual({
        criticalCount: 1,
        highCount: 2,
        mediumCount: 3,
        lowCount: 4,
        openCodeScanningAlertCount: 10,
        openSecretScanningAlertCount: 1,
        codeScanningAlerts: {},
        secretScanningAlerts: {},
        ...DEFAULT_CHECKS,
      });
    });
  });
});
