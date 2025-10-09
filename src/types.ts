import { type AxiosInstance } from 'axios'
import { UseMutationOptions, type UseQueryOptions, QueryClient } from '@tanstack/vue-query'
// import { type UseQueryOptions, type UseMutationOptions } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import { type AxiosRequestConfig } from 'axios'
import { EndpointQueryReturn } from '.'
export type { EndpointQueryReturn } from './openapi-query'

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
  UseQueryOptions<GetResponseData<Ops, Op>>,
  'enabled'
> & {
  enabled?: MaybeRefOrGetter<boolean>
  onLoad?: (data: GetResponseData<Ops, Op>) => void
  axiosOptions?: AxiosRequestConfig
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
export type MutationOptions<Ops extends Operations<Ops>, Op extends keyof Ops> = UseMutationOptions<
  GetResponseData<Ops, Op>,
  Error,
  MutationVars<Ops, Op>
> &
  MutationOnSuccessOptions<Ops> & {
    axiosOptions?: AxiosRequestConfig
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
  method: HttpMethod.GET
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
