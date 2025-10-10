import { type MaybeRefOrGetter } from 'vue'
import { EndpointQueryReturn, useEndpointQuery } from './openapi-query'
import { EndpointMutationReturn, useEndpointMutation } from './openapi-mutation'
import type {
  // IsQueryOperation,
  GetPathParameters,
  QueryOptions,
  MutationOptions,
  Operations,
  IsQueryOperation,
} from './types'
import { getHelpers } from './openapi-helpers'

// NOTE: rather than using conditional overloads, we are adjusting the signature in the calling code based on IsQueryOperation
// Conditional overload: if operation is a query, use QueryOptions and return QueryReturn
// export function useEndpoint<Ops extends Operations<Ops>, Op extends keyof Ops>(
//   config: OpenApiConfig<Ops>,
//   operationId: IsQueryOperation<Ops, Op> extends true ? Op : never,
//   pathParamsOrOptions?: MaybeRefOrGetter<GetPathParameters<Ops, Op> | null | undefined> | QueryOptions<Ops, Op>,
//   optionsOrNull?: QueryOptions<Ops, Op>
// ): EndpointQueryReturn<Ops, Op>

// // Conditional overload: if operation is a mutation, use MutationOptions and return MutationReturn
// export function useEndpoint<Ops extends Operations<Ops>, Op extends keyof Ops>(
//   config: OpenApiConfig<Ops>,
//   operationId: IsQueryOperation<Ops, Op> extends false ? Op : never,
//   pathParamsOrOptions?: MaybeRefOrGetter<GetPathParameters<Ops, Op> | null | undefined> | MutationOptions<Ops, Op>,
//   optionsOrNull?: MutationOptions<Ops, Op>
// ): EndpointMutationReturn<Ops, Op>

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
  helpers: ReturnType<typeof getHelpers<Ops, Op>>,
  pathParamsOrOptions?:
    | MaybeRefOrGetter<GetPathParameters<Ops, Op> | null | undefined>
    | (IsQueryOperation<Ops, Op> extends true ? QueryOptions<Ops, Op> : MutationOptions<Ops, Op>),
  optionsOrNull: IsQueryOperation<Ops, Op> extends true ? QueryOptions<Ops, Op> : MutationOptions<Ops, Op> = {},
): IsQueryOperation<Ops, Op> extends true ? EndpointQueryReturn<Ops, Op> : EndpointMutationReturn<Ops, Op> {
  if (helpers.isMutationOperation(operationId)) {
    return useEndpointMutation<Ops, Op>(
      operationId,
      helpers,
      pathParamsOrOptions,
      optionsOrNull as MutationOptions<Ops, Op>,
    ) as IsQueryOperation<Ops, Op> extends true ? EndpointQueryReturn<Ops, Op> : EndpointMutationReturn<Ops, Op>
  } else if (helpers.isQueryOperation(operationId)) {
    return useEndpointQuery<Ops, Op>(
      operationId,
      helpers,
      pathParamsOrOptions,
      optionsOrNull as QueryOptions<Ops, Op>,
    ) as IsQueryOperation<Ops, Op> extends true ? EndpointQueryReturn<Ops, Op> : EndpointMutationReturn<Ops, Op>
  } else {
    throw new Error(`Operation ${String(operationId)} is neither a query nor a mutation operation`)
  }
}
