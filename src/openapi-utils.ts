import { toValue, type MaybeRefOrGetter } from 'vue'
import { type GetPathParameters, type MutationOptions, type QueryOptions, Operations } from './types'

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
  Options extends MutationOptions<Ops, Op> | QueryOptions<Ops, Op>,
>(
  pathParamsOrOptions?: MaybeRefOrGetter<GetPathParameters<Ops, Op> | null | undefined> | Options,
  optionsOrNull?: Options,
): {
  pathParams: MaybeRefOrGetter<GetPathParameters<Ops, Op> | null | undefined>
  options: Options
} {
  // Check if pathParamsOrOptions is MutationOptions or QueryOptions by checking if options is undefined
  // and pathParamsOrOptions has MutationOptions properties
  let pathParams: MaybeRefOrGetter<GetPathParameters<Ops, Op> | null | undefined> | undefined
  let options: Options | undefined
  if (optionsOrNull === undefined && pathParamsOrOptions && typeof pathParamsOrOptions === 'object') {
    // Called as: useEndpointQuery(operationId, options)
    options = pathParamsOrOptions as Options
  } else {
    // Called as: useEndpointQuery(operationId, pathParams, options)
    pathParams = pathParamsOrOptions as MaybeRefOrGetter<GetPathParameters<Ops, Op> | null | undefined>
    options = optionsOrNull
  }
  return {
    pathParams: pathParams ?? ({} as MaybeRefOrGetter<GetPathParameters<Ops, Op> | null | undefined>),
    options: options ?? ({} as Options),
  }
}
