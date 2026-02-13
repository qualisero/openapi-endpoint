import type { MaybeRefOrGetter } from 'vue'

import { EndpointQueryReturn, useEndpointQuery } from './openapi-query'
import { useEndpointMutation } from './openapi-mutation'
import { Operations, ApiPathParams, OpenApiConfig, QQueryOptions, QMutationOptions, IsQueryOperation } from './types'
import { getHelpers } from './openapi-helpers'

// Public type exports
export type {
  OpenApiConfig,
  OpenApiInstance,
  ApiResponse,
  ApiRequest,
  ApiPathParams,
  ApiQueryParams,
  QueryClientLike,
  QQueryOptions,
  QMutationOptions,
  EndpointQueryReturn,
  EndpointMutationReturn,
} from './types'

// Constants exports
export { QUERY_METHODS, MUTATION_METHODS, HttpMethod } from './types'

export { queryClient } from './openapi-helpers'
/** @internal */
export { type useEndpointQuery } from './openapi-query'
/** @internal */
export { type useEndpointMutation } from './openapi-mutation'

/**
 * Creates a type-safe OpenAPI client for Vue applications.
 *
 * This is the main entry point for the library. It provides reactive composables
 * for API operations with full TypeScript type safety based on your OpenAPI specification.
 *
 * @group Setup
 * @template Ops - The operations type, typically generated from your OpenAPI spec
 * @param config - Configuration object containing operations metadata and axios instance
 * @returns {OpenApiInstance<Ops>} API instance with useQuery, useMutation, and debug methods
 *
 * @example
 * ```typescript
 * import { useOpenApi } from '@qualisero/openapi-endpoint'
 * // See documentation on how to generate types and operations automatically:
 * import { openApiOperations, type OpenApiOperations } from './generated/api-operations'
 * import axios from 'axios'
 *
 * const api = useOpenApi<OpenApiOperations>({
 *   operations: openApiOperations,
 *   axios: axios.create({ baseURL: 'https://api.example.com' })
 * })
 *
 * // Use in components
 * const { data, isLoading } = api.useQuery('listPets', {})
 * const createPet = api.useMutation('createPet', {})
 * ```
 */
export function useOpenApi<Ops extends Operations<Ops>>(config: OpenApiConfig<Ops>) {
  return {
    /**
     * Debug utility to inspect operation metadata and verify type inference.
     *
     * This method is primarily intended for development and debugging purposes.
     * It logs operation info to the console and returns a typed empty object
     * that can be used to verify TypeScript's type inference for operations.
     *
     * @param operationId - The operation ID to inspect
     * @returns An empty object typed as `IsQueryOperation<Ops, Op>` for type checking
     *
     * @example
     * ```typescript
     * // Verify type inference at compile time
     * const isQuery: true = api._debugIsQueryOperation('getPet')
     * const isMutation: false = api._debugIsQueryOperation('createPet')
     *
     * // Also logs operation info to console for runtime inspection
     * api._debugIsQueryOperation('getPet') // logs: { path: '/pets/{petId}', method: 'GET' }
     * ```
     */
    _debugIsQueryOperation: function <Op extends keyof Ops>(operationId: Op) {
      const helpers = getHelpers<Ops, Op>(config)
      const info = helpers.getOperationInfo(operationId)
      console.log('Operation Info:', info)
      return {} as IsQueryOperation<Ops, Op>
    },

    /**
     * Creates a reactive query for GET operations.
     *
     * This composable wraps TanStack Query for read-only operations with automatic
     * type inference, caching, and reactive updates.
     *
     * @template Op - The operation key from your operations type
     * @param operationId - Operation ID (must be a GET operation)
     * @param pathParamsOrOptions - Path parameters or query options
     * @param optionsOrNull - Additional query options when path params are provided
     * @returns Reactive query result with data, loading state, error handling, etc.
     *
     * @example
     * ```typescript
     * // Query without path parameters
     * const { data: pets, isLoading } = api.useQuery(OperationId.listPets, {
     *   enabled: true,
     *   onLoad: (data) => console.log('Loaded:', data)
     * })
     *
     * // Query with path parameters
     * const { data: pet } = api.useQuery(OperationId.getPet, { petId: '123' }, {
     *   enabled: computed(() => Boolean(petId.value))
     * })
     * ```
     */
    useQuery: function <Op extends keyof Ops>(
      operationId: IsQueryOperation<Ops, Op> extends true ? Op : never,
      pathParamsOrOptions?: ApiPathParams<Ops, Op> extends Record<string, never>
        ? QQueryOptions<Ops, Op>
        : MaybeRefOrGetter<ApiPathParams<Ops, Op> | null | undefined> | QQueryOptions<Ops, Op>,
      optionsOrNull?: QQueryOptions<Ops, Op>,
    ): EndpointQueryReturn<Ops, Op> {
      const helpers = getHelpers<Ops, Op>(config)

      return useEndpointQuery<Ops, Op>(operationId, helpers, pathParamsOrOptions, optionsOrNull)
    },

    /**
     * Creates a reactive mutation for POST/PUT/PATCH/DELETE operations.
     *
     * This composable wraps TanStack Query's useMutation for data-modifying operations
     * with automatic cache invalidation and optimistic updates.
     *
     * @template Op - The operation key from your operations type
     * @param operationId - Operation ID (must be a mutation operation)
     * @param pathParamsOrOptions - Path parameters or mutation options
     * @param optionsOrNull - Additional mutation options when path params are provided
     * @returns Reactive mutation result with mutate, mutateAsync, status, etc.
     *
     * @example
     * ```typescript
     * // Mutation without path parameters
     * const createPet = api.useMutation(OperationId.createPet, {
     *   onSuccess: (data) => console.log('Created:', data),
     *   onError: (error) => console.error('Failed:', error)
     * })
     *
     * // Mutation with path parameters
     * const updatePet = api.useMutation(OperationId.updatePet, { petId: '123' }, {
     *   onSuccess: async () => {
     *     // Automatically invalidates related queries
     *   }
     * })
     *
     * // Execute the mutation
     * await createPet.mutateAsync({ data: { name: 'Fluffy' } })
     * ```
     */
    useMutation: function <Op extends keyof Ops>(
      operationId: IsQueryOperation<Ops, Op> extends false ? Op : never,
      pathParamsOrOptions?: ApiPathParams<Ops, Op> extends Record<string, never>
        ? QMutationOptions<Ops, Op>
        : MaybeRefOrGetter<ApiPathParams<Ops, Op> | null | undefined> | QMutationOptions<Ops, Op>,
      optionsOrNull?: QMutationOptions<Ops, Op>,
    ) {
      const helpers = getHelpers<Ops, Op>(config)

      return useEndpointMutation<Ops, Op>(operationId, helpers, pathParamsOrOptions, optionsOrNull)
    },
  }
}
