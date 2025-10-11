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
export type { OperationInfo, QQueryOptions, OpenApiConfig, OpenApiInstance } from './types'
export { type EndpointQueryReturn, useEndpointQuery } from './openapi-query'
export { type EndpointMutationReturn, useEndpointMutation } from './openapi-mutation'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5 },
  },
})

export function useOpenApi<Ops extends Operations<Ops>>(config: OpenApiConfig<Ops>) {
  return {
    debug: function <Op extends keyof Ops>(operationId: Op) {
      const helpers = getHelpers<Ops, Op>(config)
      const info = helpers.getOperationInfo(operationId)
      console.log('Operation Info:', info)
      return {} as IsQueryOperation<Ops, Op>
    },
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
