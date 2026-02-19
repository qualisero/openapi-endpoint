// src/openapi-endpoint.ts

import type { MaybeRefOrGetter } from 'vue'
import {
  HttpMethod,
  isQueryMethod,
  isMutationMethod,
  type Operations,
  type OpenApiConfig,
  type OperationConfig,
  type OpenApiInstance,
  type QueryNamespace,
  type MutationNamespace,
  type OperationNamespace,
  type OperationQuery,
  type OperationMutation,
  type ApiPathParamsInput,
  type QQueryOptions,
  type QMutationOptions,
  type ReactiveOr,
} from './types'
import { getHelpers } from './openapi-helpers'
import { useEndpointQuery } from './openapi-query'
import { useEndpointMutation } from './openapi-mutation'

// ============================================================================
// Internal namespace builder
// ============================================================================

function buildNamespace<
  Ops extends Operations<Ops>,
  Op extends keyof Ops,
  TEnums extends Record<string, Record<string, string>>
>(
  config: OpenApiConfig<Ops>,
  operationId: Op,
  enums: TEnums,
): OperationNamespace<Ops, Op, TEnums> {
  const helpers = getHelpers<Ops, Op>(config)
  const { method, path } = helpers.getOperationInfo(operationId)
  const hasPathParams = path.includes('{')

  if (isQueryMethod(method)) {
    const useQuery: OperationQuery<Ops, Op> = hasPathParams
      ? ((pathParams: ReactiveOr<ApiPathParamsInput<Ops, Op>>, options?: QQueryOptions<Ops, Op>) =>
          useEndpointQuery(
            operationId,
            helpers,
            pathParams as MaybeRefOrGetter<ApiPathParamsInput<Ops, Op>>,
            options,
          )) as OperationQuery<Ops, Op>
      : ((options?: QQueryOptions<Ops, Op>) => useEndpointQuery(operationId, helpers, undefined, options)) as
          OperationQuery<Ops, Op>

    return { useQuery, enums } as QueryNamespace<Ops, Op, TEnums> as OperationNamespace<Ops, Op, TEnums>
  }

  const useMutation: OperationMutation<Ops, Op> = hasPathParams
    ? ((pathParams: ReactiveOr<ApiPathParamsInput<Ops, Op>>, options?: QMutationOptions<Ops, Op>) =>
        useEndpointMutation(
          operationId,
          helpers,
          pathParams as MaybeRefOrGetter<ApiPathParamsInput<Ops, Op>>,
          options,
        )) as OperationMutation<Ops, Op>
    : ((options?: QMutationOptions<Ops, Op>) => useEndpointMutation(operationId, helpers, undefined, options)) as
        OperationMutation<Ops, Op>

  return { useMutation, enums } as MutationNamespace<Ops, Op, TEnums> as OperationNamespace<Ops, Op, TEnums>
}

// ============================================================================
// Public factory
// ============================================================================

/**
 * Create a type-safe API client from your OpenAPI specification.
 *
 * Each operation in your spec becomes a property of the returned object:
 * - `GET`/`HEAD`/`OPTIONS` operations get a `useQuery` composable
 * - `POST`/`PUT`/`PATCH`/`DELETE` operations get a `useMutation` composable
 * - All operations get an `enums` object with strongly-typed enum values
 *
 * Path parameters are required as the first argument when the operation path
 * contains template segments (e.g. `/pets/{petId}`).
 *
 * @param config          Axios instance, operations map, optional query client
 * @param operationConfig Per-operation enum config from your generated `api-operations.ts`
 * @returns               Typed API instance
 *
 * @example
 * ```ts
 * import { useOpenApi } from '@qualisero/openapi-endpoint'
 * import { openApiOperations, operationConfig, type OpenApiOperations } from './generated/api-operations'
 * import axios from 'axios'
 *
 * const api = useOpenApi(
 *   { operations: openApiOperations, axios: axios.create({ baseURL: '/api' }) },
 *   operationConfig,
 * )
 *
 * // Query — no path params
 * const { data: pets } = api.listPets.useQuery({ queryParams: { limit: 10 } })
 *
 * // Query — with path params
 * const { data: pet } = api.getPet.useQuery({ petId: '123' })
 *
 * // Mutation — with strongly-typed enum
 * const create = api.createPet.useMutation()
 * create.mutate({ data: { name: 'Fluffy', status: api.createPet.enums.status.Available } })
 * ```
 */
export function useOpenApi<
  Ops extends Operations<Ops>,
  Config extends OperationConfig<Ops>
>(
  config: OpenApiConfig<Ops>,
  operationConfig: Config,
): OpenApiInstance<Ops, Config> {
  const instance = {} as OpenApiInstance<Ops, Config>

  for (const key of Object.keys(operationConfig) as Array<keyof Config & keyof Ops>) {
    ;(instance as Record<string, unknown>)[key as string] = buildNamespace(
      config,
      key as keyof Ops,
      operationConfig[key].enums,
    )
  }

  return instance
}
