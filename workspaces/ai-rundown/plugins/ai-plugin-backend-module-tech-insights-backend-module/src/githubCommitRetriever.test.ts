import { CatalogClient } from '@backstage/catalog-client';
import { Config } from '@backstage/config';
import { AuthService, DiscoveryService } from '@backstage/backend-plugin-api';
import {
  createGitHubCommitMessageRetriever,
  getGitHubTokenFromConfig,
} from './githubCommitRetriever';

jest.mock('@backstage/catalog-client');
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('createGitHubCommitMessageRetriever', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    child: jest.fn().mockReturnThis(),
  };

  const mockUrlReader = {
    read: jest.fn(),
    readUrl: jest.fn(),
    readTree: jest.fn(),
    search: jest.fn(),
  };

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

  const mockDiscovery: DiscoveryService = {
    getBaseUrl: jest.fn().mockResolvedValue('http://localhost:7007'),
    getExternalBaseUrl: jest.fn().mockResolvedValue('http://localhost:7007'),
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

  const mockPRs = [
    {
      title: 'Add new feature',
      merged_at: new Date().toISOString(),
      commits_url: 'https://api.github.com/repos/owner/repo/commits/1',
    },
  ];

  const mockCommits = [
    {
      commit: {
        message: 'Initial commit\nMore detail',
      },
    },
    {
      commit: {
        message: 'Refactor codebase',
      },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    (CatalogClient as jest.Mock).mockImplementation(() => ({
      getEntities: jest.fn().mockResolvedValue({ items: [mockEntity] }),
    }));

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPRs),
        headers: new Map(),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCommits),
        headers: new Map(),
      });
  });

  it('returns correct commit message facts', async () => {
    const result = await createGitHubCommitMessageRetriever.handler({
      config: mockConfig,
      logger: mockLogger,
      auth: mockAuth,
      discovery: mockDiscovery,
      urlReader: mockUrlReader,
    });

    expect(result).toHaveLength(1);
    const fact = result[0];

    expect(fact.entity.name).toBe('example-repo');
    expect(fact.facts.last_commit_message).toBe('Add new feature');
    expect(fact.facts.commit_count_last_week).toBeGreaterThan(0);
    expect(fact.facts.recent_commit_messages).toContain('Initial commit');
    expect(fact.facts.recent_commit_messages).toContain('Refactor codebase');
  });

  it('returns empty when no GitHub slug found', async () => {
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

    const result = await createGitHubCommitMessageRetriever.handler({
      config: mockConfig,
      logger: mockLogger,
      auth: mockAuth,
      discovery: mockDiscovery,
      urlReader: mockUrlReader,
    });

    expect(result).toEqual([]);
  });
});

describe('getGitHubTokenFromConfig', () => {
  it('returns token when present', () => {
    const config = {
      getOptionalConfigArray: jest
        .fn()
        .mockReturnValue([
          { getOptionalString: jest.fn().mockReturnValue('token-value') },
        ]),
    } as unknown as Config;

    const token = getGitHubTokenFromConfig(config);
    expect(token).toBe('token-value');
  });

  it('returns undefined when no token present', () => {
    const config = {
      getOptionalConfigArray: jest
        .fn()
        .mockReturnValue([
          { getOptionalString: jest.fn().mockReturnValue(undefined) },
        ]),
    } as unknown as Config;

    const token = getGitHubTokenFromConfig(config);
    expect(token).toBeUndefined();
  });

  it('returns undefined on config error', () => {
    const config = {
      getOptionalConfigArray: jest.fn().mockImplementation(() => {
        throw new Error('fail');
      }),
    } as unknown as Config;

    const token = getGitHubTokenFromConfig(config);
    expect(token).toBeUndefined();
  });
});
