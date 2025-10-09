import type { MaybeRefOrGetter } from 'vue'
import { QueryClient } from '@tanstack/vue-query'

import { useEndpoint } from './openapi-endpoint'
import { EndpointQueryReturn, useEndpointQuery } from './openapi-query'
import { useEndpointMutation } from './openapi-mutation'
import { Operations, GetPathParameters, OpenApiConfig, QueryOptions, MutationOptions, IsQueryOperation } from './types'
import { getHelpers } from './openapi-helpers'
export type { OperationInfo, QueryOptions, OpenApiInstance } from './types'
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
      pathParamsOrOptions?: MaybeRefOrGetter<GetPathParameters<Ops, Op> | null | undefined> | QueryOptions<Ops, Op>,
      optionsOrNull?: QueryOptions<Ops, Op>,
    ): EndpointQueryReturn<Ops, Op> {
      const helpers = getHelpers<Ops, Op>(config)

      return useEndpointQuery<Ops, Op>(operationId, helpers, pathParamsOrOptions, optionsOrNull)
    },

    useMutation: function <Op extends keyof Ops>(
      operationId: IsQueryOperation<Ops, Op> extends false ? Op : never,
      pathParamsOrOptions?: MaybeRefOrGetter<GetPathParameters<Ops, Op> | null | undefined> | MutationOptions<Ops, Op>,
      optionsOrNull?: MutationOptions<Ops, Op>,
    ) {
      const helpers = getHelpers<Ops, Op>(config)

      return useEndpointMutation<Ops, Op>(operationId, helpers, pathParamsOrOptions, optionsOrNull)
    },

    useEndpoint: function <Op extends keyof Ops>(
      operationId: Op,
      pathParamsOrOptions?:
        | MaybeRefOrGetter<GetPathParameters<Ops, Op> | null | undefined>
        | (IsQueryOperation<Ops, Op> extends true ? QueryOptions<Ops, Op> : MutationOptions<Ops, Op>),
      optionsOrNull?: IsQueryOperation<Ops, Op> extends true ? QueryOptions<Ops, Op> : MutationOptions<Ops, Op>,
    ) {
      const helpers = getHelpers<Ops, Op>(config)

      return useEndpoint<Ops, Op>(operationId, helpers, pathParamsOrOptions, optionsOrNull)
    },
  }
}
