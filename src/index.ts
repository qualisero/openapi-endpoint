import { QueryClient } from '@tanstack/vue-query'

import { useEndpoint } from './openapi-endpoint'
import { useEndpointQuery } from './openapi-query'
import { useEndpointMutation } from './openapi-mutation'
import {
  Operations,
  OpenApiConfig,
  OperationInfo,
  OpenApiInstance,
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
  OpInfo extends Record<string, OperationInfo> = Record<string, OperationInfo>,
>(config: OpenApiConfig<OpInfo>): OpenApiInstance<OperationTypes & OpInfo> {
  // Internally combine the operation types with operation info
  const combinedOperations = config.operations as OperationTypes & OpInfo

  // Create the internal config with combined operations for helper functions
  const internalConfig = {
    operations: combinedOperations,
    axios: config.axios,
    queryClient: config.queryClient,
  }

  return {
    useQuery(operationId, pathParamsOrOptions?, optionsOrNull?) {
      const helpers = getHelpers(internalConfig)
      return useEndpointQuery(operationId, helpers, pathParamsOrOptions, optionsOrNull)
    },

    useMutation(operationId, pathParamsOrOptions?, optionsOrNull?) {
      const helpers = getHelpers(internalConfig)
      return useEndpointMutation(operationId, helpers, pathParamsOrOptions, optionsOrNull)
    },

    useEndpoint(operationId, pathParamsOrOptions?, optionsOrNull?) {
      const helpers = getHelpers(internalConfig)
      return useEndpoint(operationId, helpers, pathParamsOrOptions, optionsOrNull)
    },
  }
}
