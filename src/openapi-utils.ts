import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from 'vue'
import { type ApiPathParams, type QMutationOptions, type QQueryOptions, Operations } from './types'

// Known option-like properties to distinguish from path parameters
const OPTION_PROPERTIES = [
  'enabled',
  'onSuccess',
  'onError',
  'onSettled',
  'select',
  'retry',
  'staleTime',
  'cacheTime',
  'refetchOnWindowFocus',
  'refetchOnReconnect',
  'refetchOnMount',
  'suspense',
  'useErrorBoundary',
  'meta',
  'mutationKey',
  'mutationFn',
  'queryKey',
  'queryFn',
  'initialData',
  'context',
]

// Helper to resolve path parameters in a URL path
export function resolvePath(
  path: string,
  pathParams?: MaybeRefOrGetter<Record<string, string | number | undefined> | null | undefined>,
): string {
  if (pathParams === null || pathParams === undefined) return path
  const pathParamsValue = toValue(pathParams)
  if (!pathParamsValue) return path

  let resolvedPath = path
  Object.entries(pathParamsValue).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      resolvedPath = resolvedPath.replace(`{${key}}`, String(value))
    }
  })

  return resolvedPath
}

function isPathParams(path: string, pathParams: Record<string, string | number | undefined>): boolean {
  if (!pathParams) return false
  const paramNames = Object.keys(pathParams)

  // If any option-like property is present, it's not path params
  if (paramNames.some((name) => OPTION_PROPERTIES.includes(name))) {
    return false
  }
  return paramNames.every((paramName) => path.includes(`{${paramName}}`))
}

// Helper to check if all required path parameters are provided
export function isPathResolved(path: string): boolean {
  return !/{[^}]+}/.test(path)
}

// Helper to generate query key from resolved path
export function generateQueryKey(resolvedPath: string): string[] {
  return resolvedPath.split('/').filter((segment) => segment.length > 0)
}

/**
 * Return type for useResolvedOperation composable
 */
export interface ResolvedOperation<PathParams, QueryParams> {
  /** Computed path parameters (resolved from reactive source) */
  pathParams: ComputedRef<PathParams>
  /** Computed resolved path with parameters substituted */
  resolvedPath: ComputedRef<string>
  /** Computed query parameters (resolved from reactive source) */
  queryParams: ComputedRef<QueryParams>
  /** Computed query key for TanStack Query */
  queryKey: ComputedRef<string[] | (string | QueryParams)[]>
  /** Whether the path is fully resolved (all params provided) */
  isResolved: ComputedRef<boolean>
}

/**
 * Composable for resolving operation paths and parameters.
 * Consolidates the common pattern of computing resolved paths, query keys, and parameters.
 *
 * @param path - The OpenAPI path template (e.g., '/pets/{petId}')
 * @param pathParams - Reactive path parameters
 * @param queryParams - Optional reactive query parameters
 * @param extraPathParams - Optional ref for additional path params (used by mutations)
 */
export function useResolvedOperation<
  PathParams extends Record<string, string | number | undefined>,
  QueryParams extends Record<string, unknown> = Record<string, never>,
>(
  path: string,
  pathParams: MaybeRefOrGetter<PathParams | null | undefined>,
  queryParams?: MaybeRefOrGetter<QueryParams | null | undefined>,
  extraPathParams?: { value: Partial<PathParams> },
): ResolvedOperation<PathParams, QueryParams> {
  // Compute all path params (base + extra for mutations)
  const allPathParams = computed(() => {
    const base = toValue(pathParams) || ({} as PathParams)
    if (extraPathParams?.value) {
      return { ...base, ...extraPathParams.value } as PathParams
    }
    return base
  })

  // Compute resolved path
  const resolvedPath = computed(() => resolvePath(path, allPathParams.value))

  // Compute query params
  const allQueryParams = computed(() => {
    const result = toValue(queryParams)
    return (result || {}) as QueryParams
  })

  // Generate query key including query params if present
  const queryKey = computed(() => {
    const baseKey = generateQueryKey(resolvedPath.value)
    const qParams = allQueryParams.value
    if (qParams && Object.keys(qParams).length > 0) {
      return [...baseKey, qParams] as (string | QueryParams)[]
    }
    return baseKey
  })

  // Check if path is resolved
  const isResolved = computed(() => isPathResolved(resolvedPath.value))

  return {
    pathParams: allPathParams,
    resolvedPath,
    queryParams: allQueryParams,
    queryKey: queryKey as ComputedRef<string[] | (string | QueryParams)[]>,
    isResolved,
  }
}

export function getParamsOptionsFrom<
  Ops extends Operations<Ops>,
  Op extends keyof Ops,
  Options extends QMutationOptions<Ops, Op> | QQueryOptions<Ops, Op>,
>(
  path: string,
  pathParamsOrOptions?: MaybeRefOrGetter<ApiPathParams<Ops, Op> | null | undefined> | Options,
  optionsOrNull?: Options,
): {
  pathParams: MaybeRefOrGetter<ApiPathParams<Ops, Op> | null | undefined>
  options: Options
} {
  type PathParams = MaybeRefOrGetter<ApiPathParams<Ops, Op> | null | undefined>

  let pathParams: PathParams | undefined = undefined
  let options: Options | undefined = undefined

  if (optionsOrNull === undefined) {
    const pathParamsOrOptionsValue = toValue(pathParamsOrOptions)
    if (
      (typeof pathParamsOrOptions === 'object' || typeof pathParamsOrOptions === 'function') &&
      pathParamsOrOptions !== null &&
      pathParamsOrOptionsValue &&
      typeof pathParamsOrOptionsValue === 'object' &&
      isPathParams(path, pathParamsOrOptionsValue as Record<string, string | number | undefined>)
    ) {
      // Called as: useEndpointQuery(operationId, pathParams)
      pathParams = pathParamsOrOptions as PathParams
    } else {
      // Called as: useEndpointQuery(operationId, [options])
      options = pathParamsOrOptions as Options
    }
  } else {
    // Called as: useEndpointQuery(operationId, pathParams, options)
    pathParams = pathParamsOrOptions as PathParams
    options = optionsOrNull
  }

  return {
    pathParams: pathParams ?? ({} as PathParams),
    options: options ?? ({} as Options),
  }
}
