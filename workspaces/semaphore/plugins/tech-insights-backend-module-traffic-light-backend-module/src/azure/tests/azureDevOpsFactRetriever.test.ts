import { createAzureDevOpsBugsRetriever } from '../azureDevOpsFactRetriever';
import { Entity } from '@backstage/catalog-model';

// Mock for CatalogClient
const mockGetEntitiesImpl = jest.fn();
jest.mock('@backstage/catalog-client', () => {
  return {
    CatalogClient: jest.fn().mockImplementation(() => ({
      getEntities: mockGetEntitiesImpl,
    })),
  };
});

// Mock global fetch for Azure DevOps API requests
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('Azure DevOps Bugs Fact Retriever', () => {
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

  let mockContext: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetEntitiesImpl.mockReset();

    // Setup mock context
    mockContext = {
      auth: mockAuth,
      discovery: mockDiscovery,
      config: {
        getOptionalConfigArray: jest.fn(),
      },
    };
  });

  // Test: Basic fact retriever configuration
  describe('Configuration', () => {
    test('has correct basic properties', () => {
      expect(createAzureDevOpsBugsRetriever.id).toBe(
        'azure-devops-bugs-retriever',
      );
      expect(createAzureDevOpsBugsRetriever.version).toBe('1.0');
      expect(createAzureDevOpsBugsRetriever.entityFilter).toEqual([
        { kind: 'component' },
      ]);
    });

    test('has correct schema definition', () => {
      const schema = createAzureDevOpsBugsRetriever.schema;

      expect(schema).toHaveProperty('azure_bug_count');
      expect(schema.azure_bug_count.type).toBe('integer');
      expect(schema.azure_bug_count.description).toBe(
        'Number of Azure DevOps bugs from WIQL query',
      );
    });

    test('handler is a function', () => {
      expect(typeof createAzureDevOpsBugsRetriever.handler).toBe('function');
    });
  });

  // Test: Handler function behavior
  describe('Handler Function', () => {
    const mockEntity: Entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: 'test-component',
        namespace: 'default',
        annotations: {
          'azure.com/organization': 'test-org',
          'azure.com/project': 'test-project',
          'azure.com/bugs-query-id': 'test-query-id',
        },
      },
    };

    beforeEach(() => {
      // Mock Azure config
      mockContext.config.getOptionalConfigArray.mockReturnValue([
        {
          getOptionalString: jest.fn().mockReturnValue('test-pat-token'),
        },
      ]);

      // Mock catalog client response
      mockGetEntitiesImpl.mockResolvedValue({
        items: [mockEntity],
      });
    });

    test('successfully retrieves bug count for valid entity', async () => {
      // Mock successful Azure DevOps API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          workItems: [
            { id: 1, title: 'Bug 1' },
            { id: 2, title: 'Bug 2' },
            { id: 3, title: 'Bug 3' },
          ],
        }),
      } as Response);

      const result = await createAzureDevOpsBugsRetriever.handler(mockContext);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        entity: {
          name: 'test-component',
          namespace: 'default',
          kind: 'Component',
        },
        facts: {
          azure_bug_count: 3,
        },
      });
    });

    test('handles missing Azure DevOps token', async () => {
      // Mock missing Azure config
      mockContext.config.getOptionalConfigArray.mockReturnValue([
        {
          getOptionalString: jest.fn().mockReturnValue(undefined),
        },
      ]);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await createAzureDevOpsBugsRetriever.handler(mockContext);

      expect(result).toHaveLength(1);
      expect(result[0].facts.azure_bug_count).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Azure DevOps token is not defined.',
      );

      consoleSpy.mockRestore();
    });

    test('handles entity with missing required annotations', async () => {
      const entityWithoutAnnotations: Entity = {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'incomplete-component',
          namespace: 'default',
          annotations: {
            'azure.com/organization': 'test-org',
            // Missing project and bugs-query-id
          },
        },
      };

      mockGetEntitiesImpl.mockResolvedValue({
        items: [entityWithoutAnnotations],
      });

      const result = await createAzureDevOpsBugsRetriever.handler(mockContext);

      expect(result).toHaveLength(1);
      expect(result[0].facts.azure_bug_count).toBeNull();
    });

    test('handles Azure DevOps API failure', async () => {
      // Mock failed Azure DevOps API response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized',
      } as Response);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await createAzureDevOpsBugsRetriever.handler(mockContext);

      expect(result).toHaveLength(0); // Should continue without adding result
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to fetch WIQL results for test-component: Unauthorized',
      );

      consoleSpy.mockRestore();
    });

    test('handles Azure DevOps API network error', async () => {
      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await createAzureDevOpsBugsRetriever.handler(mockContext);

      expect(result).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error retrieving bugs for test-component: Error: Network error',
      );

      consoleSpy.mockRestore();
    });

    test('handles empty workItems array', async () => {
      // Mock Azure DevOps API response with no bugs
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          workItems: [],
        }),
      } as Response);

      const result = await createAzureDevOpsBugsRetriever.handler(mockContext);

      expect(result).toHaveLength(1);
      expect(result[0].facts.azure_bug_count).toBe(0);
    });

    test('handles missing workItems property in response', async () => {
      // Mock Azure DevOps API response without workItems property
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

      const result = await createAzureDevOpsBugsRetriever.handler(mockContext);

      expect(result).toHaveLength(1);
      expect(result[0].facts.azure_bug_count).toBe(0);
    });

    test('handles catalog client failure', async () => {
      mockGetEntitiesImpl.mockRejectedValue(new Error('Catalog error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await createAzureDevOpsBugsRetriever.handler(mockContext);

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to fetch entities: Error: Catalog error',
      );

      consoleSpy.mockRestore();
    });

    test('correctly encodes PAT token for authorization', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ workItems: [] }),
      } as Response);

      await createAzureDevOpsBugsRetriever.handler(mockContext);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://dev.azure.com/test-org/test-project/_apis/wit/wiql/test-query-id?api-version=7.0',
        {
          method: 'GET',
          headers: {
            Authorization: `Basic ${Buffer.from(':test-pat-token').toString(
              'base64',
            )}`,
            Accept: 'application/json',
          },
        },
      );
    });

    test('handles entity without namespace', async () => {
      const entityWithoutNamespace: Entity = {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'no-namespace-component',
          annotations: {
            'azure.com/organization': 'test-org',
            'azure.com/project': 'test-project',
            'azure.com/bugs-query-id': 'test-query-id',
          },
        },
      };

      mockGetEntitiesImpl.mockResolvedValue({
        items: [entityWithoutNamespace],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ workItems: [{ id: 1 }] }),
      } as Response);

      const result = await createAzureDevOpsBugsRetriever.handler(mockContext);

      expect(result[0].entity.namespace).toBe('default');
    });

    test('processes multiple entities correctly', async () => {
      const entities: Entity[] = [
        {
          ...mockEntity,
          metadata: { ...mockEntity.metadata, name: 'component-1' },
        },
        {
          ...mockEntity,
          metadata: { ...mockEntity.metadata, name: 'component-2' },
        },
      ];

      mockGetEntitiesImpl.mockResolvedValue({
        items: entities,
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ workItems: [{ id: 1 }, { id: 2 }] }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ workItems: [{ id: 3 }] }),
        } as Response);

      const result = await createAzureDevOpsBugsRetriever.handler(mockContext);

      expect(result).toHaveLength(2);
      expect(result[0].facts.azure_bug_count).toBe(2);
      expect(result[1].facts.azure_bug_count).toBe(1);
    });

    test('handles missing Azure configuration', async () => {
      mockContext.config.getOptionalConfigArray.mockReturnValue(undefined);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await createAzureDevOpsBugsRetriever.handler(mockContext);

      expect(result).toHaveLength(1);
      expect(result[0].facts.azure_bug_count).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Azure DevOps token is not defined.',
      );

      consoleSpy.mockRestore();
    });

    test('uses correct API version and URL structure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ workItems: [] }),
      } as Response);

      await createAzureDevOpsBugsRetriever.handler(mockContext);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          'https://dev.azure.com/test-org/test-project/_apis/wit/wiql/test-query-id?api-version=7.0',
        ),
        expect.any(Object),
      );
    });
  });

  // Test: Edge cases and error handling
  describe('Edge Cases', () => {
    test('handles null entities response', async () => {
      mockGetEntitiesImpl.mockResolvedValue({
        items: null as any,
      });

      const result = await createAzureDevOpsBugsRetriever.handler(mockContext);

      expect(result).toEqual([]);
    });

    test('handles empty entities array', async () => {
      mockGetEntitiesImpl.mockResolvedValue({
        items: [],
      });

      const result = await createAzureDevOpsBugsRetriever.handler(mockContext);

      expect(result).toEqual([]);
    });

    test('handles entity with no annotations', async () => {
      const entityWithoutAnnotations: Entity = {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'no-annotations-component',
        },
      };

      mockGetEntitiesImpl.mockResolvedValue({
        items: [entityWithoutAnnotations],
      });

      mockContext.config.getOptionalConfigArray.mockReturnValue([
        {
          getOptionalString: jest.fn().mockReturnValue('test-pat-token'),
        },
      ]);

      const result = await createAzureDevOpsBugsRetriever.handler(mockContext);

      expect(result).toHaveLength(1);
      expect(result[0].facts.azure_bug_count).toBeNull();
    });
  });
});
