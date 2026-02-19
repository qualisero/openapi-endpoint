import type { MaybeRefOrGetter } from 'vue'

import { EndpointQueryReturn, useEndpointQuery } from './openapi-query'
import { type EndpointMutationReturn, useEndpointMutation } from './openapi-mutation'
import {
  Operations,
  ApiPathParams,
  ApiPathParamsInput,
  OpenApiConfig,
  OpenApiInstance,
  QQueryOptions,
  QMutationOptions,
  QueryOpsNoPathParams,
  QueryOpsWithPathParams,
  MutationOpsNoPathParams,
  MutationOpsWithPathParams,
  HasExcessPathParams,
  ReactiveValue,
} from './types'
import { getHelpers } from './openapi-helpers'

// Public type exports
export type {
  // Config
  OpenApiConfig,
  OperationConfig,

  // Instance types
  OpenApiInstance,
  QueryNamespace,
  MutationNamespace,
  OperationNamespace,
  OperationQuery,
  OperationMutation,

  // Request / response types
  ApiResponse,
  ApiResponseSafe,
  ApiRequest,
  ApiPathParams,
  ApiPathParamsInput,
  ApiQueryParams,

  // Query / mutation option types
  QQueryOptions,
  QMutationOptions,
  QMutationVars,
  CacheInvalidationOptions,

  // Return types
  EndpointQueryReturn,
  EndpointMutationReturn,

  // Reactive helpers
  ReactiveOr,
  ReactiveValue,

  // Mutation function signatures
  MutateFn,
  MutateAsyncFn,
  MutateAsyncReturn,

  // Internal / advanced
  QueryClientLike,
  AxiosRequestConfigExtended,
  HasExcessPathParams,
  RequiresPathParameters,
  NoPathParams,
  WithPathParams,
  QueryOpsNoPathParams,
  QueryOpsWithPathParams,
  MutationOpsNoPathParams,
  MutationOpsWithPathParams,
} from './types'

// Public function exports
export { validateMutationParams } from './types'

// Factory
export { useOpenApi } from './openapi-endpoint'