import { type AxiosInstance, type AxiosError } from 'axios'
import { UseMutationOptions, type UseQueryOptions, QueryClient } from '@tanstack/vue-query'
// import { type UseQueryOptions, type UseMutationOptions } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import { type AxiosRequestConfig } from 'axios'
import type { EndpointQueryReturn } from './openapi-query'
import type { EndpointMutationReturn } from './openapi-mutation'
export type { EndpointQueryReturn } from './openapi-query'
export type { EndpointMutationReturn } from './openapi-mutation'

// Extend AxiosRequestConfig to include custom properties
export interface ExtendedAxiosRequestConfig extends AxiosRequestConfig {
  skipErrorHandling?: boolean
}

export type OperationId = string

export type Operations<Ops> = object & { [K in keyof Ops]: { method: HttpMethod } }

export interface OpenApiConfig<
  Ops extends Operations<Ops>,
  // Ids extends Record<keyof Ops & string, string> = Record<keyof Ops & string, string>,
> {
  // operationIds: Ids
  operations: Ops
  axios: AxiosInstance
  queryClient?: QueryClient
}

export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
  HEAD = 'HEAD',
  OPTIONS = 'OPTIONS',
  TRACE = 'TRACE',
}

export interface OperationInfo {
  path: string
  method: HttpMethod
}

export type GetOperation<Ops extends Operations<Ops>, Op extends keyof Ops> = Ops[Op]

export type GetResponseData<Ops extends Operations<Ops>, Op extends keyof Ops> =
  GetOperation<Ops, Op> extends {
    responses: { 200: { content: { 'application/json': infer Data } } }
  }
    ? RequireReadonly<Data>
    : unknown

// Type-safe options for queries
export type QueryOptions<Ops extends Operations<Ops>, Op extends keyof Ops> = Omit<
  UseQueryOptions<GetResponseData<Ops, Op>, Error, GetResponseData<Ops, Op>, GetResponseData<Ops, Op>>,
  'queryKey' | 'queryFn'
> & {
  enabled?: MaybeRefOrGetter<boolean>
  staleTime?: number
  retry?: boolean | number | ((failureCount: number, error: Error) => boolean)
  refetchOnWindowFocus?: boolean
  refetchInterval?: number | false
  refetchOnMount?: boolean
  onLoad?: (data: GetResponseData<Ops, Op>) => void
  axiosOptions?: ExtendedAxiosRequestConfig
  errorHandler?: (error: AxiosError) => GetResponseData<Ops, Op> | void | Promise<GetResponseData<Ops, Op> | void>
}

type MutationOnSuccessOptions<Ops extends Operations<Ops>> = {
  dontInvalidate?: boolean
  dontUpdateCache?: boolean
  invalidateOperations?: (keyof Ops)[] | Partial<{ [K in keyof Ops]: GetPathParameters<Ops, K> }>
  refetchEndpoints?: EndpointQueryReturn<Ops, keyof Ops>[]
}

export type MutationVars<Ops extends Operations<Ops>, Op extends keyof Ops> = MutationOnSuccessOptions<Ops> & {
  data: GetRequestBody<Ops, Op>
  pathParams?: GetPathParameters<Ops, Op>
}

// // Type-safe options for mutations
export type MutationOptions<Ops extends Operations<Ops>, Op extends keyof Ops> = Omit<
  UseMutationOptions<GetResponseData<Ops, Op>, Error, MutationVars<Ops, Op>, unknown>,
  'mutationFn' | 'mutationKey'
> &
  MutationOnSuccessOptions<Ops> & {
    retry?: boolean | number | ((failureCount: number, error: Error) => boolean)
    onSuccess?: (
      data: GetResponseData<Ops, Op>,
      variables: MutationVars<Ops, Op>,
      context: unknown,
    ) => void | Promise<void>
    onError?: (error: Error, variables: MutationVars<Ops, Op>, context: unknown) => void | Promise<void>
    onSettled?: (
      data: GetResponseData<Ops, Op> | undefined,
      error: Error | null,
      variables: MutationVars<Ops, Op>,
      context: unknown,
    ) => void | Promise<void>
    onMutate?: (variables: MutationVars<Ops, Op>) => unknown | Promise<unknown>
    meta?: Record<string, unknown>
    retryDelay?: number | ((failureCount: number, error: Error) => number)
    useErrorBoundary?: boolean | ((error: Error) => boolean)
    axiosOptions?: ExtendedAxiosRequestConfig
    errorHandler?: (error: AxiosError) => GetResponseData<Ops, Op> | void | Promise<GetResponseData<Ops, Op> | void>
  }

export type GetPathParameters<Ops extends Operations<Ops>, Op extends keyof Ops> = Ops[Op] extends {
  parameters: { path: infer PathParams }
}
  ? { [K in keyof PathParams]: PathParams[K] | undefined }
  : Record<string, never>

type IfEquals<X, Y, A = X, B = never> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? A : B
type IsReadonly<T, K extends keyof T> = IfEquals<Pick<T, K>, { -readonly [Q in K]: T[K] }, false, true>
type Writable<T> = {
  -readonly [K in keyof T as IsReadonly<T, K> extends false ? K : never]: T[K]
}

export type GetRequestBody<Ops extends Operations<Ops>, Op extends keyof Ops> =
  GetOperation<Ops, Op> extends {
    requestBody: { content: { 'application/json': infer Body } }
  }
    ? Writable<Body>
    : never

// Utility: Make readonly properties required (non-optional)
type RequireReadonly<T> = {
  // Required: all readonly properties (remove optional modifier)
  [K in keyof T as IsReadonly<T, K> extends true ? K : never]-?: T[K]
} & {
  // Keep as-is: all non-readonly properties (preserve optional modifier)
  [K in keyof T as IsReadonly<T, K> extends false ? K : never]: T[K]
}

export type IsQueryOperation<Ops extends Operations<Ops>, Op extends keyof Ops> = Ops[Op] extends {
  method: HttpMethod.GET | HttpMethod.HEAD | HttpMethod.OPTIONS
}
  ? true
  : false

// export type IsMutationOperation<Ops extends object, Op extends keyof Ops> =
//   IsQueryOperation<Ops, Op> extends true ? false : true

// export type IsQueryOperation<Ops extends object, Op extends keyof Ops> = Op extends OperationKey
//   ? (typeof operationInfoDict)[Op]['method'] extends HttpMethod.GET
//     ? true
//     : false
//   : never

// export type IsMutationOperation<Op extends string> = IsQueryOperation<Op> extends true ? false : true

// Type representing an instance of the OpenAPI client returned by useOpenApi
export type OpenApiInstance<Ops extends Operations<Ops>> = {
  useQuery: <Op extends keyof Ops>(
    operationId: IsQueryOperation<Ops, Op> extends true ? Op : never,
    pathParamsOrOptions?: MaybeRefOrGetter<GetPathParameters<Ops, Op> | null | undefined> | QueryOptions<Ops, Op>,
    optionsOrNull?: QueryOptions<Ops, Op>,
  ) => EndpointQueryReturn<Ops, Op>

  useMutation: <Op extends keyof Ops>(
    operationId: IsQueryOperation<Ops, Op> extends false ? Op : never,
    pathParamsOrOptions?: MaybeRefOrGetter<GetPathParameters<Ops, Op> | null | undefined> | MutationOptions<Ops, Op>,
    optionsOrNull?: MutationOptions<Ops, Op>,
  ) => EndpointMutationReturn<Ops, Op>

  useEndpoint: <Op extends keyof Ops>(
    operationId: Op,
    pathParamsOrOptions?:
      | MaybeRefOrGetter<GetPathParameters<Ops, Op> | null | undefined>
      | (IsQueryOperation<Ops, Op> extends true ? QueryOptions<Ops, Op> : MutationOptions<Ops, Op>),
    optionsOrNull?: IsQueryOperation<Ops, Op> extends true ? QueryOptions<Ops, Op> : MutationOptions<Ops, Op>,
  ) => IsQueryOperation<Ops, Op> extends true ? EndpointQueryReturn<Ops, Op> : EndpointMutationReturn<Ops, Op>
}
