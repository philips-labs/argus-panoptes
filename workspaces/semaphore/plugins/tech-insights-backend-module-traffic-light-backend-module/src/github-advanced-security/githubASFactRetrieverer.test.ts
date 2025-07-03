/**
 * Tests for GitHub Advanced Security Fact Retriever
 */
import { githubAdvancedSecurityFactRetriever } from './githubASFactRetriever';

// Mock dependencies
jest.mock('@backstage/catalog-client');
jest.mock('../dependabot/octokitLoader');

const mockConfig = {
  getOptionalConfigArray: jest.fn(),
};

const mockAuth = {
  getPluginRequestToken: jest.fn(),
  getOwnServiceCredentials: jest.fn(),
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const mockUrlReader = {
  readUrl: jest.fn(),
  readTree: jest.fn(),
  search: jest.fn(),
};

const mockCatalogClient = {
  getEntities: jest.fn(),
};

const mockOctokit = {
  request: jest.fn(),
};

describe('githubAdvancedSecurityFactRetriever', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    require('@backstage/catalog-client').CatalogClient.mockImplementation(
      () => mockCatalogClient,
    );
    require('../dependabot/octokitLoader').loadOctokit.mockResolvedValue(
      jest.fn(() => mockOctokit),
    );
  });

  const mockHandlerParams = {
    config: mockConfig as any,
    logger: mockLogger as any,
    entityFilter: [{ kind: 'component' }],
    auth: mockAuth as any,
    discovery: {} as any,
    urlReader: mockUrlReader as any,
  };

  // Basic configuration tests
  it('should have correct basic configuration', () => {
    expect(githubAdvancedSecurityFactRetriever.id).toBe(
      'githubAdvancedSecurityFactRetriever',
    );
    expect(githubAdvancedSecurityFactRetriever.version).toBe('0.2.0');
    expect(githubAdvancedSecurityFactRetriever.entityFilter).toEqual([
      { kind: 'component' },
    ]);
  });

  // Should return empty array when there is no GitHub token
  it('should return empty array when no GitHub token', async () => {
    mockConfig.getOptionalConfigArray.mockReturnValue([
      {
        getOptionalString: jest.fn().mockReturnValue(undefined),
      },
    ]);

    mockAuth.getOwnServiceCredentials.mockResolvedValue({});
    mockAuth.getPluginRequestToken.mockResolvedValue({
      token: 'catalog-token',
    });
    mockCatalogClient.getEntities.mockResolvedValue({ items: [] });

    const result = await githubAdvancedSecurityFactRetriever.handler(
      mockHandlerParams,
    );

    expect(result).toEqual([]);
  });

  // Returns empty array when config throws error
  it('should return empty array when config throws error', async () => {
    mockConfig.getOptionalConfigArray.mockImplementation(() => {
      throw new Error('Config error');
    });

    const result = await githubAdvancedSecurityFactRetriever.handler(
      mockHandlerParams,
    );

    expect(result).toEqual([]);
  });

  it('should successfully process entities with security alerts', async () => {
    // Setup config mock
    mockConfig.getOptionalConfigArray.mockReturnValue([
      {
        getOptionalString: jest.fn().mockReturnValue('mock-token'),
      },
    ]);

    // Setup auth mocks
    mockAuth.getOwnServiceCredentials.mockResolvedValue({});
    mockAuth.getPluginRequestToken.mockResolvedValue({
      token: 'catalog-token',
    });

    // Mock entity with GitHub annotation
    const mockEntities = [
      {
        kind: 'Component',
        metadata: {
          name: 'test-component',
          namespace: 'default',
          annotations: {
            'github.com/project-slug': 'owner/repo',
          },
        },
      },
    ];

    mockCatalogClient.getEntities.mockResolvedValue({ items: mockEntities });

    // Mock GitHub API responses
    const mockCodeScanningAlerts = [
      {
        number: 1,
        rule: {
          security_severity_level: 'high',
          description: 'SQL injection vulnerability',
        },
        created_at: '2023-01-01T00:00:00Z',
        most_recent_instance: {
          commit_sha: 'abc123',
          location: {
            path: 'src/app.js',
            start_line: 42,
          },
        },
      },
    ];

    const mockSecretScanningAlerts = [
      {
        number: 1,
        secret_type: 'github_personal_access_token',
        created_at: '2023-01-01T00:00:00Z',
        html_url: 'https://github.com/owner/repo/security/secret-scanning/1',
      },
    ];

    mockOctokit.request
      .mockResolvedValueOnce({ data: mockCodeScanningAlerts })
      .mockResolvedValueOnce({ data: mockSecretScanningAlerts });

    const result = await githubAdvancedSecurityFactRetriever.handler(
      mockHandlerParams,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.entity.name).toBe('test-component');
    expect(result[0]?.facts.openCodeScanningAlertCount).toBe(1);
    expect(result[0]?.facts.openSecretScanningAlertCount).toBe(1);
    expect(result[0]?.facts.highCount).toBe(1);
    expect((result[0]?.facts.codeScanningAlerts as any)['code-1']).toEqual({
      severity: 'high',
      description: 'SQL injection vulnerability',
      created_at: '2023-01-01T00:00:00Z',
      direct_link: 'https://github.com/owner/repo/blob/abc123/src/app.js#L42',
    });
    expect((result[0]?.facts.secretScanningAlerts as any)['secret-1']).toEqual({
      severity: 'high',
      description: 'Secret of type github_personal_access_token found',
      created_at: '2023-01-01T00:00:00Z',
      direct_link: 'https://github.com/owner/repo/security/secret-scanning/1',
    });
  });

  it('should skip entities without GitHub annotations', async () => {
    mockConfig.getOptionalConfigArray.mockReturnValue([
      {
        getOptionalString: jest.fn().mockReturnValue('mock-token'),
      },
    ]);

    mockAuth.getOwnServiceCredentials.mockResolvedValue({});
    mockAuth.getPluginRequestToken.mockResolvedValue({
      token: 'catalog-token',
    });

    const mockEntities = [
      {
        kind: 'Component',
        metadata: {
          name: 'no-github-component',
          namespace: 'default',
          annotations: {}, // No GitHub annotation
        },
      },
    ];

    mockCatalogClient.getEntities.mockResolvedValue({ items: mockEntities });

    const result = await githubAdvancedSecurityFactRetriever.handler(
      mockHandlerParams,
    );

    expect(result).toEqual([]);
    expect(mockOctokit.request).not.toHaveBeenCalled();
  });

  it('should handle GitHub API errors by returning null', async () => {
    mockConfig.getOptionalConfigArray.mockReturnValue([
      {
        getOptionalString: jest.fn().mockReturnValue('mock-token'),
      },
    ]);

    mockAuth.getOwnServiceCredentials.mockResolvedValue({});
    mockAuth.getPluginRequestToken.mockResolvedValue({
      token: 'catalog-token',
    });

    const mockEntities = [
      {
        kind: 'Component',
        metadata: {
          name: 'error-component',
          namespace: 'default',
          annotations: {
            'github.com/project-slug': 'owner/repo',
          },
        },
      },
    ];

    mockCatalogClient.getEntities.mockResolvedValue({ items: mockEntities });

    mockOctokit.request.mockRejectedValue(new Error('API Error'));

    const result = await githubAdvancedSecurityFactRetriever.handler(
      mockHandlerParams,
    );

    expect(result).toEqual([]);
  });

  // counting the security alerts by severity levels
  it('should count different severity levels correctly', async () => {
    mockConfig.getOptionalConfigArray.mockReturnValue([
      {
        getOptionalString: jest.fn().mockReturnValue('mock-token'),
      },
    ]);

    mockAuth.getOwnServiceCredentials.mockResolvedValue({});
    mockAuth.getPluginRequestToken.mockResolvedValue({
      token: 'catalog-token',
    });

    const mockEntities = [
      {
        kind: 'Component',
        metadata: {
          name: 'test-component',
          namespace: 'default',
          annotations: {
            'github.com/project-slug': 'owner/repo',
          },
        },
      },
    ];

    mockCatalogClient.getEntities.mockResolvedValue({ items: mockEntities });

    const mockCodeScanningAlerts = [
      {
        number: 1,
        rule: { security_severity_level: 'critical' },
        created_at: '2023-01-01T00:00:00Z',
        most_recent_instance: {
          commit_sha: 'abc',
          location: { path: 'file1.js' },
        },
      },
      {
        number: 2,
        rule: { security_severity_level: 'high' },
        created_at: '2023-01-01T00:00:00Z',
        most_recent_instance: {
          commit_sha: 'abc',
          location: { path: 'file2.js' },
        },
      },
      {
        number: 3,
        rule: { security_severity_level: 'medium' },
        created_at: '2023-01-01T00:00:00Z',
        most_recent_instance: {
          commit_sha: 'abc',
          location: { path: 'file3.js' },
        },
      },
    ];

    mockOctokit.request
      .mockResolvedValueOnce({ data: mockCodeScanningAlerts })
      .mockResolvedValueOnce({ data: [] });

    const result = await githubAdvancedSecurityFactRetriever.handler(
      mockHandlerParams,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.facts.criticalCount).toBe(1);
    expect(result[0]?.facts.highCount).toBe(1);
    expect(result[0]?.facts.mediumCount).toBe(1);
    expect(result[0]?.facts.lowCount).toBe(0);
  });

  // Handling empty alerts responses
  it('should handle empty alerts responses', async () => {
    mockConfig.getOptionalConfigArray.mockReturnValue([
      {
        getOptionalString: jest.fn().mockReturnValue('mock-token'),
      },
    ]);

    mockAuth.getOwnServiceCredentials.mockResolvedValue({});
    mockAuth.getPluginRequestToken.mockResolvedValue({
      token: 'catalog-token',
    });

    const mockEntities = [
      {
        kind: 'Component',
        metadata: {
          name: 'clean-component',
          namespace: 'default',
          annotations: {
            'github.com/project-slug': 'owner/clean-repo',
          },
        },
      },
    ];

    mockCatalogClient.getEntities.mockResolvedValue({ items: mockEntities });

    mockOctokit.request
      .mockResolvedValueOnce({ data: [] }) // No code scanning alerts
      .mockResolvedValueOnce({ data: [] }); // No secret scanning alerts

    const result = await githubAdvancedSecurityFactRetriever.handler(
      mockHandlerParams,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.facts).toEqual({
      openCodeScanningAlertCount: 0,
      openSecretScanningAlertCount: 0,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      codeScanningAlerts: {},
      secretScanningAlerts: {},
    });
  });

  // Test handling of missing or null values (testing nullish coalescing)
  it('should handle alerts with missing or null values', async () => {
    mockConfig.getOptionalConfigArray.mockReturnValue([
      {
        getOptionalString: jest.fn().mockReturnValue('mock-token'),
      },
    ]);

    mockAuth.getOwnServiceCredentials.mockResolvedValue({});
    mockAuth.getPluginRequestToken.mockResolvedValue({
      token: 'catalog-token',
    });

    const mockEntities = [
      {
        kind: 'Component',
        metadata: {
          name: 'test-component',
          namespace: 'default',
          annotations: {
            'github.com/project-slug': 'owner/repo',
          },
        },
      },
    ];

    mockCatalogClient.getEntities.mockResolvedValue({ items: mockEntities });

    // Mock alerts with missing/null values
    const mockCodeScanningAlerts = [
      {
        number: 1,
        rule: {
          // missing security_severity_level, description, and name
        },
        // missing created_at
        most_recent_instance: {
          commit_sha: 'abc123',
          location: {
            path: 'src/app.js',
            // missing start_line
          },
        },
      },
    ];

    const mockSecretScanningAlerts = [
      {
        number: 1,
        // missing secret_type, created_at, html_url
      },
    ];

    mockOctokit.request
      .mockResolvedValueOnce({ data: mockCodeScanningAlerts })
      .mockResolvedValueOnce({ data: mockSecretScanningAlerts });

    const result = await githubAdvancedSecurityFactRetriever.handler(
      mockHandlerParams,
    );

    expect(result).toHaveLength(1);
    expect((result[0]?.facts.codeScanningAlerts as any)['code-1']).toEqual({
      severity: 'unknown',
      description: 'No description available',
      created_at: '',
      direct_link: 'https://github.com/owner/repo/blob/abc123/src/app.js#L1',
    });
    expect((result[0]?.facts.secretScanningAlerts as any)['secret-1']).toEqual({
      severity: 'high',
      description: 'Secret of type unknown found',
      created_at: '',
      direct_link: '',
    });
  });
});
