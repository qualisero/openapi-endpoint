import { computed, ref, type ComputedRef, type Ref, type MaybeRefOrGetter } from 'vue'
import { useMutation, QueryClient } from '@tanstack/vue-query'

import {
  type ApiPathParams,
  type QMutationVars,
  type ApiResponse,
  type QMutationOptions,
  HttpMethod,
  Operations,
  ApiRequest,
} from './types'
import {
  isPathResolved,
  getParamsOptionsFrom,
  useResolvedOperation,
  resolvePath,
  generateQueryKey,
} from './openapi-utils'
import { type OpenApiHelpers } from './openapi-helpers'
import { type AxiosResponse } from 'axios'

/**
 * Return type of `useMutation` with all available reactive properties.
 *
 * Includes all properties from TanStack Query's UseMutationResult plus
 * helper properties provided by this library.
 *
 * @template Ops - The operations type from your OpenAPI specification
 * @template Op - The operation key from your operations type
 */
export type EndpointMutationReturn<Ops extends Operations<Ops>, Op extends keyof Ops> = ReturnType<
  typeof useEndpointMutation<Ops, Op>
>

/**
 * Composable for performing a strictly typed OpenAPI mutation operation using Vue Query.
 * Ensures the operation is a mutation (POST/PUT/PATCH/DELETE) at runtime.
 * Returns a reactive mutation object, including helpers for query key and enabled state.
 *
 * NOTE: By default, the mutation will automatically update cache with returned data and reload
 * any matching GET queries for the same path.
 *
 * @template T OperationId type representing the OpenAPI operation.
 * @param operationId The OpenAPI operation ID to mutate.
 * @param pathParams Optional path parameters for the endpoint, can be reactive.
 * @param options Optional mutation options, including Vue Query options and custom axios options:
 *   - 'dontUpdateCache': If true, will not update cache with returned data (default: false)
 *   - 'dontInvalidate': If true, will not invalidate matching GET queries (default: false)
 *  - 'invalidateOperations': List of additional OperationIds to invalidate after mutation (can also be a map of OperationId to path parameters)
 * - 'refetchEndpoints': List of additional EndpointQueryReturn objects to refetch after mutation
 *   - `axiosOptions`: Custom axios request options (e.g., headers, params)
 *   - All properties from {@link UseMutationOptions} (from @tanstack/vue-query)
 * @throws Error if the operation is not a mutation operation.
 * @returns Mutation object with
 *   - `data`: ComputedRef of response data.
 *   - `isEnabled`: ComputedRef indicating if mutation can be executed (path resolved).
 *   - `extraPathParams`: Ref to set of additional path parameters when calling mutate.
 *   - `mutate` and `mutateAsync`: Functions to trigger the mutation, taking an object with:
 *     - `data`: The request body data for the mutation.
 *     - `pathParams`: Optional additional path parameters for the mutation.
 *     - `axiosOptions`: Optional axios configuration overrides for this specific mutation call.
 *    - `dontUpdateCache`, `dontInvalidate`, `invalidateOperations`, `refetchEndpoints`: Same as options, but can be set per-mutation.
 *   - All other properties and methods from the underlying Vue Query mutation object.
 */
export function useEndpointMutation<Ops extends Operations<Ops>, Op extends keyof Ops>(
  operationId: Op,
  h: OpenApiHelpers<Ops, Op>, // helpers
  pathParamsOrOptions?: MaybeRefOrGetter<ApiPathParams<Ops, Op> | null | undefined> | QMutationOptions<Ops, Op>,
  optionsOrNull?: QMutationOptions<Ops, Op>,
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
  const { pathParams, options } = getParamsOptionsFrom<Ops, Op, QMutationOptions<Ops, Op>>(
    path,
    pathParamsOrOptions,
    optionsOrNull,
  )
  const {
    axiosOptions,
    dontInvalidate,
    dontUpdateCache,
    invalidateOperations,
    refetchEndpoints,
    queryParams,
    ...useMutationOptions
  } = options
  const extraPathParams = ref({}) as Ref<ApiPathParams<Ops, Op>>

  // Use the consolidated operation resolver with extraPathParams support
  const {
    resolvedPath,
    queryKey,
    queryParams: resolvedQueryParams,
    pathParams: allPathParams,
  } = useResolvedOperation(path, pathParams, queryParams, extraPathParams as { value: Partial<ApiPathParams<Ops, Op>> })

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
        extraPathParams.value = pathParamsFromMutate || ({} as ApiPathParams<Ops, Op>)

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
            const listResolvedPath = resolvePath(listPath, pathParams)
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
        extraPathParams.value = {} as ApiPathParams<Ops, Op>
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
    pathParams: allPathParams,
  }
}
