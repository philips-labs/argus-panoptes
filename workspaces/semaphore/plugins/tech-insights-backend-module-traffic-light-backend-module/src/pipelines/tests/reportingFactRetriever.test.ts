import { reportingPipelineStatusFactRetriever } from '../reportingFactRetriever';
import { CatalogClient } from '@backstage/catalog-client';
import { Logger } from 'winston';
import { Config } from '@backstage/config';
import {
  AuthService,
  DiscoveryService,
  UrlReaderService,
} from '@backstage/backend-plugin-api';

jest.mock('@backstage/catalog-client');

const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockLogger: Logger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
} as any;

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

const mockDiscovery: DiscoveryService = {
  getBaseUrl: jest.fn().mockResolvedValue('http://localhost:7007'),
  getExternalBaseUrl: jest.fn().mockResolvedValue('http://localhost:7007'),
};

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

const sampleEntities = [
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'test-service',
      namespace: 'default',
      annotations: {
        'github.com/project-slug': 'owner/repo1',
        'reporting/workflows': '["CI", "Deploy"]',
        'reporting/target-branch': 'develop',
      },
    },
    spec: {},
  },
];

const sampleWorkflowDefinitions = {
  workflows: [
    { id: 1, name: 'CI', path: '.github/workflows/ci.yml' },
    { id: 2, name: 'Deploy', path: '.github/workflows/deploy.yml' },
  ],
};

const sampleWorkflowRuns = {
  workflow_runs: [
    {
      name: 'CI',
      status: 'completed',
      conclusion: 'success',
      created_at: '2023-01-01T00:00:00Z',
      head_branch: 'develop',
      workflow_id: 1,
    },
    {
      name: 'Deploy',
      status: 'completed',
      conclusion: 'failure',
      created_at: '2023-01-01T01:00:00Z',
      head_branch: 'develop',
      workflow_id: 2,
    },
  ],
};

describe('reportingPipelineStatusFactRetriever', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (CatalogClient as jest.Mock).mockImplementation(() => ({
      getEntities: jest.fn().mockResolvedValue({ items: sampleEntities }),
    }));
  });

  it('returns empty array when no GitHub token is configured', async () => {
    const config = createMockConfig();

    // Mock the workflow definitions call that will happen even without token
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    const facts = await reportingPipelineStatusFactRetriever.handler({
      config,
      logger: mockLogger,
      entityFilter: [{ kind: 'component' }],
      auth: mockAuth,
      discovery: mockDiscovery,
      urlReader: mockUrlReader,
    });

    expect(facts).toEqual([]);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner/repo1/actions/workflows',
      expect.objectContaining({
        headers: { Accept: 'application/vnd.github.v3+json' },
      }),
    );
  });

  it('uses target branch from annotation and returns correct workflow metrics', async () => {
    const config = createMockConfig('test-token');

    // Mock workflow definitions
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => sampleWorkflowDefinitions,
    });

    // CI workflow run (develop)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        workflow_runs: [sampleWorkflowRuns.workflow_runs[0]], // CI - success
      }),
    });

    // Deploy workflow run (develop)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        workflow_runs: [sampleWorkflowRuns.workflow_runs[1]], // Deploy - failure
      }),
    });

    const facts = await reportingPipelineStatusFactRetriever.handler({
      config,
      logger: mockLogger,
      entityFilter: [{ kind: 'component' }],
      auth: mockAuth,
      discovery: mockDiscovery,
      urlReader: mockUrlReader,
    });

    expect(facts).toHaveLength(1);

    const fact = facts[0];
    expect(fact.entity).toEqual({
      kind: 'Component',
      namespace: 'default',
      name: 'test-service',
    });

    const metrics = fact.facts.workflowMetrics as Array<{
      workflowName: string;
      lastRunStatus: string;
      lastRunDate: string;
    }>;

    expect(metrics).toHaveLength(2);

    const ciMetric = metrics.find(m => m.workflowName === 'CI');
    const deployMetric = metrics.find(m => m.workflowName === 'Deploy');

    expect(ciMetric?.lastRunStatus).toBe('success');
    expect(deployMetric?.lastRunStatus).toBe('failure');
    expect(fact.facts.totalIncludedWorkflows).toBe(2);
    expect(fact.facts.successRate).toBe(50);
  });

  it('calculates 0% success rate when no workflow runs are found', async () => {
    const config = createMockConfig('test-token');

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => sampleWorkflowDefinitions,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ workflow_runs: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ workflow_runs: [] }),
      });

    const facts = await reportingPipelineStatusFactRetriever.handler({
      config,
      logger: mockLogger,
      entityFilter: [{ kind: 'component' }],
      auth: mockAuth,
      discovery: mockDiscovery,
      urlReader: mockUrlReader,
    });

    expect(facts).toHaveLength(1);

    const fact = facts[0];
    expect(fact.facts.workflowMetrics).toEqual([]);
    expect(fact.facts.successRate).toBe(0);
    expect(fact.facts.totalIncludedWorkflows).toBe(0);
  });

  it('returns empty array when workflow annotation is malformed', async () => {
    const badEntities = [
      {
        ...sampleEntities[0],
        metadata: {
          ...sampleEntities[0].metadata,
          annotations: {
            ...sampleEntities[0].metadata.annotations,
            'reporting/workflows': '[not json]',
          },
        },
      },
    ];

    (CatalogClient as jest.Mock).mockImplementation(() => ({
      getEntities: jest.fn().mockResolvedValue({ items: badEntities }),
    }));

    const config = createMockConfig('test-token');
    const facts = await reportingPipelineStatusFactRetriever.handler({
      config,
      logger: mockLogger,
      entityFilter: [{ kind: 'component' }],
      auth: mockAuth,
      discovery: mockDiscovery,
      urlReader: mockUrlReader,
    });

    expect(facts).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns empty array when specified workflows do not exist in repository', async () => {
    const noMatchEntities = [
      {
        ...sampleEntities[0],
        metadata: {
          ...sampleEntities[0].metadata,
          annotations: {
            ...sampleEntities[0].metadata.annotations,
            'reporting/workflows': '["Unknown", "NonExistent"]',
          },
        },
      },
    ];

    (CatalogClient as jest.Mock).mockImplementation(() => ({
      getEntities: jest.fn().mockResolvedValue({ items: noMatchEntities }),
    }));

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => sampleWorkflowDefinitions,
    });

    const config = createMockConfig('test-token');
    const facts = await reportingPipelineStatusFactRetriever.handler({
      config,
      logger: mockLogger,
      entityFilter: [{ kind: 'component' }],
      auth: mockAuth,
      discovery: mockDiscovery,
      urlReader: mockUrlReader,
    });

    expect(facts).toEqual([]);
    expect(mockFetch).toHaveBeenCalledTimes(1); // Only workflow definitions call
  });

  it('defaults to "main" branch when no target branch annotation is provided', async () => {
    const defaultBranchEntity = {
      ...sampleEntities[0],
      metadata: {
        ...sampleEntities[0].metadata,
        annotations: {
          'github.com/project-slug': 'owner/repo1',
          'reporting/workflows': '["CI"]',
          // No 'reporting/target-branch' annotation
        },
      },
    };

    (CatalogClient as jest.Mock).mockImplementation(() => ({
      getEntities: jest
        .fn()
        .mockResolvedValue({ items: [defaultBranchEntity] }),
    }));

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => sampleWorkflowDefinitions,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          workflow_runs: [sampleWorkflowRuns.workflow_runs[0]],
        }),
      });

    const config = createMockConfig('test-token');
    const facts = await reportingPipelineStatusFactRetriever.handler({
      config,
      logger: mockLogger,
      entityFilter: [{ kind: 'component' }],
      auth: mockAuth,
      discovery: mockDiscovery,
      urlReader: mockUrlReader,
    });

    // Verify that the API was called with main branch
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('branch=main'),
      expect.anything(),
    );

    expect(facts).toHaveLength(1);
    expect(facts[0].facts.successRate).toBe(100);
  });

  it('handles GitHub API errors gracefully', async () => {
    const config = createMockConfig('test-token');

    // Mock workflow definitions API to fail
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const facts = await reportingPipelineStatusFactRetriever.handler({
      config,
      logger: mockLogger,
      entityFilter: [{ kind: 'component' }],
      auth: mockAuth,
      discovery: mockDiscovery,
      urlReader: mockUrlReader,
    });

    expect(facts).toEqual([]);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner/repo1/actions/workflows',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'token test-token',
        }),
      }),
    );
  });

  it('handles entities without GitHub project slug', async () => {
    const entityWithoutSlug = {
      ...sampleEntities[0],
      metadata: {
        ...sampleEntities[0].metadata,
        annotations: {
          'reporting/workflows': '["CI"]',
          // No 'github.com/project-slug' annotation
        },
      },
    };

    (CatalogClient as jest.Mock).mockImplementation(() => ({
      getEntities: jest.fn().mockResolvedValue({ items: [entityWithoutSlug] }),
    }));

    const config = createMockConfig('test-token');
    const facts = await reportingPipelineStatusFactRetriever.handler({
      config,
      logger: mockLogger,
      entityFilter: [{ kind: 'component' }],
      auth: mockAuth,
      discovery: mockDiscovery,
      urlReader: mockUrlReader,
    });

    expect(facts).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
