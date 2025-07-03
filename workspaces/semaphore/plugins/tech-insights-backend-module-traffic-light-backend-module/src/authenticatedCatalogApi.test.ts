import { AuthenticatedCatalogApi } from './authenticatedCatalogApi';
import {
  CatalogApi,
  CatalogRequestOptions,
  GetEntityFacetsRequest,
} from '@backstage/catalog-client';
import { Entity } from '@backstage/catalog-model';

describe('AuthenticatedCatalogApi', () => {
  // Mock CatalogApi implementation
  const mockCatalogApi: jest.Mocked<CatalogApi> = {
    removeEntityByUid: jest.fn(),
    refreshEntity: jest.fn(),
    getEntityFacets: jest.fn(),
    addLocation: jest.fn(),
    removeLocationById: jest.fn(),
    getLocationByEntity: jest.fn(),
    validateEntity: jest.fn(),
    getEntityByRef: jest.fn(),
    getEntities: jest.fn(),
    getEntitiesByRefs: jest.fn(),
    queryEntities: jest.fn(),
    getEntityAncestors: jest.fn(),
    getLocationById: jest.fn(),
    getLocationByRef: jest.fn(),
    getLocations: jest.fn(),
  };

  const testToken = 'test-auth-token';
  let api: AuthenticatedCatalogApi;

  beforeEach(() => {
    jest.resetAllMocks();
    api = new AuthenticatedCatalogApi(mockCatalogApi, testToken);
  });

  test('constructor should initialize with catalogApi and token', () => {
    expect(api).toBeDefined();
  });

  test('removeEntityByUid should pass token to underlying api', async () => {
    const uid = 'test-uid';
    const options: CatalogRequestOptions = {};

    await api.removeEntityByUid(uid, options);

    expect(mockCatalogApi.removeEntityByUid).toHaveBeenCalledWith(uid, {
      ...options,
      token: testToken,
    });
  });

  test('refreshEntity should pass token to underlying api', async () => {
    const entityRef = 'component:default/test';
    const options: CatalogRequestOptions = {};

    await api.refreshEntity(entityRef, options);

    expect(mockCatalogApi.refreshEntity).toHaveBeenCalledWith(entityRef, {
      ...options,
      token: testToken,
    });
  });

  test('getEntityFacets should pass token to underlying api', async () => {
    const request: GetEntityFacetsRequest = {
      filter: { kind: 'Component' },
      facets: ['someField'],
    };
    const options: CatalogRequestOptions = {};

    await api.getEntityFacets(request, options);

    expect(mockCatalogApi.getEntityFacets).toHaveBeenCalledWith(request, {
      ...options,
      token: testToken,
    });
  });

  test('addLocation should pass token to underlying api', async () => {
    const location = { type: 'url', target: 'http://example.com' };
    const options: CatalogRequestOptions = {};

    await api.addLocation(location, options);

    expect(mockCatalogApi.addLocation).toHaveBeenCalledWith(location, {
      ...options,
      token: testToken,
    });
  });

  test('removeLocationById should pass token to underlying api', async () => {
    const id = 'location-id';
    const options: CatalogRequestOptions = {};

    await api.removeLocationById(id, options);

    expect(mockCatalogApi.removeLocationById).toHaveBeenCalledWith(id, {
      ...options,
      token: testToken,
    });
  });

  test('getLocationByEntity should pass token to underlying api', async () => {
    const entityRef = 'component:default/test';
    const options: CatalogRequestOptions = {};

    await api.getLocationByEntity(entityRef, options);

    expect(mockCatalogApi.getLocationByEntity).toHaveBeenCalledWith(entityRef, {
      ...options,
      token: testToken,
    });
  });

  test('validateEntity should pass token to underlying api', async () => {
    const entity: Entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: { name: 'test' },
    };
    const locationRef = 'location-ref';
    const options: CatalogRequestOptions = {};

    await api.validateEntity(entity, locationRef, options);

    expect(mockCatalogApi.validateEntity).toHaveBeenCalledWith(
      entity,
      locationRef,
      {
        ...options,
        token: testToken,
      },
    );
  });

  test('getEntityByRef should pass token to underlying api', async () => {
    const ref = 'component:default/test';
    const options: CatalogRequestOptions = {};
    await api.getEntityByRef(ref, options);

    expect(mockCatalogApi.getEntityByRef).toHaveBeenCalledWith(ref, {
      ...options,
      token: testToken,
    });
  });

  test('getEntities should pass token to underlying api', async () => {
    const request = { filter: { kind: 'Component' } };
    const options: CatalogRequestOptions = {};
    await api.getEntities(request, options);

    expect(mockCatalogApi.getEntities).toHaveBeenCalledWith(request, {
      ...options,
      token: testToken,
    });
  });

  test('getEntitiesByRefs should pass token to underlying api', async () => {
    const request = { entityRefs: ['component:default/test'] };
    const options: CatalogRequestOptions = {};
    await api.getEntitiesByRefs(request, options);

    expect(mockCatalogApi.getEntitiesByRefs).toHaveBeenCalledWith(request, {
      ...options,
      token: testToken,
    });
  });

  test('queryEntities should pass token to underlying api', async () => {
    const request = { filter: { key: 'value' } };
    const options: CatalogRequestOptions = {};
    await api.queryEntities(request, options);

    expect(mockCatalogApi.queryEntities).toHaveBeenCalledWith(request, {
      ...options,
      token: testToken,
    });
  });

  test('getEntityAncestors should pass token to underlying api', async () => {
    const request = { entityRef: 'component:default/test' };
    const options: CatalogRequestOptions = {};
    await api.getEntityAncestors(request, options);

    expect(mockCatalogApi.getEntityAncestors).toHaveBeenCalledWith(request, {
      ...options,
      token: testToken,
    });
  });

  test('getLocationById should pass token to underlying api', async () => {
    const locationId = 'location-id';
    const options: CatalogRequestOptions = {};
    await api.getLocationById(locationId, options);

    expect(mockCatalogApi.getLocationById).toHaveBeenCalledWith(locationId, {
      ...options,
      token: testToken,
    });
  });

  test('getLocationByRef should pass token to underlying api', async () => {
    const locationRef = 'location-ref';
    const options: CatalogRequestOptions = {};
    await api.getLocationByRef(locationRef, options);

    expect(mockCatalogApi.getLocationByRef).toHaveBeenCalledWith(locationRef, {
      ...options,
      token: testToken,
    });
  });

  test('getLocations should pass token to underlying api', async () => {
    const request = {};
    const options: CatalogRequestOptions = {};
    await api.getLocations(request, options);

    expect(mockCatalogApi.getLocations).toHaveBeenCalledWith(request, {
      ...options,
      token: testToken,
    });
  });
});
