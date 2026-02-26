import { computed, watch, toValue, type ComputedRef } from 'vue'
import type { MaybeRefOrGetter } from '@vue/reactivity'
import { useQuery, type UseQueryReturnType, type QueryClient } from '@tanstack/vue-query'
import { isAxiosError, type AxiosError } from 'axios'

import {
  type EndpointConfig,
  type QueryOptions,
  type LazyQueryFetchOptions,
  type AxiosRequestConfigExtended,
  isQueryMethod,
} from './types'
import { normalizeParamsOptions, useResolvedOperation, generateQueryKey } from './openapi-utils'

/**
 * Private helper: build the query function for useEndpointQuery and useEndpointLazyQuery.
 * Extracted to avoid duplicating axios call logic and error handling.
 * @internal
 */
function buildQueryFn<TResponse>(
  config: EndpointConfig,
  getResolvedPath: () => string,
  getQueryParams: () => Record<string, unknown>,
  hookAxiosOptions?: AxiosRequestConfigExtended,
  callAxiosOptions?: AxiosRequestConfigExtended,
  errorHandler?: (error: AxiosError) => TResponse | void | Promise<TResponse | void>,
): () => Promise<TResponse> {
  return async () => {
    try {
      const response = await config.axios({
        method: config.method.toLowerCase(),
        url: getResolvedPath(),
        ...hookAxiosOptions,
        ...callAxiosOptions,
        params: {
          ...(hookAxiosOptions?.params || {}),
          ...(callAxiosOptions?.params || {}),
          ...getQueryParams(),
        },
        headers: {
          ...(hookAxiosOptions?.headers || {}),
          ...(callAxiosOptions?.headers || {}),
        },
      })
      return response.data
    } catch (error: unknown) {
      if (errorHandler && isAxiosError(error)) {
        const result = await errorHandler(error)
        if (result !== undefined) return result
        return undefined as unknown as TResponse
      }
      throw error
    }
  }
}

/**
 * Return type of `useEndpointQuery` (the `useQuery` composable on a generated namespace).
 *
 * Extends TanStack's `UseQueryReturnType<TResponse, Error>` so all fields — including
 * `refetch`, `isPending`, `isLoading`, `isSuccess`, `isError`, `error`, etc. — carry
 * their real TanStack types. `data` is overridden with a `ComputedRef` typed to
 * `TResponse | undefined`, and three extra fields are added for our own abstractions.
 *
 * @template TResponse   Response data type
 * @template TPathParams Path parameters type (concrete, no undefined)
 *
 * @group Types
 */
export type QueryReturn<TResponse, TPathParams extends Record<string, unknown> = Record<string, never>> = Omit<
  UseQueryReturnType<TResponse, Error>,
  // `data` is replaced with a ComputedRef typed to TResponse | undefined.
  // `isEnabled` is replaced with our own computed that also gates on path-param resolution
  // (TanStack's isEnabled only tracks the `enabled` option flag).
  'data' | 'isEnabled'
> & {
  /** The response data (undefined until loaded). */
  data: ComputedRef<TResponse | undefined>
  /** Whether the query is currently enabled. */
  isEnabled: ComputedRef<boolean>
  /** The resolved query key. */
  queryKey: ComputedRef<string[] | (string | unknown)[]>
  /** The resolved path parameters. */
  pathParams: ComputedRef<TPathParams>
  /** Register a callback for when data loads successfully for the first time. */
  onLoad: (callback: (data: TResponse) => void) => void
}

/**
 * Return type of `useLazyQuery`.
 *
 * Shares the reactive state fields of `QueryReturn` (data, isPending, isSuccess,
 * isError, error, isEnabled, pathParams, queryKey) and adds a `fetch()` method
 * for imperative, on-demand query execution.
 *
 * @template TResponse    Response data type
 * @template TPathParams  Path parameters type
 * @template TQueryParams Query parameters type
 *
 * @group Types
 */
export type LazyQueryReturn<
  TResponse,
  TPathParams extends Record<string, unknown> = Record<string, never>,
  TQueryParams extends Record<string, unknown> = Record<string, never>,
> = Pick<
  QueryReturn<TResponse, TPathParams>,
  'data' | 'isPending' | 'isSuccess' | 'isError' | 'error' | 'isEnabled' | 'pathParams' | 'queryKey'
> & {
  /**
   * Execute a query imperatively.
   *
   * Uses `queryClient.fetchQuery()` — result is written to the TanStack cache
   * under the same key as `useQuery` for this operation+queryParams, so both
   * composables share data automatically.
   *
   * @param options - Per-call queryParams and axiosOptions
   * @returns Promise resolving to response data
   * @throws If path parameters are not yet resolved
   */
  fetch: (options?: LazyQueryFetchOptions<TQueryParams>) => Promise<TResponse>
}

/**
 * Execute a type-safe query (GET/HEAD/OPTIONS) with automatic caching.
 *
 * This is a low-level primitive — in normal usage it is called by the generated
 * per-operation `useQuery` wrappers in `api-client.ts`, not directly.
 *
 * @template TResponse    The response data type
 * @template TPathParams  The path parameters type (concrete, required values)
 * @template TQueryParams The query parameters type
 *
 * @param config      Endpoint config: axios instance, queryClient, path, method, listPath
 * @param pathParams  Path parameters (reactive). Pass `undefined` for operations without path params.
 * @param options     Query options (enabled, staleTime, queryParams, onLoad, etc.)
 */
export function useEndpointQuery<
  TResponse,
  TPathParams extends Record<string, unknown> = Record<string, never>,
  TQueryParams extends Record<string, unknown> = Record<string, never>,
>(
  config: EndpointConfig,
  pathParams?: MaybeRefOrGetter<Record<string, string | number | undefined> | null | undefined>,
  options?: QueryOptions<TResponse, TQueryParams>,
): QueryReturn<TResponse, TPathParams> {
  if (!isQueryMethod(config.method)) {
    throw new Error(
      `Operation at '${config.path}' uses method ${config.method} and cannot be used with useQuery(). ` +
        `Use useMutation() for POST/PUT/PATCH/DELETE operations.`,
    )
  }

  const { pathParams: resolvedPathParamsInput, options: resolvedOptions } = normalizeParamsOptions<
    Record<string, string | number | undefined>,
    QueryOptions<TResponse, TQueryParams>
  >(pathParams, options)

  const {
    enabled: enabledInit,
    onLoad: onLoadInit,
    axiosOptions,
    errorHandler,
    queryParams,
    ...useQueryOptions
  } = resolvedOptions

  const {
    resolvedPath,
    queryKey,
    isResolved,
    queryParams: resolvedQueryParams,
    pathParams: resolvedPathParams,
  } = useResolvedOperation(config.path, resolvedPathParamsInput, queryParams)

  const isEnabled = computed(() => {
    const baseEnabled = enabledInit !== undefined ? toValue(enabledInit) : true
    return baseEnabled && isResolved.value
  })

  const queryOptions = {
    queryKey: queryKey as ComputedRef<readonly unknown[]>,
    queryFn: buildQueryFn<TResponse>(
      config,
      () => resolvedPath.value,
      () => resolvedQueryParams.value,
      axiosOptions,
      undefined,
      errorHandler,
    ),
    enabled: isEnabled,
    staleTime: 1000 * 60,
    retry: (_failureCount: number, error: Error) => {
      if (isAxiosError(error) && error.response && error.response.status >= 400 && error.response.status < 500) {
        return false
      }
      return _failureCount < 3
    },
    ...useQueryOptions,
  } as unknown as Parameters<typeof useQuery>[0]

  const query = useQuery(queryOptions, config.queryClient)

  const onLoadCallbacks = new Set<(data: TResponse) => void>()
  if (onLoadInit) onLoadCallbacks.add(onLoadInit)

  if (query.data.value !== undefined) {
    onLoadCallbacks.forEach((cb) => cb(query.data.value as TResponse))
    onLoadCallbacks.clear()
  } else {
    const stopWatch = watch(query.data, (newData) => {
      if (newData !== undefined && onLoadCallbacks.size > 0) {
        onLoadCallbacks.forEach((cb) => cb(newData as TResponse))
        onLoadCallbacks.clear()
        stopWatch()
      }
    })
  }

  const onLoad = (callback: (data: TResponse) => void) => {
    if (query.data.value !== undefined) {
      callback(query.data.value as TResponse)
    } else {
      onLoadCallbacks.add(callback)
    }
  }

  return {
    ...query,
    data: computed(() => query.data.value) as ComputedRef<TResponse | undefined>,
    isEnabled,
    queryKey,
    onLoad,
    pathParams: resolvedPathParams as ComputedRef<TPathParams>,
  } as unknown as QueryReturn<TResponse, TPathParams>
}

/**
 * Execute a type-safe lazy query (GET/HEAD/OPTIONS) with imperative execution.
 *
 * Lazy queries do not auto-execute. The `fetch()` method must be called explicitly
 * with query parameters. Results are cached and shared with `useQuery` for the same
 * operation+params.
 *
 * This is a low-level primitive — in normal usage it is called by the generated
 * per-operation `useLazyQuery` wrappers in `api-client.ts`, not directly.
 *
 * @template TResponse    The response data type
 * @template TPathParams  The path parameters type (concrete, required values)
 * @template TQueryParams The query parameters type
 *
 * @param config      Endpoint config: axios instance, queryClient, path, method, listPath
 * @param pathParams  Path parameters (reactive). Pass `undefined` for operations without path params.
 * @param options     Query options (staleTime, errorHandler, axiosOptions — but NOT queryParams/onLoad/enabled)
 */
export function useEndpointLazyQuery<
  TResponse,
  TPathParams extends Record<string, unknown> = Record<string, never>,
  TQueryParams extends Record<string, unknown> = Record<string, never>,
>(
  config: EndpointConfig,
  pathParams?: MaybeRefOrGetter<Record<string, string | number | undefined> | null | undefined>,
  options?: Omit<QueryOptions<TResponse, TQueryParams>, 'queryParams' | 'onLoad' | 'enabled'>,
): LazyQueryReturn<TResponse, TPathParams, TQueryParams> {
  if (!isQueryMethod(config.method)) {
    throw new Error(
      `Operation at '${config.path}' uses method ${config.method} and cannot be used with useLazyQuery(). ` +
        `Use useMutation() for POST/PUT/PATCH/DELETE operations.`,
    )
  }

  const { pathParams: resolvedPathParamsInput } = normalizeParamsOptions<
    Record<string, string | number | undefined>,
    Omit<QueryOptions<TResponse, TQueryParams>, 'queryParams' | 'onLoad' | 'enabled'>
  >(pathParams, options)

  const { axiosOptions, errorHandler, ...useQueryOptions } = (options || {}) as Omit<
    QueryOptions<TResponse, TQueryParams>,
    'queryParams' | 'onLoad' | 'enabled'
  >

  // Use shared path/key resolution
  const {
    resolvedPath,
    isResolved,
    pathParams: resolvedPathParams,
    queryKey,
  } = useResolvedOperation(
    config.path,
    resolvedPathParamsInput,
    undefined, // no queryParams at hook level for lazy queries
  )

  // Underlying query for reactive state only — never auto-fires
  const query = useEndpointQuery<TResponse, TPathParams, TQueryParams>(config, pathParams, {
    ...options,
    enabled: false,
    staleTime: useQueryOptions?.staleTime ?? Infinity,
  })

  const fetch = async (fetchOptions?: LazyQueryFetchOptions<TQueryParams>): Promise<TResponse> => {
    if (!isResolved.value) {
      throw new Error(
        `Cannot fetch '${config.path}': path parameters not resolved. ` + `Resolved path: '${resolvedPath.value}'`,
      )
    }

    const qParams = fetchOptions?.queryParams
    const fetchQueryKey: (string | TQueryParams)[] =
      qParams && Object.keys(qParams).length > 0
        ? [...generateQueryKey(resolvedPath.value), qParams]
        : generateQueryKey(resolvedPath.value)

    return (config.queryClient as QueryClient).fetchQuery({
      queryKey: fetchQueryKey,
      queryFn: buildQueryFn<TResponse>(
        config,
        () => resolvedPath.value,
        () => (qParams ?? {}) as Record<string, unknown>,
        axiosOptions,
        fetchOptions?.axiosOptions,
        errorHandler,
      ),
      staleTime: useQueryOptions?.staleTime ?? Infinity,
    })
  }

  return {
    data: query.data,
    isPending: query.isPending,
    isSuccess: query.isSuccess,
    isError: query.isError,
    error: query.error,
    isEnabled: query.isEnabled,
    pathParams: resolvedPathParams as ComputedRef<TPathParams>,
    queryKey: queryKey as ComputedRef<string[]>,
    fetch,
  }
}
