// ============================================================================
// Core primitives (called by generated api-client.ts)
// ============================================================================
export { useEndpointQuery, useEndpointLazyQuery } from './openapi-query'
export { useEndpointMutation } from './openapi-mutation'
export { defaultQueryClient } from './openapi-helpers'
export { createApiErrorCaches, ERROR_POLICY_META_KEY } from './error-policy'

// ============================================================================
// Return types (used in component / composable signatures)
// ============================================================================
export type { QueryReturn, LazyQueryReturn } from './openapi-query'
export type { MutationReturn } from './openapi-mutation'

// ============================================================================
// Option types (used in component / composable signatures)
// ============================================================================
export type {
  // Endpoint config (used in generated api-client.ts)
  EndpointConfig,

  // Options
  QueryOptions,
  LazyQueryFetchOptions,
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
  ApiResponseStrict,
  ApiRequest,
  ApiPathParams,
  ApiPathParamsInput,
  ApiQueryParams,
  ApiErrorOf,
  ApiErrorData,

  // Direction vocabulary — usable directly by consumers

  /**
   * Deep-require all fields of `T`, recursing into nested objects and arrays.
   *
   * **Direction: response presence policy.**
   * Asserts that the API serialises every documented field (transitional
   * approximation; collapses once specs carry dump-direction `required`).
   *
   * @see {@link Writable} — strips `readOnly` props for request types
   * @see {@link Mutable}  — strips `readonly` modifiers for mutable store shapes
   */
  RequireAll,

  /**
   * Deep-strip properties whose `readonly` modifier originates from an OpenAPI
   * `readOnly: true` marker, recursing into nested objects and arrays.
   *
   * **Direction: response shape → request shape.**
   * Excludes server-assigned fields (`id`, `createdAt`, …) at every nesting
   * level so generated `Request` types are always write-safe.
   *
   * @see {@link Mutable}    — strips the `readonly` modifier without removing keys
   * @see {@link RequireAll} — response presence policy
   */
  Writable,

  /**
   * Deep-strip all TypeScript `readonly` modifiers from `T`, recursing into
   * nested objects and arrays (including `readonly` arrays).
   *
   * **Direction: response shape → mutable store shape.**
   * Keeps all properties; only removes the `readonly` modifier so response
   * types can be stored in Vue `ref`/`reactive` or Pinia state without
   * TypeScript mutation errors.
   *
   * @see {@link Writable}    — excludes `readOnly` keys for request types
   * @see {@link RequireAll}  — response presence policy
   */
  Mutable,
} from './types'

// ============================================================================
// Error policy types
// ============================================================================
export type { ApiErrorContext, ApiErrorPolicy, ApiErrorPolicyOptions } from './types'

// ============================================================================
// HTTP method utilities
// ============================================================================
export { HttpMethod, QUERY_METHODS, MUTATION_METHODS, isQueryMethod, isMutationMethod } from './types'

// ============================================================================
// URL building utilities
// ============================================================================
export { buildUrl } from './openapi-utils'

// ============================================================================
// Value schema types and runtime helpers
// ============================================================================
export type { ValueSchema, ValueSchemaObject, SchemaDefs, SchemaField } from './value-schemas'
export { resolveSchema, fieldsOf } from './value-schemas'

// ============================================================================
// Re-export Vue types (ensures consumer's version is used)
// ============================================================================
export type { Ref, ComputedRef, ShallowRef } from 'vue'
export type { MaybeRefOrGetter } from '@vue/reactivity'
