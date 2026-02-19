// Auto-generated from OpenAPI specification - do not edit manually
// Use `createApiClient` to instantiate a fully-typed API client.

import type { AxiosInstance } from 'axios'
import {
  useEndpointQuery,
  useEndpointMutation,
  defaultQueryClient,
  HttpMethod,
  type QueryOptions,
  type MutationOptions,
  type QueryReturn,
  type MutationReturn,
  type ReactiveOr,
  type QueryClientLike,
  type MaybeRefOrGetter,
} from '@qualisero/openapi-endpoint'

import type {
  ApiResponse,
  ApiRequest,
  ApiPathParams,
  ApiPathParamsInput,
  ApiQueryParams,
  operations,
} from './api-operations.js'

import {
  createPet_enums,
  deletePet_enums,
  getConfigJson_enums,
  getDataV1Json_enums,
  getOwners_enums,
  getPet_enums,
  getPetPetId_enums,
  listPets_enums,
  listUserPets_enums,
  postOwners_enums,
  postPetAdopt_enums,
  postPetGiveTreats_enums,
  updatePet_enums,
  updatePetPetId_enums,
  uploadPetPic_enums,
} from './api-operations.js'

// ============================================================================
// Operations registry (for invalidateOperations support)
// ============================================================================

const _registry = {
  createPet: { path: '/pets' },
  deletePet: { path: '/pets/{petId}' },
  getConfigJson: { path: '/api/config.json' },
  getDataV1Json: { path: '/api/data.v1.json' },
  getOwners: { path: '/owners' },
  getPet: { path: '/pets/{petId}' },
  getPetPetId: { path: '/api/pet/{pet_id}' },
  listPets: { path: '/pets' },
  listUserPets: { path: '/users/{userId}/pets' },
  postOwners: { path: '/owners' },
  postPetAdopt: { path: '/api/pet/{pet_id}/adopt' },
  postPetGiveTreats: { path: '/api/pet/give_treats' },
  updatePet: { path: '/pets/{petId}' },
  updatePetPetId: { path: '/api/pet/{pet_id}' },
  uploadPetPic: { path: '/pets/{petId}/upload' },
} as const

// ============================================================================
// Internal config type
// ============================================================================

type _Config = {
  axios: AxiosInstance
  queryClient: QueryClientLike
  operationsRegistry: typeof _registry
}

// ============================================================================
// Type alias for path params cast (avoids repetition)
// ============================================================================

type _PathParamsCast = MaybeRefOrGetter<Record<string, string | number | undefined> | null | undefined>

// ============================================================================
// Type alias for all operations
// ============================================================================

type AllOps = keyof operations

// ============================================================================
// Shared generic factory helpers (4 patterns)
// ============================================================================

/**
 * Generic query helper for operations without path parameters.
 * @internal
 */
function _queryNoParams<Op extends AllOps>(
  base: _Config,
  cfg: { path: string; method: HttpMethod; listPath: string | null },
  enums: Record<string, unknown>,
) {
  type Response = ApiResponse<Op>
  type QueryParams = ApiQueryParams<Op>

  return {
    useQuery: (options?: QueryOptions<Response, QueryParams>): QueryReturn<Response, Record<string, never>> =>
      useEndpointQuery<Response, Record<string, never>, QueryParams>({ ...base, ...cfg }, undefined, options),
    enums,
  } as const
}

/**
 * Generic query helper for operations with path parameters.
 * @internal
 */
function _queryWithParams<Op extends AllOps>(
  base: _Config,
  cfg: { path: string; method: HttpMethod; listPath: string | null },
  enums: Record<string, unknown>,
) {
  type PathParams = ApiPathParams<Op>
  type PathParamsInput = ApiPathParamsInput<Op>
  type Response = ApiResponse<Op>
  type QueryParams = ApiQueryParams<Op>

  return {
    useQuery: (
      pathParams: ReactiveOr<PathParamsInput>,
      options?: QueryOptions<Response, QueryParams>,
    ): QueryReturn<Response, PathParams> =>
      useEndpointQuery<Response, PathParams, QueryParams>({ ...base, ...cfg }, pathParams as _PathParamsCast, options),
    enums,
  } as const
}

/**
 * Generic mutation helper for operations without path parameters.
 * @internal
 */
function _mutationNoParams<Op extends AllOps>(
  base: _Config,
  cfg: { path: string; method: HttpMethod; listPath: string | null },
  enums: Record<string, unknown>,
) {
  type RequestBody = ApiRequest<Op>
  type Response = ApiResponse<Op>
  type QueryParams = ApiQueryParams<Op>

  return {
    useMutation: (
      options?: MutationOptions<Response, Record<string, never>, RequestBody, QueryParams>,
    ): MutationReturn<Response, Record<string, never>, RequestBody, QueryParams> =>
      useEndpointMutation<Response, Record<string, never>, RequestBody, QueryParams>(
        { ...base, ...cfg },
        undefined,
        options,
      ),
    enums,
  } as const
}

/**
 * Generic mutation helper for operations with path parameters.
 * @internal
 */
function _mutationWithParams<Op extends AllOps>(
  base: _Config,
  cfg: { path: string; method: HttpMethod; listPath: string | null },
  enums: Record<string, unknown>,
) {
  type PathParams = ApiPathParams<Op>
  type PathParamsInput = ApiPathParamsInput<Op>
  type RequestBody = ApiRequest<Op>
  type Response = ApiResponse<Op>
  type QueryParams = ApiQueryParams<Op>

  return {
    useMutation: (
      pathParams: ReactiveOr<PathParamsInput>,
      options?: MutationOptions<Response, PathParams, RequestBody, QueryParams>,
    ): MutationReturn<Response, PathParams, RequestBody, QueryParams> =>
      useEndpointMutation<Response, PathParams, RequestBody, QueryParams>(
        { ...base, ...cfg },
        pathParams as _PathParamsCast,
        options,
      ),
    enums,
  } as const
}

// ============================================================================
// Public API client factory
// ============================================================================

/**
 * Create a fully-typed API client.
 *
 * Each operation in the spec is a property of the returned object:
 * - GET/HEAD/OPTIONS → `api.opName.useQuery(...)`
 * - POST/PUT/PATCH/DELETE → `api.opName.useMutation(...)`
 * - All operations → `api.opName.enums.fieldName.Value`
 *
 * @example
 * ```ts
 * import { createApiClient } from './generated/api-client'
 * import axios from 'axios'
 *
 * const api = createApiClient(axios.create({ baseURL: '/api' }))
 *
 * // In a Vue component:
 * const { data: pets } = api.listPets.useQuery()
 * const create = api.createPet.useMutation()
 * create.mutate({ data: { name: 'Fluffy' } })
 * ```
 */
export function createApiClient(axios: AxiosInstance, queryClient: QueryClientLike = defaultQueryClient) {
  const base: _Config = { axios, queryClient, operationsRegistry: _registry }
  return {
    createPet: _mutationNoParams<'createPet'>(
      base,
      { path: '/pets', method: HttpMethod.POST, listPath: '/pets' },
      createPet_enums,
    ),
    deletePet: _mutationWithParams<'deletePet'>(
      base,
      { path: '/pets/{petId}', method: HttpMethod.DELETE, listPath: '/pets' },
      deletePet_enums,
    ),
    getConfigJson: _queryNoParams<'getConfigJson'>(
      base,
      { path: '/api/config.json', method: HttpMethod.GET, listPath: null },
      getConfigJson_enums,
    ),
    getDataV1Json: _queryNoParams<'getDataV1Json'>(
      base,
      { path: '/api/data.v1.json', method: HttpMethod.GET, listPath: null },
      getDataV1Json_enums,
    ),
    getOwners: _queryNoParams<'getOwners'>(
      base,
      { path: '/owners', method: HttpMethod.GET, listPath: null },
      getOwners_enums,
    ),
    getPet: _queryWithParams<'getPet'>(
      base,
      { path: '/pets/{petId}', method: HttpMethod.GET, listPath: null },
      getPet_enums,
    ),
    getPetPetId: _queryWithParams<'getPetPetId'>(
      base,
      { path: '/api/pet/{pet_id}', method: HttpMethod.GET, listPath: null },
      getPetPetId_enums,
    ),
    listPets: _queryNoParams<'listPets'>(
      base,
      { path: '/pets', method: HttpMethod.GET, listPath: null },
      listPets_enums,
    ),
    listUserPets: _queryWithParams<'listUserPets'>(
      base,
      { path: '/users/{userId}/pets', method: HttpMethod.GET, listPath: null },
      listUserPets_enums,
    ),
    postOwners: _mutationNoParams<'postOwners'>(
      base,
      { path: '/owners', method: HttpMethod.POST, listPath: null },
      postOwners_enums,
    ),
    postPetAdopt: _mutationWithParams<'postPetAdopt'>(
      base,
      { path: '/api/pet/{pet_id}/adopt', method: HttpMethod.POST, listPath: null },
      postPetAdopt_enums,
    ),
    postPetGiveTreats: _mutationNoParams<'postPetGiveTreats'>(
      base,
      { path: '/api/pet/give_treats', method: HttpMethod.POST, listPath: null },
      postPetGiveTreats_enums,
    ),
    updatePet: _mutationWithParams<'updatePet'>(
      base,
      { path: '/pets/{petId}', method: HttpMethod.PUT, listPath: '/pets' },
      updatePet_enums,
    ),
    updatePetPetId: _mutationWithParams<'updatePetPetId'>(
      base,
      { path: '/api/pet/{pet_id}', method: HttpMethod.PATCH, listPath: '/api/pet/' },
      updatePetPetId_enums,
    ),
    uploadPetPic: _mutationWithParams<'uploadPetPic'>(
      base,
      { path: '/pets/{petId}/upload', method: HttpMethod.POST, listPath: null },
      uploadPetPic_enums,
    ),
  } as const
}

/** The fully-typed API client instance type. */
export type ApiClient = ReturnType<typeof createApiClient>
