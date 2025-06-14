import { githubPipelineStatusFactRetriever } from '../preproductionFactRetriever';
import { CatalogClient } from '@backstage/catalog-client';
import { Entity } from '@backstage/catalog-model';
import { Config } from '@backstage/config';
import { Logger } from 'winston';
import {
  AuthService,
  DiscoveryService,
  UrlReaderService,
} from '@backstage/backend-plugin-api';

// Mock dependencies
jest.mock('@backstage/catalog-client');
jest.mock('node-fetch');

const mockCatalogClient = CatalogClient as jest.MockedClass<
  typeof CatalogClient
>;
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock logger
const mockLogger: Logger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
} as any;

// Mock config
const createMockConfig = (token?: string): Config =>
  ({
    getOptionalConfigArray: jest.fn((path: string) => {
      if (path === 'integrations.github' && token) {
        return [
          {
            getOptionalString: jest.fn((key: string) => {
              if (key === 'token') return token;
              return undefined;
            }),
          },
        ];
      }
      return undefined;
    }),
  } as any);

// Complete mock auth service
const mockAuth: AuthService = {
  getPluginRequestToken: jest
    .fn()
    .mockResolvedValue({ token: 'catalog-token' }),
  getOwnServiceCredentials: jest.fn().mockResolvedValue({}),
  authenticate: jest.fn().mockResolvedValue({ principal: { type: 'service' } }),
  getNoneCredentials: jest
    .fn()
    .mockReturnValue({ principal: { type: 'none' } }),
  getLimitedUserToken: jest
    .fn()
    .mockResolvedValue({ token: 'limited-user-token' }),
  listPublicServiceKeys: jest.fn().mockResolvedValue({ keys: [] }),
  isPrincipal: jest.fn().mockReturnValue(true) as any,
};

// Mock discovery service
const mockDiscovery: DiscoveryService = {
  getBaseUrl: jest.fn().mockResolvedValue('http://localhost:7007'),
  getExternalBaseUrl: jest.fn().mockResolvedValue('http://localhost:7007'),
};

// Mock URL reader service
const mockUrlReader: UrlReaderService = {
  readUrl: jest.fn().mockResolvedValue({
    buffer: jest.fn().mockResolvedValue(Buffer.from('mock content')),
    stream: jest.fn().mockReturnValue({} as any),
    etag: 'mock-etag',
  }),
  readTree: jest.fn().mockResolvedValue({
    files: jest.fn().mockResolvedValue([]),
    archive: jest.fn().mockResolvedValue(Buffer.from('mock archive')),
    dir: jest.fn().mockResolvedValue('/mock/dir'),
    etag: 'mock-etag',
  }),
  search: jest.fn().mockResolvedValue({
    files: [],
    etag: 'mock-etag',
  }),
};

// Sample entities for testing
const sampleEntities: Entity[] = [
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'test-service',
      namespace: 'default',
      annotations: {
        'github.com/project-slug': 'owner/repo1',
      },
    },
    spec: {},
  },
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'test-service-with-exclusions',
      namespace: 'default',
      annotations: {
        'github.com/project-slug': 'owner/repo2',
        'preproduction/exclude': '["workflow.*", ".*test.*"]',
      },
    },
    spec: {},
  },
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'service-without-github',
      namespace: 'default',
    },
    spec: {},
  },
];

// Sample workflow definitions
const sampleWorkflowDefinitions = {
  workflows: [
    { id: 1, name: 'CI', path: '.github/workflows/ci.yml' },
    { id: 2, name: 'workflow1', path: '.github/workflows/workflow1.yml' },
    { id: 3, name: 'workflow2', path: '.github/workflows/workflow2.yml' },
    { id: 4, name: 'Deploy', path: '.github/workflows/deploy.yml' },
    {
      id: 5,
      name: 'integration-test',
      path: '.github/workflows/integration-test.yml',
    },
  ],
};

// Sample workflow runs
const sampleWorkflowRuns = {
  workflow_runs: [
    {
      name: 'CI',
      status: 'completed',
      conclusion: 'success',
      created_at: '2023-01-01T00:00:00Z',
      head_branch: 'main',
      workflow_id: 1,
    },
    {
      name: 'workflow1',
      status: 'completed',
      conclusion: 'failure',
      created_at: '2023-01-01T01:00:00Z',
      head_branch: 'main',
      workflow_id: 2,
    },
    {
      name: 'workflow2',
      status: 'completed',
      conclusion: 'success',
      created_at: '2023-01-01T02:00:00Z',
      head_branch: 'main',
      workflow_id: 3,
    },
    {
      name: 'Deploy',
      status: 'completed',
      conclusion: 'success',
      created_at: '2023-01-01T03:00:00Z',
      head_branch: 'main',
      workflow_id: 4,
    },
    {
      name: 'integration-test',
      status: 'completed',
      conclusion: 'failure',
      created_at: '2023-01-01T03:30:00Z',
      head_branch: 'main',
      workflow_id: 5,
    },
    {
      name: 'CI',
      status: 'in_progress',
      conclusion: null,
      created_at: '2023-01-01T04:00:00Z',
      head_branch: 'main',
      workflow_id: 1,
    },
    // Run on different branch (should be filtered out)
    {
      name: 'CI',
      status: 'completed',
      conclusion: 'success',
      created_at: '2023-01-01T05:00:00Z',
      head_branch: 'feature-branch',
      workflow_id: 1,
    },
  ],
};

describe('githubPipelineStatusFactRetriever', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('handler', () => {
    it('should return empty array when GitHub token is not configured', async () => {
      const config = createMockConfig(); // No token

      const mockCatalogInstance = {
        getEntities: jest.fn().mockResolvedValue({ items: [] }),
      };
      mockCatalogClient.mockImplementation(() => mockCatalogInstance as any);

      const result = await githubPipelineStatusFactRetriever.handler({
        config,
        logger: mockLogger,
        entityFilter: [{ kind: 'component' }],
        auth: mockAuth,
        discovery: mockDiscovery,
        urlReader: mockUrlReader,
      });

      expect(result).toEqual([]);
    });

    it('should handle regex workflow exclusions correctly', async () => {
      const config = createMockConfig('github-token');

      const mockCatalogInstance = {
        getEntities: jest.fn().mockResolvedValue({
          items: [sampleEntities[1]], // Entity with regex exclusions
        }),
      };
      mockCatalogClient.mockImplementation(() => mockCatalogInstance as any);

      // Mock fetch responses
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(sampleWorkflowDefinitions),
          headers: new Map(),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(sampleWorkflowRuns),
          headers: new Map([['Link', 'no-next']]),
        });

      const result = await githubPipelineStatusFactRetriever.handler({
        config,
        logger: mockLogger,
        entityFilter: [{ kind: 'component' }],
        auth: mockAuth,
        discovery: mockDiscovery,
        urlReader: mockUrlReader,
      });

      expect(result).toHaveLength(1);
      // workflow.* should match workflow1 and workflow2
      // .*test.* should match integration-test
      // Only CI and Deploy should remain (both successful)
      expect(result[0].facts).toEqual({
        totalWorkflowRunsCount: 6, // All main branch runs (including excluded)
        uniqueWorkflowsCount: 5, // From workflow definitions
        successWorkflowRunsCount: 2, // CI and Deploy success (others excluded by regex)
        failureWorkflowRunsCount: 0, // workflow1 failure and integration-test failure excluded
        successRate: 100, // 2/2 * 100
      });
    });

    it('should handle invalid regex patterns gracefully', async () => {
      const config = createMockConfig('github-token');

      const entityWithInvalidRegex: Entity = {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'test-service',
          namespace: 'default',
          annotations: {
            'github.com/project-slug': 'owner/repo1',
            'preproduction/exclude': '["[invalid-regex", "valid-pattern"]',
          },
        },
        spec: {},
      };

      const mockCatalogInstance = {
        getEntities: jest.fn().mockResolvedValue({
          items: [entityWithInvalidRegex],
        }),
      };
      mockCatalogClient.mockImplementation(() => mockCatalogInstance as any);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(sampleWorkflowDefinitions),
          headers: new Map(),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(sampleWorkflowRuns),
          headers: new Map(),
        });

      const result = await githubPipelineStatusFactRetriever.handler({
        config,
        logger: mockLogger,
        entityFilter: [{ kind: 'component' }],
        auth: mockAuth,
        discovery: mockDiscovery,
        urlReader: mockUrlReader,
      });

      expect(result).toHaveLength(1);
      // Should still process and handle the invalid regex gracefully
      // The implementation falls back to string matching for invalid regex
      expect(result[0].facts.totalWorkflowRunsCount).toBeGreaterThan(0);
    });

    it('should handle invalid GitHub project slug', async () => {
      const config = createMockConfig('github-token');

      const invalidEntity: Entity = {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'invalid-service',
          namespace: 'default',
          annotations: {
            'github.com/project-slug': 'invalid-slug', // Missing slash
          },
        },
        spec: {},
      };

      const mockCatalogInstance = {
        getEntities: jest.fn().mockResolvedValue({
          items: [invalidEntity],
        }),
      };
      mockCatalogClient.mockImplementation(() => mockCatalogInstance as any);

      const result = await githubPipelineStatusFactRetriever.handler({
        config,
        logger: mockLogger,
        entityFilter: [{ kind: 'component' }],
        auth: mockAuth,
        discovery: mockDiscovery,
        urlReader: mockUrlReader,
      });

      expect(result).toEqual([]);
      // Since logging is removed, we just verify the behavior (empty result)
    });

    it('should handle GitHub API errors gracefully', async () => {
      const config = createMockConfig('github-token');

      const mockCatalogInstance = {
        getEntities: jest.fn().mockResolvedValue({
          items: [sampleEntities[0]],
        }),
      };
      mockCatalogClient.mockImplementation(() => mockCatalogInstance as any);

      // Mock fetch to return error for workflow definitions
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
        headers: new Map(),
      });

      const result = await githubPipelineStatusFactRetriever.handler({
        config,
        logger: mockLogger,
        entityFilter: [{ kind: 'component' }],
        auth: mockAuth,
        discovery: mockDiscovery,
        urlReader: mockUrlReader,
      });

      expect(result).toEqual([]);
      // Since logging is removed, we just verify the behavior (empty result)
    });

    it('should handle pagination correctly', async () => {
      const config = createMockConfig('github-token');

      const mockCatalogInstance = {
        getEntities: jest.fn().mockResolvedValue({
          items: [sampleEntities[0]],
        }),
      };
      mockCatalogClient.mockImplementation(() => mockCatalogInstance as any);

      // Create 100 workflow runs for first page (full page)
      const firstPageRuns = Array.from({ length: 100 }, (_, i) => ({
        name: `Workflow-${i}`,
        status: 'completed',
        conclusion: 'success',
        created_at: '2023-01-01T00:00:00Z',
        head_branch: 'main',
        workflow_id: 1,
      }));

      // Create 50 workflow runs for second page (partial page)
      const secondPageRuns = Array.from({ length: 50 }, (_, i) => ({
        name: `Workflow-${i + 100}`,
        status: 'completed',
        conclusion: 'success',
        created_at: '2023-01-01T00:00:00Z',
        head_branch: 'main',
        workflow_id: 1,
      }));

      // Mock fetch responses
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(sampleWorkflowDefinitions),
          headers: new Map(),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ workflow_runs: firstPageRuns }),
          headers: new Map([['Link', '<page2>; rel="next"']]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ workflow_runs: secondPageRuns }),
          headers: new Map(),
        });

      const result = await githubPipelineStatusFactRetriever.handler({
        config,
        logger: mockLogger,
        entityFilter: [{ kind: 'component' }],
        auth: mockAuth,
        discovery: mockDiscovery,
        urlReader: mockUrlReader,
      });

      expect(result).toHaveLength(1);
      expect(result[0].facts.totalWorkflowRunsCount).toBe(150); // 100 + 50
      expect(result[0].facts.successWorkflowRunsCount).toBe(150);
    });

    it('should filter out non-main branch runs', async () => {
      const config = createMockConfig('github-token');

      const mockCatalogInstance = {
        getEntities: jest.fn().mockResolvedValue({
          items: [sampleEntities[0]],
        }),
      };
      mockCatalogClient.mockImplementation(() => mockCatalogInstance as any);

      const mixedBranchRuns = {
        workflow_runs: [
          {
            name: 'CI',
            status: 'completed',
            conclusion: 'success',
            created_at: '2023-01-01T00:00:00Z',
            head_branch: 'main',
            workflow_id: 1,
          },
          {
            name: 'CI',
            status: 'completed',
            conclusion: 'success',
            created_at: '2023-01-01T01:00:00Z',
            head_branch: 'feature-branch',
            workflow_id: 1,
          },
          {
            name: 'CI',
            status: 'completed',
            conclusion: 'success',
            created_at: '2023-01-01T02:00:00Z',
            head_branch: 'develop',
            workflow_id: 1,
          },
        ],
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(sampleWorkflowDefinitions),
          headers: new Map(),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mixedBranchRuns),
          headers: new Map(),
        });

      const result = await githubPipelineStatusFactRetriever.handler({
        config,
        logger: mockLogger,
        entityFilter: [{ kind: 'component' }],
        auth: mockAuth,
        discovery: mockDiscovery,
        urlReader: mockUrlReader,
      });

      expect(result).toHaveLength(1);
      expect(result[0].facts.totalWorkflowRunsCount).toBe(1); // Only main branch
      expect(result[0].facts.successWorkflowRunsCount).toBe(1);
    });

    it('should handle no workflow runs found', async () => {
      const config = createMockConfig('github-token');

      const mockCatalogInstance = {
        getEntities: jest.fn().mockResolvedValue({
          items: [sampleEntities[0]],
        }),
      };
      mockCatalogClient.mockImplementation(() => mockCatalogInstance as any);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(sampleWorkflowDefinitions),
          headers: new Map(),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ workflow_runs: [] }),
          headers: new Map(),
        });

      const result = await githubPipelineStatusFactRetriever.handler({
        config,
        logger: mockLogger,
        entityFilter: [{ kind: 'component' }],
        auth: mockAuth,
        discovery: mockDiscovery,
        urlReader: mockUrlReader,
      });

      expect(result).toHaveLength(1);
      expect(result[0].facts).toEqual({
        totalWorkflowRunsCount: 0,
        uniqueWorkflowsCount: 5, // Updated to match new workflow definitions count
        successWorkflowRunsCount: 0,
        failureWorkflowRunsCount: 0,
        successRate: 0,
      });
    });

    it('should handle invalid exclusion annotation', async () => {
      const config = createMockConfig('github-token');

      const entityWithInvalidExclusion: Entity = {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'test-service',
          namespace: 'default',
          annotations: {
            'github.com/project-slug': 'owner/repo1',
            'preproduction/exclude': 'invalid-json',
          },
        },
        spec: {},
      };

      const mockCatalogInstance = {
        getEntities: jest.fn().mockResolvedValue({
          items: [entityWithInvalidExclusion],
        }),
      };
      mockCatalogClient.mockImplementation(() => mockCatalogInstance as any);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(sampleWorkflowDefinitions),
          headers: new Map(),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(sampleWorkflowRuns),
          headers: new Map(),
        });

      const result = await githubPipelineStatusFactRetriever.handler({
        config,
        logger: mockLogger,
        entityFilter: [{ kind: 'component' }],
        auth: mockAuth,
        discovery: mockDiscovery,
        urlReader: mockUrlReader,
      });

      expect(result).toHaveLength(1);
      // Since logging is removed, we just verify the behavior
      // Should process all workflows since exclusion parsing failed
      expect(result[0].facts.successWorkflowRunsCount).toBe(3); // Updated to match new expected count
    });

    it('should calculate success rate correctly with mixed results', async () => {
      const config = createMockConfig('github-token');

      const mockCatalogInstance = {
        getEntities: jest.fn().mockResolvedValue({
          items: [sampleEntities[0]],
        }),
      };
      mockCatalogClient.mockImplementation(() => mockCatalogInstance as any);

      const mixedResultRuns = {
        workflow_runs: [
          // 2 successes
          {
            name: 'CI',
            status: 'completed',
            conclusion: 'success',
            created_at: '2023-01-01T00:00:00Z',
            head_branch: 'main',
            workflow_id: 1,
          },
          {
            name: 'Deploy',
            status: 'completed',
            conclusion: 'success',
            created_at: '2023-01-01T01:00:00Z',
            head_branch: 'main',
            workflow_id: 2,
          },
          // 3 failures
          {
            name: 'Test',
            status: 'completed',
            conclusion: 'failure',
            created_at: '2023-01-01T02:00:00Z',
            head_branch: 'main',
            workflow_id: 3,
          },
          {
            name: 'Lint',
            status: 'completed',
            conclusion: 'failure',
            created_at: '2023-01-01T03:00:00Z',
            head_branch: 'main',
            workflow_id: 4,
          },
          {
            name: 'Build',
            status: 'completed',
            conclusion: 'failure',
            created_at: '2023-01-01T04:00:00Z',
            head_branch: 'main',
            workflow_id: 5,
          },
          // 1 in progress (should not count in success rate)
          {
            name: 'Security',
            status: 'in_progress',
            conclusion: null,
            created_at: '2023-01-01T05:00:00Z',
            head_branch: 'main',
            workflow_id: 6,
          },
        ],
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(sampleWorkflowDefinitions),
          headers: new Map(),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mixedResultRuns),
          headers: new Map(),
        });

      const result = await githubPipelineStatusFactRetriever.handler({
        config,
        logger: mockLogger,
        entityFilter: [{ kind: 'component' }],
        auth: mockAuth,
        discovery: mockDiscovery,
        urlReader: mockUrlReader,
      });

      expect(result).toHaveLength(1);
      expect(result[0].facts).toEqual({
        totalWorkflowRunsCount: 6,
        uniqueWorkflowsCount: 5, // Updated to match new workflow definitions count
        successWorkflowRunsCount: 2,
        failureWorkflowRunsCount: 3,
        successRate: 40, // 2/(2+3) * 100 = 40%
      });
    });
  });

  describe('schema validation', () => {
    it('should have correct schema definition', () => {
      expect(githubPipelineStatusFactRetriever.schema).toEqual({
        totalWorkflowRunsCount: {
          type: 'integer',
          description:
            'Total number of workflow runs on main branch (including excluded)',
        },
        uniqueWorkflowsCount: {
          type: 'integer',
          description:
            'Number of unique workflows that have runs (matching GitHub UI)',
        },
        successWorkflowRunsCount: {
          type: 'integer',
          description:
            'Number of successful workflow runs (excluding workflows matching exclude patterns)',
        },
        failureWorkflowRunsCount: {
          type: 'integer',
          description:
            'Number of failed workflow runs (excluding workflows matching exclude patterns)',
        },
        successRate: {
          type: 'float',
          description:
            'Success rate percentage (0-100) of workflow runs (excluding workflows matching exclude patterns)',
        },
      });
    });

    it('should have correct entity filter', () => {
      expect(githubPipelineStatusFactRetriever.entityFilter).toEqual([
        { kind: 'component' },
      ]);
    });

    it('should have correct id and version', () => {
      expect(githubPipelineStatusFactRetriever.id).toBe(
        'githubPipelineStatusFactRetriever',
      );
      expect(githubPipelineStatusFactRetriever.version).toBe('0.2.0');
    });
  });
});
