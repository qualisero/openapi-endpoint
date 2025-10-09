import { computed, ref, toValue, type ComputedRef, type Ref, type MaybeRefOrGetter } from 'vue'
import { useMutation } from '@tanstack/vue-query'

import {
  type GetPathParameters,
  type MutationVars,
  type GetResponseData,
  type MutationOptions,
  HttpMethod,
  Operations,
} from './types'
import { resolvePath, generateQueryKey, isPathResolved, getParamsOptionsFrom } from './openapi-utils'
import { getHelpers } from './openapi-helpers'

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
 *    - `dontUpdateCache`, `dontInvalidate`, `invalidateOperations`, `refetchEndpoints`: Same as options, but can be set per-mutation.
 *   - All other properties and methods from the underlying Vue Query mutation object.
 */
export function useEndpointMutation<Ops extends Operations<Ops>, Op extends keyof Ops>(
  operationId: Op,
  h: ReturnType<typeof getHelpers<Ops, Op>>, // helpers
  pathParamsOrOptions?: MaybeRefOrGetter<GetPathParameters<Ops, Op> | null | undefined> | MutationOptions<Ops, Op>,
  optionsOrNull?: MutationOptions<Ops, Op>,
) {
  // Runtime check to ensure this is actually a mutation operation
  if (!h.isMutationOperation(operationId)) {
    throw new Error(`Operation ${String(operationId)} is not a mutation operation (POST/PUT/PATCH/DELETE)`)
  }

  const { path, method } = h.getOperationInfo(operationId)
  const { pathParams, options } = getParamsOptionsFrom<Ops, Op, MutationOptions<Ops, Op>>(
    pathParamsOrOptions,
    optionsOrNull,
  )
  const {
    axiosOptions,
    dontInvalidate,
    dontUpdateCache,
    invalidateOperations,
    refetchEndpoints,
    ...useMutationOptions
  } = options
  const extraPathParams = ref({}) as Ref<GetPathParameters<Ops, Op>>

  // Compute the resolved path
  const allPathParams = computed(() => ({
    ...toValue(pathParams),
    ...extraPathParams.value,
  }))
  const resolvedPath = computed(() => resolvePath(path, allPathParams.value))
  const queryKey = computed(() => generateQueryKey(resolvedPath.value))

  const mutation = useMutation({
    mutationFn: async (vars: MutationVars<Ops, Op>): Promise<GetResponseData<Ops, Op>> => {
      const { data, pathParams: pathParamsFromMutate } = vars
      extraPathParams.value = pathParamsFromMutate || ({} as GetPathParameters<Ops, Op>)

      // TODO: use typing to ensure all required path params are provided
      if (!isPathResolved(resolvedPath.value)) {
        return Promise.reject(
          new Error(
            `Mutation for '${String(operationId)}' cannot be used, as path is not resolved: ${resolvedPath.value} (params: ${JSON.stringify(allPathParams.value)})`,
          ),
        )
      }
      // Cancel any ongoing queries for this path (prevent race conditions with refresh)
      await h.queryClient.cancelQueries({ queryKey: queryKey.value, exact: false })

      const response = await h.axios({
        method: method.toLowerCase(),
        url: resolvedPath.value,
        data: data,
        ...(axiosOptions || {}),
      })
      return response.data
    },
    onSuccess: async (data, vars, _context) => {
      const {
        dontInvalidate: dontInvalidateMutate,
        dontUpdateCache: dontUpdateCacheMutate,
        invalidateOperations: invalidateOperationsMutate,
        refetchEndpoints: refetchEndpointsMutate,
      } = vars

      // Optimistically update cache with returned data for PUT/PATCH requests
      if (
        // dontUpdateCacheMutate supersedes dontUpdateCache from options
        (dontInvalidateMutate !== undefined ? !dontInvalidateMutate : !dontInvalidate) &&
        data &&
        [HttpMethod.PUT, HttpMethod.PATCH].includes(method)
      ) {
        await h.queryClient.setQueryData(queryKey.value, data)
      }

      // Invalidate queries for this path, and any additional specified operations
      if (dontUpdateCacheMutate !== undefined ? !dontUpdateCacheMutate : !dontUpdateCache) {
        // Invalidate all queries for this path (exact for POST, prefix for others):
        await h.queryClient.invalidateQueries({ queryKey: queryKey.value, exact: method !== HttpMethod.POST })

        const listPath = h.getListOperationPath(operationId)
        if (listPath) {
          const listResolvedPath = resolvePath(listPath, pathParams)
          if (isPathResolved(listResolvedPath)) {
            const listQueryKey = generateQueryKey(listResolvedPath)
            await h.queryClient.invalidateQueries({ queryKey: listQueryKey, exact: true })
          }
        }
      }

      const operationsWithPathParams: [Op, GetPathParameters<Ops, Op>][] = []
      Array.from([invalidateOperations, invalidateOperationsMutate]).forEach((ops) => {
        operationsWithPathParams.push(
          ...((typeof ops === 'object' && !Array.isArray(ops)
            ? Object.entries(ops)
            : ops?.map((opId) => [opId, {}]) || []) as [Op, GetPathParameters<Ops, Op>][]),
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
      extraPathParams.value = {} as GetPathParameters<Ops, Op>
    },
    ...useMutationOptions,
  })

  return {
    ...mutation,
    data: mutation.data as ComputedRef<GetResponseData<Ops, Op> | undefined>,
    isEnabled: computed(() => isPathResolved(resolvedPath.value)),
    extraPathParams,
  }
}
