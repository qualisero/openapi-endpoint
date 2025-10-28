import { toValue, type MaybeRefOrGetter } from 'vue'
import { type GetPathParameters, type QMutationOptions, type QQueryOptions, Operations } from './types'

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

export function getParamsOptionsFrom<
  Ops extends Operations<Ops>,
  Op extends keyof Ops,
  Options extends QMutationOptions<Ops, Op> | QQueryOptions<Ops, Op>,
>(
  path: string,
  pathParamsOrOptions?: MaybeRefOrGetter<GetPathParameters<Ops, Op> | null | undefined> | Options,
  optionsOrNull?: Options,
): {
  pathParams: MaybeRefOrGetter<GetPathParameters<Ops, Op> | null | undefined>
  options: Options
} {
  type PathParams = MaybeRefOrGetter<GetPathParameters<Ops, Op> | null | undefined>

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
