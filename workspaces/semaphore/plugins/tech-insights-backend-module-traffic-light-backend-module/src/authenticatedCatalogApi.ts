import {
  CatalogApi,
  GetEntitiesRequest,
  GetEntitiesResponse,
  GetEntitiesByRefsRequest,
  GetEntityAncestorsRequest,
  CatalogRequestOptions,
  AddLocationRequest,
  AddLocationResponse,
  GetEntityFacetsRequest,
  GetEntityFacetsResponse,
  Location,
  ValidateEntityResponse,
} from '@backstage/catalog-client';
import { CompoundEntityRef, Entity } from '@backstage/catalog-model';

export class AuthenticatedCatalogApi implements CatalogApi {
  constructor(
    private readonly catalogApi: CatalogApi,
    private readonly token: string,
  ) {}

  async removeEntityByUid(
    uid: string,
    options?: CatalogRequestOptions,
  ): Promise<void> {
    return this.catalogApi.removeEntityByUid(uid, {
      ...options,
      token: this.token,
    });
  }

  async refreshEntity(
    entityRef: string,
    options?: CatalogRequestOptions,
  ): Promise<void> {
    return this.catalogApi.refreshEntity(entityRef, {
      ...options,
      token: this.token,
    });
  }

  async getEntityFacets(
    request: GetEntityFacetsRequest,
    options?: CatalogRequestOptions,
  ): Promise<GetEntityFacetsResponse> {
    return this.catalogApi.getEntityFacets(request, {
      ...options,
      token: this.token,
    });
  }

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

  async getLocationByEntity(
    entityRef: string | CompoundEntityRef,
    options?: CatalogRequestOptions,
  ): Promise<Location | undefined> {
    return this.catalogApi.getLocationByEntity(entityRef, {
      ...options,
      token: this.token,
    });
  }

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

  async getEntityByRef(ref: string): Promise<Entity | undefined> {
    return this.catalogApi.getEntityByRef(ref, { token: this.token });
  }

  async getEntities(
    request?: GetEntitiesRequest,
  ): Promise<GetEntitiesResponse> {
    return this.catalogApi.getEntities(request, { token: this.token });
  }

  async getEntitiesByRefs(
    request: GetEntitiesByRefsRequest,
    options?: CatalogRequestOptions,
  ) {
    return this.catalogApi.getEntitiesByRefs(request, {
      ...options,
      token: this.token,
    });
  }

  async queryEntities(request?: GetEntitiesRequest) {
    return this.catalogApi.queryEntities(request, { token: this.token });
  }

  async getEntityAncestors(
    request: GetEntityAncestorsRequest,
    options?: CatalogRequestOptions,
  ) {
    return this.catalogApi.getEntityAncestors(request, {
      ...options,
      token: this.token,
    });
  }

  async getLocationById(locationId: string) {
    return this.catalogApi.getLocationById(locationId, { token: this.token });
  }

  async getLocationByRef(locationRef: string) {
    return this.catalogApi.getLocationByRef(locationRef, { token: this.token });
  }

  getLocations: CatalogApi['getLocations'] = async (request, options) => {
    return this.catalogApi.getLocations(request, {
      ...options,
      token: this.token,
    });
  };
}
