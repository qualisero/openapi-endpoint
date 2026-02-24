// ============================================================================
// Core primitives (called by generated api-client.ts)
// ============================================================================
export { useEndpointQuery } from './openapi-query'
export { useEndpointMutation } from './openapi-mutation'
export { defaultQueryClient } from './openapi-helpers'

// ============================================================================
// Return types (used in component / composable signatures)
// ============================================================================
export type { QueryReturn } from './openapi-query'
export type { MutationReturn } from './openapi-mutation'

// ============================================================================
// Option types (used in component / composable signatures)
// ============================================================================
export type {
  // Endpoint config (used in generated api-client.ts)
  EndpointConfig,

  // Options
  QueryOptions,
  MutationOptions,
  MutationVars,

  // Cache invalidation
  CacheInvalidationOptions,
  Refetchable,

  // Mutate function signatures
  MutateFn,
  MutateAsyncFn,
  MutateAsyncReturn,

  // Reactive helpers
  ReactiveOr,
  NoExcessReturn,

  // Axios
  AxiosRequestConfigExtended,

  // Type extraction utilities (used in generated api-operations.ts / api-client.ts)
  ApiResponse,
  ApiResponseSafe,
  ApiRequest,
  ApiPathParams,
  ApiPathParamsInput,
  ApiQueryParams,
} from './types'

// ============================================================================
// HTTP method utilities
// ============================================================================
export { HttpMethod, QUERY_METHODS, MUTATION_METHODS, isQueryMethod, isMutationMethod } from './types'

// ============================================================================
// Re-export Vue types (ensures consumer's version is used)
// ============================================================================
export type { Ref, ComputedRef } from 'vue'
export type { MaybeRefOrGetter } from '@vue/reactivity'
