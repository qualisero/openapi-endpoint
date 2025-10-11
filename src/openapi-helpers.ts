import { HttpMethod, type OperationInfo, OpenApiConfig, Operations } from './types'
import { queryClient as defaultQueryClient } from './index'

// Helper returning the operationId prefix given an http method
function getMethodPrefix(method: HttpMethod): string | null {
  const METHOD_PREFIXES: Record<HttpMethod, string | null> = {
    [HttpMethod.GET]: 'get', // or 'list' depending on the operationId
    [HttpMethod.POST]: 'create',
    [HttpMethod.PUT]: 'update',
    [HttpMethod.PATCH]: 'update',
    [HttpMethod.DELETE]: 'delete',
    [HttpMethod.HEAD]: null,
    [HttpMethod.OPTIONS]: null,
    [HttpMethod.TRACE]: null,
  }
  return METHOD_PREFIXES[method]
}

export function getHelpers<Ops extends Operations<Ops>, Op extends keyof Ops>(config: OpenApiConfig<Ops>) {
  // Helper function to get operation info by ID
  function getOperationInfo(operationId: Op): OperationInfo {
    return config.operations[operationId as keyof Ops] as unknown as OperationInfo
  }

  // Helper to return a url path for matching list endpoint (e.g. /items/123 -> /items/)
  // Based on operationId prefix: createItem, updateItem -> listItems
  function getListOperationPath(operationId: Op): string | null {
    const opInfo = getOperationInfo(operationId)
    const operationIdStr: string = operationId as string
    const operationPrefix = opInfo ? getMethodPrefix(opInfo.method) : null
    // Make sure operationId matches `<operationPrefix><upercase resourceName>` pattern
    if (!operationPrefix || !/^[A-Z]/.test(operationIdStr.charAt(operationPrefix.length)))
      // If not, fallback to CRUD heuristic
      return getCrudListPathPrefix(operationId)
    const resourceName = operationIdStr.substring(operationPrefix.length)
    const listOperationId = `list${resourceName}`
    let listOperationInfo = getOperationInfo(listOperationId as Op)
    if (!listOperationInfo) {
      // Try pluralizing the resource name (simple heuristic)
      let pluralResourceName = resourceName
      const addEsSuffixes = ['s', 'x', 'z', 'ch', 'sh', 'o']
      if (resourceName.endsWith('y')) {
        pluralResourceName = resourceName.slice(0, -1) + 'ies'
      } else if (addEsSuffixes.some((suffix) => resourceName.endsWith(suffix))) {
        pluralResourceName = resourceName + 'es'
      } else {
        pluralResourceName = resourceName + 's'
      }
      listOperationInfo = getOperationInfo(`list${pluralResourceName}` as Op)
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

  // Constants for HTTP method categorization
  const QUERY_METHODS: HttpMethod[] = [HttpMethod.GET, HttpMethod.HEAD, HttpMethod.OPTIONS]
  const MUTATION_METHODS: HttpMethod[] = [HttpMethod.POST, HttpMethod.PUT, HttpMethod.PATCH, HttpMethod.DELETE]

  // Helper to check if an operation is a query method at runtime
  function isQueryOperation(operationId: Op): boolean {
    const { method } = getOperationInfo(operationId)
    return QUERY_METHODS.includes(method)
  }

  // Helper to check if an operation is a mutation method at runtime
  function isMutationOperation(operationId: Op): boolean {
    const { method } = getOperationInfo(operationId)
    return MUTATION_METHODS.includes(method)
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
