import type { MaybeRefOrGetter } from 'vue'
import { QueryClient } from '@tanstack/vue-query'

import { useEndpoint } from './openapi-endpoint'
import { EndpointQueryReturn, useEndpointQuery } from './openapi-query'
import { EndpointMutationReturn, useEndpointMutation } from './openapi-mutation'
import {
  Operations,
  GetPathParameters,
  OpenApiConfig,
  QQueryOptions,
  QMutationOptions,
  IsQueryOperation,
} from './types'
import { getHelpers } from './openapi-helpers'
export type { OpenApiConfig, OpenApiInstance } from './types'
export { type EndpointQueryReturn, useEndpointQuery } from './openapi-query'
export { type EndpointMutationReturn, useEndpointMutation } from './openapi-mutation'

/**
 * Default QueryClient instance with pre-configured options.
 *
 * This client is used by default when no custom QueryClient is provided to useOpenApi.
 * It includes sensible defaults like 5-minute stale time for queries.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5 },
  },
})

/**
 * Creates a type-safe OpenAPI client for Vue applications.
 *
 * This is the main entry point for the library. It provides reactive composables
 * for API operations with full TypeScript type safety based on your OpenAPI specification.
 *
 * @template Ops - The operations type, typically generated from your OpenAPI spec
 * @param config - Configuration object containing operations metadata and axios instance
 * @returns API instance with useQuery, useMutation, useEndpoint, and debug methods
 *
 * @example
 * ```typescript
 * import { useOpenApi } from '@qualisero/openapi-endpoint'
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
     * Debug utility to inspect operation metadata.
     *
     * @param operationId - The operation ID to debug
     * @returns Information about whether the operation is a query operation
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
      pathParamsOrOptions?: GetPathParameters<Ops, Op> extends Record<string, never>
        ? QQueryOptions<Ops, Op>
        : MaybeRefOrGetter<GetPathParameters<Ops, Op> | null | undefined> | QQueryOptions<Ops, Op>,
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
      pathParamsOrOptions?: GetPathParameters<Ops, Op> extends Record<string, never>
        ? QMutationOptions<Ops, Op>
        : MaybeRefOrGetter<GetPathParameters<Ops, Op> | null | undefined> | QMutationOptions<Ops, Op>,
      optionsOrNull?: QMutationOptions<Ops, Op>,
    ) {
      const helpers = getHelpers<Ops, Op>(config)

      return useEndpointMutation<Ops, Op>(operationId, helpers, pathParamsOrOptions, optionsOrNull)
    },

    /**
     * Generic endpoint composable that automatically detects operation type.
     *
     * This is a universal composable that returns either a query or mutation based
     * on the operation's HTTP method. Use this when you want unified handling.
     *
     * @template Op - The operation key from your operations type
     * @param operationId - Any operation ID
     * @param pathParamsOrOptions - Path parameters or operation options
     * @param optionsOrNull - Additional options when path params are provided
     * @returns Query result for GET operations, mutation result for others
     *
     * @example
     * ```typescript
     * // Automatically becomes a query for GET operations
     * const listEndpoint = api.useEndpoint(OperationId.listPets)
     *
     * // Automatically becomes a mutation for POST operations
     * const createEndpoint = api.useEndpoint(OperationId.createPet)
     *
     * // TypeScript knows the correct return type based on the operation
     * const data = listEndpoint.data // Query data
     * await createEndpoint.mutateAsync({ data: petData }) // Mutation execution
     * ```
     */
    useEndpoint: function <Op extends keyof Ops>(
      operationId: Op,
      pathParamsOrOptions?: GetPathParameters<Ops, Op> extends Record<string, never>
        ? IsQueryOperation<Ops, Op> extends true
          ? QQueryOptions<Ops, Op>
          : QMutationOptions<Ops, Op>
        :
            | MaybeRefOrGetter<GetPathParameters<Ops, Op> | null | undefined>
            | (IsQueryOperation<Ops, Op> extends true ? QQueryOptions<Ops, Op> : QMutationOptions<Ops, Op>),
      optionsOrNull?: IsQueryOperation<Ops, Op> extends true ? QQueryOptions<Ops, Op> : QMutationOptions<Ops, Op>,
    ): IsQueryOperation<Ops, Op> extends true ? EndpointQueryReturn<Ops, Op> : EndpointMutationReturn<Ops, Op> {
      const helpers = getHelpers<Ops, Op>(config)

      return useEndpoint<Ops, Op>(operationId, helpers, pathParamsOrOptions, optionsOrNull)
    },
  }
}
