import { computed, watch, toValue, type ComputedRef, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import {
  Operations,
  type GetPathParameters,
  type GetResponseData,
  type QueryOptions,
  // type OperationsConfig,
  // type OperationId,
} from './types'
import { resolvePath, generateQueryKey, isPathResolved, getParamsOptionsFrom } from './openapi-utils'
import type { AxiosError } from 'axios'
import { getHelpers } from './openapi-helpers'

// DEBUG:
// import axios from 'axios'

// Move to a module init
// import { OperationId } from '../../api/api-operations'
// import axios from '@/api/axios'

export type EndpointQueryReturn<Ops extends Operations<Ops>, Op extends keyof Ops> = ReturnType<
  typeof useEndpointQuery<Ops, Op>
> & {
  onLoad: (callback: (data: GetResponseData<Ops, Op>) => void) => void
}

/**
 * Composable for performing a strictly typed OpenAPI query operation using Vue Query.
 * Ensures the operation is a query (GET/HEAD/OPTIONS) at runtime.
 * Returns a reactive query object, including helpers for query key, enabled state, and an `onLoad` callback.
 *
 * @template T OperationId type representing the OpenAPI operation.
 * @param operationId The OpenAPI operation ID to query.
 * @param pathParams Optional path parameters for the endpoint, can be reactive.
 * @param options Optional query options, including:
 *   - All properties from {@link UseQueryOptions} (from @tanstack/vue-query)
 *   - `enabled`: Whether the query should automatically run (boolean or reactive).
 *   - `onLoad`: Callback invoked once when data is loaded (immediately or after fetch).
 *   - `axiosOptions`: Custom axios request options (e.g., headers, params).
 * @throws Error if the operation is not a query operation.
 * @returns Query object with strict typing and helpers:
 *   - `data`: ComputedRef of response data.
 *   - `isEnabled`: ComputedRef indicating if query is enabled.
 *   - `queryKey`: ComputedRef of the query key.
 *   - `onLoad`: Method to register a callback for when data is loaded.
 */
export function useEndpointQuery<Ops extends Operations<Ops>, Op extends keyof Ops>(
  operationId: Op,
  h: ReturnType<typeof getHelpers<Ops, Op>>,
  pathParamsOrOptions?: MaybeRefOrGetter<GetPathParameters<Ops, Op> | null | undefined> | QueryOptions<Ops, Op>,
  optionsOrNull?: QueryOptions<Ops, Op>,
) {
  // Runtime check to ensure this is actually a query operation
  if (!h.isQueryOperation(operationId)) {
    throw new Error(`Operation ${String(operationId)} is not a query operation (GET/HEAD/OPTIONS)`)
  }
  const { path, method } = h.getOperationInfo(operationId)
  const { pathParams, options } = getParamsOptionsFrom<Ops, Op, QueryOptions<Ops, Op>>(
    pathParamsOrOptions,
    optionsOrNull,
  )
  const { enabled: enabledInit, onLoad: onLoadInit, axiosOptions, errorHandler, ...useQueryOptions } = options

  const resolvedPath = computed(() => resolvePath(path, pathParams))
  const queryKey = computed(() => generateQueryKey(resolvedPath.value))

  // Check if path is fully resolved for enabling the query
  const isEnabled = computed(() => {
    // can be explicitly disabled via options
    const baseEnabled = enabledInit !== undefined ? toValue(enabledInit) : true
    return baseEnabled && isPathResolved(resolvedPath.value)
  })

  const query = useQuery(
    {
      queryKey: queryKey,
      queryFn: async (): Promise<GetResponseData<Ops, Op>> => {
        try {
          const response = await h.axios({
            method: method.toLowerCase(),
            url: resolvedPath.value,
            ...(axiosOptions || {}),
          })
          return response.data
        } catch (error) {
          if (errorHandler) {
            await errorHandler(error as Error)
          }
          throw error
        }
      },
      enabled: isEnabled,
      staleTime: 1000 * 60,
      retry: (failureCount, error: AxiosError) => {
        // Don't retry 4xx errors
        if (error.response && error.response.status >= 400 && error.response.status < 500) {
          return false
        }
        // Retry up to 3 times for other errors
        return failureCount < 3
      },

      ...useQueryOptions,
    },
    h.queryClient,
  )

  // onLoad callback is called once, as soon as data is available (immediately or when loading finishes)
  // Shared onLoad handler setup
  const setupOnLoadHandler = (callback: (data: GetResponseData<Ops, Op>) => void) => {
    // If data is already available, call immediately
    if (query.data.value !== undefined) {
      callback(query.data.value)
    } else {
      // Watch for data to become available
      let hasLoaded = false
      const stopWatch = watch(query.data, (newData) => {
        if (newData !== undefined && !hasLoaded) {
          hasLoaded = true
          callback(newData)
          stopWatch() // Stop watching after first load
        }
      })
    }
  }

  // Handle onLoad callback from options
  if (onLoadInit) {
    setupOnLoadHandler(onLoadInit)
  }

  // Create onLoad method
  const onLoad = (callback: (data: GetResponseData<Ops, Op>) => void) => {
    setupOnLoadHandler(callback)
  }

  return {
    ...query,
    data: query.data as ComputedRef<GetResponseData<Ops, Op> | undefined>,
    isEnabled,
    queryKey,
    onLoad,
  }
}
