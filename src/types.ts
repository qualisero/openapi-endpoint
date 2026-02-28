import { type AxiosInstance, type AxiosError, type AxiosRequestConfig, type AxiosResponse } from 'axios'
import type { MutationObserverOptions, QueryKey, QueryObserverOptions } from '@tanstack/query-core'
import type { ComputedRef, Ref } from 'vue'
import type { QueryClient } from '@tanstack/vue-query'

/**
 * Extended Axios request configuration that allows custom properties.
 */
export type AxiosRequestConfigExtended = AxiosRequestConfig & Record<string, unknown>

// ============================================================================
// HTTP Methods
// ============================================================================

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

export const QUERY_METHODS = [HttpMethod.GET, HttpMethod.HEAD, HttpMethod.OPTIONS] as const
export const MUTATION_METHODS = [HttpMethod.POST, HttpMethod.PUT, HttpMethod.PATCH, HttpMethod.DELETE] as const

export function isQueryMethod(method: HttpMethod): boolean {
  return (QUERY_METHODS as readonly HttpMethod[]).includes(method)
}

export function isMutationMethod(method: HttpMethod): boolean {
  return (MUTATION_METHODS as readonly HttpMethod[]).includes(method)
}

// ============================================================================
// Reactive Patterns
// ============================================================================

/**
 * A value that can be reactive (ref, computed, getter function) or direct.
 */
export type ReactiveOr<T> = T | Ref<T> | ComputedRef<T> | (() => T)

/**
 * Constrains a getter function `F` so that its return type has no excess
 * properties beyond the expected type `T`.
 *
 * Evaluates to `F` when the return type is valid, or `never` when the
 * function returns unexpected extra properties — causing a type error at the
 * call site.
 *
 * @example
 * ```ts
 * type PP = { petId: string | undefined }
 * type F1 = () => { petId: string }         // NoExcessReturn<PP, F1> → F1   ✅
 * type F2 = () => { petId: string; bad: 'x' } // NoExcessReturn<PP, F2> → never ❌
 * ```
 *
 * @internal Used in generated `api-client.ts` to enforce strict path params on getter fns.
 */
export type NoExcessReturn<T extends Record<string, unknown>, F extends () => T> =
  Exclude<keyof ReturnType<F>, keyof T> extends never ? F : never

/**
 * Reactive value that excludes function getters.
 * @internal Used for internal type inference.
 */
export type ReactiveValue<T> = T | Ref<T> | ComputedRef<T>

// ============================================================================
// Endpoint Config (runtime config for each operation)
// ============================================================================

/**
 * Runtime configuration for a single endpoint. Passed directly to
 * `useEndpointQuery` / `useEndpointMutation` by generated code.
 *
 * Created by the generated `createApiClient` factory and embedded per-operation
 * in the generated `api-client.ts`.
 */
export interface EndpointConfig {
  axios: AxiosInstance
  queryClient: QueryClient
  /** The OpenAPI path template, e.g. `/pets/{petId}` */
  path: string
  method: HttpMethod
  /**
   * Pre-computed list path for cache invalidation after mutations.
   * e.g. for `updatePet` at `/pets/{petId}`, this would be `/pets`.
   * `null` means no list invalidation.
   * Generated at code-gen time by the CLI.
   */
  listPath?: string | null
  /**
   * Registry of all operations' paths, used to resolve `invalidateOperations`
   * option at mutation time. Generated and embedded by the CLI.
   */
  operationsRegistry?: Readonly<Record<string, { path: string }>>
}

// ============================================================================
// Refetchable (minimal interface for refetchEndpoints)
// ============================================================================

/**
 * Minimal interface satisfied by `QueryReturn`. Used for `refetchEndpoints`
 * in cache invalidation options.
 *
 * Uses `Promise<unknown>` so this is compatible with TanStack's real `refetch`
 * return type (`Promise<QueryObserverResult<TData, TError>>`).
 */
export interface Refetchable {
  refetch: () => Promise<unknown>
}

// ============================================================================
// Cache Invalidation Options (no Ops generic — plain strings)
// ============================================================================

/**
 * Options for controlling automatic cache invalidation after mutations.
 */
export interface CacheInvalidationOptions {
  /** Skip automatic cache invalidation. @default false */
  dontInvalidate?: boolean
  /** Skip automatic cache update for PUT/PATCH responses. @default false */
  dontUpdateCache?: boolean
  /**
   * Additional operation IDs to invalidate after mutation succeeds.
   * Array of operation name strings, or map of operation name → path params.
   * @example ['listPets']
   * @example { getPet: { petId: '123' } }
   */
  invalidateOperations?: string[] | Record<string, Record<string, string | undefined>>
  /** Specific query endpoints to refetch after mutation succeeds. */
  refetchEndpoints?: Refetchable[]
}

// ============================================================================
// Query Options
// ============================================================================

type MaybeRefLeaf<T> = T | Ref<T> | ComputedRef<T>
type MaybeRefDeep<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends object
    ? { [K in keyof T]: MaybeRefDeep<T[K]> }
    : MaybeRefLeaf<T>

type BaseQueryOptions<TResponse, _TQueryParams extends Record<string, unknown>> = MaybeRefDeep<
  QueryObserverOptions<TResponse, Error, TResponse, TResponse, QueryKey>
> & { shallow?: boolean }

/**
 * Options for `useQuery` composable. Accepts all TanStack Query options plus:
 * - `enabled`: reactive boolean
 * - `queryParams`: reactive query string parameters
 * - `onLoad`: callback when data loads for the first time
 * - `errorHandler`: custom error handler
 * - `axiosOptions`: additional axios config
 *
 * @template TResponse    The response data type for this operation
 * @template TQueryParams The query parameters type for this operation
 */
export type QueryOptions<TResponse, TQueryParams extends Record<string, unknown> = Record<string, never>> = Omit<
  BaseQueryOptions<TResponse, TQueryParams>,
  'queryKey' | 'queryFn' | 'enabled'
> & {
  enabled?: ReactiveOr<boolean>
  onLoad?: (data: TResponse) => void
  axiosOptions?: AxiosRequestConfigExtended
  errorHandler?: (error: AxiosError) => TResponse | void | Promise<TResponse | void>
  queryParams?: ReactiveOr<TQueryParams>
}

/**
 * Per-call options for `useLazyQuery`'s `fetch()` method.
 *
 * @template TQueryParams The query parameters type for this operation
 */
export type LazyQueryFetchOptions<TQueryParams extends Record<string, unknown> = Record<string, never>> = {
  /** Query string parameters for this fetch call. */
  queryParams?: TQueryParams
  /** Additional axios config for this fetch call (merged with hook-level axiosOptions). */
  axiosOptions?: AxiosRequestConfigExtended
}

// ============================================================================
// Mutation Vars & Options
// ============================================================================

type MutationVarsBase<
  TPathParams extends Record<string, unknown>,
  TQueryParams extends Record<string, unknown>,
> = CacheInvalidationOptions & {
  pathParams?: Partial<TPathParams>
  axiosOptions?: AxiosRequestConfigExtended
  queryParams?: TQueryParams
}

/**
 * Variables passed to `mutation.mutate()` or `mutation.mutateAsync()`.
 *
 * When `TRequest` is `never` (operation has no request body), `data` is excluded.
 *
 * @template TPathParams  Path parameters type
 * @template TRequest     Request body type (`never` if none)
 * @template TQueryParams Query parameters type
 */
export type MutationVars<
  TPathParams extends Record<string, unknown>,
  TRequest,
  TQueryParams extends Record<string, unknown> = Record<string, never>,
> = [TRequest] extends [never]
  ? MutationVarsBase<TPathParams, TQueryParams>
  : MutationVarsBase<TPathParams, TQueryParams> & { data?: TRequest }

type BaseMutationOptions<
  TResponse,
  TPathParams extends Record<string, unknown>,
  TRequest,
  TQueryParams extends Record<string, unknown>,
> = MaybeRefDeep<
  MutationObserverOptions<AxiosResponse<TResponse>, Error, MutationVars<TPathParams, TRequest, TQueryParams>, unknown>
> & { shallow?: boolean }

/**
 * Options for `useMutation` composable.
 *
 * @template TResponse    Response data type
 * @template TPathParams  Path parameters type
 * @template TRequest     Request body type
 * @template TQueryParams Query parameters type
 */
export type MutationOptions<
  TResponse,
  TPathParams extends Record<string, unknown>,
  TRequest,
  TQueryParams extends Record<string, unknown> = Record<string, never>,
> = Omit<BaseMutationOptions<TResponse, TPathParams, TRequest, TQueryParams>, 'mutationFn' | 'mutationKey'> &
  CacheInvalidationOptions & {
    axiosOptions?: AxiosRequestConfigExtended
    queryParams?: ReactiveOr<TQueryParams>
  }

// ============================================================================
// Mutate function types
// ============================================================================

/**
 * Return type of `mutation.mutateAsync()`.
 */
export type MutateAsyncReturn<TResponse> = Promise<AxiosResponse<TResponse>>

/**
 * `mutation.mutate()` function signature.
 */
export type MutateFn<
  TPathParams extends Record<string, unknown>,
  TRequest,
  TQueryParams extends Record<string, unknown> = Record<string, never>,
> = (vars?: MutationVars<TPathParams, TRequest, TQueryParams>) => void

/**
 * `mutation.mutateAsync()` function signature.
 */
export type MutateAsyncFn<
  TResponse,
  TPathParams extends Record<string, unknown>,
  TRequest,
  TQueryParams extends Record<string, unknown> = Record<string, never>,
> = (vars?: MutationVars<TPathParams, TRequest, TQueryParams>) => MutateAsyncReturn<TResponse>

// ============================================================================
// Type Extraction Utilities (used by generated api-operations.ts)
//
// These are pure type helpers that work on any Ops object type.
// The constraint is intentionally relaxed to `Record<string, unknown>` so
// they work directly with the openapi-typescript `operations` type (which
// does NOT include our runtime path/method additions).
// ============================================================================

/**
 * Constraint for operation objects. Accepts any object type including
 * interfaces with known keys (like those generated by openapi-typescript).
 */
type AnyOps = object

type RequireAll<T> = { [K in keyof T]-?: T[K] }

type IfEquals<X, Y, A = X, B = never> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? A : B

type IsReadonly<T, K extends keyof T> = IfEquals<Pick<T, K>, { -readonly [Q in K]: T[K] }, false, true>

type ExcludeReadonly<T> = {
  [K in keyof T as IsReadonly<T, K> extends false ? K : never]: T[K]
}

type ExtractResponseData<Ops extends AnyOps, Op extends keyof Ops> = Ops[Op] extends {
  responses: { 200: { content: { 'application/json': infer Data } } }
}
  ? Data
  : Ops[Op] extends { responses: { 201: { content: { 'application/json': infer Data } } } }
    ? Data
    : Ops[Op] extends { responses: { 202: { content: { 'application/json': infer Data } } } }
      ? Data
      : Ops[Op] extends { responses: { 203: { content: { 'application/json': infer Data } } } }
        ? Data
        : Ops[Op] extends { responses: { 204: { content: { 'application/json': infer Data } } } }
          ? Data
          : Ops[Op] extends { responses: { 206: { content: { 'application/json': infer Data } } } }
            ? Data
            : unknown

/**
 * Extract response data type for mutations (excludes readonly fields, preserves optionality).
 *
 * Used for POST/PUT/PATCH/DELETE responses where:
 * - Readonly fields are excluded (client cannot set them)
 * - Optional fields remain optional (as per the OpenAPI spec)
 *
 * @example `ApiResponse<operations, 'createPet'>` → `{ name: string, tag?: string, ... }`
 */
export type ApiResponse<Ops extends AnyOps, Op extends keyof Ops> = ExcludeReadonly<ExtractResponseData<Ops, Op>>

/**
 * Extract response data type for queries (ALL fields required, including optional ones).
 *
 * Used for GET/HEAD/OPTIONS responses where the assumption is that the API
 * shares the same schema for POST/PATCH and GET, but always returns all fields
 * for GET operations. This makes ALL fields required regardless of how they're
 * marked in the spec.
 *
 * @example `ApiResponseSafe<operations, 'getPet'>` → `{ readonly id: string, name: string, tag: string, ... }`
 */
export type ApiResponseSafe<Ops extends AnyOps, Op extends keyof Ops> = RequireAll<ExtractResponseData<Ops, Op>>

type Writable<T> = {
  -readonly [K in keyof T as IfEquals<Pick<T, K>, { -readonly [Q in K]: T[K] }, false, true> extends false
    ? K
    : never]: T[K]
}

/**
 * Extract the request body type.
 * @example `ApiRequest<operations, 'createPet'>` → `{ name: string, species?: string }`
 */
export type ApiRequest<Ops extends AnyOps, Op extends keyof Ops> = Ops[Op] extends {
  requestBody: { content: { 'application/json': infer Body } }
}
  ? Writable<Body>
  : Ops[Op] extends { requestBody: { content: { 'multipart/form-data': infer Body } } }
    ? Writable<Body> | FormData
    : never

/**
 * Extract path parameters type (all required).
 * @example `ApiPathParams<operations, 'getPet'>` → `{ petId: string }`
 */
export type ApiPathParams<Ops extends AnyOps, Op extends keyof Ops> = Ops[Op] extends {
  parameters: { path: infer PathParams }
}
  ? PathParams extends Record<string, unknown>
    ? PathParams
    : Record<string, never>
  : Record<string, never>

/**
 * Path params input type — same as `ApiPathParams` but all values allow `undefined`
 * (for reactive resolution where params may not yet be set).
 */
export type ApiPathParamsInput<Ops extends AnyOps, Op extends keyof Ops> = {
  [K in keyof ApiPathParams<Ops, Op>]: ApiPathParams<Ops, Op>[K] | undefined
}

/**
 * Extract query parameters type (all optional).
 * @example `ApiQueryParams<operations, 'listPets'>` → `{ limit?: number, status?: string }`
 */
export type ApiQueryParams<Ops extends AnyOps, Op extends keyof Ops> = Ops[Op] extends {
  parameters: { query?: infer QueryParams }
}
  ? QueryParams extends Record<string, unknown>
    ? { [K in keyof QueryParams]?: QueryParams[K] }
    : Record<string, never>
  : Record<string, never>
