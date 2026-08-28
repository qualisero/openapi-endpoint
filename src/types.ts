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
  /**
   * The OpenAPI `operationId` for this operation. Provided by generated code;
   * used to populate `ApiErrorContext.operationId` in the error policy.
   * When absent, the policy falls back to `"METHOD /path/template"`.
   */
  operationId?: string
}

// ============================================================================
// Error policy types
// ============================================================================

/**
 * Context passed to the global `onError` policy callback. Identifies which
 * operation failed so the policy can log, display, or filter by operation.
 */
export interface ApiErrorContext {
  /** The OpenAPI `operationId`, or `"METHOD /path/template"` when not set. */
  operationId: string
  /** The OpenAPI path template, e.g. `'/pets/{petId}'`. */
  path: string
  /** HTTP method of the operation. */
  method: HttpMethod
  /** Whether the failure came from a query or a mutation. */
  kind: 'query' | 'mutation'
}

/**
 * Global error side-effect callback. Observe-only — the promise always rejects
 * after this returns. `error` is `unknown` (not `AxiosError`) because the
 * cache-level hook fires for ANY rejection, including non-axios throws.
 * Narrow with `isAxiosError` inside the policy if needed.
 */
export type ApiErrorPolicy = (error: unknown, ctx: ApiErrorContext) => void

/**
 * Options for `createApiErrorCaches`.
 */
export interface ApiErrorPolicyOptions {
  /** Called once per logical failure, after retries, without swallowing the rejection. */
  onError?: ApiErrorPolicy
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

type BaseQueryOptions<TResponse, _TQueryParams extends Record<string, unknown>, TError = unknown> = MaybeRefDeep<
  QueryObserverOptions<TResponse, AxiosError<TError>, TResponse, TResponse, QueryKey>
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
export type QueryOptions<
  TResponse,
  TQueryParams extends Record<string, unknown> = Record<string, never>,
  TError = unknown,
> = Omit<BaseQueryOptions<TResponse, TQueryParams, TError>, 'queryKey' | 'queryFn' | 'enabled'> & {
  enabled?: ReactiveOr<boolean>
  onLoad?: (data: TResponse) => void
  axiosOptions?: AxiosRequestConfigExtended
  /**
   * @deprecated Use the `onError` policy on `createApiErrorCaches` instead.
   * `errorHandler` swallows the error unless it rethrows, fires per retry
   * attempt, and only receives `AxiosError` (non-axios throws bypass it).
   * The cache-level `onError` policy fires once, after retries, and receives
   * any rejection.
   */
  errorHandler?: (error: AxiosError) => TResponse | void | Promise<TResponse | void>
  /**
   * Suppress the client-level `onError` policy for this call.
   * `true` → always suppress; function → suppress when it returns `true`
   * (e.g. only on 409). The promise rejects either way; this controls the
   * global side-effect only.
   *
   * Note: the predicate is only evaluated for axios errors. A non-axios throw
   * (e.g. synthesised by a request interceptor) cannot be selectively
   * suppressed; use `skipGlobalError: true` to always suppress.
   *
   * The predicate parameter is narrowed to `AxiosError<TError>` when `TError`
   * is supplied. With the default `TError = unknown` it is `AxiosError<unknown>`.
   */
  skipGlobalError?: boolean | ((error: AxiosError<TError>) => boolean)
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
  TError = unknown,
> = MaybeRefDeep<
  MutationObserverOptions<
    AxiosResponse<TResponse>,
    AxiosError<TError>,
    MutationVars<TPathParams, TRequest, TQueryParams>,
    unknown
  >
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
  TError = unknown,
> = Omit<BaseMutationOptions<TResponse, TPathParams, TRequest, TQueryParams, TError>, 'mutationFn' | 'mutationKey'> &
  CacheInvalidationOptions & {
    axiosOptions?: AxiosRequestConfigExtended
    queryParams?: ReactiveOr<TQueryParams>
    /**
     * Serialise this mutation with others sharing the same scope: queued
     * mutations run one at a time in submission order (TanStack `scope`).
     * `true` derives the scope id from the operation's resolved path;
     * a string is used as the scope id verbatim.
     *
     * When path parameters are deferred to mutate-time, `true` falls back to
     * the path template (e.g. `serialize:PATCH:/pets/{petId}`), serialising
     * all mutations of that operation. For per-resource granularity with
     * deferred params, supply path parameters at hook-time or use a string scope.
     *
     * An explicit `scope` option from the caller always takes precedence over
     * `serialize`. A warning is emitted when both are set.
     */
    serialize?: boolean | string
    /**
     * Suppress the client-level `onError` policy for this call.
     * `true` → always suppress; function → suppress when it returns `true`
     * (e.g. only on 409). The promise rejects either way; this controls the
     * global side-effect only.
     *
     * Note: the predicate is only evaluated for axios errors. A non-axios throw
     * (e.g. synthesised by a request interceptor) cannot be selectively
     * suppressed; use `skipGlobalError: true` to always suppress.
     *
     * The predicate parameter is narrowed to `AxiosError<TError>` when `TError`
     * is supplied. With the default `TError = unknown` it is `AxiosError<unknown>`.
     */
    skipGlobalError?: boolean | ((error: AxiosError<TError>) => boolean)
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

type RequireAll<T> = T extends (infer E)[]
  ? RequireAll<E>[]
  : T extends readonly (infer E)[]
    ? readonly RequireAll<E>[]
    : { [K in keyof T]-?: RequireAll<T[K]> }

type IfEquals<X, Y, A = X, B = never> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? A : B

type IsReadonly<T, K extends keyof T> = IfEquals<Pick<T, K>, { -readonly [Q in K]: T[K] }, false, true>

type RequireReadonlyOrRequired<T> = {
  [K in keyof T as IsReadonly<T, K> extends true ? K : undefined extends T[K] ? never : K]-?: T[K]
} & {
  [K in keyof T as IsReadonly<T, K> extends false ? (undefined extends T[K] ? K : never) : never]: T[K]
}

/**
 * Media-type keys treated as JSON: exact `application/json`, `application/json`
 * with parameters (e.g. `; charset=utf-8`), and `application/*+json`
 * structured-syntax suffixes (e.g. `application/vnd.api+json`).
 */
type JsonMediaKey =
  | 'application/json'
  | `application/json;${string}`
  | `application/${string}+json`
  | `application/${string}+json;${string}`

/**
 * Select the JSON media-type value from an OpenAPI `content` map:
 * exact `application/json` wins, else any `application/*+json` variant.
 * Resolves to `never` when no JSON-compatible key exists.
 */
type JsonMediaValue<C> = 'application/json' extends keyof C
  ? C['application/json' & keyof C]
  : { [K in keyof C]: K extends JsonMediaKey ? C[K] : never }[keyof C]

/** Success status codes checked in priority order by {@link ExtractResponseData}. */
type SuccessStatusOrder = readonly [200, 201, 202, 203, 204, 206]

/** Walk `Codes` in order and return the first JSON media-type response body found. */
type FirstJsonResponse<R, Codes extends readonly number[]> = Codes extends readonly [
  infer H,
  ...infer Rest extends readonly number[],
]
  ? H extends keyof R
    ? R[H] extends { content: infer C }
      ? [JsonMediaValue<C>] extends [never]
        ? FirstJsonResponse<R, Rest>
        : JsonMediaValue<C>
      : FirstJsonResponse<R, Rest>
    : FirstJsonResponse<R, Rest>
  : unknown

type ExtractResponseData<Ops extends AnyOps, Op extends keyof Ops> = Ops[Op] extends { responses: infer R }
  ? FirstJsonResponse<R, SuccessStatusOrder>
  : unknown

// ============================================================================
// Error response type extraction
// ============================================================================

/**
 * Keys in an OpenAPI `responses` object that denote error responses:
 * the string `'default'`, range keys `'4XX'` / `'5XX'`, and numeric
 * 4xx / 5xx status codes.
 *
 * Numeric range detection uses a template-literal `${S}` trick because
 * numeric literal types are not directly pattern-matchable. A third arm
 * also accepts quoted numeric string keys (e.g. '404') by checking the
 * string prefix directly ('4...' or '5...').
 *
 * @internal
 */
type ErrorStatusKey<S> = S extends 'default' | '4XX' | '5XX'
  ? S
  : S extends number
    ? `${S}` extends `4${string}` | `5${string}`
      ? S
      : never
    : S extends `4${string}` | `5${string}`
      ? S
      : never

/**
 * Extract the union of JSON body types declared for error responses
 * (4xx, 5xx, `default`, `4XX`, `5XX`) of operation `Op`.
 *
 * Falls back to `unknown` when no error response declares a JSON body —
 * so `error.response.data` is always at least `unknown`, never `never`.
 *
 * @internal
 */
type ExtractErrorData<Ops extends AnyOps, Op extends keyof Ops> = Ops[Op] extends { responses: infer R }
  ? {
      [S in keyof R as ErrorStatusKey<S>]: R[S] extends { content: { 'application/json': infer D } } ? D : never
    } extends infer M extends Record<PropertyKey, unknown>
    ? M[keyof M] extends infer U
      ? [U] extends [never]
        ? unknown
        : U
      : unknown
    : unknown
  : unknown

/**
 * The `AxiosError` type for operation `Op`, with its `response.data` typed to
 * the union of JSON bodies declared for all error responses (4xx / 5xx /
 * `default`). Falls back to `AxiosError<unknown>` for operations that declare
 * no JSON error body.
 *
 * @example
 * ```ts
 * // Assuming operations.createVessel has a 422 response with JSON body:
 * type E = ApiErrorOf<operations, 'createVessel'>
 * // → AxiosError<{ code?: string; message?: string }>
 * ```
 */
export type ApiErrorOf<Ops extends AnyOps, Op extends keyof Ops> = AxiosError<ExtractErrorData<Ops, Op>>

/**
 * Extract the union of JSON body types declared for error responses.
 * Equivalent to the `response.data` type of `ApiErrorOf<Ops, Op>`.
 *
 * Use this when you need the raw error payload type (not wrapped in `AxiosError`).
 *
 * @example
 * ```ts
 * type E = ApiErrorData<operations, 'createVessel'>
 * // → { code?: string; message?: string }
 * // (`undefined` only appears via optional chaining on `error.response`,
 * //  it is not part of `ApiErrorData` itself)
 * ```
 */
export type ApiErrorData<Ops extends AnyOps, Op extends keyof Ops> = ExtractErrorData<Ops, Op>

// ============================================================================

/**
 * Extract response data type (ALL fields required - default behavior).
 *
 * Used for ALL endpoint responses (GET, POST, PUT, PATCH, DELETE) by default.
 * Assumes the API always returns all fields regardless of how they're marked in the spec.
 *
 * @example `ApiResponse<operations, 'getPet'>` → `{ readonly id: string, name: string, tag: string, status: 'available' | ... }`
 */
export type ApiResponse<Ops extends AnyOps, Op extends keyof Ops> = RequireAll<ExtractResponseData<Ops, Op>>

/**
 * Extract response data type (only readonly OR required fields are required - strict mode).
 *
 * Used for ALL endpoint responses when `--use-strict-response` flag is enabled.
 * Only marks fields as required if they are:
 * - readonly (server-generated), OR
 * - marked as required in the OpenAPI spec
 * All other fields remain optional.
 *
 * @example `ApiResponseStrict<operations, 'getPet'>` → `{ readonly id: string, name: string, tag?: string, status?: 'available' | ... }`
 */
export type ApiResponseStrict<Ops extends AnyOps, Op extends keyof Ops> = RequireReadonlyOrRequired<
  ExtractResponseData<Ops, Op>
>

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
  requestBody: { content: infer C }
}
  ? [JsonMediaValue<C>] extends [never]
    ? C extends { 'multipart/form-data': infer Body }
      ? Writable<Body> | FormData
      : never
    : Writable<JsonMediaValue<C>>
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
