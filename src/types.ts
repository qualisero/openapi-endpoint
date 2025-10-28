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

export type OperationId = string

/**
 * Interface defining the minimal QueryClient methods required by this library.
 *
 * This interface ensures compatibility with different versions of @tanstack/vue-query
 * by only requiring the specific methods that are actually used internally.
 * This prevents version compatibility issues where internal implementation details
 * (like private properties) might differ between versions.
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
   */
  invalidateQueries(filters: { queryKey: unknown[]; exact?: boolean }): Promise<void>
}

export type Operations<Ops> = object & { [K in keyof Ops]: { method: HttpMethod } }

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

/** @internal */
export interface OperationInfo {
  path: string
  method: HttpMethod
}

export type GetOperation<Ops extends Operations<Ops>, Op extends keyof Ops> = Ops[Op]

export type GetResponseData<Ops extends Operations<Ops>, Op extends keyof Ops> =
  GetOperation<Ops, Op> extends {
    responses: { 200: { content: { 'application/json': infer Data } } }
  }
    ? RequireReadonly<Data>
    : unknown

type OmitMaybeRef<T, K extends PropertyKey> =
  T extends MaybeRef<infer U>
    ? MaybeRef<Omit<U, K> & Partial<Pick<U, K & keyof U>>>
    : Omit<T, K> & Partial<Pick<T, K & keyof T>>

// Type-safe options for queries
// NOTE: because UseQueryOptions is a MaybeRef, regular Omit won't work:
/** @internal */
export type QQueryOptions<Ops extends Operations<Ops>, Op extends keyof Ops> = OmitMaybeRef<
  UseQueryOptions<GetResponseData<Ops, Op>, Error, GetResponseData<Ops, Op>, GetResponseData<Ops, Op>>,
  'queryKey' | 'queryFn' | 'enabled'
> & {
  enabled?: MaybeRefOrGetter<boolean>
  onLoad?: (data: GetResponseData<Ops, Op>) => void
  axiosOptions?: AxiosRequestConfigExtended
  errorHandler?: (error: AxiosError) => GetResponseData<Ops, Op> | void | Promise<GetResponseData<Ops, Op> | void>
}

type MutationOnSuccessOptions<Ops extends Operations<Ops>> = {
  dontInvalidate?: boolean
  dontUpdateCache?: boolean
  invalidateOperations?: (keyof Ops)[] | Partial<{ [K in keyof Ops]: GetPathParameters<Ops, K> }>
  refetchEndpoints?: EndpointQueryReturn<Ops, keyof Ops>[]
}

/** @internal */
export type QMutationVars<Ops extends Operations<Ops>, Op extends keyof Ops> = MutationOnSuccessOptions<Ops> & {
  data?: GetRequestBody<Ops, Op>
  pathParams?: GetPathParameters<Ops, Op>
  axiosOptions?: AxiosRequestConfigExtended
}
/** @internal */
export type QMutationOptions<Ops extends Operations<Ops>, Op extends keyof Ops> = OmitMaybeRef<
  UseMutationOptions<
    AxiosResponse<GetResponseData<Ops, Op>>,
    Error,
    GetRequestBody<Ops, Op> extends never ? QMutationVars<Ops, Op> | void : QMutationVars<Ops, Op>
  >,
  'mutationFn' | 'mutationKey'
> &
  MutationOnSuccessOptions<Ops> & {
    axiosOptions?: AxiosRequestConfigExtended
  }

export type GetPathParameters<Ops extends Operations<Ops>, Op extends keyof Ops> = Ops[Op] extends {
  parameters: { path: infer PathParams }
}
  ? { [K in keyof PathParams]: PathParams[K] | undefined }
  : Record<string, never>

type IfEquals<X, Y, A = X, B = never> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? A : B
type IsReadonly<T, K extends keyof T> = IfEquals<Pick<T, K>, { -readonly [Q in K]: T[K] }, false, true>
type Writable<T> = {
  -readonly [K in keyof T as IsReadonly<T, K> extends false ? K : never]: T[K]
}

export type GetRequestBody<Ops extends Operations<Ops>, Op extends keyof Ops> =
  GetOperation<Ops, Op> extends {
    requestBody: { content: { 'application/json': infer Body } }
  }
    ? Writable<Body>
    : GetOperation<Ops, Op> extends {
          requestBody: { content: { 'multipart/form-data': infer Body } }
        }
      ? Writable<Body> | FormData
      : never

// Utility: Make readonly properties required (non-optional)
type RequireReadonly<T> = {
  // Required: all readonly properties (remove optional modifier)
  [K in keyof T as IsReadonly<T, K> extends true ? K : never]-?: T[K]
} & {
  // Keep as-is: all non-readonly properties (preserve optional modifier)
  [K in keyof T as IsReadonly<T, K> extends false ? K : never]: T[K]
}

export type IsQueryOperation<Ops extends Operations<Ops>, Op extends keyof Ops> = Ops[Op] extends {
  method: HttpMethod.GET | HttpMethod.HEAD | HttpMethod.OPTIONS
}
  ? true
  : false

/**
 * Type representing an instance of the OpenAPI client returned by useOpenApi.
 *
 * This interface defines all the methods available on the API client instance,
 * providing type-safe access to queries, mutations, and generic endpoints based
 * on your OpenAPI specification.
 *
 * @template Ops - The operations type from your OpenAPI specification
 * @template AxiosConfig - The axios request configuration type (defaults to AxiosRequestConfig)
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
 * const endpoint = api.useEndpoint('listPets')
 * ```
 */
export type OpenApiInstance<Ops extends Operations<Ops>> = {
  /**
   * Debug utility to inspect operation metadata at runtime.
   *
   * This method helps during development to understand how operations are classified
   * and can be useful for debugging type inference issues.
   *
   * @param operationId - The operation ID to inspect
   * @returns Boolean indicating whether the operation is a query (GET/HEAD/OPTIONS)
   *
   * @example
   * ```typescript
   * // Check if an operation is a query or mutation
   * const isQuery = api._debugIsQueryOperation('getPet') // true for GET
   * const isMutation = api._debugIsQueryOperation('createPet') // false for POST
   * ```
   */
  _debugIsQueryOperation: <Op extends keyof Ops>(operationId: Op) => IsQueryOperation<Ops, Op>

  /**
   * Creates a reactive query for GET/HEAD/OPTIONS operations.
   *
   * This method creates a TanStack Query with automatic type inference, caching,
   * and reactive updates. Only accepts operation IDs that correspond to query operations.
   *
   * @template Op - The operation key from your operations type
   * @param operationId - Operation ID (must be a GET/HEAD/OPTIONS operation)
   * @param pathParamsOrOptions - Path parameters (for parameterized routes) or query options
   * @param optionsOrNull - Additional query options when path parameters are provided separately
   * @returns Reactive query result with data, loading state, error handling, etc.
   *
   * @example
   * ```typescript
   * // Simple query without parameters
   * const { data: pets, isLoading } = api.useQuery('listPets')
   *
   * // Query with path parameters
   * const { data: pet } = api.useQuery('getPet', { petId: '123' })
   *
   * // Query with options
   * const { data: pets } = api.useQuery('listPets', {
   *   enabled: computed(() => shouldLoad.value),
   *   onLoad: (data) => console.log('Loaded:', data)
   * })
   * ```
   */
  useQuery: <Op extends keyof Ops>(
    operationId: IsQueryOperation<Ops, Op> extends true ? Op : never,
    pathParamsOrOptions?: GetPathParameters<Ops, Op> extends Record<string, never>
      ? QQueryOptions<Ops, Op>
      : MaybeRefOrGetter<GetPathParameters<Ops, Op> | null | undefined> | QQueryOptions<Ops, Op>,
    optionsOrNull?: QQueryOptions<Ops, Op>,
  ) => EndpointQueryReturn<Ops, Op>

  /**
   * Creates a reactive mutation for POST/PUT/PATCH/DELETE operations.
   *
   * This method creates a TanStack Query mutation with automatic cache invalidation,
   * optimistic updates, and type-safe request/response handling. Only accepts operation IDs
   * that correspond to mutation operations.
   *
   * @template Op - The operation key from your operations type
   * @param operationId - Operation ID (must be a POST/PUT/PATCH/DELETE operation)
   * @param pathParamsOrOptions - Path parameters (for parameterized routes) or mutation options
   * @param optionsOrNull - Additional mutation options when path parameters are provided separately
   * @returns Reactive mutation result with mutate, mutateAsync, status, etc.
   *
   * @example
   * ```typescript
   * // Simple mutation without path parameters
   * const createPet = api.useMutation('createPet', {
   *   onSuccess: (data) => console.log('Created:', data),
   *   onError: (error) => console.error('Failed:', error)
   * })
   *
   * // Mutation with path parameters
   * const updatePet = api.useMutation('updatePet', { petId: '123' })
   *
   * // Execute mutations
   * await createPet.mutateAsync({ data: { name: 'Fluffy', species: 'cat' } })
   * await updatePet.mutateAsync({ data: { name: 'Updated Name' } })
   * ```
   */
  useMutation: <Op extends keyof Ops>(
    operationId: IsQueryOperation<Ops, Op> extends false ? Op : never,
    pathParamsOrOptions?: GetPathParameters<Ops, Op> extends Record<string, never>
      ? QMutationOptions<Ops, Op>
      : MaybeRefOrGetter<GetPathParameters<Ops, Op> | null | undefined> | QMutationOptions<Ops, Op>,
    optionsOrNull?: QMutationOptions<Ops, Op>,
  ) => EndpointMutationReturn<Ops, Op>

  /**
   * Generic endpoint composable that automatically detects operation type.
   *
   * This is a universal method that returns either a query or mutation based on the
   * operation's HTTP method. It provides the same functionality as useQuery/useMutation
   * but with automatic type detection, making it useful for generic or dynamic scenarios.
   *
   * @template Op - The operation key from your operations type
   * @param operationId - Any valid operation ID from your API specification
   * @param pathParamsOrOptions - Path parameters (for parameterized routes) or operation-specific options
   * @param optionsOrNull - Additional options when path parameters are provided separately
   * @returns Query result for GET/HEAD/OPTIONS operations, mutation result for others
   *
   * @example
   * ```typescript
   * // Automatically becomes a query for GET operations
   * const listEndpoint = api.useEndpoint('listPets')
   * // TypeScript infers this has query properties: .data, .isLoading, .refetch(), etc.
   *
   * // Automatically becomes a mutation for POST operations
   * const createEndpoint = api.useEndpoint('createPet')
   * // TypeScript infers this has mutation properties: .mutate(), .mutateAsync(), etc.
   *
   * // Use based on the detected type
   * const petData = listEndpoint.data // Query data
   * await createEndpoint.mutateAsync({ data: { name: 'Fluffy' } }) // Mutation execution
   * ```
   */
  useEndpoint: <Op extends keyof Ops>(
    operationId: Op,
    pathParamsOrOptions?: GetPathParameters<Ops, Op> extends Record<string, never>
      ? IsQueryOperation<Ops, Op> extends true
        ? QQueryOptions<Ops, Op>
        : QMutationOptions<Ops, Op>
      :
          | MaybeRefOrGetter<GetPathParameters<Ops, Op> | null | undefined>
          | (IsQueryOperation<Ops, Op> extends true ? QQueryOptions<Ops, Op> : QMutationOptions<Ops, Op>),
    optionsOrNull?: IsQueryOperation<Ops, Op> extends true ? QQueryOptions<Ops, Op> : QMutationOptions<Ops, Op>,
  ) => IsQueryOperation<Ops, Op> extends true ? EndpointQueryReturn<Ops, Op> : EndpointMutationReturn<Ops, Op>
}
