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
  OperationInfo,
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

export function useOpenApi<
  OperationTypes extends Operations<OperationTypes>,
  OpInfo extends Record<string, OperationInfo>,
>(config: OpenApiConfig<OpInfo>) {
  // Internally combine the operation types with operation info
  type CombinedOps = OperationTypes & OpInfo
  const combinedOperations: CombinedOps = config.operations as CombinedOps

  // Create the internal config with combined operations for helper functions
  const internalConfig = {
    operations: combinedOperations,
    axios: config.axios,
    queryClient: config.queryClient,
  }

  return {
    useQuery: function <Op extends keyof CombinedOps>(
      operationId: IsQueryOperation<CombinedOps, Op> extends true ? Op : never,
      pathParamsOrOptions?: GetPathParameters<CombinedOps, Op> extends Record<string, never>
        ? QQueryOptions<CombinedOps, Op>
        : MaybeRefOrGetter<GetPathParameters<CombinedOps, Op> | null | undefined> | QQueryOptions<CombinedOps, Op>,
      optionsOrNull?: QQueryOptions<CombinedOps, Op>,
    ): EndpointQueryReturn<CombinedOps, Op> {
      const helpers = getHelpers<CombinedOps, Op>(internalConfig)

      return useEndpointQuery<CombinedOps, Op>(operationId, helpers, pathParamsOrOptions, optionsOrNull)
    },

    useMutation: function <Op extends keyof CombinedOps>(
      operationId: IsQueryOperation<CombinedOps, Op> extends false ? Op : never,
      pathParamsOrOptions?: GetPathParameters<CombinedOps, Op> extends Record<string, never>
        ? QMutationOptions<CombinedOps, Op>
        : MaybeRefOrGetter<GetPathParameters<CombinedOps, Op> | null | undefined> | QMutationOptions<CombinedOps, Op>,
      optionsOrNull?: QMutationOptions<CombinedOps, Op>,
    ) {
      const helpers = getHelpers<CombinedOps, Op>(internalConfig)

      return useEndpointMutation<CombinedOps, Op>(operationId, helpers, pathParamsOrOptions, optionsOrNull)
    },

    useEndpoint: function <Op extends keyof CombinedOps>(
      operationId: Op,
      pathParamsOrOptions?: GetPathParameters<CombinedOps, Op> extends Record<string, never>
        ? IsQueryOperation<CombinedOps, Op> extends true
          ? QQueryOptions<CombinedOps, Op>
          : QMutationOptions<CombinedOps, Op>
        :
            | MaybeRefOrGetter<GetPathParameters<CombinedOps, Op> | null | undefined>
            | (IsQueryOperation<CombinedOps, Op> extends true
                ? QQueryOptions<CombinedOps, Op>
                : QMutationOptions<CombinedOps, Op>),
      optionsOrNull?: IsQueryOperation<CombinedOps, Op> extends true
        ? QQueryOptions<CombinedOps, Op>
        : QMutationOptions<CombinedOps, Op>,
    ): IsQueryOperation<CombinedOps, Op> extends true
      ? EndpointQueryReturn<CombinedOps, Op>
      : EndpointMutationReturn<CombinedOps, Op> {
      const helpers = getHelpers<CombinedOps, Op>(internalConfig)

      return useEndpoint<CombinedOps, Op>(operationId, helpers, pathParamsOrOptions, optionsOrNull)
    },
  }
}
