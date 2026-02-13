import { computed, watch, toValue, type ComputedRef, type MaybeRefOrGetter } from 'vue'
import { useQuery, QueryClient } from '@tanstack/vue-query'
import { Operations, type ApiPathParams, type ApiResponse, type QQueryOptions } from './types'
import { getParamsOptionsFrom, useResolvedOperation } from './openapi-utils'
import { isAxiosError } from 'axios'
import { type OpenApiHelpers } from './openapi-helpers'

/**
 * Return type of `useQuery` with all available reactive properties.
 *
 * Includes all properties from TanStack Query's UseQueryResult plus
 * helper properties provided by this library.
 *
 * @template Ops - The operations type from your OpenAPI specification
 * @template Op - The operation key from your operations type
 */
export type EndpointQueryReturn<Ops extends Operations<Ops>, Op extends keyof Ops> = ReturnType<
  typeof useEndpointQuery<Ops, Op>
> & {
  /** Register a callback for when data loads successfully. */
  onLoad: (callback: (data: ApiResponse<Ops, Op>) => void) => void
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
  h: OpenApiHelpers<Ops, Op>,
  pathParamsOrOptions?: MaybeRefOrGetter<ApiPathParams<Ops, Op> | null | undefined> | QQueryOptions<Ops, Op>,
  optionsOrNull?: QQueryOptions<Ops, Op>,
) {
  // Runtime check to ensure this is actually a query operation
  if (!h.isQueryOperation(operationId)) {
    const { method } = h.getOperationInfo(operationId)
    throw new Error(
      `Operation '${String(operationId)}' uses method ${method} and cannot be used with useQuery(). ` +
        `Use useMutation() for POST/PUT/PATCH/DELETE operations.`,
    )
  }
  const { path, method } = h.getOperationInfo(operationId)
  const { pathParams, options } = getParamsOptionsFrom<Ops, Op, QQueryOptions<Ops, Op>>(
    path,
    pathParamsOrOptions,
    optionsOrNull,
  )
  const {
    enabled: enabledInit,
    onLoad: onLoadInit,
    axiosOptions,
    errorHandler,
    queryParams,
    ...useQueryOptions
  } = options

  // Use the consolidated operation resolver
  const {
    resolvedPath,
    queryKey,
    isResolved,
    queryParams: resolvedQueryParams,
    pathParams: resolvedPathParams,
  } = useResolvedOperation(path, pathParams, queryParams)

  // Check if path is fully resolved for enabling the query
  const isEnabled = computed(() => {
    const baseEnabled = enabledInit !== undefined ? toValue(enabledInit) : true
    return baseEnabled && isResolved.value
  })

  const query = useQuery(
    {
      queryKey,
      queryFn: async () => {
        try {
          const response = await h.axios({
            method: method.toLowerCase(),
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
            if (result !== undefined) {
              return result
            }
            // If errorHandler returns undefined and doesn't throw,
            // we consider this a "recovered" state and return undefined
            // TanStack Query will handle this as a successful query with no data
            return undefined as ApiResponse<Ops, Op>
          } else {
            throw error
          }
        }
      },
      enabled: isEnabled,
      staleTime: 1000 * 60,
      retry: (_failureCount: number, error: Error) => {
        // Don't retry 4xx errors if error is AxiosError
        if (isAxiosError(error) && error.response && error.response.status >= 400 && error.response.status < 500) {
          return false
        }
        // Retry up to 3 times for other errors
        return _failureCount < 3
      },
      ...useQueryOptions,
    },
    h.queryClient as QueryClient,
  )

  // onLoad callback management using a Set for efficient tracking
  const onLoadCallbacks = new Set<(data: ApiResponse<Ops, Op>) => void>()

  // Add initial callback from options if provided
  if (onLoadInit) {
    onLoadCallbacks.add(onLoadInit)
  }

  // Single watch instance to handle all callbacks
  if (query.data.value !== undefined) {
    // Data already available - call all callbacks immediately
    onLoadCallbacks.forEach((cb) => cb(query.data.value as ApiResponse<Ops, Op>))
    onLoadCallbacks.clear()
  } else {
    // Watch for data to become available
    watch(query.data, (newData) => {
      if (newData !== undefined && onLoadCallbacks.size > 0) {
        // Call all pending callbacks
        onLoadCallbacks.forEach((cb) => cb(newData))
        onLoadCallbacks.clear()
      }
    })
  }

  // Public onLoad method to register additional callbacks
  const onLoad = (callback: (data: ApiResponse<Ops, Op>) => void) => {
    if (query.data.value !== undefined) {
      // Data already available - call immediately
      callback(query.data.value as ApiResponse<Ops, Op>)
    } else {
      // Add to pending callbacks
      onLoadCallbacks.add(callback)
    }
  }

  return {
    ...query,
    data: query.data as ComputedRef<ApiResponse<Ops, Op> | undefined>,
    isEnabled,
    queryKey,
    onLoad,
    pathParams: resolvedPathParams,
  }
}
