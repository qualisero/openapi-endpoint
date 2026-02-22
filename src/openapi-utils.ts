import { computed, toValue, type ComputedRef } from 'vue'
import type { MaybeRefOrGetter } from '@vue/reactivity'

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
    if (value !== null && value !== undefined) {
      resolvedPath = resolvedPath.replace(`{${key}}`, String(value))
    }
  })

  return resolvedPath
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
  PathParams extends Record<string, string | number | undefined> = Record<string, never>,
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

export function normalizeParamsOptions<PathParams extends Record<string, unknown>, Options>(
  pathParams?: MaybeRefOrGetter<PathParams | null | undefined>,
  options?: Options,
): {
  pathParams: MaybeRefOrGetter<PathParams | null | undefined>
  options: Options
} {
  return {
    pathParams: pathParams ?? ({} as MaybeRefOrGetter<PathParams | null | undefined>),
    options: options ?? ({} as Options),
  }
}
