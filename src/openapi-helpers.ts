import {
  HttpMethod,
  type OperationInfo,
  OpenApiConfig,
  Operations,
  QueryClientLike,
  isQueryMethod,
  isMutationMethod,
} from './types'
import { QueryClient } from '@tanstack/vue-query'

/**
 * Default QueryClient instance with pre-configured options.
 *
 * This client is used by default when no custom QueryClient is provided to useOpenApi.
 * It includes sensible defaults like 5-minute stale time for queries.
 */
const defaultQueryClient: QueryClientLike = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5 },
  },
})

/**
 * Suffixes that require adding 'es' for pluralization (e.g., 'box' -> 'boxes').
 */
const PLURAL_ES_SUFFIXES = ['s', 'x', 'z', 'ch', 'sh', 'o'] as const

/**
 * Mapping of HTTP methods to their CRUD operation name prefixes.
 * Used to infer resource names from operation IDs.
 */
const CRUD_PREFIXES: Record<HttpMethod, { singular: string; plural: string } | null> = {
  [HttpMethod.GET]: { singular: 'get', plural: 'list' },
  [HttpMethod.POST]: { singular: 'create', plural: 'create' },
  [HttpMethod.PUT]: { singular: 'update', plural: 'update' },
  [HttpMethod.PATCH]: { singular: 'update', plural: 'update' },
  [HttpMethod.DELETE]: { singular: 'delete', plural: 'delete' },
  [HttpMethod.HEAD]: null,
  [HttpMethod.OPTIONS]: null,
  [HttpMethod.TRACE]: null,
}

/**
 * Extracts the resource name from an operation ID based on its HTTP method.
 * @param operationId - The operation ID (e.g., 'createPet', 'updatePet')
 * @param method - The HTTP method
 * @returns The resource name (e.g., 'Pet') or null if not extractable
 */
function getResourceName(operationId: string, method: HttpMethod): string | null {
  const prefixes = CRUD_PREFIXES[method]
  if (!prefixes) return null

  // Try singular prefix first (get, create, update, delete)
  if (operationId.startsWith(prefixes.singular)) {
    const remaining = operationId.slice(prefixes.singular.length)
    if (remaining.length > 0 && /^[A-Z]/.test(remaining)) {
      return remaining
    }
  }

  // Try plural prefix (list)
  if (operationId.startsWith(prefixes.plural)) {
    const remaining = operationId.slice(prefixes.plural.length)
    if (remaining.length > 0 && /^[A-Z]/.test(remaining)) {
      return remaining
    }
  }

  return null
}

/**
 * Pluralizes a resource name using common English rules.
 * @param name - The singular resource name
 * @returns The pluralized name
 */
function pluralizeResource(name: string): string {
  if (name.endsWith('y')) {
    return name.slice(0, -1) + 'ies'
  } else if (PLURAL_ES_SUFFIXES.some((suffix) => name.endsWith(suffix))) {
    return name + 'es'
  }
  return name + 's'
}

export function getHelpers<Ops extends Operations<Ops>, Op extends keyof Ops>(config: OpenApiConfig<Ops>) {
  // Helper function to get operation info by ID
  function getOperationInfo(operationId: Op): OperationInfo {
    return config.operations[operationId]
  }

  // Helper to return a url path for matching list endpoint (e.g. /items/123 -> /items/)
  // Based on operationId prefix: createItem, updateItem -> listItem
  function getListOperationPath(operationId: Op): string | null {
    const opInfo = getOperationInfo(operationId)
    const operationIdStr: string = operationId as string

    // Try to extract resource name from operation ID
    const resourceName = getResourceName(operationIdStr, opInfo.method)
    if (!resourceName) {
      // Fallback to CRUD heuristic based on path structure
      return getCrudListPathPrefix(operationId)
    }

    // Try to find list operation with same resource name
    const listOperationId = `list${resourceName}`
    let listOperationInfo = getOperationInfo(listOperationId as Op)

    // If not found, try pluralized version
    if (!listOperationInfo) {
      const pluralName = pluralizeResource(resourceName)
      listOperationInfo = getOperationInfo(`list${pluralName}` as Op)
    }

    if (listOperationInfo && listOperationInfo.method === HttpMethod.GET) {
      return listOperationInfo.path
    }
    return null
  }

  // Fallback to return a url path prefix matching list endpoint (e.g. /items/123 -> /items/)
  // based on Assumes standard CRUD Restful patterns.
  function getCrudListPathPrefix(operationId: Op): string | null {
    const { path } = getOperationInfo(operationId)
    // for PUT/PATCH/DELETE, strip last segment if it's a path parameter
    const segments = path.split('/').filter((segment) => segment.length > 0)
    if (segments.length >= 2 && /^{[^}]+}$/.test(segments.at(-1)!)) {
      return '/' + segments.slice(0, -1).join('/') + '/'
    }
    return null
  }

  // Helper to check if an operation is a query method at runtime
  function isQueryOperation(operationId: Op): boolean {
    const { method } = getOperationInfo(operationId)
    return isQueryMethod(method)
  }

  // Helper to check if an operation is a mutation method at runtime
  function isMutationOperation(operationId: Op): boolean {
    const { method } = getOperationInfo(operationId)
    return isMutationMethod(method)
  }

  return {
    getOperationInfo,
    getListOperationPath,
    getCrudListPathPrefix,
    isQueryOperation,
    isMutationOperation,
    axios: config.axios,
    queryClient: config.queryClient || defaultQueryClient,
  }
}

export type OpenApiHelpers<Ops extends Operations<Ops>, Op extends keyof Ops> = ReturnType<typeof getHelpers<Ops, Op>>

export { defaultQueryClient as queryClient }
