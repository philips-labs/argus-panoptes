import { createDependabotFactRetriever } from './dependabotFactRetriever';

jest.mock('@backstage/catalog-client', () => ({
  CatalogClient: jest.fn().mockImplementation(() => ({
    getEntities: jest.fn().mockResolvedValue({
      items: [
        {
          apiVersion: 'backstage.io/v1alpha1',
          kind: 'Component',
          metadata: {
            name: 'my-service',
            namespace: 'default',
            annotations: {
              'github.com/project-slug': 'test-org/my-service',
            },
          },
          spec: {
            type: 'service',
            lifecycle: 'production',
            owner: 'user:default/team',
          },
        },
      ],
    }),
  })),
}));

const requestMock = jest.fn();
jest.mock('./octokitLoader', () => ({
  loadOctokit: jest.fn().mockResolvedValue(
    jest.fn().mockImplementation(() => ({
      request: requestMock,
    })),
  ),
}));

describe('createDependabotFactRetriever', () => {
  const mockLogger = {
    child: jest.fn().mockReturnThis(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as any;

  const mockConfig = {
    getOptionalConfigArray: jest
      .fn()
      .mockReturnValue([
        { getOptionalString: jest.fn().mockReturnValue('mock-token') },
      ]),
  } as any;

  const mockConfigWithoutToken = {
    getOptionalConfigArray: jest
      .fn()
      .mockReturnValue([
        { getOptionalString: jest.fn().mockReturnValue(undefined) },
      ]),
  } as any;

  const mockDiscovery = {
    getBaseUrl: jest.fn().mockResolvedValue('http://localhost'),
  } as any;

  const mockAuth = {
    getOwnServiceCredentials: jest
      .fn()
      .mockResolvedValue({ token: 'service-token' }),
    getPluginRequestToken: jest
      .fn()
      .mockResolvedValue({ token: 'catalog-token' }),
  } as any;

  const urlReader = {} as any;

  const factRetriever = createDependabotFactRetriever(mockConfig, mockLogger);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns correct counts for critical, high, and medium alerts', async () => {
    requestMock.mockResolvedValue({
      data: [
        { state: 'open', security_advisory: { severity: 'CRITICAL' } },
        { state: 'open', security_advisory: { severity: 'HIGH' } },
        { state: 'open', security_advisory: { severity: 'HIGH' } },
        { state: 'open', security_advisory: { severity: 'MODERATE' } },
        { state: 'closed', security_advisory: { severity: 'CRITICAL' } },
      ],
    });

    const result = await factRetriever.handler({
      discovery: mockDiscovery,
      auth: mockAuth,
      logger: mockLogger,
      config: mockConfig,
      urlReader,
    });

    expect(result).toEqual([
      {
        entity: {
          name: 'my-service',
          kind: 'Component',
          namespace: 'default',
        },
        facts: {
          critical: 1,
          high: 2,
          medium: 1,
        },
      },
    ]);
  });

  it('returns zeros if no alerts found', async () => {
    requestMock.mockResolvedValue({ data: [] });

    const result = await factRetriever.handler({
      discovery: mockDiscovery,
      auth: mockAuth,
      logger: mockLogger,
      config: mockConfig,
      urlReader,
    });

    expect(result).toEqual([
      {
        entity: {
          name: 'my-service',
          kind: 'Component',
          namespace: 'default',
        },
        facts: {
          critical: 0,
          high: 0,
          medium: 0,
        },
      },
    ]);
  });

  it('returns empty array if slug is missing', async () => {
    const catalogClient = require('@backstage/catalog-client').CatalogClient;
    catalogClient.mockImplementation(() => ({
      getEntities: jest.fn().mockResolvedValue({
        items: [
          {
            apiVersion: 'backstage.io/v1alpha1',
            kind: 'Component',
            metadata: {
              name: 'my-service',
              namespace: 'default',
              annotations: {},
            },
            spec: {},
          },
        ],
      }),
    }));

    const factRetrieverWithoutSlug = createDependabotFactRetriever(
      mockConfig,
      mockLogger,
    );

    const result = await factRetrieverWithoutSlug.handler({
      discovery: mockDiscovery,
      auth: mockAuth,
      logger: mockLogger,
      config: mockConfig,
      urlReader,
    });

    expect(result).toEqual([]);
  });

  it('returns empty if GitHub token is missing', async () => {
    const retriever = createDependabotFactRetriever(
      mockConfigWithoutToken,
      mockLogger,
    );

    const result = await retriever.handler({
      discovery: mockDiscovery,
      auth: mockAuth,
      logger: mockLogger,
      config: mockConfigWithoutToken,
      urlReader,
    });

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Missing GitHub token in config',
    );
    expect(result).toEqual([]);
  });
});
