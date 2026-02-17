import { type AxiosInstance, type AxiosError, type AxiosRequestConfig, type AxiosResponse } from 'axios'
import { UseMutationOptions, type UseQueryOptions } from '@tanstack/vue-query'
import type { MaybeRef, MaybeRefOrGetter } from 'vue'
import type { EndpointQueryReturn } from './openapi-query'
import type { EndpointMutationReturn } from './openapi-mutation'

/**
 * Extended Axios request configuration that allows custom properties.
 *
 * This type extends the standard AxiosRequestConfig to support custom properties
 * that users might add through module augmentation. It ensures compatibility with
 * both standard axios options and user-defined custom properties.
 */
export type AxiosRequestConfigExtended = AxiosRequestConfig & Record<string, unknown>

/** @internal */
export type { EndpointQueryReturn, EndpointMutationReturn }

/**
 * Interface defining the minimal QueryClient methods required by this library.
 *
 * This interface ensures compatibility with different versions of @tanstack/vue-query
 * by only requiring the specific methods that are actually used internally.
 * This prevents version compatibility issues where internal implementation details
 * (like private properties) might differ between versions.
 *
 * @group Types
 */
export interface QueryClientLike {
  /**
   * Cancel running queries that match the provided filters.
   * Used to prevent race conditions when mutations affect data.
   */
  cancelQueries(filters: { queryKey: unknown[]; exact?: boolean }): Promise<void>

  /**
   * Set query data for a specific query key.
   * Used for optimistic updates after successful mutations.
   */
  setQueryData(queryKey: unknown[], data: unknown): void

  /**
   * Invalidate queries that match the provided filters.
   * Used to trigger refetches of related data after mutations.
   *
   * @param filters - Filters can include queryKey, exact, and/or a predicate function
   */
  invalidateQueries(filters: {
    queryKey?: unknown[]
    exact?: boolean
    predicate?: (query: { queryKey: readonly unknown[] }) => boolean
  }): Promise<void>
}

/** @internal */
export type Operations<Ops> = object & { [K in keyof Ops]: OperationInfo }

/**
 * Configuration object for initializing the OpenAPI client.
 *
 * This interface defines the required configuration to set up a type-safe OpenAPI client
 * with Vue Query integration. It requires both the operations metadata (typically generated
 * from your OpenAPI specification) and an Axios instance for making HTTP requests.
 *
 * @template Ops - The operations type, typically generated from your OpenAPI specification
 * @template AxiosConfig - The axios request configuration type (defaults to AxiosRequestConfig)
 *
 * @example
 * ```typescript
 * import { OpenApiConfig } from '@qualisero/openapi-endpoint'
 * import { openApiOperations, type OpenApiOperations } from './generated/api-operations'
 * import axios from 'axios'
 *
 * // Basic usage with default axios config
 * const config: OpenApiConfig<OpenApiOperations> = {
 *   operations: openApiOperations,
 *   axios: axios.create({
 *     baseURL: 'https://api.example.com',
 *     headers: { 'Authorization': 'Bearer token' }
 *   }),
 *   queryClient: customQueryClient // optional
 * }
 *
 * // With custom axios config type (for module augmentation)
 * const configWithCustomAxios: OpenApiConfig<OpenApiOperations, MyCustomAxiosRequestConfig> = {
 *   operations: openApiOperations,
 *   axios: customAxiosInstance
 * }
 * ```
 */
export interface OpenApiConfig<Ops extends Operations<Ops>> {
  /**
   * The operations metadata object, typically generated from your OpenAPI specification.
   * This contains type information and HTTP method details for each API endpoint.
   */
  operations: Ops

  /**
   * Axios instance for making HTTP requests.
   * Configure this with your base URL, authentication, and any global request/response interceptors.
   */
  axios: AxiosInstance

  /**
   * Optional TanStack Query client instance.
   * If not provided, a default QueryClient with sensible defaults will be used.
   *
   * Note: This accepts any QueryClient-like object that implements the required methods,
   * ensuring compatibility across different versions of @tanstack/vue-query.
   */
  queryClient?: QueryClientLike
}

/** @internal */
export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
  HEAD = 'HEAD',
  OPTIONS = 'OPTIONS',
  TRACE = 'TRACE',
}

/**
 * HTTP methods that are considered read-only query operations.
 * These can be used with useQuery() and support caching.
 */
export const QUERY_METHODS = [HttpMethod.GET, HttpMethod.HEAD, HttpMethod.OPTIONS] as const

/**
 * HTTP methods that modify data and should use mutations.
 */
export const MUTATION_METHODS = [HttpMethod.POST, HttpMethod.PUT, HttpMethod.PATCH, HttpMethod.DELETE] as const

/** @internal */
export function isQueryMethod(method: HttpMethod): boolean {
  return (QUERY_METHODS as readonly HttpMethod[]).includes(method)
}

/** @internal */
export function isMutationMethod(method: HttpMethod): boolean {
  return (MUTATION_METHODS as readonly HttpMethod[]).includes(method)
}

/** @internal */
export interface OperationInfo {
  path: string
  method: HttpMethod
}

/** @internal */
export type GetOperation<Ops extends Operations<Ops>, Op extends keyof Ops> = Ops[Op]

// Utility: Make ALL properties required (for ApiResponse)
type RequireAll<T> = {
  [K in keyof T]-?: T[K]
}

// Utility: Make readonly properties required, keep others as-is (for ApiResponseSafe)
type RequireReadonly<T> = {
  [K in keyof T as IsReadonly<T, K> extends true ? K : never]-?: T[K]
} & {
  [K in keyof T as IsReadonly<T, K> extends false ? K : never]: T[K]
}

/**
 * Extract response data type from an operation.
 *
 * All fields are REQUIRED regardless of their `required` status in the OpenAPI schema.
 * This assumes the server always returns complete objects for GET/list endpoints.
 *
 * @example
 * ```typescript
 * type PetResponse = ApiResponse<OpenApiOperations, OpType.getPet>
 * // { readonly id: string, name: string, tag: string, status: 'available' | ... }
 * // All fields required - no null checks needed
 * ```
 */
export type ApiResponse<Ops extends Operations<Ops>, Op extends keyof Ops> =
  GetOperation<Ops, Op> extends {
    responses: { 200: { content: { 'application/json': infer Data } } }
  }
    ? RequireAll<Data>
    : unknown

/**
 * Extract response data type with safe typing for unreliable backends.
 *
 * Only readonly properties are REQUIRED. Other properties preserve their
 * optional status from the OpenAPI schema. Use this when the backend may
 * omit optional fields in responses.
 *
 * @example
 * ```typescript
 * type PetResponse = ApiResponseSafe<OpenApiOperations, OpType.getPet>
 * // { readonly id: string, name: string, tag?: string, status?: 'available' | ... }
 * // tag and status optional - null checks required
 * ```
 */
export type ApiResponseSafe<Ops extends Operations<Ops>, Op extends keyof Ops> =
  GetOperation<Ops, Op> extends {
    responses: { 200: { content: { 'application/json': infer Data } } }
  }
    ? RequireReadonly<Data>
    : unknown

type OmitMaybeRef<T, K extends PropertyKey> =
  T extends MaybeRef<infer U>
    ? MaybeRef<Omit<U, K> & Partial<Pick<U, K & keyof U>>>
    : Omit<T, K> & Partial<Pick<T, K & keyof T>>

/**
 * Query options for `useQuery` that extend TanStack Query options.
 *
 * Combines TanStack Query's UseQueryOptions with custom options for reactive
 * query parameters, custom error handling, and axios configuration.
 *
 * @template Ops - The operations type from your OpenAPI specification
 * @template Op - The operation key from your operations type
 *
 * @example
 * ```typescript
 * const { data } = api.useQuery(OperationId.listPets, {
 *   enabled: computed(() => isLoggedIn.value),
 *   staleTime: 5000,
 *   queryParams: { limit: 10, status: PetStatus.Available },
 *   onLoad: (data) => console.log('Loaded:', data)
 * })
 * ```
 */
export type QQueryOptions<Ops extends Operations<Ops>, Op extends keyof Ops> = OmitMaybeRef<
  UseQueryOptions<ApiResponse<Ops, Op>, Error, ApiResponse<Ops, Op>, ApiResponse<Ops, Op>>,
  'queryKey' | 'queryFn' | 'enabled'
> & {
  /** Whether the query should execute. Can be reactive. */
  enabled?: MaybeRefOrGetter<boolean>
  /** Callback when data is successfully loaded. */
  onLoad?: (data: ApiResponse<Ops, Op>) => void
  /** Additional axios configuration for this request. */
  axiosOptions?: AxiosRequestConfigExtended
  /** Custom error handler. Return data to use as fallback, or void to use default error. */
  errorHandler?: (error: AxiosError) => ApiResponse<Ops, Op> | void | Promise<ApiResponse<Ops, Op> | void>
  /** Query parameters for the request. Can be reactive. */
  queryParams?: MaybeRefOrGetter<ApiQueryParams<Ops, Op>>
}

/** @internal */
type MutationOnSuccessOptions<Ops extends Operations<Ops>> = {
  dontInvalidate?: boolean
  dontUpdateCache?: boolean
  invalidateOperations?: (keyof Ops)[] | Partial<{ [K in keyof Ops]: ApiPathParams<Ops, K> }>
  refetchEndpoints?: EndpointQueryReturn<Ops, keyof Ops>[]
}

/** @internal */
export type QMutationVars<Ops extends Operations<Ops>, Op extends keyof Ops> = MutationOnSuccessOptions<Ops> & {
  data?: ApiRequest<Ops, Op>
  pathParams?: ApiPathParams<Ops, Op>
  axiosOptions?: AxiosRequestConfigExtended
  queryParams?: ApiQueryParams<Ops, Op>
}

/**
 * Mutation options for `useMutation` that extend TanStack Query options.
 *
 * Combines TanStack Query's UseMutationOptions with custom options for cache
 * management, such as controlling automatic cache updates and specifying
 * operations to invalidate after the mutation.
 *
 * @template Ops - The operations type from your OpenAPI specification
 * @template Op - The operation key from your operations type
 *
 * @example
 * ```typescript
 * const mutation = api.useMutation(OperationId.createPet, {
 *   onSuccess: (data) => console.log('Created', data),
 *   dontInvalidate: false,  // default: auto-invalidate
 *   invalidateOperations: [OperationId.listPets]  // manual invalidation
 * })
 * ```
 */
export type QMutationOptions<Ops extends Operations<Ops>, Op extends keyof Ops> = OmitMaybeRef<
  UseMutationOptions<
    AxiosResponse<ApiResponse<Ops, Op>>,
    Error,
    ApiRequest<Ops, Op> extends never ? QMutationVars<Ops, Op> | void : QMutationVars<Ops, Op>
  >,
  'mutationFn' | 'mutationKey'
> &
  MutationOnSuccessOptions<Ops> & {
    /** Additional axios configuration for this request. */
    axiosOptions?: AxiosRequestConfigExtended
    /** Query parameters for the request. Can be reactive. */
    queryParams?: MaybeRefOrGetter<ApiQueryParams<Ops, Op>>
  }

/**
 * Extract path parameters type from an operation.
 * @example
 * ```typescript
 * type Params = ApiPathParams<OpenApiOperations, OpType.getPet>
 * // { petId: string | undefined }
 * ```
 */
export type ApiPathParams<Ops extends Operations<Ops>, Op extends keyof Ops> = Ops[Op] extends {
  parameters: { path: infer PathParams }
}
  ? { [K in keyof PathParams]: PathParams[K] | undefined }
  : Record<string, never>

/**
 * Extract query parameters type from an operation.
 * @example
 * ```typescript
 * type Params = ApiQueryParams<OpenApiOperations, OpType.listPets>
 * // { limit?: number, status?: string }
 * ```
 */
export type ApiQueryParams<Ops extends Operations<Ops>, Op extends keyof Ops> = Ops[Op] extends {
  parameters: { query?: infer QueryParams }
}
  ? QueryParams extends Record<string, unknown>
    ? { [K in keyof QueryParams]?: QueryParams[K] }
    : Record<string, never>
  : Record<string, never>

type IfEquals<X, Y, A = X, B = never> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? A : B
type IsReadonly<T, K extends keyof T> = IfEquals<Pick<T, K>, { -readonly [Q in K]: T[K] }, false, true>
type Writable<T> = {
  -readonly [K in keyof T as IsReadonly<T, K> extends false ? K : never]: T[K]
}

/**
 * Extract request body type from an operation.
 * @example
 * ```typescript
 * type Body = ApiRequest<OpenApiOperations, OpType.createPet>
 * // { name: string, species?: string }
 * ```
 */
export type ApiRequest<Ops extends Operations<Ops>, Op extends keyof Ops> =
  GetOperation<Ops, Op> extends {
    requestBody: { content: { 'application/json': infer Body } }
  }
    ? Writable<Body>
    : GetOperation<Ops, Op> extends {
          requestBody: { content: { 'multipart/form-data': infer Body } }
        }
      ? Writable<Body> | FormData
      : never

export type IsQueryOperation<Ops extends Operations<Ops>, Op extends keyof Ops> = Ops[Op] extends {
  method: HttpMethod.GET | HttpMethod.HEAD | HttpMethod.OPTIONS
}
  ? true
  : false

/**
 * Type representing an instance of the OpenAPI client returned by useOpenApi.
 *
 * This interface defines all the methods available on the API client instance,
 * providing type-safe access to queries and mutations based
 * on your OpenAPI specification.
 *
 * @group Types
 * @template Ops - The operations type from your OpenAPI specification
 *
 * @example
 * ```typescript
 * import { OpenApiInstance } from '@qualisero/openapi-endpoint'
 * import { type OpenApiOperations } from './generated/api-operations'
 *
 * // Type your API instance for better IntelliSense
 * const api: OpenApiInstance<OpenApiOperations> = useOpenApi(config)
 *
 * // All methods are now fully typed
 * const query = api.useQuery('getPet', { petId: '123' })
 * const mutation = api.useMutation('createPet')
 * ```
 */
export type OpenApiInstance<Ops extends Operations<Ops>> = {
  /**
   * Execute a type-safe query (GET/HEAD/OPTIONS) with automatic caching.
   *
   * Only accepts operation IDs that correspond to query operations.
   *
   * @template Op - The operation key from your operations type
   * @param operationId - Operation ID (must be a GET/HEAD/OPTIONS operation)
   * @param pathParamsOrOptions - Path params or query options:
   *   - If the operation has path params, provide them here (can be reactive)
   *   - If the operation has no path params, pass query options here instead
   * @param optionsOrNull - Query options when path params are provided separately
   * @returns Reactive query result with helpers:
   *   - `data`, `isPending`, `isSuccess`, `error`, `refetch()`
   *   - `isEnabled`, `queryKey`, `onLoad(callback)`
   *
   * @example
   * ```typescript
   * // Simple list query
   * const listQuery = api.useQuery(OperationId.listPets, {
   *   queryParams: { limit: 10 }
   * })
   *
   * // Query with path parameters
   * const petQuery = api.useQuery(OperationId.getPet, { petId: '123' })
   *
   * // Conditional query
   * const id = ref('')
   * const detailsQuery = api.useQuery(OperationId.getPet, { petId: id }, {
   *   enabled: computed(() => id.value !== '')
   * })
   * ```
   */
  useQuery: <Op extends keyof Ops>(
    operationId: IsQueryOperation<Ops, Op> extends true ? Op : never,
    pathParamsOrOptions?: ApiPathParams<Ops, Op> extends Record<string, never>
      ? QQueryOptions<Ops, Op>
      : MaybeRefOrGetter<ApiPathParams<Ops, Op> | null | undefined> | QQueryOptions<Ops, Op>,
    optionsOrNull?: QQueryOptions<Ops, Op>,
  ) => EndpointQueryReturn<Ops, Op>

  /**
   * Execute a type-safe mutation (POST/PUT/PATCH/DELETE) with cache updates.
   *
   * Only accepts operation IDs that correspond to mutation operations.
   *
   * @template Op - The operation key from your operations type
   * @param operationId - Operation ID (must be a POST/PUT/PATCH/DELETE operation)
   * @param pathParamsOrOptions - Path params or mutation options:
   *   - If the operation has path params, provide them here (can be reactive)
   *   - If the operation has no path params, pass mutation options here instead
   * @param optionsOrNull - Mutation options when path params are provided separately
   * @returns Reactive mutation result with helpers:
   *   - `mutate(vars)` / `mutateAsync(vars)`
   *   - `data`, `isPending`, `isSuccess`, `error`
   *   - `isEnabled`, `extraPathParams`, `pathParams`
   *
   * @example
   * ```typescript
   * const createPet = api.useMutation(OperationId.createPet)
   * await createPet.mutateAsync({ data: { name: 'Fluffy', species: 'cat' } })
   *
   * const updatePet = api.useMutation(OperationId.updatePet, { petId: '123' })
   * updatePet.mutate({ data: { name: 'Updated Name' } })
   * ```
   */
  useMutation: <Op extends keyof Ops>(
    operationId: IsQueryOperation<Ops, Op> extends false ? Op : never,
    pathParamsOrOptions?: ApiPathParams<Ops, Op> extends Record<string, never>
      ? QMutationOptions<Ops, Op>
      : MaybeRefOrGetter<ApiPathParams<Ops, Op> | null | undefined> | QMutationOptions<Ops, Op>,
    optionsOrNull?: QMutationOptions<Ops, Op>,
  ) => EndpointMutationReturn<Ops, Op>
}
