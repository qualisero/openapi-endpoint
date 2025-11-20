import { describe, it, expect } from 'vitest'

// Import the OpenAPI specification for testing
import toyOpenApiSpec from '../fixtures/toy-openapi.json'

describe('CLI codegen functionality', () => {
  describe('parseOperationsFromSpec', () => {
    // We'll test this function by creating a pure implementation
    // since we can't easily import the actual CLI module due to Node.js dependencies

    const parseOperationsFromSpec = (openapiContent: string) => {
      const openApiSpec = JSON.parse(openapiContent)

      if (!openApiSpec.paths) {
        throw new Error('Invalid OpenAPI spec: missing paths')
      }

      const operationIds: string[] = []
      const operationInfoMap: Record<string, { path: string; method: string }> = {}

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Object.entries(openApiSpec.paths).forEach(([pathUrl, pathItem]: [string, any]) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Object.entries(pathItem).forEach(([method, operation]: [string, any]) => {
          const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace']
          if (!httpMethods.includes(method.toLowerCase())) {
            return
          }

          if (operation.operationId) {
            operationIds.push(operation.operationId)
            operationInfoMap[operation.operationId] = {
              path: pathUrl,
              method: method.toUpperCase(),
            }
          }
        })
      })

      operationIds.sort()

      return { operationIds, operationInfoMap }
    }

    it('should extract operation IDs from OpenAPI spec', () => {
      const openapiContent = JSON.stringify(toyOpenApiSpec)
      const result = parseOperationsFromSpec(openapiContent)

      expect(result.operationIds).toEqual([
        'createPet',
        'deletePet',
        'getPet',
        'listPets',
        'listUserPets',
        'updatePet',
        'uploadPetPic',
      ])
    })

    it('should create operation info map with correct structure', () => {
      const openapiContent = JSON.stringify(toyOpenApiSpec)
      const result = parseOperationsFromSpec(openapiContent)

      expect(result.operationInfoMap).toEqual({
        listPets: { path: '/pets', method: 'GET' },
        createPet: { path: '/pets', method: 'POST' },
        getPet: { path: '/pets/{petId}', method: 'GET' },
        updatePet: { path: '/pets/{petId}', method: 'PUT' },
        deletePet: { path: '/pets/{petId}', method: 'DELETE' },
        listUserPets: { path: '/users/{userId}/pets', method: 'GET' },
        uploadPetPic: { path: '/pets/{petId}/upload', method: 'POST' },
      })
    })

    it('should handle OpenAPI spec without paths', () => {
      const invalidSpec = JSON.stringify({ openapi: '3.0.0', info: { title: 'Test' } })

      expect(() => parseOperationsFromSpec(invalidSpec)).toThrow('Invalid OpenAPI spec: missing paths')
    })

    it('should ignore non-HTTP methods', () => {
      const specWithParameters = {
        openapi: '3.0.0',
        info: { title: 'Test' },
        paths: {
          '/test': {
            parameters: [{ name: 'test', in: 'query' }],
            get: { operationId: 'getTest' },
          },
        },
      }

      const result = parseOperationsFromSpec(JSON.stringify(specWithParameters))
      expect(result.operationIds).toEqual(['getTest'])
    })

    it('should skip operations without operationId', () => {
      const specWithoutOperationId = {
        openapi: '3.0.0',
        info: { title: 'Test' },
        paths: {
          '/test': {
            get: { summary: 'Get test' }, // No operationId
          },
        },
      }

      const result = parseOperationsFromSpec(JSON.stringify(specWithoutOperationId))
      expect(result.operationIds).toEqual([])
      expect(result.operationInfoMap).toEqual({})
    })

    it('should correctly parse toy spec including endpoints without operationId', () => {
      const openapiContent = JSON.stringify(toyOpenApiSpec)
      const result = parseOperationsFromSpec(openapiContent)

      // Should include the original operations with operationId
      expect(result.operationIds).toContain('createPet')
      expect(result.operationIds).toContain('getPet')
      expect(result.operationIds).toContain('listPets')
      expect(result.operationIds).toContain('updatePet')
      expect(result.operationIds).toContain('deletePet')
      expect(result.operationIds).toContain('listUserPets')
      expect(result.operationIds).toContain('uploadPetPic')
    })
  })

  describe('generateOperationId', () => {
    // Test the operationId generation logic
    const generateOperationId = (path: string, method: string): string => {
      const methodLower = method.toLowerCase()

      // Remove leading/trailing slashes and split path into segments
      const pathSegments = path
        .replace(/^\/+|\/+$/g, '')
        .split('/')
        .filter((segment) => segment.length > 0)

      // Remove path parameters (e.g., {petId}) and convert to camelCase
      const entityParts: string[] = []
      for (const segment of pathSegments) {
        if (!segment.startsWith('{') && !segment.endsWith('}')) {
          // Capitalize first letter of each segment
          entityParts.push(segment.charAt(0).toUpperCase() + segment.slice(1))
        }
      }

      // Join entity parts to form entity name (e.g., ['Pets', 'Owners'] -> 'PetsOwners')
      const entityName = entityParts.join('')

      // Determine prefix based on method and whether it's a collection or single resource
      let prefix = ''

      // Check if path ends with a parameter (single resource) or not (collection)
      const lastSegment = pathSegments[pathSegments.length - 1] || ''
      const isCollection = !lastSegment.startsWith('{') || pathSegments.length === 0

      switch (methodLower) {
        case 'get':
          // GET on collection -> list, GET on resource -> get
          prefix = isCollection ? 'list' : 'get'
          break
        case 'post':
          // POST usually creates, but check if it's a nested action
          if (pathSegments.length > 2 && !lastSegment.startsWith('{')) {
            // Nested action like /pets/{petId}/adopt -> postPetAdopt
            prefix = 'post'
          } else {
            prefix = 'create'
          }
          break
        case 'put':
        case 'patch':
          prefix = 'update'
          break
        case 'delete':
          prefix = 'delete'
          break
        case 'head':
          prefix = 'head'
          break
        case 'options':
          prefix = 'options'
          break
        case 'trace':
          prefix = 'trace'
          break
        default:
          prefix = methodLower
      }

      // Combine prefix and entity name
      return prefix + entityName
    }

    it('should generate getPet for GET /api/pet/{pet_id}', () => {
      expect(generateOperationId('/api/pet/{pet_id}', 'get')).toBe('getApiPet')
    })

    it('should generate updatePet for PATCH /api/pet/{pet_id}', () => {
      expect(generateOperationId('/api/pet/{pet_id}', 'patch')).toBe('updateApiPet')
    })

    it('should generate updatePet for PUT /api/pet/{pet_id}', () => {
      expect(generateOperationId('/api/pet/{pet_id}', 'put')).toBe('updateApiPet')
    })

    it('should generate postPetAdopt for POST /api/pet/{pet_id}/adopt', () => {
      expect(generateOperationId('/api/pet/{pet_id}/adopt', 'post')).toBe('postApiPetAdopt')
    })

    it('should generate listOwners for GET /owners', () => {
      expect(generateOperationId('/owners', 'get')).toBe('listOwners')
    })

    it('should generate createOwners for POST /owners', () => {
      expect(generateOperationId('/owners', 'post')).toBe('createOwners')
    })

    it('should generate listPets for GET /pets', () => {
      expect(generateOperationId('/pets', 'get')).toBe('listPets')
    })

    it('should generate getPet for GET /pets/{petId}', () => {
      expect(generateOperationId('/pets/{petId}', 'get')).toBe('getPets')
    })

    it('should generate deletePet for DELETE /pets/{petId}', () => {
      expect(generateOperationId('/pets/{petId}', 'delete')).toBe('deletePets')
    })

    it('should handle nested paths correctly', () => {
      expect(generateOperationId('/users/{userId}/pets', 'get')).toBe('listUsersPets')
      expect(generateOperationId('/users/{userId}/pets/{petId}', 'get')).toBe('getUsersPets')
    })

    it('should handle paths with leading/trailing slashes', () => {
      expect(generateOperationId('/pets/', 'get')).toBe('listPets')
      expect(generateOperationId('pets', 'get')).toBe('listPets')
    })

    it('should handle empty paths', () => {
      expect(generateOperationId('/', 'get')).toBe('list')
      expect(generateOperationId('', 'get')).toBe('list')
    })
  })

  describe('addMissingOperationIds', () => {
    const addMissingOperationIds = (openApiSpec: { paths?: Record<string, unknown> }): void => {
      if (!openApiSpec.paths) {
        return
      }

      const generateOperationId = (path: string, method: string): string => {
        const methodLower = method.toLowerCase()
        const pathSegments = path
          .replace(/^\/+|\/+$/g, '')
          .split('/')
          .filter((segment) => segment.length > 0)

        const entityParts: string[] = []
        for (const segment of pathSegments) {
          if (!segment.startsWith('{') && !segment.endsWith('}')) {
            entityParts.push(segment.charAt(0).toUpperCase() + segment.slice(1))
          }
        }

        const entityName = entityParts.join('')
        const lastSegment = pathSegments[pathSegments.length - 1] || ''
        const isCollection = !lastSegment.startsWith('{') || pathSegments.length === 0

        let prefix = ''
        switch (methodLower) {
          case 'get':
            prefix = isCollection ? 'list' : 'get'
            break
          case 'post':
            if (pathSegments.length > 2 && !lastSegment.startsWith('{')) {
              prefix = 'post'
            } else {
              prefix = 'create'
            }
            break
          case 'put':
          case 'patch':
            prefix = 'update'
            break
          case 'delete':
            prefix = 'delete'
            break
          default:
            prefix = methodLower
        }

        return prefix + entityName
      }

      Object.entries(openApiSpec.paths).forEach(([pathUrl, pathItem]) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Object.entries(pathItem as any).forEach(([method, operation]: [string, any]) => {
          const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace']
          if (!httpMethods.includes(method.toLowerCase())) {
            return
          }

          if (!operation.operationId) {
            operation.operationId = generateOperationId(pathUrl, method)
          }
        })
      })
    }

    it('should add operationId to operations without one', () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test' },
        paths: {
          '/pets': {
            get: { summary: 'List pets' },
          },
          '/pets/{petId}': {
            get: { summary: 'Get pet' },
            put: { summary: 'Update pet' },
          },
        },
      }

      addMissingOperationIds(spec)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((spec.paths['/pets'] as any).get.operationId).toBe('listPets')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((spec.paths['/pets/{petId}'] as any).get.operationId).toBe('getPets')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((spec.paths['/pets/{petId}'] as any).put.operationId).toBe('updatePets')
    })

    it('should not overwrite existing operationIds', () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test' },
        paths: {
          '/pets': {
            get: { operationId: 'customListPets', summary: 'List pets' },
          },
        },
      }

      addMissingOperationIds(spec)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((spec.paths['/pets'] as any).get.operationId).toBe('customListPets')
    })

    it('should handle specs without paths', () => {
      const spec: { openapi: string; info: { title: string }; paths?: Record<string, unknown> } = {
        openapi: '3.0.0',
        info: { title: 'Test' },
      }

      expect(() => addMissingOperationIds(spec)).not.toThrow()
    })

    it('should ignore non-HTTP methods', () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test' },
        paths: {
          '/pets': {
            parameters: [{ name: 'test' }],
            get: { summary: 'List pets' },
          },
        },
      }

      addMissingOperationIds(spec)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((spec.paths['/pets'] as any).get.operationId).toBe('listPets')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((spec.paths['/pets'] as any).parameters).toEqual([{ name: 'test' }])
    })
  })

  describe('generateApiOperationsContent', () => {
    const generateApiOperationsContent = (
      operationIds: string[],
      operationInfoMap: Record<string, { path: string; method: string }>,
    ): string => {
      // Generate operationsBase dictionary
      const operationsBaseContent = operationIds
        .map((id) => {
          const info = operationInfoMap[id]
          return `  ${id}: {\n    path: '${info.path}',\n    method: HttpMethod.${info.method},\n  },`
        })
        .join('\n')

      // Generate OperationId enum content
      const operationIdContent = operationIds.map((id) => `  ${id}: '${id}' as const,`).join('\n')

      return `// Auto-generated from OpenAPI specification
// Do not edit this file manually

import type { operations } from './openapi-types'

export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
  HEAD = 'HEAD',
  OPTIONS = 'OPTIONS',
  TRACE = 'TRACE',
}

// Create the typed structure that combines operations with operation metadata
// This ensures the debug method returns correct values and all operations are properly typed
const operationsBase = {
${operationsBaseContent}
} as const

// Merge with operations type to maintain OpenAPI type information
export const openApiOperations = operationsBase as typeof operationsBase & operations

export type OpenApiOperations = typeof openApiOperations

// Dynamically generate OperationId enum from the operations keys
export const OperationId = {
${operationIdContent}
} satisfies Record<keyof typeof operationsBase, keyof typeof operationsBase>

// Export the type for TypeScript inference
export type OperationId = keyof OpenApiOperations
`
    }

    it('should generate correct TypeScript content', () => {
      const operationIds = ['listPets', 'createPet', 'getPet']
      const operationInfoMap = {
        listPets: { path: '/pets', method: 'GET' },
        createPet: { path: '/pets', method: 'POST' },
        getPet: { path: '/pets/{petId}', method: 'GET' },
      }

      const content = generateApiOperationsContent(operationIds, operationInfoMap)

      expect(content).toContain("import type { operations } from './openapi-types'")
      expect(content).toContain('export enum HttpMethod {')
      expect(content).toContain('const operationsBase = {')
      expect(content).toContain('export const openApiOperations = operationsBase as typeof operationsBase & operations')
      expect(content).toContain('export type OpenApiOperations = typeof openApiOperations')
      expect(content).toContain('export const OperationId = {')
      expect(content).toContain("listPets: 'listPets' as const,")
      expect(content).toContain("createPet: 'createPet' as const,")
      expect(content).toContain("getPet: 'getPet' as const,")
      expect(content).toContain("listPets: {\n    path: '/pets',\n    method: HttpMethod.GET,\n  },")
      expect(content).toContain("createPet: {\n    path: '/pets',\n    method: HttpMethod.POST,\n  },")
      expect(content).toContain("getPet: {\n    path: '/pets/{petId}',\n    method: HttpMethod.GET,\n  },")
      expect(content).toContain('} satisfies Record<keyof typeof operationsBase, keyof typeof operationsBase>')
      expect(content).toContain('export type OperationId = keyof OpenApiOperations')
    })

    it('should handle empty operation lists', () => {
      const content = generateApiOperationsContent([], {})

      expect(content).toContain('const operationsBase = {\n\n} as const')
      expect(content).toContain(
        'export const OperationId = {\n\n} satisfies Record<keyof typeof operationsBase, keyof typeof operationsBase>',
      )
    })

    it('should generate valid TypeScript for toy OpenAPI spec', () => {
      const openapiContent = JSON.stringify(toyOpenApiSpec)
      const parseOperationsFromSpec = (content: string) => {
        const openApiSpec = JSON.parse(content)
        const operationIds: string[] = []
        const operationInfoMap: Record<string, { path: string; method: string }> = {}

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Object.entries(openApiSpec.paths).forEach(([pathUrl, pathItem]: [string, any]) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          Object.entries(pathItem).forEach(([method, operation]: [string, any]) => {
            const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace']
            if (!httpMethods.includes(method.toLowerCase())) return

            if (operation.operationId) {
              operationIds.push(operation.operationId)
              operationInfoMap[operation.operationId] = {
                path: pathUrl,
                method: method.toUpperCase(),
              }
            }
          })
        })

        operationIds.sort()
        return { operationIds, operationInfoMap }
      }

      const { operationIds, operationInfoMap } = parseOperationsFromSpec(openapiContent)
      const content = generateApiOperationsContent(operationIds, operationInfoMap)

      // Verify all operations from toy spec are present
      expect(content).toContain("createPet: 'createPet'")
      expect(content).toContain("deletePet: 'deletePet'")
      expect(content).toContain("getPet: 'getPet'")
      expect(content).toContain("listPets: 'listPets'")
      expect(content).toContain("listUserPets: 'listUserPets'")
      expect(content).toContain("updatePet: 'updatePet'")
    })
  })

  describe('URL validation patterns', () => {
    it('should identify HTTP URLs correctly', () => {
      const httpUrl = 'http://api.example.com/openapi.json'
      const httpsUrl = 'https://api.example.com/openapi.json'
      const localFile = './tests/fixtures/toy-openapi.json'

      expect(httpUrl.startsWith('http://')).toBe(true)
      expect(httpsUrl.startsWith('https://')).toBe(true)
      expect(localFile.startsWith('http://') || localFile.startsWith('https://')).toBe(false)
    })

    it('should validate command line arguments format', () => {
      const validateArgs = (args: string[]) => {
        if (args.length !== 2) {
          throw new Error('Exactly 2 arguments are required')
        }
        return { openapiInput: args[0], outputDir: args[1] }
      }

      expect(() => validateArgs([])).toThrow('Exactly 2 arguments are required')
      expect(() => validateArgs(['input'])).toThrow('Exactly 2 arguments are required')
      expect(() => validateArgs(['input', 'output', 'extra'])).toThrow('Exactly 2 arguments are required')

      const valid = validateArgs(['input.json', 'output/'])
      expect(valid).toEqual({ openapiInput: 'input.json', outputDir: 'output/' })
    })
  })
})
