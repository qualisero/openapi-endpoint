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
  ApiResponseSafe,
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
 * Create a type-safe OpenAPI client with Vue Query integration.
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
 * import { openApiOperations, type OpenApiOperations, OperationId } from './generated/api-operations'
 * import axios from 'axios'
 *
 * const api = useOpenApi<OpenApiOperations>({
 *   operations: openApiOperations,
 *   axios: axios.create({ baseURL: 'https://api.example.com' })
 * })
 *
 * // Queries
 * const listQuery = api.useQuery(OperationId.listPets, {
 *   queryParams: { limit: 10 }
 * })
 *
 * // Mutations
 * const createPet = api.useMutation(OperationId.createPet)
 * createPet.mutate({ data: { name: 'Fluffy' } })
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
     * const isQuery: true = api._debugIsQueryOperation(OperationId.getPet)
     * const isMutation: false = api._debugIsQueryOperation(OperationId.createPet)
     *
     * // Also logs operation info to console for runtime inspection
     * api._debugIsQueryOperation(OperationId.getPet) // logs: { path: '/pets/{petId}', method: 'GET' }
     * ```
     */
    _debugIsQueryOperation: function <Op extends keyof Ops>(operationId: Op) {
      const helpers = getHelpers<Ops, Op>(config)
      const info = helpers.getOperationInfo(operationId)
      console.log('Operation Info:', info)
      return {} as IsQueryOperation<Ops, Op>
    },

    /**
     * Execute a type-safe query (GET/HEAD/OPTIONS) with automatic caching.
     *
     * @template Op - The operation key from your operations type
     * @param operationId - Operation ID (must be a GET/HEAD/OPTIONS operation)
     * @param pathParamsOrOptions - Path params or query options:
     *   - If the operation has path params, provide them here (can be reactive)
     *   - If the operation has no path params, pass query options here instead
     * @param optionsOrNull - Query options when path params are provided separately:
     *   - `enabled`: Whether the query should auto-run (boolean or reactive)
     *   - `queryParams`: Query string parameters (operation-specific)
     *   - `onLoad`: Callback invoked when data loads
     *   - `axiosOptions`: Custom axios request options
     *   - Plus all {@link UseQueryOptions} from @tanstack/vue-query
     * @returns Reactive query result with helpers:
     *   - `data`, `isPending`, `isSuccess`, `error`, `refetch()`
     *   - `isEnabled`, `queryKey`, `onLoad(callback)`
     * @throws Error if the operation is not a query operation
     *
     * @example
     * ```typescript
     * // Simple list query
     * const listQuery = api.useQuery(OperationId.listPets, {
     *   queryParams: { limit: 10 }
     * })
     *
     * // Query with path parameters
     * const petId = ref('123')
     * const petQuery = api.useQuery(
     *   OperationId.getPet,
     *   computed(() => ({ petId: petId.value })),
     *   { enabled: computed(() => petId.value !== '') }
     * )
     *
     * // Manual refetch
     * await listQuery.refetch()
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
     * Execute a type-safe mutation (POST/PUT/PATCH/DELETE) with cache updates.
     *
     * @template Op - The operation key from your operations type
     * @param operationId - Operation ID (must be a POST/PUT/PATCH/DELETE operation)
     * @param pathParamsOrOptions - Path params or mutation options:
     *   - If the operation has path params, provide them here (can be reactive)
     *   - If the operation has no path params, pass mutation options here instead
     * @param optionsOrNull - Mutation options when path params are provided separately:
     *   - `dontUpdateCache`: Skip cache update for PUT/PATCH responses
     *   - `dontInvalidate`: Skip invalidating matching queries
     *   - `invalidateOperations`: Additional operations to invalidate (array or map)
     *   - `refetchEndpoints`: Additional query results to refetch
     *   - `queryParams`: Query string parameters (operation-specific)
     *   - `axiosOptions`: Custom axios request options
     *   - Plus all {@link UseMutationOptions} from @tanstack/vue-query
     * @returns Reactive mutation result with helpers:
     *   - `mutate(vars)` / `mutateAsync(vars)`
     *   - `data`, `isPending`, `isSuccess`, `error`
     *   - `isEnabled`, `extraPathParams`, `pathParams`
     * @throws Error if the operation is not a mutation operation
     *
     * @example
     * ```typescript
     * const createPet = api.useMutation(OperationId.createPet)
     * await createPet.mutateAsync({ data: { name: 'Fluffy' } })
     *
     * const updatePet = api.useMutation(OperationId.updatePet, { petId: '123' })
     * updatePet.mutate({ data: { name: 'Updated' } })
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
