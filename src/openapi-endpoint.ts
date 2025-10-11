import { type MaybeRefOrGetter } from 'vue'
import { EndpointQueryReturn, useEndpointQuery } from './openapi-query'
import { EndpointMutationReturn, useEndpointMutation } from './openapi-mutation'
import type { GetPathParameters, QQueryOptions, QMutationOptions, Operations, IsQueryOperation } from './types'
import { type OpenApiHelpers } from './openapi-helpers'

/**
 * Composable for performing a strictly typed OpenAPI operation (query or mutation) using Vue Query.
 * Automatically detects whether the operation is a query or mutation and delegates to the appropriate composable.
 * Returns a reactive query or mutation object with strict typing and helpers.
 *
 * @template T OperationId type representing the OpenAPI operation.
 * @param operationId The OpenAPI operation ID to execute.
 * @param pathParamsOrOptions Optional path parameters for the endpoint, can be reactive.
 * @param optionsOrNull Optional query or mutation options, including Vue Query options.
 * @returns Query or mutation object with strict typing and helpers.
 */
export function useEndpoint<Ops extends Operations<Ops>, Op extends keyof Ops>(
  operationId: Op,
  helpers: OpenApiHelpers<Ops, Op>,
  pathParamsOrOptions?:
    | MaybeRefOrGetter<GetPathParameters<Ops, Op> | null | undefined>
    | (IsQueryOperation<Ops, Op> extends true ? QQueryOptions<Ops, Op> : QMutationOptions<Ops, Op>),
  optionsOrNull?: IsQueryOperation<Ops, Op> extends true ? QQueryOptions<Ops, Op> : QMutationOptions<Ops, Op>,
): IsQueryOperation<Ops, Op> extends true ? EndpointQueryReturn<Ops, Op> : EndpointMutationReturn<Ops, Op> {
  type ReturnType =
    IsQueryOperation<Ops, Op> extends true ? EndpointQueryReturn<Ops, Op> : EndpointMutationReturn<Ops, Op>

  if (helpers.isMutationOperation(operationId)) {
    return useEndpointMutation<Ops, Op>(
      operationId,
      helpers,
      pathParamsOrOptions as
        | MaybeRefOrGetter<GetPathParameters<Ops, Op> | null | undefined>
        | QMutationOptions<Ops, Op>,
      optionsOrNull as QMutationOptions<Ops, Op>,
    ) as ReturnType
  } else if (helpers.isQueryOperation(operationId)) {
    return useEndpointQuery<Ops, Op>(
      operationId,
      helpers,
      pathParamsOrOptions as MaybeRefOrGetter<GetPathParameters<Ops, Op> | null | undefined> | QQueryOptions<Ops, Op>,
      optionsOrNull as QQueryOptions<Ops, Op>,
    ) as ReturnType
  } else {
    throw new Error(`Operation ${String(operationId)} is neither a query nor a mutation operation`)
  }
}
