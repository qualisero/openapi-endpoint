/* eslint-disable */
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
// Per-operation namespace factories
// ============================================================================

/**
 * createPet
 * 
 * POST /pets
 * 
 * @param pathParams - Path parameters (reactive)
 * @param options - Mutation options (onSuccess, onError, invalidateOperations, etc.)
 * @returns Mutation helper with mutate() and mutateAsync() methods
 */
function _createPet(base: _Config) {
  type RequestBody = ApiRequest<'createPet'>
  type Response = ApiResponse<'createPet'>
  type QueryParams = ApiQueryParams<'createPet'>
  
  return {
    useMutation: (
      options?: MutationOptions<Response, Record<string, never>, RequestBody, QueryParams>
    ): MutationReturn<Response, Record<string, never>, RequestBody, QueryParams> =>
      useEndpointMutation<Response, Record<string, never>, RequestBody, QueryParams>(
        { ...base, path: '/pets', method: HttpMethod.POST, listPath: '/pets' }, undefined, options
      ),
    enums: createPet_enums,
  } as const
}

/**
 * deletePet
 * 
 * DELETE /pets/{petId}
 * 
 * @param pathParams - Path parameters (reactive)
 * @param options - Mutation options (onSuccess, onError, invalidateOperations, etc.)
 * @returns Mutation helper with mutate() and mutateAsync() methods
 */
function _deletePet(base: _Config) {
  type PathParams = ApiPathParams<'deletePet'>
  type PathParamsInput = ApiPathParamsInput<'deletePet'>
  type RequestBody = ApiRequest<'deletePet'>
  type Response = ApiResponse<'deletePet'>
  type QueryParams = ApiQueryParams<'deletePet'>
  
  return {
    useMutation: (
      pathParams: ReactiveOr<PathParamsInput>,
      options?: MutationOptions<Response, PathParams, RequestBody, QueryParams>
    ): MutationReturn<Response, PathParams, RequestBody, QueryParams> => 
      useEndpointMutation<Response, PathParams, RequestBody, QueryParams>(
        { ...base, path: '/pets/{petId}', method: HttpMethod.DELETE, listPath: '/pets' }, pathParams as MaybeRefOrGetter<Record<string, string | number | undefined> | null | undefined>, options
      ),
    enums: deletePet_enums,
  } as const
}

/**
 * getConfigJson
 * 
 * GET /api/config.json
 * 
 * @param pathParams - Path parameters (reactive)
 * @param options - Query options (enabled, staleTime, onLoad, etc.)
 * @returns Query result with data, isLoading, refetch(), etc.
 */
function _getConfigJson(base: _Config) {
  type Response = ApiResponse<'getConfigJson'>
  type QueryParams = ApiQueryParams<'getConfigJson'>
  
  return {
    useQuery: (
      options?: QueryOptions<Response, QueryParams>
    ): QueryReturn<Response, Record<string, never>> =>
      useEndpointQuery<Response, Record<string, never>, QueryParams>(
        { ...base, path: '/api/config.json', method: HttpMethod.GET, listPath: null }, undefined, options
      ),
    enums: getConfigJson_enums,
  } as const
}

/**
 * getDataV1Json
 * 
 * GET /api/data.v1.json
 * 
 * @param pathParams - Path parameters (reactive)
 * @param options - Query options (enabled, staleTime, onLoad, etc.)
 * @returns Query result with data, isLoading, refetch(), etc.
 */
function _getDataV1Json(base: _Config) {
  type Response = ApiResponse<'getDataV1Json'>
  type QueryParams = ApiQueryParams<'getDataV1Json'>
  
  return {
    useQuery: (
      options?: QueryOptions<Response, QueryParams>
    ): QueryReturn<Response, Record<string, never>> =>
      useEndpointQuery<Response, Record<string, never>, QueryParams>(
        { ...base, path: '/api/data.v1.json', method: HttpMethod.GET, listPath: null }, undefined, options
      ),
    enums: getDataV1Json_enums,
  } as const
}

/**
 * getOwners
 * 
 * GET /owners
 * 
 * @param pathParams - Path parameters (reactive)
 * @param options - Query options (enabled, staleTime, onLoad, etc.)
 * @returns Query result with data, isLoading, refetch(), etc.
 */
function _getOwners(base: _Config) {
  type Response = ApiResponse<'getOwners'>
  type QueryParams = ApiQueryParams<'getOwners'>
  
  return {
    useQuery: (
      options?: QueryOptions<Response, QueryParams>
    ): QueryReturn<Response, Record<string, never>> =>
      useEndpointQuery<Response, Record<string, never>, QueryParams>(
        { ...base, path: '/owners', method: HttpMethod.GET, listPath: null }, undefined, options
      ),
    enums: getOwners_enums,
  } as const
}

/**
 * getPet
 * 
 * GET /pets/{petId}
 * 
 * @param pathParams - Path parameters (reactive)
 * @param options - Query options (enabled, staleTime, onLoad, etc.)
 * @returns Query result with data, isLoading, refetch(), etc.
 */
function _getPet(base: _Config) {
  type PathParams = ApiPathParams<'getPet'>
  type PathParamsInput = ApiPathParamsInput<'getPet'>
  type Response = ApiResponse<'getPet'>
  type QueryParams = ApiQueryParams<'getPet'>
  
  return {
    useQuery: (
      pathParams: ReactiveOr<PathParamsInput>,
      options?: QueryOptions<Response, QueryParams>
    ): QueryReturn<Response, PathParams> => 
      useEndpointQuery<Response, PathParams, QueryParams>(
        { ...base, path: '/pets/{petId}', method: HttpMethod.GET, listPath: null }, pathParams as MaybeRefOrGetter<Record<string, string | number | undefined> | null | undefined>, options
      ),
    enums: getPet_enums,
  } as const
}

/**
 * getPetPetId
 * 
 * GET /api/pet/{pet_id}
 * 
 * @param pathParams - Path parameters (reactive)
 * @param options - Query options (enabled, staleTime, onLoad, etc.)
 * @returns Query result with data, isLoading, refetch(), etc.
 */
function _getPetPetId(base: _Config) {
  type PathParams = ApiPathParams<'getPetPetId'>
  type PathParamsInput = ApiPathParamsInput<'getPetPetId'>
  type Response = ApiResponse<'getPetPetId'>
  type QueryParams = ApiQueryParams<'getPetPetId'>
  
  return {
    useQuery: (
      pathParams: ReactiveOr<PathParamsInput>,
      options?: QueryOptions<Response, QueryParams>
    ): QueryReturn<Response, PathParams> => 
      useEndpointQuery<Response, PathParams, QueryParams>(
        { ...base, path: '/api/pet/{pet_id}', method: HttpMethod.GET, listPath: null }, pathParams as MaybeRefOrGetter<Record<string, string | number | undefined> | null | undefined>, options
      ),
    enums: getPetPetId_enums,
  } as const
}

/**
 * listPets
 * 
 * GET /pets
 * 
 * @param pathParams - Path parameters (reactive)
 * @param options - Query options (enabled, staleTime, onLoad, etc.)
 * @returns Query result with data, isLoading, refetch(), etc.
 */
function _listPets(base: _Config) {
  type Response = ApiResponse<'listPets'>
  type QueryParams = ApiQueryParams<'listPets'>
  
  return {
    useQuery: (
      options?: QueryOptions<Response, QueryParams>
    ): QueryReturn<Response, Record<string, never>> =>
      useEndpointQuery<Response, Record<string, never>, QueryParams>(
        { ...base, path: '/pets', method: HttpMethod.GET, listPath: null }, undefined, options
      ),
    enums: listPets_enums,
  } as const
}

/**
 * listUserPets
 * 
 * GET /users/{userId}/pets
 * 
 * @param pathParams - Path parameters (reactive)
 * @param options - Query options (enabled, staleTime, onLoad, etc.)
 * @returns Query result with data, isLoading, refetch(), etc.
 */
function _listUserPets(base: _Config) {
  type PathParams = ApiPathParams<'listUserPets'>
  type PathParamsInput = ApiPathParamsInput<'listUserPets'>
  type Response = ApiResponse<'listUserPets'>
  type QueryParams = ApiQueryParams<'listUserPets'>
  
  return {
    useQuery: (
      pathParams: ReactiveOr<PathParamsInput>,
      options?: QueryOptions<Response, QueryParams>
    ): QueryReturn<Response, PathParams> => 
      useEndpointQuery<Response, PathParams, QueryParams>(
        { ...base, path: '/users/{userId}/pets', method: HttpMethod.GET, listPath: null }, pathParams as MaybeRefOrGetter<Record<string, string | number | undefined> | null | undefined>, options
      ),
    enums: listUserPets_enums,
  } as const
}

/**
 * postOwners
 * 
 * POST /owners
 * 
 * @param pathParams - Path parameters (reactive)
 * @param options - Mutation options (onSuccess, onError, invalidateOperations, etc.)
 * @returns Mutation helper with mutate() and mutateAsync() methods
 */
function _postOwners(base: _Config) {
  type RequestBody = ApiRequest<'postOwners'>
  type Response = ApiResponse<'postOwners'>
  type QueryParams = ApiQueryParams<'postOwners'>
  
  return {
    useMutation: (
      options?: MutationOptions<Response, Record<string, never>, RequestBody, QueryParams>
    ): MutationReturn<Response, Record<string, never>, RequestBody, QueryParams> =>
      useEndpointMutation<Response, Record<string, never>, RequestBody, QueryParams>(
        { ...base, path: '/owners', method: HttpMethod.POST, listPath: null }, undefined, options
      ),
    enums: postOwners_enums,
  } as const
}

/**
 * postPetAdopt
 * 
 * POST /api/pet/{pet_id}/adopt
 * 
 * @param pathParams - Path parameters (reactive)
 * @param options - Mutation options (onSuccess, onError, invalidateOperations, etc.)
 * @returns Mutation helper with mutate() and mutateAsync() methods
 */
function _postPetAdopt(base: _Config) {
  type PathParams = ApiPathParams<'postPetAdopt'>
  type PathParamsInput = ApiPathParamsInput<'postPetAdopt'>
  type RequestBody = ApiRequest<'postPetAdopt'>
  type Response = ApiResponse<'postPetAdopt'>
  type QueryParams = ApiQueryParams<'postPetAdopt'>
  
  return {
    useMutation: (
      pathParams: ReactiveOr<PathParamsInput>,
      options?: MutationOptions<Response, PathParams, RequestBody, QueryParams>
    ): MutationReturn<Response, PathParams, RequestBody, QueryParams> => 
      useEndpointMutation<Response, PathParams, RequestBody, QueryParams>(
        { ...base, path: '/api/pet/{pet_id}/adopt', method: HttpMethod.POST, listPath: null }, pathParams as MaybeRefOrGetter<Record<string, string | number | undefined> | null | undefined>, options
      ),
    enums: postPetAdopt_enums,
  } as const
}

/**
 * postPetGiveTreats
 * 
 * POST /api/pet/give_treats
 * 
 * @param pathParams - Path parameters (reactive)
 * @param options - Mutation options (onSuccess, onError, invalidateOperations, etc.)
 * @returns Mutation helper with mutate() and mutateAsync() methods
 */
function _postPetGiveTreats(base: _Config) {
  type RequestBody = ApiRequest<'postPetGiveTreats'>
  type Response = ApiResponse<'postPetGiveTreats'>
  type QueryParams = ApiQueryParams<'postPetGiveTreats'>
  
  return {
    useMutation: (
      options?: MutationOptions<Response, Record<string, never>, RequestBody, QueryParams>
    ): MutationReturn<Response, Record<string, never>, RequestBody, QueryParams> =>
      useEndpointMutation<Response, Record<string, never>, RequestBody, QueryParams>(
        { ...base, path: '/api/pet/give_treats', method: HttpMethod.POST, listPath: null }, undefined, options
      ),
    enums: postPetGiveTreats_enums,
  } as const
}

/**
 * updatePet
 * 
 * PUT /pets/{petId}
 * 
 * @param pathParams - Path parameters (reactive)
 * @param options - Mutation options (onSuccess, onError, invalidateOperations, etc.)
 * @returns Mutation helper with mutate() and mutateAsync() methods
 */
function _updatePet(base: _Config) {
  type PathParams = ApiPathParams<'updatePet'>
  type PathParamsInput = ApiPathParamsInput<'updatePet'>
  type RequestBody = ApiRequest<'updatePet'>
  type Response = ApiResponse<'updatePet'>
  type QueryParams = ApiQueryParams<'updatePet'>
  
  return {
    useMutation: (
      pathParams: ReactiveOr<PathParamsInput>,
      options?: MutationOptions<Response, PathParams, RequestBody, QueryParams>
    ): MutationReturn<Response, PathParams, RequestBody, QueryParams> => 
      useEndpointMutation<Response, PathParams, RequestBody, QueryParams>(
        { ...base, path: '/pets/{petId}', method: HttpMethod.PUT, listPath: '/pets' }, pathParams as MaybeRefOrGetter<Record<string, string | number | undefined> | null | undefined>, options
      ),
    enums: updatePet_enums,
  } as const
}

/**
 * updatePetPetId
 * 
 * PATCH /api/pet/{pet_id}
 * 
 * @param pathParams - Path parameters (reactive)
 * @param options - Mutation options (onSuccess, onError, invalidateOperations, etc.)
 * @returns Mutation helper with mutate() and mutateAsync() methods
 */
function _updatePetPetId(base: _Config) {
  type PathParams = ApiPathParams<'updatePetPetId'>
  type PathParamsInput = ApiPathParamsInput<'updatePetPetId'>
  type RequestBody = ApiRequest<'updatePetPetId'>
  type Response = ApiResponse<'updatePetPetId'>
  type QueryParams = ApiQueryParams<'updatePetPetId'>
  
  return {
    useMutation: (
      pathParams: ReactiveOr<PathParamsInput>,
      options?: MutationOptions<Response, PathParams, RequestBody, QueryParams>
    ): MutationReturn<Response, PathParams, RequestBody, QueryParams> => 
      useEndpointMutation<Response, PathParams, RequestBody, QueryParams>(
        { ...base, path: '/api/pet/{pet_id}', method: HttpMethod.PATCH, listPath: '/api/pet/' }, pathParams as MaybeRefOrGetter<Record<string, string | number | undefined> | null | undefined>, options
      ),
    enums: updatePetPetId_enums,
  } as const
}

/**
 * uploadPetPic
 * 
 * POST /pets/{petId}/upload
 * 
 * @param pathParams - Path parameters (reactive)
 * @param options - Mutation options (onSuccess, onError, invalidateOperations, etc.)
 * @returns Mutation helper with mutate() and mutateAsync() methods
 */
function _uploadPetPic(base: _Config) {
  type PathParams = ApiPathParams<'uploadPetPic'>
  type PathParamsInput = ApiPathParamsInput<'uploadPetPic'>
  type RequestBody = ApiRequest<'uploadPetPic'>
  type Response = ApiResponse<'uploadPetPic'>
  type QueryParams = ApiQueryParams<'uploadPetPic'>
  
  return {
    useMutation: (
      pathParams: ReactiveOr<PathParamsInput>,
      options?: MutationOptions<Response, PathParams, RequestBody, QueryParams>
    ): MutationReturn<Response, PathParams, RequestBody, QueryParams> => 
      useEndpointMutation<Response, PathParams, RequestBody, QueryParams>(
        { ...base, path: '/pets/{petId}/upload', method: HttpMethod.POST, listPath: null }, pathParams as MaybeRefOrGetter<Record<string, string | number | undefined> | null | undefined>, options
      ),
    enums: uploadPetPic_enums,
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
    createPet: _createPet(base),
    deletePet: _deletePet(base),
    getConfigJson: _getConfigJson(base),
    getDataV1Json: _getDataV1Json(base),
    getOwners: _getOwners(base),
    getPet: _getPet(base),
    getPetPetId: _getPetPetId(base),
    listPets: _listPets(base),
    listUserPets: _listUserPets(base),
    postOwners: _postOwners(base),
    postPetAdopt: _postPetAdopt(base),
    postPetGiveTreats: _postPetGiveTreats(base),
    updatePet: _updatePet(base),
    updatePetPetId: _updatePetPetId(base),
    uploadPetPic: _uploadPetPic(base),
  } as const
}

/** The fully-typed API client instance type. */
export type ApiClient = ReturnType<typeof createApiClient>
