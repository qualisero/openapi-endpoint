import { computed, watch, toValue, type ComputedRef, type Ref } from 'vue'
import type { MaybeRefOrGetter } from '@vue/reactivity'
import { useQuery } from '@tanstack/vue-query'
import { isAxiosError } from 'axios'

import { type EndpointConfig, type QueryOptions, isQueryMethod } from './types'
import { normalizeParamsOptions, useResolvedOperation } from './openapi-utils'

/**
 * Return type of `useEndpointQuery` (the `useQuery` composable on a generated namespace).
 *
 * @template TResponse   Response data type
 * @template TPathParams Path parameters type (concrete, no undefined)
 *
 * @group Types
 */
export interface QueryReturn<TResponse, TPathParams extends Record<string, unknown> = Record<string, never>> {
  /** The response data (undefined until loaded). */
  data: ComputedRef<TResponse | undefined>
  /** The error if the query failed. */
  error: Ref<Error | null>
  /** True while the query is loading. */
  isPending: Ref<boolean>
  /** True while loading (alias for isPending). */
  isLoading: Ref<boolean>
  /** True when the query succeeded. */
  isSuccess: Ref<boolean>
  /** True when the query failed. */
  isError: Ref<boolean>
  /** Manually trigger a refetch. */
  refetch: () => Promise<void>
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
    queryFn: async () => {
      try {
        const response = await config.axios({
          method: config.method.toLowerCase(),
          url: resolvedPath.value,
          ...axiosOptions,
          params: {
            ...(axiosOptions?.params || {}),
            ...(resolvedQueryParams.value || {}),
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
    },
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
