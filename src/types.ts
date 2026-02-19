import { type AxiosInstance, type AxiosError, type AxiosRequestConfig, type AxiosResponse } from 'axios'
import type { MutationObserverOptions, QueryKey, QueryObserverOptions } from '@tanstack/query-core'
import type { ComputedRef, Ref } from 'vue'
import type { EndpointQueryReturn } from './openapi-query'
import type { EndpointMutationReturn } from './openapi-mutation'

/**
 * Extended Axios request configuration that allows custom properties.
 */
export type AxiosRequestConfigExtended = AxiosRequestConfig & Record<string, unknown>

/**
 * Error type shown when an operation requires path parameters but they weren't provided.
 *
 * @internal
 */
export type RequiresPathParameters<Op extends string> = {
  readonly __error: `Operation '${Op}' requires path parameters as the second argument`
  readonly __fix: 'Provide path parameters as the second argument'
  readonly __see: 'Check the operation path definition (e.g., /pets/{petId}) or JSDoc'
}

/**
 * Validates that path parameters have no excess properties.
 *
 * @internal
 */
export type HasExcessPathParams<Provided extends Record<string, unknown>, Expected extends Record<string, unknown>> =
  Exclude<keyof Provided, keyof Expected> extends never ? true : false

/**
 * Type representing an operation that does NOT require path parameters.
 * Used in function signatures to restrict which operations can be called without path params.
 *
 * @internal
 */
export type NoPathParams<Ops extends Operations<Ops>, Op extends keyof Ops> = Op &
  (ApiPathParams<Ops, Op> extends Record<string, never> ? Op : RequiresPathParameters<Op & string>)

/**
 * Type representing an operation that DOES require path parameters.
 * Used in function signatures to restrict which operations must be called with path params.
 *
 * @internal
 */
export type WithPathParams<Ops extends Operations<Ops>, Op extends keyof Ops> = Op &
  (ApiPathParams<Ops, Op> extends Record<string, never> ? RequiresPathParameters<Op & string> : Op)

/** @internal */
export type { EndpointQueryReturn, EndpointMutationReturn }

/**
 * Interface defining the minimal QueryClient methods required by this library.
 *
 * This interface ensures compatibility with different versions of @tanstack/vue-query
 * by only requiring the specific methods that are actually used internally.
 *
 * @group Types
 */
export interface QueryClientLike {
  cancelQueries(filters: { queryKey: unknown[]; exact?: boolean }): Promise<void>
  setQueryData(queryKey: unknown[], data: unknown): void
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
 * @template Ops - The operations type, typically generated from your OpenAPI specification
 *
 * @example
 * ```typescript
 * import { useOpenApi } from '@qualisero/openapi-endpoint'
 * import { openApiOperations, type OpenApiOperations } from './generated/api-operations'
 * import axios from 'axios'
 *
 * const config: OpenApiConfig<OpenApiOperations> = {
 *   operations: openApiOperations,
 *   axios: axios.create({ baseURL: 'https://api.example.com' }),
 *   queryClient: customQueryClient // optional
 * }
 * ```
 */
export interface OpenApiConfig<Ops extends Operations<Ops>> {
  operations: Ops
  axios: AxiosInstance
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

// ============================================================================
// Response Type Extraction (DRY)
// ============================================================================

type RequireAll<T> = { [K in keyof T]-?: T[K] }

type RequireReadonly<T> = {
  [K in keyof T as IsReadonly<T, K> extends true ? K : never]-?: T[K]
} & {
  [K in keyof T as IsReadonly<T, K> extends false ? K : never]: T[K]
}

type IfEquals<X, Y, A = X, B = never> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? A : B

type IsReadonly<T, K extends keyof T> = IfEquals<Pick<T, K>, { -readonly [Q in K]: T[K] }, false, true>

/**
 * Extract the raw response data type from an operation without modifications.
 * @internal
 */
type ExtractResponseData<Ops extends Operations<Ops>, Op extends keyof Ops> =
  GetOperation<Ops, Op> extends { responses: { 200: { content: { 'application/json': infer Data } } } } ? Data : unknown

/**
 * Extract response data type from an operation (all fields required).
 *
 * All fields are REQUIRED regardless of their `required` status in the OpenAPI schema.
 * This assumes the server always returns complete objects.
 *
 * @example
 * ```typescript
 * type PetResponse = ApiResponse<OpenApiOperations, 'getPet'>
 * // { readonly id: string, name: string, ... } - all required
 * ```
 */
export type ApiResponse<Ops extends Operations<Ops>, Op extends keyof Ops> = RequireAll<ExtractResponseData<Ops, Op>>

/**
 * Extract response data type with safe typing for unreliable backends.
 *
 * Only readonly properties are REQUIRED. Other properties preserve their optional status.
 *
 * @example
 * ```typescript
 * type PetResponse = ApiResponseSafe<OpenApiOperations, 'getPet'>
 * // { readonly id: string, name?: string, ... } - only readonly required
 * ```
 */
export type ApiResponseSafe<Ops extends Operations<Ops>, Op extends keyof Ops> = RequireReadonly<
  ExtractResponseData<Ops, Op>
>

// ============================================================================
// Reactive Patterns (Standardized)
// ============================================================================

/**
 * A value that can be reactive (ref, computed) or direct.
 * Standardized pattern for all reactive values across the library.
 *
 * @internal
 */
export type ReactiveOr<T> = T | Ref<T> | ComputedRef<T> | (() => T)

/**
 * Reactive value that excludes function getters.
 * Useful for path params where function overloads have stricter checks.
 *
 * @internal
 */
export type ReactiveValue<T> = T | Ref<T> | ComputedRef<T>

/** @internal */
type MaybeRefLeaf<T> = T | Ref<T> | ComputedRef<T>

type MaybeRefDeep<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends object
    ? { [K in keyof T]: MaybeRefDeep<T[K]> }
    : MaybeRefLeaf<T>

/** @internal */
type ShallowOption = {
  shallow?: boolean
}

// ============================================================================
// Path Parameters (now truly required, not optional)
// ============================================================================

/**
 * Extract path parameters type from an operation (truly required).
 *
 * All path parameters from the OpenAPI schema are required - they cannot be undefined.
 * This matches the runtime behavior where missing path params cause errors.
 *
 * @example
 * ```typescript
 * type Params = ApiPathParams<OpenApiOperations, 'getPet'>
 * // { petId: string } - all params required
 * ```
 */
export type ApiPathParams<Ops extends Operations<Ops>, Op extends keyof Ops> = Ops[Op] extends {
  parameters: { path: infer PathParams }
}
  ? PathParams extends Record<string, unknown>
    ? PathParams
    : Record<string, never>
  : Record<string, never>

/**
 * Path params input type that allows undefined values for reactive resolution.
 *
 * @internal
 */
export type ApiPathParamsInput<Ops extends Operations<Ops>, Op extends keyof Ops> = {
  [K in keyof ApiPathParams<Ops, Op>]: ApiPathParams<Ops, Op>[K] | undefined
}

/**
 * Extract query parameters type from an operation.
 * @example
 * ```typescript
 * type Params = ApiQueryParams<OpenApiOperations, 'listPets'>
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

// ============================================================================
// Request Body
// ============================================================================

type Writable<T> = {
  -readonly [K in keyof T as IfEquals<Pick<T, K>, { -readonly [Q in K]: T[K] }, false, true> extends false
    ? K
    : never]: T[K]
}

/**
 * Extract request body type from an operation.
 * @example
 * ```typescript
 * type Body = ApiRequest<OpenApiOperations, 'createPet'>
 * // { name: string, species?: string }
 * ```
 */
export type ApiRequest<Ops extends Operations<Ops>, Op extends keyof Ops> =
  GetOperation<Ops, Op> extends { requestBody: { content: { 'application/json': infer Body } } }
    ? Writable<Body>
    : GetOperation<Ops, Op> extends { requestBody: { content: { 'multipart/form-data': infer Body } } }
      ? Writable<Body> | FormData
      : never

// ============================================================================
// Cache Invalidation Options (consolidated, well-documented)
// ============================================================================

/**
 * Options for controlling automatic cache invalidation and updates after mutations.
 *
 * By default, mutations automatically:
 * - Update cache for PUT/PATCH responses with the returned data
 * - Invalidate matching GET queries to trigger refetches
 *
 * @group Types
 */
export interface CacheInvalidationOptions<Ops extends Operations<Ops>> {
  /**
   * Skip automatic cache invalidation after mutation completes.
   *
   * @default false
   */
  dontInvalidate?: boolean

  /**
   * Skip automatic cache update for PUT/PATCH responses.
   *
   * @default false
   */
  dontUpdateCache?: boolean

  /**
   * Additional operations to invalidate after mutation succeeds.
   *
   * Can be either:
   * - Array of operation IDs: `['listPets', 'getPetStats']`
   * - Map of operation ID to path params: `{ getPet: { petId: '123' } }`
   *
   * @example
   * ```typescript
   * // Invalidate list when creating
   * { invalidateOperations: ['listPets'] }
   *
   * // Invalidate specific item
   * { invalidateOperations: { getPet: { petId: '123' } } }
   * ```
   */
  invalidateOperations?: (keyof Ops)[] | Partial<{ [K in keyof Ops]: ApiPathParams<Ops, K> }>

  /**
   * Specific query endpoints to refetch after mutation succeeds.
   *
   * Use when you have specific query results that need to be refetched.
   *
   * @example
   * ```typescript
   * const listQuery = api.useQuery('listPets')
   * { refetchEndpoints: [listQuery] }
   * ```
   */
  refetchEndpoints?: EndpointQueryReturn<Ops, keyof Ops>[]
}

// ============================================================================
// Query Options
// ============================================================================

/**
 * Query options for `useQuery` with custom extensions.
 *
 * Supports all TanStack Query options plus:
 * - `enabled`: Reactive boolean to control when query runs
 * - `queryParams`: Reactive query string parameters
 * - `onLoad`: Callback when data loads successfully
 * - `errorHandler`: Custom error handler with fallback support
 * - `axiosOptions`: Additional axios configuration
 *
 * @template Ops - The operations type from your OpenAPI specification
 * @template Op - The operation key
 *
 * @example
 * ```typescript
 * const { data } = api.useQuery('listPets', {
 *   queryParams: { limit: 10 },
 *   enabled: computed(() => isLoggedIn.value),
 *   staleTime: 5000,
 *   onLoad: (data) => console.log('Loaded:', data.length)
 * })
 * ```
 *
 * @group Types
 */
type BaseQueryOptions<Ops extends Operations<Ops>, Op extends keyof Ops> = MaybeRefDeep<
  QueryObserverOptions<ApiResponse<Ops, Op>, Error, ApiResponse<Ops, Op>, ApiResponse<Ops, Op>, QueryKey>
> &
  ShallowOption

export type QQueryOptions<Ops extends Operations<Ops>, Op extends keyof Ops> = Omit<
  BaseQueryOptions<Ops, Op>,
  'queryKey' | 'queryFn' | 'enabled'
> & {
  /** Whether the query should execute. Can be reactive (ref/computed/function). */
  enabled?: ReactiveOr<boolean>

  /** Callback when data is successfully loaded for the first time. */
  onLoad?: (data: ApiResponse<Ops, Op>) => void

  /** Additional axios configuration for this request. */
  axiosOptions?: AxiosRequestConfigExtended

  /** Custom error handler. Return data to use as fallback, or void to use default error. */
  errorHandler?: (error: AxiosError) => ApiResponse<Ops, Op> | void | Promise<ApiResponse<Ops, Op> | void>

  /** Query parameters for the request. Can be reactive (ref/computed/function). */
  queryParams?: ReactiveOr<ApiQueryParams<Ops, Op>>
}

// ============================================================================
// Utility Types
// ============================================================================

// ============================================================================
// Mutation Variables & Options
// ============================================================================

/**
 * Variables passed to mutation.mutate() or mutation.mutateAsync().
 *
 * Combines cache invalidation options with mutation-specific data:
 * - `data`: Request body (when operation accepts one)
 * - `pathParams`: Path parameters (can override those from useMutation call)
 * - `queryParams`: Query string parameters
 * - `axiosOptions`: Additional axios configuration
 *
 * Plus all cache invalidation options (dontInvalidate, invalidateOperations, etc.)
 *
 * @template Ops - The operations type
 * @template Op - The operation key
 *
 * @example
 * ```typescript
 * const mutation = api.useMutation('createPet')
 * mutation.mutate({
 *   data: { name: 'Fluffy' },
 *   invalidateOperations: ['listPets']
 * })
 * ```
 *
 * @group Types
 */
export type QMutationVars<Ops extends Operations<Ops>, Op extends keyof Ops> = CacheInvalidationOptions<Ops> & {
  data?: ApiRequest<Ops, Op>
  pathParams?: ApiPathParamsInput<Ops, Op>
  axiosOptions?: AxiosRequestConfigExtended
  queryParams?: ApiQueryParams<Ops, Op>
}

/**
 * Resolved return type for mutateAsync to avoid showing full operations union in tooltips.
 * @internal
 */
export type MutateAsyncReturn<Ops extends Operations<Ops>, Op extends keyof Ops> = Promise<
  AxiosResponse<ApiResponse<Ops, Op>>
>

/**
 * Function signature for mutation.mutate() - non-blocking mutation execution.
 *
 * Inlined types allow TypeScript to resolve specific operation types in tooltips
 * instead of showing the entire operations union.
 *
 * @group Types
 * @internal
 */
export type MutateFn<Ops extends Operations<Ops>, Op extends keyof Ops> = (vars?: {
  data?: ApiRequest<Ops, Op>
  pathParams?: ApiPathParamsInput<Ops, Op>
  axiosOptions?: AxiosRequestConfigExtended
  queryParams?: ApiQueryParams<Ops, Op>
  dontInvalidate?: boolean
  dontUpdateCache?: boolean
  invalidateOperations?: (keyof Ops)[]
  refetchEndpoints?: EndpointQueryReturn<Ops, keyof Ops>[]
}) => void

/**
 * Function signature for mutation.mutateAsync() - async mutation execution.
 *
 * Inlined types allow TypeScript to resolve specific operation types in tooltips
 * instead of showing the entire operations union.
 *
 * @group Types
 * @internal
 */
export type MutateAsyncFn<Ops extends Operations<Ops>, Op extends keyof Ops> = (vars?: {
  data?: ApiRequest<Ops, Op>
  pathParams?: ApiPathParamsInput<Ops, Op>
  axiosOptions?: AxiosRequestConfigExtended
  queryParams?: ApiQueryParams<Ops, Op>
  dontInvalidate?: boolean
  dontUpdateCache?: boolean
  invalidateOperations?: (keyof Ops)[]
  refetchEndpoints?: EndpointQueryReturn<Ops, keyof Ops>[]
}) => MutateAsyncReturn<Ops, Op>

/**
 * Mutation options for `useMutation` with custom extensions.
 *
 * Supports all TanStack Query mutation options plus:
 * - Cache invalidation options (dontInvalidate, invalidateOperations, etc.)
 * - `queryParams`: Reactive query string parameters
 * - `axiosOptions`: Additional axios configuration
 *
 * @template Ops - The operations type
 * @template Op - The operation key
 *
 * @example
 * ```typescript
 * const mutation = api.useMutation('createPet', {
 *   onSuccess: () => console.log('Created!'),
 *   invalidateOperations: ['listPets']
 * })
 * ```
 *
 * @group Types
 */
type MutationVarsInput<Ops extends Operations<Ops>, Op extends keyof Ops> =
  ApiRequest<Ops, Op> extends never ? QMutationVars<Ops, Op> | void : QMutationVars<Ops, Op>

type BaseMutationOptions<Ops extends Operations<Ops>, Op extends keyof Ops> = MaybeRefDeep<
  MutationObserverOptions<AxiosResponse<ApiResponse<Ops, Op>>, Error, MutationVarsInput<Ops, Op>, unknown>
> &
  ShallowOption

export type QMutationOptions<Ops extends Operations<Ops>, Op extends keyof Ops> = Omit<
  BaseMutationOptions<Ops, Op>,
  'mutationFn' | 'mutationKey'
> &
  CacheInvalidationOptions<Ops> & {
    axiosOptions?: AxiosRequestConfigExtended
    queryParams?: ReactiveOr<ApiQueryParams<Ops, Op>>
  }

/**
 * Runtime type validator for mutation parameters.
 *
 * This helper is a pass-through function that helps TypeScript narrow parameter types.
 *
 * @example
 * ```typescript
 * const mutation = api.useMutation(MutationOperationId.createPet)
 * await mutation.mutateAsync(
 *   validateMutationParams(MutationOperationId.createPet, {
 *     data: { name: 'Fluffy' }
 *   })
 * )
 * ```
 */
export function validateMutationParams<Ops extends Operations<Ops>, Op extends keyof Ops>(
  _operationId: Op,
  params: QMutationVars<Ops, Op>,
): QMutationVars<Ops, Op> {
  return params
}

// ============================================================================
// Operation Filtering Types (internal)
// ============================================================================

/** @internal */
export type QueryOpsNoPathParams<Ops extends Operations<Ops>> = {
  [Op in keyof Ops]: Ops[Op]['method'] extends HttpMethod.GET | HttpMethod.HEAD | HttpMethod.OPTIONS
    ? ApiPathParams<Ops, Op> extends Record<string, never>
      ? Op
      : never
    : never
}[keyof Ops]

/** @internal */
export type QueryOpsWithPathParams<Ops extends Operations<Ops>> = {
  [Op in keyof Ops]: Ops[Op]['method'] extends HttpMethod.GET | HttpMethod.HEAD | HttpMethod.OPTIONS
    ? ApiPathParams<Ops, Op> extends Record<string, never>
      ? never
      : Op
    : never
}[keyof Ops]

/** @internal */
export type MutationOpsNoPathParams<Ops extends Operations<Ops>> = {
  [Op in keyof Ops]: Ops[Op]['method'] extends HttpMethod.POST | HttpMethod.PUT | HttpMethod.PATCH | HttpMethod.DELETE
    ? ApiPathParams<Ops, Op> extends Record<string, never>
      ? Op
      : never
    : never
}[keyof Ops]

/** @internal */
export type MutationOpsWithPathParams<Ops extends Operations<Ops>> = {
  [Op in keyof Ops]: Ops[Op]['method'] extends HttpMethod.POST | HttpMethod.PUT | HttpMethod.PATCH | HttpMethod.DELETE
    ? ApiPathParams<Ops, Op> extends Record<string, never>
      ? never
      : Op
    : never
}[keyof Ops]

// ============================================================================
// Operation-Named API Types
// ============================================================================

/**
 * Configuration for the operation-named API.
 *
 * Maps each operation to its runtime enum values.
 * Passed to `useOpenApi` as the second argument.
 *
 * @template Ops - The operations type from your generated `api-operations.ts`
 *
 * @example
 * ```typescript
 * const operationConfig = {
 *   createPet: { enums: { status: { Available: 'available', Pending: 'pending' } } },
 *   listPets:  { enums: { status: { Available: 'available', Pending: 'pending' } } },
 * } as const
 * ```
 */
export type OperationConfig<Ops extends Operations<Ops>> = {
  [Op in keyof Ops]: {
    enums: Record<string, Record<string, string>>
  }
}

/** @internal Determines if an operation uses a query-style HTTP method. */
export type IsQueryOp<Ops extends Operations<Ops>, Op extends keyof Ops> =
  Ops[Op] extends { method: HttpMethod.GET | HttpMethod.HEAD | HttpMethod.OPTIONS } ? true : false

/**
 * Namespace for a GET/HEAD/OPTIONS operation.
 *
 * @template Ops     The full operations type
 * @template Op      This operation's key
 * @template TEnums  The exact enum shape for this operation (inferred from config)
 *
 * @group Types
 */
export type QueryNamespace<
  Ops extends Operations<Ops>,
  Op extends keyof Ops,
  TEnums extends Record<string, Record<string, string>>
> = {
  /**
   * Execute this query with automatic caching via Vue Query.
   *
   * Requires path parameters as the first argument when the operation path
   * contains `{param}` segments (e.g. `/pets/{petId}`).
   *
   * @example
   * // No path params
   * const { data } = api.listPets.useQuery({ queryParams: { limit: 10 } })
   *
   * // With path params
   * const { data } = api.getPet.useQuery({ petId: '123' })
   * const { data } = api.getPet.useQuery(computed(() => ({ petId: id.value })))
   */
  useQuery: OperationQuery<Ops, Op>

  /**
   * Strongly-typed enum values for this operation's fields.
   *
   * @example
   * api.listPets.useQuery({ queryParams: { status: api.listPets.enums.status.Available } })
   */
  enums: TEnums
}

/**
 * Namespace for a POST/PUT/PATCH/DELETE operation.
 *
 * @template Ops     The full operations type
 * @template Op      This operation's key
 * @template TEnums  The exact enum shape for this operation (inferred from config)
 *
 * @group Types
 */
export type MutationNamespace<
  Ops extends Operations<Ops>,
  Op extends keyof Ops,
  TEnums extends Record<string, Record<string, string>>
> = {
  /**
   * Set up this mutation with Vue Query.
   *
   * Requires path parameters as the first argument when the operation path
   * contains `{param}` segments (e.g. `/pets/{petId}`).
   *
   * @example
   * // No path params
   * const create = api.createPet.useMutation()
   * create.mutate({ data: { name: 'Fluffy' } })
   *
   * // With path params
   * const update = api.updatePet.useMutation({ petId: '123' })
   * update.mutate({ data: { name: 'Updated' } })
   *
   * // Reactive path params
   * const del = api.deletePet.useMutation(computed(() => ({ petId: id.value })))
   */
  useMutation: OperationMutation<Ops, Op>

  /**
   * Strongly-typed enum values for this operation's fields.
   *
   * @example
   * create.mutate({ data: { status: api.createPet.enums.status.Available } })
   */
  enums: TEnums
}

/**
 * Resolves to `QueryNamespace` or `MutationNamespace` based on the operation's HTTP method.
 * @internal Used to build `OpenApiInstance`.
 */
export type OperationNamespace<
  Ops extends Operations<Ops>,
  Op extends keyof Ops,
  TEnums extends Record<string, Record<string, string>>
> = Ops[Op] extends { method: HttpMethod.GET | HttpMethod.HEAD | HttpMethod.OPTIONS }
  ? QueryNamespace<Ops, Op, TEnums>
  : MutationNamespace<Ops, Op, TEnums>

/**
 * The `useQuery` function type for a specific operation.
 * Adjusts its signature based on whether the operation has path parameters.
 * @internal
 */
export type OperationQuery<Ops extends Operations<Ops>, Op extends keyof Ops> =
  ApiPathParams<Ops, Op> extends Record<string, never>
    ? (options?: QQueryOptions<Ops, Op>) => EndpointQueryReturn<Ops, Op>
    : (
        pathParams: ReactiveOr<ApiPathParamsInput<Ops, Op>>,
        options?: QQueryOptions<Ops, Op>,
      ) => EndpointQueryReturn<Ops, Op>

/**
 * The `useMutation` function type for a specific operation.
 * Adjusts its signature based on whether the operation has path parameters.
 * @internal
 */
export type OperationMutation<Ops extends Operations<Ops>, Op extends keyof Ops> =
  ApiPathParams<Ops, Op> extends Record<string, never>
    ? (options?: QMutationOptions<Ops, Op>) => EndpointMutationReturn<Ops, Op>
    : (
        pathParams: ReactiveOr<ApiPathParamsInput<Ops, Op>>,
        options?: QMutationOptions<Ops, Op>,
      ) => EndpointMutationReturn<Ops, Op>

// ============================================================================
// Main API Instance Type
// ============================================================================

/**
 * The API instance returned by `useOpenApi`.
 *
 * Each operation from `Config` is a property on this object.
 * Query operations expose `useQuery`; mutation operations expose `useMutation`.
 * All operations expose `enums` with their specific enum values.
 *
 * @template Ops    The operations type from your generated `api-operations.ts`
 * @template Config The operation config object (inferred — do not pass manually)
 *
 * @group Types
 * @example
 * ```typescript
 * const api = useOpenApi({ operations, axios }, operationConfig)
 * // typeof api == OpenApiInstance<OpenApiOperations, typeof operationConfig>
 * ```
 */
export type OpenApiInstance<
  Ops extends Operations<Ops>,
  Config extends OperationConfig<Ops>
> = {
  [Op in keyof Config & keyof Ops]: OperationNamespace<Ops, Op, Config[Op]['enums']>
}
