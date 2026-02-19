import { computed, ref, type ComputedRef, type Ref, type MaybeRefOrGetter } from 'vue'
import { useMutation, QueryClient } from '@tanstack/vue-query'

import {
  type ApiPathParams,
  type ApiPathParamsInput,
  type QMutationVars,
  type ApiResponse,
  type QMutationOptions,
  type ApiRequest,
  type MutateFn,
  type MutateAsyncFn,
  HttpMethod,
  Operations,
} from './types'
import {
  isPathResolved,
  normalizeParamsOptions,
  useResolvedOperation,
  resolvePath,
  generateQueryKey,
} from './openapi-utils'
import { type OpenApiHelpers } from './openapi-helpers'
import { type AxiosResponse } from 'axios'

/**
 * Return type of `useMutation` (created via `useOpenApi`).
 *
 * Reactive mutation result with automatic cache management and helpers.
 *
 * All properties are reactive (ComputedRef/Ref) and auto-unwrap in Vue templates.
 *
 * @template Ops - The operations type from your OpenAPI specification
 * @template Op - The operation key from your operations type
 *
 * @example
 * ```typescript
 * const mutation = api.useMutation('createPet')
 *
 * // Reactive properties
 * if (mutation.isPending.value) console.log('Saving...')
 * if (mutation.isSuccess.value) console.log('Created:', mutation.data.value)
 *
 * // Execute
 * mutation.mutate({ data: { name: 'Fluffy' } })
 * await mutation.mutateAsync({ data: { name: 'Fluffy' } })
 * ```
 *
 * @group Types
 */
export interface EndpointMutationReturn<Ops extends Operations<Ops>, Op extends keyof Ops> {
  /** The Axios response (undefined until mutation completes). */
  data: ComputedRef<AxiosResponse<ApiResponse<Ops, Op>> | undefined>

  /** The error if the mutation failed. */
  error: Ref<Error | null>

  /** True while the mutation is in progress. */
  isPending: Ref<boolean>

  /** True when the mutation succeeded. */
  isSuccess: Ref<boolean>

  /** True when the mutation failed. */
  isError: Ref<boolean>

  /** Execute the mutation (non-blocking). */
  mutate: MutateFn<Ops, Op>

  /** Execute the mutation and wait for the response. */
  mutateAsync: MutateAsyncFn<Ops, Op>

  /** Reset the mutation state. */
  reset: () => void

  /** Whether the mutation can execute (path parameters resolved). */
  isEnabled: ComputedRef<boolean>

  /** The resolved path parameters. */
  pathParams: ComputedRef<ApiPathParams<Ops, Op>>

  /** Additional path parameters that can be provided at mutation time. */
  extraPathParams: Ref<ApiPathParams<Ops, Op>>
}

/**
 * Execute a type-safe mutation (POST/PUT/PATCH/DELETE) with automatic cache updates.
 *
 * Ensures the operation is a mutation at runtime and returns a reactive mutation object
 * with helpers for path resolution and cache invalidation.
 *
 * NOTE: By default, the mutation updates cache for PUT/PATCH and invalidates matching
 * GET queries for the same path.
 *
 * @template Ops - The operations type from your OpenAPI specification
 * @template Op - The operation key from your operations type
 * @param operationId - The OpenAPI operation ID to mutate
 * @param h - OpenAPI helpers (internal), provided by useOpenApi
 * @param pathParams - Path parameters (can be reactive). Omit for operations without path params.
 * @param options - Mutation options (dontInvalidate, refetchEndpoints, etc.)
 *   - `dontUpdateCache`: Skip cache update for PUT/PATCH responses
 *   - `dontInvalidate`: Skip invalidating matching queries
 *   - `invalidateOperations`: Additional operation IDs to invalidate (array or map of params)
 *   - `refetchEndpoints`: Additional query results to refetch
 *   - `queryParams`: Query string parameters (operation-specific)
 *   - `axiosOptions`: Custom axios request options (headers, params, etc.)
 *   - Plus all {@link UseMutationOptions} from @tanstack/vue-query
 * @throws Error if the operation is not a mutation operation
 * @returns Mutation object with
 *   - `mutate(vars)` / `mutateAsync(vars)` to trigger the mutation
 *   - `data`: ComputedRef of Axios response data
 *   - `isEnabled`: ComputedRef indicating if mutation can execute (path resolved)
 *   - `extraPathParams`: Ref to set additional path params at call time
 *   - `pathParams`: Resolved path params as a computed ref
 */
export function useEndpointMutation<Ops extends Operations<Ops>, Op extends keyof Ops>(
  operationId: Op,
  h: OpenApiHelpers<Ops, Op>, // helpers
  pathParams?: MaybeRefOrGetter<ApiPathParamsInput<Ops, Op> | null | undefined>,
  options?: QMutationOptions<Ops, Op>,
) {
  // Runtime check to ensure this is actually a mutation operation
  if (!h.isMutationOperation(operationId)) {
    const { method } = h.getOperationInfo(operationId)
    throw new Error(
      `Operation '${String(operationId)}' uses method ${method} and cannot be used with useMutation(). ` +
        `Use useQuery() for GET/HEAD/OPTIONS operations.`,
    )
  }

  const { path, method } = h.getOperationInfo(operationId)
  const { pathParams: resolvedPathParamsInput, options: resolvedOptions } = normalizeParamsOptions<
    ApiPathParamsInput<Ops, Op>,
    QMutationOptions<Ops, Op>
  >(pathParams, options)
  const {
    axiosOptions,
    dontInvalidate,
    dontUpdateCache,
    invalidateOperations,
    refetchEndpoints,
    queryParams,
    ...useMutationOptions
  } = resolvedOptions
  const extraPathParams = ref({}) as Ref<ApiPathParamsInput<Ops, Op>>

  // Use the consolidated operation resolver with extraPathParams support
  const {
    resolvedPath,
    queryKey,
    queryParams: resolvedQueryParams,
    pathParams: allPathParams,
  } = useResolvedOperation(
    path,
    resolvedPathParamsInput,
    queryParams,
    extraPathParams as { value: Partial<ApiPathParamsInput<Ops, Op>> },
  )

  const mutation = useMutation(
    {
      mutationFn: async (
        vars: ApiRequest<Ops, Op> extends never ? QMutationVars<Ops, Op> | void : QMutationVars<Ops, Op>,
      ) => {
        const {
          data,
          pathParams: pathParamsFromMutate,
          axiosOptions: axiosOptionsFromMutate,
          queryParams: queryParamsFromMutate,
        } = vars as QMutationVars<Ops, Op> & { data?: unknown }
        extraPathParams.value = pathParamsFromMutate || ({} as ApiPathParamsInput<Ops, Op>)

        // TODO: use typing to ensure all required path params are provided
        if (!isPathResolved(resolvedPath.value)) {
          return Promise.reject(
            new Error(
              `Cannot execute mutation '${String(operationId)}': path parameters not resolved. ` +
                `Path: '${resolvedPath.value}', provided params: ${JSON.stringify(allPathParams.value)}`,
            ),
          )
        }
        // Cancel any ongoing queries for this path (prevent race conditions with refresh)
        await h.queryClient.cancelQueries({ queryKey: queryKey.value, exact: false })

        return h.axios({
          method: method.toLowerCase(),
          url: resolvedPath.value,
          ...(data !== undefined && { data }),
          ...axiosOptions,
          ...axiosOptionsFromMutate,
          params: {
            ...(axiosOptions?.params || {}),
            ...(resolvedQueryParams.value || {}),
            ...(queryParamsFromMutate || {}),
          },
        })
      },
      onSuccess: async (response, vars, _context) => {
        const data = response.data
        const {
          dontInvalidate: dontInvalidateMutate,
          dontUpdateCache: dontUpdateCacheMutate,
          invalidateOperations: invalidateOperationsMutate,
          refetchEndpoints: refetchEndpointsMutate,
        } = vars || {}

        // update cache with returned data for PUT/PATCH requests
        if (
          // dontUpdateCacheMutate supersedes dontUpdateCache from options
          (dontUpdateCacheMutate !== undefined ? !dontUpdateCacheMutate : !dontUpdateCache) &&
          data &&
          [HttpMethod.PUT, HttpMethod.PATCH].includes(method)
        ) {
          await h.queryClient.setQueryData(queryKey.value, data)
        }

        // Invalidate queries for this path, and any additional specified operations
        if (dontInvalidateMutate !== undefined ? !dontInvalidateMutate : !dontInvalidate) {
          // Invalidate all queries for this path (exact for POST, prefix for others):
          await h.queryClient.invalidateQueries({ queryKey: queryKey.value, exact: method !== HttpMethod.POST })

          const listPath = h.getListOperationPath(operationId)
          if (listPath) {
            const listResolvedPath = resolvePath(listPath, resolvedPathParamsInput)
            if (isPathResolved(listResolvedPath)) {
              const listQueryKey = generateQueryKey(listResolvedPath)

              // Invalidate list queries by comparing normalized query keys.
              // For queries with query parameters (objects), strip the last element before comparing.
              // This matches:
              //   - List queries without params: ["api", "user"]
              //   - List queries with params: ["api", "user", {filter}] → normalized to ["api", "user"]
              // But NOT single-item queries where last element is a primitive:
              //   - Single-item: ["api", "user", "uuid"] → kept as ["api", "user", "uuid"]
              await h.queryClient.invalidateQueries({
                predicate: (query: { queryKey: readonly unknown[] }) => {
                  const qKey = query.queryKey
                  if (!qKey || qKey.length === 0) return false

                  // Normalize query key: strip last element if it's an object (query params)
                  const normalizedKey =
                    typeof qKey[qKey.length - 1] === 'object' && qKey[qKey.length - 1] !== null
                      ? qKey.slice(0, -1)
                      : qKey

                  // Compare with listQueryKey
                  if (normalizedKey.length !== listQueryKey.length) return false
                  for (let i = 0; i < listQueryKey.length; i++) {
                    if (normalizedKey[i] !== listQueryKey[i]) return false
                  }
                  return true
                },
              })
            }
          }
        }

        const operationsWithPathParams: [Op, ApiPathParams<Ops, Op>][] = []
        Array.from([invalidateOperations, invalidateOperationsMutate]).forEach((ops) => {
          operationsWithPathParams.push(
            ...((typeof ops === 'object' && !Array.isArray(ops)
              ? Object.entries(ops)
              : ops?.map((opId) => [opId, {}]) || []) as [Op, ApiPathParams<Ops, Op>][]),
          )
        })

        if (operationsWithPathParams.length > 0) {
          const promises = operationsWithPathParams.map(([opId, opParams]) => {
            const opInfo = h.getOperationInfo(opId)
            const opPath = resolvePath(opInfo.path, {
              ...allPathParams.value,
              ...opParams,
            })
            if (isPathResolved(opPath)) {
              const opQueryKey = generateQueryKey(opPath)
              return h.queryClient.invalidateQueries({ queryKey: opQueryKey, exact: true })
            } else {
              console.warn(
                `Cannot invalidate operation '${String(opId)}', path not resolved: ${opPath} (params: ${JSON.stringify({ ...allPathParams.value, ...opParams })})`,
              )
              return Promise.reject()
            }
          })
          await Promise.all(promises)
        }

        if (refetchEndpoints && refetchEndpoints.length > 0) {
          await Promise.all(refetchEndpoints.map((endpoint) => endpoint.refetch()))
        }
        if (refetchEndpointsMutate && refetchEndpointsMutate.length > 0) {
          await Promise.all(refetchEndpointsMutate.map((endpoint) => endpoint.refetch()))
        }
      },
      onSettled: () => {
        extraPathParams.value = {} as ApiPathParamsInput<Ops, Op>
      },
      ...useMutationOptions,
    },
    h.queryClient as QueryClient,
  )

  return {
    ...mutation,
    data: mutation.data as ComputedRef<AxiosResponse<ApiResponse<Ops, Op>> | undefined>,
    isEnabled: computed(() => isPathResolved(resolvedPath.value)),
    extraPathParams,
    pathParams: allPathParams as ComputedRef<ApiPathParams<Ops, Op>>,
  } as unknown as EndpointMutationReturn<Ops, Op>
}
