import type { MaybeRefOrGetter } from 'vue'
import { QueryClient } from '@tanstack/vue-query'

import { useEndpoint } from './openapi-endpoint'
import { EndpointQueryReturn, useEndpointQuery } from './openapi-query'
import { EndpointMutationReturn, useEndpointMutation } from './openapi-mutation'
import { Operations, GetPathParameters, OpenApiConfig, QueryOptions, MutationOptions, IsQueryOperation } from './types'
import { getHelpers } from './openapi-helpers'
export type { OperationInfo, QueryOptions, OpenApiConfig, OpenApiInstance } from './types'
export { type EndpointQueryReturn, useEndpointQuery } from './openapi-query'
export { type EndpointMutationReturn, useEndpointMutation } from './openapi-mutation'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5 },
  },
})

export function useOpenApi<Ops extends Operations<Ops>>(config: OpenApiConfig<Ops>) {
  return {
    useQuery: function <Op extends keyof Ops>(
      operationId: IsQueryOperation<Ops, Op> extends true ? Op : never,
      pathParamsOrOptions?: GetPathParameters<Ops, Op> extends Record<string, never>
        ? QueryOptions<Ops, Op>
        : MaybeRefOrGetter<GetPathParameters<Ops, Op> | null | undefined> | QueryOptions<Ops, Op>,
      optionsOrNull?: QueryOptions<Ops, Op>,
    ): EndpointQueryReturn<Ops, Op> {
      const helpers = getHelpers<Ops>(config)

      return useEndpointQuery<Ops, Op>(operationId, helpers, pathParamsOrOptions, optionsOrNull)
    },

    useMutation: function <Op extends keyof Ops>(
      operationId: IsQueryOperation<Ops, Op> extends false ? Op : never,
      pathParamsOrOptions?: GetPathParameters<Ops, Op> extends Record<string, never>
        ? MutationOptions<Ops, Op>
        : MaybeRefOrGetter<GetPathParameters<Ops, Op> | null | undefined> | MutationOptions<Ops, Op>,
      optionsOrNull?: MutationOptions<Ops, Op>,
    ) {
      const helpers = getHelpers<Ops>(config)

      return useEndpointMutation<Ops, Op>(operationId, helpers, pathParamsOrOptions, optionsOrNull)
    },

    useEndpoint: function <Op extends keyof Ops>(
      operationId: Op,
      pathParamsOrOptions?: GetPathParameters<Ops, Op> extends Record<string, never>
        ? IsQueryOperation<Ops, Op> extends true
          ? QueryOptions<Ops, Op>
          : MutationOptions<Ops, Op>
        :
            | MaybeRefOrGetter<GetPathParameters<Ops, Op> | null | undefined>
            | (IsQueryOperation<Ops, Op> extends true ? QueryOptions<Ops, Op> : MutationOptions<Ops, Op>),
      optionsOrNull?: IsQueryOperation<Ops, Op> extends true ? QueryOptions<Ops, Op> : MutationOptions<Ops, Op>,
    ): IsQueryOperation<Ops, Op> extends true ? EndpointQueryReturn<Ops, Op> : EndpointMutationReturn<Ops, Op> {
      const helpers = getHelpers<Ops>(config)

      return useEndpoint<Ops, Op>(operationId, helpers, pathParamsOrOptions, optionsOrNull)
    },
  }
}
