import { CatalogClient } from '@backstage/catalog-client';
import { Config } from '@backstage/config';
import { foundationPipelineStatusFactRetriever } from '../foundationFactRetriever';
import { AuthService, DiscoveryService } from '@backstage/backend-plugin-api';

jest.mock('node-fetch', () => jest.fn());
jest.mock('@backstage/catalog-client', () => ({
  CatalogClient: jest.fn().mockImplementation(() => ({
    getEntities: jest.fn(),
  })),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('foundationPipelineStatusFactRetriever', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    child: jest.fn().mockReturnThis(),
  };

  // Complete mock auth service
  const mockAuth: AuthService = {
    getPluginRequestToken: jest
      .fn()
      .mockResolvedValue({ token: 'catalog-token' }),
    getOwnServiceCredentials: jest.fn().mockResolvedValue({}),
    authenticate: jest
      .fn()
      .mockResolvedValue({ principal: { type: 'service' } }),
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

  const mockUrlReader = {
    read: jest.fn(),
    readUrl: jest.fn(),
    readTree: jest.fn(),
    search: jest.fn(),
  };

  const mockConfig = {
    getOptionalConfigArray: jest
      .fn()
      .mockReturnValue([
        { getOptionalString: jest.fn().mockReturnValue('mock-github-token') },
      ]),
  } as unknown as Config;

  const mockEntity = {
    kind: 'Component',
    metadata: {
      name: 'example-repo',
      annotations: { 'github.com/project-slug': 'owner/repo' },
    },
  };

  const mockWorkflows = {
    workflows: [
      { id: 123, name: 'Build', path: '.github/workflows/build.yml' },
      { id: 456, name: 'Test', path: '.github/workflows/test.yml' },
    ],
  };

  const mockWorkflowRuns = {
    workflow_runs: [
      {
        name: 'Build',
        status: 'completed',
        conclusion: 'success',
        created_at: '2025-05-01T12:00:00Z',
        head_branch: 'main',
        workflow_id: 123,
      },
      {
        name: 'Test',
        status: 'completed',
        conclusion: 'failure',
        created_at: '2025-05-01T12:00:00Z',
        head_branch: 'main',
        workflow_id: 456,
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (CatalogClient as jest.Mock).mockImplementation(() => ({
      getEntities: jest.fn().mockResolvedValue({ items: [mockEntity] }),
    }));

    // Set up fetch to respond with workflows then runs
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockWorkflows),
        headers: new Map(),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockWorkflowRuns),
        headers: new Map([['Link', 'no-next']]),
      });
  });

  it('returns correct pipeline fact summary for GitHub repo', async () => {
    const result = await foundationPipelineStatusFactRetriever.handler({
      config: mockConfig,
      logger: mockLogger,
      entityFilter: [{ kind: 'Component' }],
      auth: mockAuth,
      discovery: mockDiscovery,
      urlReader: mockUrlReader,
    });

    expect(result).toHaveLength(1);
    const fact = result[0];
    expect(fact.entity.name).toBe('example-repo');
    expect(fact.facts.totalWorkflowRunsCount).toBe(2);
    expect(fact.facts.uniqueWorkflowsCount).toBe(2);
    expect(fact.facts.successWorkflowRunsCount).toBe(1);
    expect(fact.facts.failureWorkflowRunsCount).toBe(1);
    expect(fact.facts.successRate).toBe(50);

    expect(fact.facts.workflowMetrics).toHaveProperty('Build');
    expect(fact.facts.workflowMetrics).toHaveProperty('Test');
  });

  it('returns empty facts when no GitHub slug exists', async () => {
    (CatalogClient as jest.Mock).mockImplementation(() => ({
      getEntities: jest.fn().mockResolvedValue({
        items: [
          {
            kind: 'Component',
            metadata: { name: 'no-github', annotations: {} },
          },
        ],
      }),
    }));

    const result = await foundationPipelineStatusFactRetriever.handler({
      config: mockConfig,
      logger: mockLogger,
      entityFilter: [{ kind: 'Component' }],
      auth: mockAuth,
      discovery: mockDiscovery,
      urlReader: mockUrlReader,
    });

    expect(result).toEqual([]);
  });
});
