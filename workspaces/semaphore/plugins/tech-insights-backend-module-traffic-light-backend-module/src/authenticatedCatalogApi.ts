import {
  CatalogApi,
  GetEntitiesRequest,
  GetEntitiesResponse,
  GetEntitiesByRefsRequest,
  GetEntitiesByRefsResponse,
  GetEntityAncestorsRequest,
  GetEntityAncestorsResponse,
  CatalogRequestOptions,
  AddLocationRequest,
  AddLocationResponse,
  GetEntityFacetsRequest,
  GetEntityFacetsResponse,
  GetLocationsResponse,
  Location,
  ValidateEntityResponse,
  QueryEntitiesRequest,
  QueryEntitiesResponse,
} from '@backstage/catalog-client';
import { CompoundEntityRef, Entity } from '@backstage/catalog-model';

/**
 * Decorator that wraps a CatalogApi and injects authentication token
 * into all requests automatically
 */
export class AuthenticatedCatalogApi implements CatalogApi {
  constructor(
    private readonly catalogApi: CatalogApi,
    private readonly token: string,
  ) {}

  // Entity removal operations
  async removeEntityByUid(
    uid: string,
    options?: CatalogRequestOptions,
  ): Promise<void> {
    return this.catalogApi.removeEntityByUid(uid, {
      ...options,
      token: this.token,
    });
  }

  // Entity refresh operations
  async refreshEntity(
    entityRef: string,
    options?: CatalogRequestOptions,
  ): Promise<void> {
    return this.catalogApi.refreshEntity(entityRef, {
      ...options,
      token: this.token,
    });
  }

  // Entity facet operations
  async getEntityFacets(
    request: GetEntityFacetsRequest,
    options?: CatalogRequestOptions,
  ): Promise<GetEntityFacetsResponse> {
    return this.catalogApi.getEntityFacets(request, {
      ...options,
      token: this.token,
    });
  }

  // Location management operations
  async addLocation(
    location: AddLocationRequest,
    options?: CatalogRequestOptions,
  ): Promise<AddLocationResponse> {
    return this.catalogApi.addLocation(location, {
      ...options,
      token: this.token,
    });
  }

  async removeLocationById(
    id: string,
    options?: CatalogRequestOptions,
  ): Promise<void> {
    return this.catalogApi.removeLocationById(id, {
      ...options,
      token: this.token,
    });
  }

  // Location retrieval operations
  async getLocationByEntity(
    entityRef: string | CompoundEntityRef,
    options?: CatalogRequestOptions,
  ): Promise<Location | undefined> {
    return this.catalogApi.getLocationByEntity(entityRef, {
      ...options,
      token: this.token,
    });
  }

  // Validation operations
  async validateEntity(
    entity: Entity,
    locationRef: string,
    options?: CatalogRequestOptions,
  ): Promise<ValidateEntityResponse> {
    return this.catalogApi.validateEntity(entity, locationRef, {
      ...options,
      token: this.token,
    });
  }

  // Entity retrieval operations
  async getEntityByRef(
    ref: string,
    options?: CatalogRequestOptions,
  ): Promise<Entity | undefined> {
    return this.catalogApi.getEntityByRef(ref, {
      ...options,
      token: this.token,
    });
  }

  async getEntities(
    request?: GetEntitiesRequest,
    options?: CatalogRequestOptions,
  ): Promise<GetEntitiesResponse> {
    return this.catalogApi.getEntities(request, {
      ...options,
      token: this.token,
    });
  }

  async getEntitiesByRefs(
    request: GetEntitiesByRefsRequest,
    options?: CatalogRequestOptions,
  ): Promise<GetEntitiesByRefsResponse> {
    return this.catalogApi.getEntitiesByRefs(request, {
      ...options,
      token: this.token,
    });
  }

  async queryEntities(
    request?: QueryEntitiesRequest,
    options?: CatalogRequestOptions,
  ): Promise<QueryEntitiesResponse> {
    return this.catalogApi.queryEntities(request, {
      ...options,
      token: this.token,
    });
  }

  // Relationship operations
  async getEntityAncestors(
    request: GetEntityAncestorsRequest,
    options?: CatalogRequestOptions,
  ): Promise<GetEntityAncestorsResponse> {
    return this.catalogApi.getEntityAncestors(request, {
      ...options,
      token: this.token,
    });
  }

  // Additional location operations
  async getLocationById(
    locationId: string,
    options?: CatalogRequestOptions,
  ): Promise<Location | undefined> {
    return this.catalogApi.getLocationById(locationId, {
      ...options,
      token: this.token,
    });
  }

  async getLocationByRef(
    locationRef: string,
    options?: CatalogRequestOptions,
  ): Promise<Location | undefined> {
    return this.catalogApi.getLocationByRef(locationRef, {
      ...options,
      token: this.token,
    });
  }

  async getLocations(
    request?: {},
    options?: CatalogRequestOptions,
  ): Promise<GetLocationsResponse> {
    return this.catalogApi.getLocations(request, {
      ...options,
      token: this.token,
    });
  }
}
