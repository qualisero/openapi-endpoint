import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { MaybeRefOrGetter } from '@vue/reactivity'
import { useMutation } from '@tanstack/vue-query'
import { type AxiosResponse } from 'axios'

import {
  type EndpointConfig,
  type MutationOptions,
  type MutationVars,
  type MutateFn,
  type MutateAsyncFn,
  HttpMethod,
  isMutationMethod,
} from './types'
import {
  isPathResolved,
  normalizeParamsOptions,
  useResolvedOperation,
  resolvePath,
  generateQueryKey,
} from './openapi-utils'

/**
 * Return type of `useEndpointMutation` (the `useMutation` composable on a generated namespace).
 *
 * @template TResponse    Response data type
 * @template TPathParams  Path parameters type (concrete, required values)
 * @template TRequest     Request body type (`never` if none)
 * @template TQueryParams Query parameters type
 *
 * @group Types
 */
export interface MutationReturn<
  TResponse,
  TPathParams extends Record<string, unknown> = Record<string, never>,
  TRequest = never,
  TQueryParams extends Record<string, unknown> = Record<string, never>,
> {
  /** The Axios response (undefined until mutation completes). */
  data: ComputedRef<AxiosResponse<TResponse> | undefined>
  /** The error if the mutation failed. */
  error: Ref<Error | null>
  /** True while the mutation is in progress. */
  isPending: Ref<boolean>
  /** True when the mutation succeeded. */
  isSuccess: Ref<boolean>
  /** True when the mutation failed. */
  isError: Ref<boolean>
  /** Execute the mutation (non-blocking). */
  mutate: MutateFn<TPathParams, TRequest, TQueryParams>
  /** Execute the mutation and await the response. */
  mutateAsync: MutateAsyncFn<TResponse, TPathParams, TRequest, TQueryParams>
  /** Reset the mutation state. */
  reset: () => void
  /** Whether the mutation can execute (all required path params are resolved). */
  isEnabled: ComputedRef<boolean>
  /** The resolved path parameters. */
  pathParams: ComputedRef<TPathParams>
  /** Additional path params that can be supplied at mutation time. */
  extraPathParams: Ref<TPathParams>
}

/**
 * Execute a type-safe mutation (POST/PUT/PATCH/DELETE) with automatic cache management.
 *
 * This is a low-level primitive — in normal usage it is called by the generated
 * per-operation `useMutation` wrappers in `api-client.ts`, not directly.
 *
 * @template TResponse    The response data type
 * @template TPathParams  The path parameters type (concrete, required values)
 * @template TRequest     The request body type (`never` if no body)
 * @template TQueryParams The query parameters type
 *
 * @param config      Endpoint config: axios instance, queryClient, path, method, listPath, operationsRegistry
 * @param pathParams  Path parameters (reactive). Pass `undefined` for operations without path params.
 * @param options     Mutation options (dontInvalidate, refetchEndpoints, etc.)
 */
export function useEndpointMutation<
  TResponse,
  TPathParams extends Record<string, unknown> = Record<string, never>,
  TRequest = never,
  TQueryParams extends Record<string, unknown> = Record<string, never>,
>(
  config: EndpointConfig,
  pathParams?: MaybeRefOrGetter<Record<string, string | number | undefined> | null | undefined>,
  options?: MutationOptions<TResponse, TPathParams, TRequest, TQueryParams>,
): MutationReturn<TResponse, TPathParams, TRequest, TQueryParams> {
  if (!isMutationMethod(config.method)) {
    throw new Error(
      `Operation at '${config.path}' uses method ${config.method} and cannot be used with useMutation(). ` +
        `Use useQuery() for GET/HEAD/OPTIONS operations.`,
    )
  }

  const { pathParams: resolvedPathParamsInput, options: resolvedOptions } = normalizeParamsOptions<
    Record<string, string | number | undefined>,
    MutationOptions<TResponse, TPathParams, TRequest, TQueryParams>
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

  const extraPathParams = ref({}) as Ref<Record<string, string | undefined>>

  const {
    resolvedPath,
    queryKey,
    queryParams: resolvedQueryParams,
    pathParams: allPathParams,
  } = useResolvedOperation(config.path, resolvedPathParamsInput, queryParams, extraPathParams)

  const mutation = useMutation(
    {
      mutationFn: async (vars: MutationVars<TPathParams, TRequest, TQueryParams>) => {
        const {
          pathParams: pathParamsFromMutate,
          axiosOptions: axiosOptionsFromMutate,
          queryParams: queryParamsFromMutate,
        } = (vars || {}) as MutationVars<TPathParams, TRequest, TQueryParams> & {
          pathParams?: Record<string, string | undefined>
        }
        const data = (vars as { data?: TRequest } | undefined)?.data

        extraPathParams.value = (pathParamsFromMutate || {}) as Record<string, string | undefined>

        if (!isPathResolved(resolvedPath.value)) {
          return Promise.reject(
            new Error(
              `Cannot execute mutation at '${config.path}': path parameters not resolved. ` +
                `Path: '${resolvedPath.value}', provided params: ${JSON.stringify(allPathParams.value)}`,
            ),
          )
        }

        await config.queryClient.cancelQueries({ queryKey: queryKey.value, exact: false })

        return config.axios({
          method: config.method.toLowerCase(),
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
      onSuccess: async (response, vars) => {
        const data = (response as AxiosResponse<TResponse>).data
        const {
          dontInvalidate: dontInvalidateMutate,
          dontUpdateCache: dontUpdateCacheMutate,
          invalidateOperations: invalidateOperationsMutate,
          refetchEndpoints: refetchEndpointsMutate,
        } = (vars || {}) as MutationVars<TPathParams, TRequest, TQueryParams>

        // Update cache for PUT/PATCH
        if (
          (dontUpdateCacheMutate !== undefined ? !dontUpdateCacheMutate : !dontUpdateCache) &&
          data &&
          [HttpMethod.PUT, HttpMethod.PATCH].includes(config.method)
        ) {
          await config.queryClient.setQueryData(queryKey.value, data)
        }

        // Invalidate queries for this path
        if (dontInvalidateMutate !== undefined ? !dontInvalidateMutate : !dontInvalidate) {
          await config.queryClient.invalidateQueries({
            queryKey: queryKey.value,
            exact: config.method !== HttpMethod.POST,
          })

          // Invalidate associated list path
          if (config.listPath) {
            const listResolvedPath = resolvePath(config.listPath, resolvedPathParamsInput)
            if (isPathResolved(listResolvedPath)) {
              const listQueryKey = generateQueryKey(listResolvedPath)
              await config.queryClient.invalidateQueries({
                predicate: (query: { queryKey: readonly unknown[] }) => {
                  const qKey = query.queryKey
                  if (!qKey || qKey.length === 0) return false
                  const normalizedKey =
                    typeof qKey[qKey.length - 1] === 'object' && qKey[qKey.length - 1] !== null
                      ? qKey.slice(0, -1)
                      : qKey
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

        // Resolve invalidateOperations entries using the registry
        const registry = config.operationsRegistry || {}
        const allInvalidateOps = [invalidateOperations, invalidateOperationsMutate].filter(Boolean)

        const operationsWithPathParams: [string, Record<string, string | undefined>][] = []
        for (const ops of allInvalidateOps) {
          if (!ops) continue
          if (Array.isArray(ops)) {
            operationsWithPathParams.push(...ops.map((id) => [id, {}] as [string, Record<string, string | undefined>]))
          } else {
            operationsWithPathParams.push(
              ...Object.entries(ops).map(
                ([id, params]) => [id, params] as [string, Record<string, string | undefined>],
              ),
            )
          }
        }

        if (operationsWithPathParams.length > 0) {
          const promises = operationsWithPathParams.map(([opId, opParams]) => {
            const opInfo = registry[opId]
            if (!opInfo) {
              console.warn(`Cannot invalidate operation '${opId}': not found in operations registry`)
              return Promise.resolve()
            }
            const opPath = resolvePath(opInfo.path, {
              ...(allPathParams.value as Record<string, string | undefined>),
              ...opParams,
            })
            if (isPathResolved(opPath)) {
              const opQueryKey = generateQueryKey(opPath)
              return config.queryClient.invalidateQueries({ queryKey: opQueryKey, exact: true })
            } else {
              console.warn(`Cannot invalidate operation '${opId}', path not resolved: ${opPath}`)
              return Promise.resolve()
            }
          })
          await Promise.all(promises)
        }

        const allRefetch = [
          ...(refetchEndpoints || []),
          ...((vars as { refetchEndpoints?: { refetch: () => Promise<void> }[] } | undefined)?.refetchEndpoints || []),
          ...(refetchEndpointsMutate || []),
        ]
        if (allRefetch.length > 0) {
          await Promise.all(allRefetch.map((ep) => ep.refetch()))
        }
      },
      onSettled: () => {
        extraPathParams.value = {}
      },
      ...useMutationOptions,
    },
    config.queryClient,
  )

  return {
    ...mutation,
    data: mutation.data as ComputedRef<AxiosResponse<TResponse> | undefined>,
    isEnabled: computed(() => isPathResolved(resolvedPath.value)),
    extraPathParams: extraPathParams as Ref<TPathParams>,
    pathParams: allPathParams as ComputedRef<TPathParams>,
  } as unknown as MutationReturn<TResponse, TPathParams, TRequest, TQueryParams>
}
