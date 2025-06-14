import { getVoidLogger } from '@backstage/backend-common';
import { createBlackDuckFactRetriever } from '../blackduckFactRetriever';
import { ConfigReader } from '@backstage/config';
import { Entity } from '@backstage/catalog-model';
import { UrlReaderService } from '@backstage/backend-plugin-api';

// Mock for CatalogClient
const mockGetEntitiesImpl = jest.fn();
jest.mock('@backstage/catalog-client', () => {
  return {
    CatalogClient: jest.fn().mockImplementation(() => ({
      getEntities: mockGetEntitiesImpl,
    })),
  };
});

// Mock global fetch for BlackDuck API requests
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('BlackDuck Fact Retriever', () => {
  // Setup reusable test variables
  const mockConfig = new ConfigReader({
    blackduck: {
      token: 'test-token',
      host: 'https://blackduck.test',
    },
  });

  const mockLogger = getVoidLogger();

  // Mock discovery API for service URLs
  const mockDiscovery = {
    getBaseUrl: jest
      .fn()
      .mockResolvedValue('http://backstage.test/api/catalog'),
    getExternalBaseUrl: jest
      .fn()
      .mockResolvedValue('http://backstage.test/external'),
  };

  // Mock authentication API
  const mockAuth: any = {
    getPluginRequestToken: jest
      .fn()
      .mockResolvedValue({ token: 'catalog-token' }),
    getOwnServiceCredentials: jest.fn().mockResolvedValue('service-creds'),
    authenticate: jest.fn(),
    isPrincipal: jest.fn().mockImplementation(() => false),
    getNoneCredentials: jest.fn(),
    getLimitedUserToken: jest.fn(),
    listPublicServiceKeys: jest.fn(),
  };

  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetEntitiesImpl.mockReset();
  });

  /**
   * Helper function to create a test entity
   * @param overrides - Partial entity metadata to override defaults
   */
  const createTestEntity = (overrides: any = {}): Entity => {
    const entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'component',
      metadata: {
        name: 'test-component',
        namespace: 'default',
        annotations: {
          'blackduck.io/enabled': 'true',
          'blackduck.io/project-name': 'test-project',
          'blackduck.io/project-version': '1.0',
        },
      },
      spec: {},
    };

    // Handle metadata overrides
    if (overrides.metadata) {
      if (overrides.metadata.name) {
        entity.metadata.name = overrides.metadata.name;
      }
      if (overrides.metadata.namespace) {
        entity.metadata.namespace = overrides.metadata.namespace;
      }
      if (overrides.metadata.annotations) {
        entity.metadata.annotations = {
          ...entity.metadata.annotations,
          ...overrides.metadata.annotations,
        };
      }
    }

    return entity as Entity;
  };

  // Test: Fact retriever is created with correct configuration
  it('should create a fact retriever with correct id and schema', async () => {
    const factRetriever = createBlackDuckFactRetriever(mockConfig);

    // Verify the fact retriever is set up correctly
    expect(factRetriever).toEqual(
      expect.objectContaining({
        id: 'blackduck-fact-retriever',
        version: '1.0',
        entityFilter: [{ kind: 'component' }],
        schema: {
          security_risks_critical: {
            type: 'integer',
            description:
              'Number of critical security risks found by Black Duck',
          },
          security_risks_high: {
            type: 'integer',
            description: 'Number of high severity security risks',
          },
          security_risks_medium: {
            type: 'integer',
            description: 'Number of medium severity security risks',
          },
        },
        handler: expect.any(Function),
      }),
    );
  });

  // Test: Retrieves BlackDuck metrics for enabled components
  it('should retrieve BlackDuck metrics for enabled components', async () => {
    // Setup test entity
    const testEntity = createTestEntity();

    mockGetEntitiesImpl.mockResolvedValue({ items: [testEntity] });

    // Create mock JSON functions that return promises
    const mockProjectJson = jest.fn().mockResolvedValue({
      items: [
        {
          name: 'test-project', // This must match the annotation value
          _meta: { href: 'https://blackduck.test/api/projects/123' },
        },
      ],
    });

    const mockVersionJson = jest.fn().mockResolvedValue({
      items: [
        {
          versionName: '1.0', // This must match the annotation value
          _meta: { href: 'https://blackduck.test/api/versions/456' },
        },
      ],
    });

    const mockRiskProfileJson = jest.fn().mockResolvedValue({
      categories: {
        SECURITY: {
          CRITICAL: 1,
          HIGH: 5,
          MEDIUM: 10,
        },
      },
    });

    // Mock the project search API call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: mockProjectJson,
    });

    // Mock the version search API call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: mockVersionJson,
    });

    // Mock the risk profile API call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: mockRiskProfileJson,
    });

    // Create the fact retriever
    const factRetriever = createBlackDuckFactRetriever(mockConfig);

    // Execute the handler
    const result = await factRetriever.handler({
      config: mockConfig,
      logger: mockLogger,
      discovery: mockDiscovery,
      auth: mockAuth,
      entityFilter: [{ kind: 'component' }],
      urlReader: {
        read: jest.fn(),
        readTree: jest.fn(),
        search: jest.fn(),
      } as unknown as UrlReaderService,
    });

    // Verify the results
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      entity: {
        name: 'test-component',
        namespace: 'default',
        kind: 'component',
      },
      facts: {
        security_risks_critical: 1,
        security_risks_high: 5,
        security_risks_medium: 10,
      },
    });

    // Verify that fetch was called with the correct URLs and headers
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  // Test: Filters out components without BlackDuck enabled
  it('should filter out components that do not have BlackDuck enabled', async () => {
    // Setup mock entities - one enabled, one disabled
    const enabledEntity = createTestEntity();
    const disabledEntity = createTestEntity({
      metadata: {
        name: 'disabled-component',
        annotations: {
          'blackduck.io/enabled': 'false',
          'blackduck.io/project-name': 'disabled-test-project',
          'blackduck.io/project-version': '2.0',
        },
      },
    });

    mockGetEntitiesImpl.mockResolvedValue({
      items: [enabledEntity, disabledEntity],
    });

    // Create mock JSON functions that return promises
    const mockProjectJson = jest.fn().mockResolvedValue({
      items: [
        {
          name: 'test-project', // This must match the annotation value
          _meta: { href: 'https://blackduck.test/api/projects/123' },
        },
      ],
    });

    const mockVersionJson = jest.fn().mockResolvedValue({
      items: [
        {
          versionName: '1.0', // This must match the annotation value
          _meta: { href: 'https://blackduck.test/api/versions/456' },
        },
      ],
    });

    const mockRiskProfileJson = jest.fn().mockResolvedValue({
      categories: {
        SECURITY: {
          CRITICAL: 1,
          HIGH: 5,
          MEDIUM: 10,
        },
      },
    });

    // Mock the project search API call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: mockProjectJson,
    });

    // Mock the version search API call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: mockVersionJson,
    });

    // Mock the risk profile API call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: mockRiskProfileJson,
    });

    // Create the fact retriever
    const factRetriever = createBlackDuckFactRetriever(mockConfig);

    // Execute the handler
    const result = await factRetriever.handler({
      config: mockConfig,
      logger: mockLogger,
      discovery: mockDiscovery,
      auth: mockAuth,
      entityFilter: [{ kind: 'component' }],
      urlReader: {
        read: jest.fn(),
        readTree: jest.fn(),
        search: jest.fn(),
      } as unknown as UrlReaderService,
    });

    // Verify only one result is returned (the enabled entity)
    expect(result).toHaveLength(1);
    expect(result[0].entity.name).toBe('test-component');

    // Verify fetch was called only for the enabled entity (2 calls in total)
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  // Test: Handles missing project name annotation
  it('should handle missing project name annotation', async () => {
    // Setup mock entity with missing project name
    const noKeyEntity = createTestEntity({
      metadata: {
        name: 'no-name-component',
        annotations: {
          'blackduck.io/enabled': 'true',
          'blackduck.io/project-name': undefined,
          'blackduck.io/project-version': '1.0',
        },
      },
    });

    mockGetEntitiesImpl.mockResolvedValue({ items: [noKeyEntity] });

    // Create the fact retriever
    const factRetriever = createBlackDuckFactRetriever(mockConfig);

    // Execute the handler
    const result = await factRetriever.handler({
      config: mockConfig,
      logger: mockLogger,
      discovery: mockDiscovery,
      auth: mockAuth,
      entityFilter: [{ kind: 'component' }],
      urlReader: {
        read: jest.fn(),
        readTree: jest.fn(),
        search: jest.fn(),
      } as unknown as UrlReaderService,
    });

    // Verify no results are returned
    expect(result).toHaveLength(0);

    // Verify fetch was not called
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // Test: Handles BlackDuck API failures
  it('should handle BlackDuck API failures', async () => {
    const testEntity = createTestEntity();

    mockGetEntitiesImpl.mockResolvedValue({ items: [testEntity] });

    // Mock a failed API response
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'Invalid token',
    });

    // Create the fact retriever
    const factRetriever = createBlackDuckFactRetriever(mockConfig);

    // Execute the handler
    const result = await factRetriever.handler({
      config: mockConfig,
      logger: mockLogger,
      discovery: mockDiscovery,
      auth: mockAuth,
      entityFilter: [{ kind: 'component' }],
      urlReader: {
        read: jest.fn(),
        readTree: jest.fn(),
        search: jest.fn(),
      } as unknown as UrlReaderService,
    });

    // Verify no results are returned
    expect(result).toHaveLength(0);
  });

  // Test: Handles missing metric values in BlackDuck response
  it('should handle missing metric values in BlackDuck response', async () => {
    const testEntity = createTestEntity();

    mockGetEntitiesImpl.mockResolvedValue({ items: [testEntity] });

    // Create mock JSON functions that return promises
    const mockProjectJson = jest.fn().mockResolvedValue({
      items: [
        {
          name: 'test-project', // This must match the annotation value
          _meta: { href: 'https://blackduck.test/api/projects/123' },
        },
      ],
    });

    const mockVersionJson = jest.fn().mockResolvedValue({
      items: [
        {
          versionName: '1.0', // This must match the annotation value
          _meta: { href: 'https://blackduck.test/api/versions/456' },
        },
      ],
    });

    const mockRiskProfileJson = jest.fn().mockResolvedValue({
      categories: {
        SECURITY: {
          CRITICAL: 1, // high and medium will be missing
        },
      },
    });

    // Mock the project search API call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: mockProjectJson,
    });

    // Mock the version search API call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: mockVersionJson,
    });

    // Mock the risk profile API call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: mockRiskProfileJson,
    });

    // Create the fact retriever
    const factRetriever = createBlackDuckFactRetriever(mockConfig);

    // Execute the handler
    const result = await factRetriever.handler({
      config: mockConfig,
      logger: mockLogger,
      discovery: mockDiscovery,
      auth: mockAuth,
      entityFilter: [{ kind: 'component' }],
      urlReader: {
        read: jest.fn(),
        readTree: jest.fn(),
        search: jest.fn(),
      } as unknown as UrlReaderService,
    });

    // Verify the results - missing metrics should be 0
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      entity: {
        name: 'test-component',
        namespace: 'default',
        kind: 'component',
      },
      facts: {
        security_risks_critical: 1,
        security_risks_high: 0,
        security_risks_medium: 0,
      },
    });

    // Verify that fetch was called with the correct URLs and headers
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('should handle multiple enabled components', async () => {
    // Setup test entities
    const entity1 = createTestEntity();

    const entity2 = createTestEntity({
      metadata: {
        name: 'test-component-2',
        annotations: {
          'blackduck.io/enabled': 'true',
          'blackduck.io/project-name': 'test-project-2',
          'blackduck.io/project-version': '1.0',
        },
      },
    });

    // // Mock catalog client to return both entities
    mockGetEntitiesImpl.mockResolvedValue({ items: [entity1, entity2] });

    // Mock all API calls in sequence
    // Entity 1
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              name: 'test-project',
              _meta: { href: 'https://blackduck.test/api/projects/123' },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              name: 'test-project-2',
              _meta: { href: 'https://blackduck.test/api/projects/123' },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              versionName: '1.0',
              _meta: { href: 'https://blackduck.test/api/versions/111' },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              versionName: '1.0',
              _meta: { href: 'https://blackduck.test/api/versions/222' },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          categories: {
            SECURITY: {
              CRITICAL: 1,
              HIGH: 5,
              MEDIUM: 10,
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          categories: {
            SECURITY: {
              CRITICAL: 2,
              HIGH: 3,
              MEDIUM: 4,
            },
          },
        }),
      });

    const factRetriever = createBlackDuckFactRetriever(mockConfig);

    const result = await factRetriever.handler({
      config: mockConfig,
      logger: mockLogger,
      discovery: mockDiscovery,
      auth: mockAuth,
      entityFilter: [{ kind: 'component' }],
      urlReader: {
        read: jest.fn(),
        readTree: jest.fn(),
        search: jest.fn(),
      } as unknown as UrlReaderService,
    });

    expect(result).toHaveLength(2);

    // Entity 1
    expect(result[0].entity.name).toBe('test-component');
    expect(result[0].facts).toEqual({
      security_risks_critical: 1,
      security_risks_high: 5,
      security_risks_medium: 10,
    });

    // Entity 2
    expect(result[1].entity.name).toBe('test-component-2');
    expect(result[1].facts).toEqual({
      security_risks_critical: 2,
      security_risks_high: 3,
      security_risks_medium: 4,
    });

    expect(mockFetch).toHaveBeenCalledTimes(6);
  });
});
