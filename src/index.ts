import type { MaybeRefOrGetter } from 'vue'

import { EndpointQueryReturn, useEndpointQuery } from './openapi-query'
import { type EndpointMutationReturn, useEndpointMutation } from './openapi-mutation'
import {
  Operations,
  ApiPathParams,
  OpenApiConfig,
  OpenApiInstance,
  QQueryOptions,
  QMutationOptions,
  NoPathParams,
  WithPathParams,
  HasExcessPathParams,
} from './types'
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
  QMutationVars,
  CacheInvalidationOptions,
  EndpointQueryReturn,
  EndpointMutationReturn,
  RequiresPathParameters,
  HasExcessPathParams,
  NoPathParams,
  WithPathParams,
  AxiosRequestConfigExtended,
  ReactiveOr,
  MutateFn,
  MutateAsyncFn,
  MutateAsyncReturn,
} from './types'

// Public function exports
export { validateMutationParams } from './types'

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
 * import { openApiOperations, type OpenApiOperations, QueryOperationId, MutationOperationId } from './generated/api-operations'
 * import axios from 'axios'
 *
 * const api = useOpenApi<OpenApiOperations>({
 *   operations: openApiOperations,
 *   axios: axios.create({ baseURL: 'https://api.example.com' })
 * })
 *
 * // Queries
 * const listQuery = api.useQuery(QueryOperationId.listPets, {
 *   queryParams: { limit: 10 }
 * })
 *
 * // Mutations
 * const createPet = api.useMutation(MutationOperationId.createPet)
 * createPet.mutate({ data: { name: 'Fluffy' } })
 * ```
 */
export function useOpenApi<Ops extends Operations<Ops>>(config: OpenApiConfig<Ops>): OpenApiInstance<Ops> {
  /**
   * Execute a type-safe query (GET/HEAD/OPTIONS) with automatic caching.
   *
   * TypeScript automatically determines which signature applies based on whether
   * the operation requires path parameters (e.g., /pets/{petId}).
   *
   * @template Op - The operation key from your operations type
   *
   * @overload
   * @param {Op} operationId - Query operation without path parameters
   * @param {QQueryOptions<Ops, Op>} options - Query options (enabled, staleTime, queryParams, etc.)
   * @returns {EndpointQueryReturn<Ops, Op>} Reactive query result
   *
   * @overload
   * @param {Op} operationId - Query operation with path parameters
   * @param {MaybeRefOrGetter<ApiPathParams<Ops, Op>>} pathParams - Path parameters (required for operations with path params)
   * @param {QQueryOptions<Ops, Op>} options - Query options (optional)
   * @returns {EndpointQueryReturn<Ops, Op>} Reactive query result
   *
   * @remarks
   * If you see an error "not assignable to parameter of type 'never'", it means
   * the operation requires path parameters. Check the operation's path definition
   * (e.g., /pets/{petId}) and provide the required path params as the second argument.
   *
   * @example
   * // Without path params - pass options directly
   * const listQuery = api.useQuery(QueryOperationId.listPets, {
   *   queryParams: { limit: 10 }
   * })
   *
   * // With path params - provide pathParams as second argument
   * const petId = ref('123')
   * const petQuery = api.useQuery(
   *   QueryOperationId.getPet,
   *   () => ({ petId: petId.value }),  // Required for /pets/{petId}
   *   { enabled: computed(() => petId.value !== '') }
   * )
   */
  function useQuery<Op extends keyof Ops>(
    operationId: NoPathParams<Ops, Op>,
    options?: QQueryOptions<Ops, Op>,
  ): EndpointQueryReturn<Ops, Op>
  function useQuery<Op extends keyof Ops>(
    operationId: WithPathParams<Ops, Op>,
    pathParams: ApiPathParams<Ops, Op>,
    options?: QQueryOptions<Ops, Op>,
  ): EndpointQueryReturn<Ops, Op>
  function useQuery<Op extends keyof Ops, PathParams extends ApiPathParams<Ops, Op>>(
    operationId: WithPathParams<Ops, Op>,
    pathParams: () => (PathParams & (HasExcessPathParams<PathParams, ApiPathParams<Ops, Op>> extends true ? PathParams : never)),
    options?: QQueryOptions<Ops, Op>,
  ): EndpointQueryReturn<Ops, Op>
  function useQuery<Op extends keyof Ops>(
    operationId: Op,
    pathParamsOrOptions?: MaybeRefOrGetter<ApiPathParams<Ops, Op> | null | undefined> | QQueryOptions<Ops, Op>,
    optionsOrNull?: QQueryOptions<Ops, Op>,
  ): EndpointQueryReturn<Ops, Op> {
    const helpers = getHelpers<Ops, Op>(config)

    return useEndpointQuery<Ops, Op>(operationId, helpers, pathParamsOrOptions, optionsOrNull)
  }

  /**
   * Execute a type-safe mutation (POST/PUT/PATCH/DELETE) with cache updates.
   *
   * TypeScript automatically determines which signature applies based on whether
   * the operation requires path parameters (e.g., /pets/{petId}).
   *
   * @template Op - The operation key from your operations type
   *
   * @overload
   * @param {Op} operationId - Mutation operation without path parameters
   * @param {QMutationOptions<Ops, Op>} options - Mutation options (dontInvalidate, refetchEndpoints, etc.)
   * @returns {EndpointMutationReturn<Ops, Op>} Reactive mutation result
   *
   * @overload
   * @param {Op} operationId - Mutation operation with path parameters
   * @param {MaybeRefOrGetter<ApiPathParams<Ops, Op>>} pathParams - Path parameters (required for operations with path params)
   * @param {QMutationOptions<Ops, Op>} options - Mutation options (optional)
   * @returns {EndpointMutationReturn<Ops, Op>} Reactive mutation result
   *
   * @remarks
   * If you see an error "not assignable to parameter of type 'never'", it means
   * the operation requires path parameters. Check the operation's path definition
   * (e.g., /pets/{petId}) and provide the required path params as the second argument.
   *
   * @example
   * // Without path params - pass options directly
   * const createPet = api.useMutation(MutationOperationId.createPet, {
   *   onSuccess: () => console.log('Created!')
   * })
   * await createPet.mutateAsync({ data: { name: 'Fluffy' } })
   *
   * // With path params - provide pathParams as second argument
   * const updatePet = api.useMutation(
   *   MutationOperationId.updatePet,
   *   { petId: '123' }  // Required for /pets/{petId}
   * )
   * updatePet.mutate({ data: { name: 'Updated' } })
   */
  function useMutation<Op extends keyof Ops>(
    operationId: NoPathParams<Ops, Op>,
    options?: QMutationOptions<Ops, Op>,
  ): EndpointMutationReturn<Ops, Op>
  function useMutation<Op extends keyof Ops>(
    operationId: WithPathParams<Ops, Op>,
    pathParams: ApiPathParams<Ops, Op>,
    options?: QMutationOptions<Ops, Op>,
  ): EndpointMutationReturn<Ops, Op>
  function useMutation<Op extends keyof Ops, PathParams extends ApiPathParams<Ops, Op>>(
    operationId: WithPathParams<Ops, Op>,
    pathParams: () => (PathParams & (HasExcessPathParams<PathParams, ApiPathParams<Ops, Op>> extends true ? PathParams : never)),
    options?: QMutationOptions<Ops, Op>,
  ): EndpointMutationReturn<Ops, Op>
  function useMutation<Op extends keyof Ops>(
    operationId: Op,
    pathParamsOrOptions?: MaybeRefOrGetter<ApiPathParams<Ops, Op> | null | undefined> | QMutationOptions<Ops, Op>,
    optionsOrNull?: QMutationOptions<Ops, Op>,
  ): EndpointMutationReturn<Ops, Op> {
    const helpers = getHelpers<Ops, Op>(config)

    return useEndpointMutation<Ops, Op>(operationId, helpers, pathParamsOrOptions, optionsOrNull)
  }

  return { useQuery, useMutation }
}
