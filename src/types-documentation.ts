/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * @fileoverview Documentation-only exports for better API reference.
 *
 * This file exports types that are used internally but important for users to understand
 * when working with the library. These are re-exported from types.ts with enhanced
 * documentation for TypeDoc generation.
 */

import type { MaybeRefOrGetter } from 'vue'
import type { UseQueryOptions } from '@tanstack/vue-query'
import type { AxiosRequestConfig, AxiosError } from 'axios'
import type { QQueryOptions as _QQueryOptions } from './types.js'
import type { QMutationOptions as _QMutationOptions } from './types.js'
import type { EndpointQueryReturn as _EndpointQueryReturn } from './openapi-query.js'
import type { EndpointMutationReturn as _EndpointMutationReturn } from './openapi-mutation.js'
import type { GetResponseData, GetPathParameters, GetRequestBody, GetQueryParameters, Operations } from './types.js'

/**
 * Query options for `useQuery` that extend TanStack Query options.
 *
 * This type combines all options from TanStack Query's `UseQueryOptions` with
 * custom options specific to this library, such as reactive query parameters,
 * custom error handling, and axios configuration.
 *
 * @group Types
 * @template Ops - The operations type from your OpenAPI specification
 * @template Op - The operation key from your operations type
 *
 * @example
 * ```typescript
 * // Using with type inference (recommended)
 * const { data } = api.useQuery('listPets', {
 *   enabled: computed(() => isLoggedIn.value),
 *   staleTime: 5000,
 *   queryParams: { limit: 10, status: 'available' },
 *   onError: (error) => toast.error(error.message)
 * })
 *
 * // Using explicit type
 * const options: QQueryOptions<OpenApiOperations, 'listPets'> = {
 *   enabled: true,
 *   staleTime: 10000
 * }
 * ```
 */
export type QQueryOptions<Ops extends Operations<Ops>, Op extends keyof Ops> = _QQueryOptions<Ops, Op>

/**
 * Mutation options for `useMutation` that extend TanStack Query options.
 *
 * This type combines all options from TanStack Query's `UseMutationOptions` with
 * custom options for cache management, such as controlling automatic cache updates
 * and specifying operations to invalidate after the mutation.
 *
 * @group Types
 * @template Ops - The operations type from your OpenAPI specification
 * @template Op - The operation key from your operations type
 *
 * @example
 * ```typescript
 * // Default cache management (automatic)
 * const mutation = api.useMutation('createPet', {
 *   onSuccess: (data) => console.log('Created', data)
 * })
 *
 * // Disable automatic cache management
 * const mutation = api.useMutation('updatePet', {
 *   dontInvalidate: true,
 *   dontUpdateCache: true
 * })
 *
 * // Invalidate specific operations
 * const mutation = api.useMutation('deletePet', {
 *   invalidateOperations: ['listPets', 'getUserPets']
 * })
 * ```
 */
export type QMutationOptions<Ops extends Operations<Ops>, Op extends keyof Ops> = _QMutationOptions<Ops, Op>

/**
 * Return type of `useQuery` with all available reactive properties.
 *
 * This type represents the complete object returned by `useQuery`, including
 * all properties from TanStack Query's `UseQueryResult` plus additional
 * helper properties provided by this library.
 *
 * @group Types
 * @template Ops - The operations type from your OpenAPI specification
 * @template Op - The operation key from your operations type
 *
 * @property {ComputedRef<GetResponseData<Ops, Op> | undefined>} data - The response data, typed according to your OpenAPI spec
 * @property {ComputedRef<boolean>} isEnabled - Whether the query is enabled and can execute
 * @property {ComputedRef<unknown[]>} queryKey - The query key used by TanStack Query
 * @property {(callback: (data: GetResponseData<Ops, Op>) => void) => void} onLoad - Register a callback for when data loads
 * @property {ComputedRef<boolean>} isLoading - Whether the query is currently fetching
 * @property {ComputedRef<Error | null>} error - Any error that occurred
 * @property {ComputedRef<boolean>} isFetching - Whether the query is currently fetching (including background refetches)
 * @property {ComputedRef<boolean>} isSuccess - Whether the query has successfully fetched data
 * @property {ComputedRef<boolean>} isError - Whether the query has encountered an error
 * @property {() => Promise<void>} refetch - Function to manually refetch the query
 * @property {() => void} remove - Function to remove the query from the cache
 *
 * @example
 * ```typescript
 * const query = api.useQuery('getPet', { petId: '123' })
 *
 * // Access reactive properties
 * if (query.isLoading.value) {
 *   console.log('Loading...')
 * } else if (query.error.value) {
 *   console.error('Error:', query.error.value)
 * } else if (query.data.value) {
 *   console.log('Pet:', query.data.value.name)
 * }
 *
 * // Register load callback
 * query.onLoad((pet) => {
 *   console.log('Pet loaded:', pet.name)
 * })
 * ```
 */
export type EndpointQueryReturn<Ops extends Operations<Ops>, Op extends keyof Ops> = _EndpointQueryReturn<Ops, Op>

/**
 * Return type of `useMutation` with all available reactive properties.
 *
 * This type represents the complete object returned by `useMutation`, including
 * all properties from TanStack Query's `UseMutationResult` plus additional
 * helper properties provided by this library.
 *
 * @group Types
 * @template Ops - The operations type from your OpenAPI specification
 * @template Op - The operation key from your operations type
 *
 * @property {ComputedRef<AxiosResponse<GetResponseData<Ops, Op>> | undefined>} data - The axios response with typed data
 * @property {ComputedRef<boolean>} isEnabled - Whether the mutation can execute (path is resolved)
 * @property {ComputedRef<GetPathParameters<Ops, Op>>} pathParams - Current path parameters
 * @property {ComputedRef<Error | null>} error - Any error that occurred
 * @property {ComputedRef<boolean>} isIdle - Whether the mutation has not been triggered yet
 * @property {ComputedRef<boolean>} isPending - Whether the mutation is currently executing
 * @property {ComputedRef<boolean>} isSuccess - Whether the last mutation was successful
 * @property {ComputedRef<boolean>} isError - Whether the last mutation encountered an error
 * @property {Ref<GetPathParameters<Ops, Op>>} extraPathParams - Ref to set additional path parameters when calling mutate
 * @property {(variables) => void} mutate - Trigger mutation synchronously (throws error on failure)
 * @property {(variables) => Promise<void>} mutateAsync - Trigger mutation asynchronously (returns promise)
 * @property {() => void} reset - Reset the mutation to its initial state
 *
 * @example
 * ```typescript
 * const mutation = api.useMutation('createPet', {
 *   onSuccess: (response) => console.log('Created:', response.data)
 * })
 *
 * // Execute mutation
 * await mutation.mutateAsync({ data: { name: 'Fluffy' } })
 *
 * // Check state
 * if (mutation.isPending.value) {
 *   console.log('Creating...')
 * } else if (mutation.isSuccess.value) {
 *   console.log('Success!')
 * }
 * ```
 */
export type EndpointMutationReturn<Ops extends Operations<Ops>, Op extends keyof Ops> = _EndpointMutationReturn<Ops, Op>
