// Auto-generated from OpenAPI specification - do not edit manually
// Use `createApiClient` to instantiate a fully-typed API client.

import type { AxiosInstance } from 'axios'
import type { Ref, ComputedRef } from 'vue'
import {
  useEndpointQuery,
  useEndpointMutation,
  useEndpointLazyQuery,
  defaultQueryClient,
  HttpMethod,
  type QueryOptions,
  type MutationOptions,
  type QueryReturn,
  type MutationReturn,
  type LazyQueryReturn,
  type ReactiveOr,
  type NoExcessReturn,
  type MaybeRefOrGetter,
} from '@qualisero/openapi-endpoint'

import type { QueryClient } from '@tanstack/vue-query'

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
  searchPets_enums,
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
  searchPets: { path: '/pets/search' },
  updatePet: { path: '/pets/{petId}' },
  updatePetPetId: { path: '/api/pet/{pet_id}' },
  uploadPetPic: { path: '/pets/{petId}/upload' },
} as const

// ============================================================================
// Internal config type
// ============================================================================

type _Config = {
  axios: AxiosInstance
  queryClient: QueryClient
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

  const useQuery = (options?: QueryOptions<Response, QueryParams>): QueryReturn<Response, Record<string, never>> =>
    useEndpointQuery<Response, Record<string, never>, QueryParams>({ ...base, ...cfg }, undefined, options)

  const useLazyQuery = (
    options?: Omit<QueryOptions<Response, QueryParams>, 'queryParams' | 'onLoad' | 'enabled'>,
  ): LazyQueryReturn<Response, Record<string, never>, QueryParams> =>
    useEndpointLazyQuery<Response, Record<string, never>, QueryParams>({ ...base, ...cfg }, undefined, options)

  return {
    /**
     * Query hook for this operation.
     *
     * Returns an object with:
     * - `data`: The response data
     * - `isLoading`: Whether the query is loading
     * - `error`: Error object if the query failed
     * - `refetch`: Function to manually trigger a refetch
     * - `isPending`: Alias for isLoading
     * - `status`: 'pending' | 'error' | 'success'
     *
     * @param options - Query options (enabled, refetchInterval, etc.)
     * @returns Query result object
     */
    useQuery,
    /**
     * Lazy query hook for this operation.
     *
     * Returns an object with:
     * - `data`: The response data
     * - `isPending`: True while a fetch is in progress
     * - `isSuccess`: True after at least one successful fetch
     * - `isError`: True after a failed fetch
     * - `error`: The error from the last failed fetch
     * - `fetch`: Execute the query imperatively
     *
     * @param options - Lazy query options (staleTime, errorHandler, axiosOptions)
     * @returns Lazy query result object
     */
    useLazyQuery,
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

  // Two-overload interface: non-function (exact via object-literal checking) +
  // getter function (exact via NoExcessReturn constraint).
  type _UseQuery = {
    (
      pathParams: PathParamsInput | Ref<PathParamsInput> | ComputedRef<PathParamsInput>,
      options?: QueryOptions<Response, QueryParams>,
    ): QueryReturn<Response, PathParams>
    <F extends () => PathParamsInput>(
      pathParams: NoExcessReturn<PathParamsInput, F>,
      options?: QueryOptions<Response, QueryParams>,
    ): QueryReturn<Response, PathParams>
  }

  type _UseLazyQuery = {
    (
      pathParams: PathParamsInput | Ref<PathParamsInput> | ComputedRef<PathParamsInput>,
      options?: Omit<QueryOptions<Response, QueryParams>, 'queryParams' | 'onLoad' | 'enabled'>,
    ): LazyQueryReturn<Response, PathParams, QueryParams>
    <F extends () => PathParamsInput>(
      pathParams: NoExcessReturn<PathParamsInput, F>,
      options?: Omit<QueryOptions<Response, QueryParams>, 'queryParams' | 'onLoad' | 'enabled'>,
    ): LazyQueryReturn<Response, PathParams, QueryParams>
  }

  const _impl = (
    pathParams: ReactiveOr<PathParamsInput>,
    options?: QueryOptions<Response, QueryParams>,
  ): QueryReturn<Response, PathParams> =>
    useEndpointQuery<Response, PathParams, QueryParams>({ ...base, ...cfg }, pathParams as _PathParamsCast, options)

  const _lazyImpl = (
    pathParams: ReactiveOr<PathParamsInput>,
    options?: Omit<QueryOptions<Response, QueryParams>, 'queryParams' | 'onLoad' | 'enabled'>,
  ): LazyQueryReturn<Response, PathParams, QueryParams> =>
    useEndpointLazyQuery<Response, PathParams, QueryParams>({ ...base, ...cfg }, pathParams as _PathParamsCast, options)

  return {
    /**
     * Query hook for this operation.
     *
     * Returns an object with:
     * - `data`: The response data
     * - `isLoading`: Whether the query is loading
     * - `error`: Error object if the query failed
     * - `refetch`: Function to manually trigger a refetch
     * - `isPending`: Alias for isLoading
     * - `status`: 'pending' | 'error' | 'success'
     *
     * @param pathParams - Path parameters (object, ref, computed, or getter function)
     * @param options - Query options (enabled, refetchInterval, etc.)
     * @returns Query result object
     */
    useQuery: _impl as _UseQuery,
    /**
     * Lazy query hook for this operation.
     *
     * Returns an object with:
     * - `data`: The response data
     * - `isPending`: True while a fetch is in progress
     * - `isSuccess`: True after at least one successful fetch
     * - `isError`: True after a failed fetch
     * - `error`: The error from the last failed fetch
     * - `fetch`: Execute the query imperatively
     *
     * @param pathParams - Path parameters (object, ref, computed, or getter function)
     * @param options - Lazy query options (staleTime, errorHandler, axiosOptions)
     * @returns Lazy query result object
     */
    useLazyQuery: _lazyImpl as _UseLazyQuery,
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

  const useMutation = (
    options?: MutationOptions<Response, Record<string, never>, RequestBody, QueryParams>,
  ): MutationReturn<Response, Record<string, never>, RequestBody, QueryParams> =>
    useEndpointMutation<Response, Record<string, never>, RequestBody, QueryParams>(
      { ...base, ...cfg },
      undefined,
      options,
    )

  return {
    /**
     * Mutation hook for this operation.
     *
     * Returns an object with:
     * - `mutate`: Synchronous mutation function (returns void)
     * - `mutateAsync`: Async mutation function (returns Promise)
     * - `data`: The response data
     * - `isLoading`: Whether the mutation is in progress
     * - `error`: Error object if the mutation failed
     * - `isPending`: Alias for isLoading
     * - `status`: 'idle' | 'pending' | 'error' | 'success'
     *
     * @param options - Mutation options (onSuccess, onError, etc.)
     * @returns Mutation result object
     */
    useMutation,
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

  // Three-overload interface:
  // 1. Deferred path params — omit or pass undefined/null; supply at mutateAsync() time via pathParams variable
  // 2. Eager path params — object, Ref, or ComputedRef (exact via object-literal checking)
  // 3. Getter function — exact via NoExcessReturn constraint
  type _UseMutation = {
    (
      pathParams?: undefined | null,
      options?: MutationOptions<Response, PathParams, RequestBody, QueryParams>,
    ): MutationReturn<Response, PathParams, RequestBody, QueryParams>
    (
      pathParams: PathParamsInput | Ref<PathParamsInput> | ComputedRef<PathParamsInput>,
      options?: MutationOptions<Response, PathParams, RequestBody, QueryParams>,
    ): MutationReturn<Response, PathParams, RequestBody, QueryParams>
    <F extends () => PathParamsInput>(
      pathParams: NoExcessReturn<PathParamsInput, F>,
      options?: MutationOptions<Response, PathParams, RequestBody, QueryParams>,
    ): MutationReturn<Response, PathParams, RequestBody, QueryParams>
  }

  const _impl = (
    pathParams: ReactiveOr<PathParamsInput> | undefined | null,
    options?: MutationOptions<Response, PathParams, RequestBody, QueryParams>,
  ): MutationReturn<Response, PathParams, RequestBody, QueryParams> =>
    useEndpointMutation<Response, PathParams, RequestBody, QueryParams>(
      { ...base, ...cfg },
      pathParams as _PathParamsCast,
      options,
    )

  return {
    /**
     * Mutation hook for this operation.
     *
     * Returns an object with:
     * - `mutate`: Synchronous mutation function (returns void)
     * - `mutateAsync`: Async mutation function (returns Promise)
     * - `data`: The response data
     * - `isLoading`: Whether the mutation is in progress
     * - `error`: Error object if the mutation failed
     * - `isPending`: Alias for isLoading
     * - `status`: 'idle' | 'pending' | 'error' | 'success'
     *
     * @param pathParams - Path parameters (object, ref, computed, getter function, or undefined/null for deferred supply at call time)
     * @param options - Mutation options (onSuccess, onError, etc.)
     * @returns Mutation result object
     */
    useMutation: _impl as _UseMutation,
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
export function createApiClient(axios: AxiosInstance, queryClient: QueryClient = defaultQueryClient) {
  const base: _Config = { axios, queryClient, operationsRegistry: _registry }
  return {
    /**
     * Create a new pet
     * @param body - Request body type: NewPet
     * @returns Response type: Pet
     */
    createPet: _mutationNoParams<'createPet'>(
      base,
      { path: '/pets', method: HttpMethod.POST, listPath: '/pets' },
      createPet_enums,
    ),
    /**
     * Delete a pet
     * @param pathParams - { petId: string }
     */
    deletePet: _mutationWithParams<'deletePet'>(
      base,
      { path: '/pets/{petId}', method: HttpMethod.DELETE, listPath: '/pets' },
      deletePet_enums,
    ),
    /**
     * Get config file (tests file extension handling)
     */
    getConfigJson: _queryNoParams<'getConfigJson'>(
      base,
      { path: '/api/config.json', method: HttpMethod.GET, listPath: null },
      getConfigJson_enums,
    ),
    /**
     * Get data file with periods (tests period handling)
     */
    getDataV1Json: _queryNoParams<'getDataV1Json'>(
      base,
      { path: '/api/data.v1.json', method: HttpMethod.GET, listPath: null },
      getDataV1Json_enums,
    ),
    /**
     * List all owners (no operationId)
     */
    getOwners: _queryNoParams<'getOwners'>(
      base,
      { path: '/owners', method: HttpMethod.GET, listPath: null },
      getOwners_enums,
    ),
    /**
     * Get a pet by ID
     * @param pathParams - { petId: string }
     * @returns Response type: Pet
     */
    getPet: _queryWithParams<'getPet'>(
      base,
      { path: '/pets/{petId}', method: HttpMethod.GET, listPath: null },
      getPet_enums,
    ),
    /**
     * Get a pet by ID (no operationId)
     * @param pathParams - { pet_id: string }
     * @returns Response type: Pet
     */
    getPetPetId: _queryWithParams<'getPetPetId'>(
      base,
      { path: '/api/pet/{pet_id}', method: HttpMethod.GET, listPath: null },
      getPetPetId_enums,
    ),
    /**
     * List all pets
     */
    listPets: _queryNoParams<'listPets'>(
      base,
      { path: '/pets', method: HttpMethod.GET, listPath: null },
      listPets_enums,
    ),
    /**
     * List pets for a specific user
     * @param pathParams - { userId: string }
     */
    listUserPets: _queryWithParams<'listUserPets'>(
      base,
      { path: '/users/{userId}/pets', method: HttpMethod.GET, listPath: null },
      listUserPets_enums,
    ),
    /**
     * Create a new owner (no operationId)
     */
    postOwners: _mutationNoParams<'postOwners'>(
      base,
      { path: '/owners', method: HttpMethod.POST, listPath: null },
      postOwners_enums,
    ),
    /**
     * Adopt a pet (no operationId)
     * @param pathParams - { pet_id: string }
     * @returns Response type: Pet
     */
    postPetAdopt: _mutationWithParams<'postPetAdopt'>(
      base,
      { path: '/api/pet/{pet_id}/adopt', method: HttpMethod.POST, listPath: null },
      postPetAdopt_enums,
    ),
    /**
     * Give treats to pets (no operationId, tests snake_case conversion)
     */
    postPetGiveTreats: _mutationNoParams<'postPetGiveTreats'>(
      base,
      { path: '/api/pet/give_treats', method: HttpMethod.POST, listPath: null },
      postPetGiveTreats_enums,
    ),
    /**
     * Search pets with required query params
     */
    searchPets: _queryNoParams<'searchPets'>(
      base,
      { path: '/pets/search', method: HttpMethod.GET, listPath: null },
      searchPets_enums,
    ),
    /**
     * Update a pet
     * @param pathParams - { petId: string }
     * @param body - Request body type: NewPet
     * @returns Response type: Pet
     */
    updatePet: _mutationWithParams<'updatePet'>(
      base,
      { path: '/pets/{petId}', method: HttpMethod.PUT, listPath: '/pets' },
      updatePet_enums,
    ),
    /**
     * Partially update a pet (no operationId)
     * @param pathParams - { pet_id: string }
     * @param body - Request body type: NewPet
     * @returns Response type: Pet
     */
    updatePetPetId: _mutationWithParams<'updatePetPetId'>(
      base,
      { path: '/api/pet/{pet_id}', method: HttpMethod.PATCH, listPath: '/api/pet/' },
      updatePetPetId_enums,
    ),
    /**
     * Upload a picture for a pet
     * @param pathParams - { petId: string }
     * @returns Response type: Pet
     */
    uploadPetPic: _mutationWithParams<'uploadPetPic'>(
      base,
      { path: '/pets/{petId}/upload', method: HttpMethod.POST, listPath: null },
      uploadPetPic_enums,
    ),
  } as const
}

/** The fully-typed API client instance type. */
export type ApiClient = ReturnType<typeof createApiClient>
