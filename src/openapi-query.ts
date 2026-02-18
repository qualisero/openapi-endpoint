import { computed, watch, toValue, type ComputedRef, type MaybeRefOrGetter, type Ref } from 'vue'
import { useQuery, QueryClient } from '@tanstack/vue-query'
import { Operations, type ApiPathParams, type ApiPathParamsInput, type ApiResponse, type QQueryOptions } from './types'
import { normalizeParamsOptions, useResolvedOperation } from './openapi-utils'
import { isAxiosError } from 'axios'
import { type OpenApiHelpers } from './openapi-helpers'

/**
 * Return type of `useQuery` (created via `useOpenApi`).
 *
 * Reactive query result with automatic caching, error handling, and helpers.
 *
 * All properties are reactive (ComputedRef) and auto-unwrap in Vue templates.
 *
 * @template Ops - The operations type from your OpenAPI specification
 * @template Op - The operation key from your operations type
 *
 * @example
 * ```typescript
 * const query = api.useQuery('listPets', { queryParams: { limit: 10 } })
 *
 * // Reactive properties
 * if (query.isPending.value) console.log('Loading...')
 * if (query.isError.value) console.log('Error:', query.error.value)
 * if (query.isSuccess.value) console.log('Data:', query.data.value)
 *
 * // Helpers
 * query.refetch()  // Manual refetch
 * query.onLoad((data) => console.log('First load:', data))
 * ```
 *
 * @group Types
 */
export interface EndpointQueryReturn<Ops extends Operations<Ops>, Op extends keyof Ops> {
  /** The response data (undefined until loaded). */
  data: ComputedRef<ApiResponse<Ops, Op> | undefined>

  /** The error if the query failed. */
  error: Ref<Error | null>

  /** True while the query is loading. */
  isPending: Ref<boolean>

  /** True while loading (same as isPending, for compatibility). */
  isLoading: Ref<boolean>

  /** True when the query succeeded. */
  isSuccess: Ref<boolean>

  /** True when the query failed. */
  isError: Ref<boolean>

  /** Manually trigger a refetch. */
  refetch: () => Promise<void>

  /** Whether the query is currently enabled. */
  isEnabled: ComputedRef<boolean>

  /** The resolved query key for manual cache access. */
  queryKey: ComputedRef<string[] | (string | unknown)[]>

  /** The resolved path parameters. */
  pathParams: ComputedRef<ApiPathParams<Ops, Op>>

  /** Register a callback for when data loads successfully for the first time. */
  onLoad: (callback: (data: ApiResponse<Ops, Op>) => void) => void
}

/**
 * Execute a type-safe query (GET/HEAD/OPTIONS) with automatic caching.
 *
 * Ensures the operation is a query at runtime and returns a reactive query object,
 * including helpers for query key, enabled state, and an `onLoad` callback.
 *
 * @template Ops - The operations type from your OpenAPI specification
 * @template Op - The operation key from your operations type
 * @param operationId - The OpenAPI operation ID to query
 * @param h - OpenAPI helpers (internal), provided by useOpenApi
 * @param pathParams - Path parameters (can be reactive). Omit for operations without path params.
 * @param options - Query options (enabled, staleTime, queryParams, etc.)
 *   - `enabled`: Whether the query should auto-run (boolean or reactive)
 *   - `queryParams`: Query string parameters (operation-specific)
 *   - `onLoad`: Callback invoked once when data is loaded
 *   - `axiosOptions`: Custom axios request options (headers, params, etc.)
 *   - Plus all {@link UseQueryOptions} from @tanstack/vue-query
 * @throws Error if the operation is not a query operation
 * @returns Query object with strict typing and helpers:
 *   - `data`: ComputedRef of response data
 *   - `isEnabled`: ComputedRef indicating if query is enabled
 *   - `queryKey`: ComputedRef of the query key
 *   - `onLoad(callback)`: Register a callback for when data is loaded
 */
export function useEndpointQuery<Ops extends Operations<Ops>, Op extends keyof Ops>(
  operationId: Op,
  h: OpenApiHelpers<Ops, Op>,
  pathParams?: MaybeRefOrGetter<ApiPathParamsInput<Ops, Op> | null | undefined>,
  options?: QQueryOptions<Ops, Op>,
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
  const { pathParams: resolvedPathParamsInput, options: resolvedOptions } = normalizeParamsOptions<
    ApiPathParamsInput<Ops, Op>,
    QQueryOptions<Ops, Op>
  >(pathParams, options)
  const {
    enabled: enabledInit,
    onLoad: onLoadInit,
    axiosOptions,
    errorHandler,
    queryParams,
    ...useQueryOptions
  } = resolvedOptions

  // Use the consolidated operation resolver
  const {
    resolvedPath,
    queryKey,
    isResolved,
    queryParams: resolvedQueryParams,
    pathParams: resolvedPathParams,
  } = useResolvedOperation(path, resolvedPathParamsInput, queryParams)

  // Check if path is fully resolved for enabling the query
  const isEnabled = computed(() => {
    const baseEnabled = enabledInit !== undefined ? toValue(enabledInit) : true
    return baseEnabled && isResolved.value
  })

  const queryOptions = {
    queryKey: queryKey as ComputedRef<readonly unknown[]>,
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
          return undefined as unknown as ApiResponse<Ops, Op>
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
  } as unknown as Parameters<typeof useQuery>[0]

  const query = useQuery(queryOptions, h.queryClient as QueryClient)

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
        onLoadCallbacks.forEach((cb) => cb(newData as ApiResponse<Ops, Op>))
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

  // Return object spread with data wrapped as ComputedRef for Vue template unwrapping
  return {
    ...query,
    data: computed(() => query.data.value) as ComputedRef<ApiResponse<Ops, Op> | undefined>,
    isEnabled,
    queryKey,
    onLoad,
    pathParams: resolvedPathParams,
  } as unknown as EndpointQueryReturn<Ops, Op>
}
