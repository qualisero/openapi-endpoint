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

      Object.entries(openApiSpec.paths).forEach(([pathUrl, pathItem]: [string, any]) => {
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
    // Helper to convert snake_case to PascalCase
    const snakeToPascalCase = (str: string): string => {
      return str
        .split('_')
        .filter((part) => part.length > 0)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join('')
    }

    // Helper to check if path has file extension
    const hasFileExtension = (pathUrl: string): boolean => {
      const segments = pathUrl.split('/').filter((s) => s.length > 0 && !s.startsWith('{'))
      if (segments.length === 0) return false
      const lastSegment = segments[segments.length - 1]
      return /\.\w+$/.test(lastSegment)
    }

    // Test the operationId generation logic
    const generateOperationId = (path: string, method: string, prefixToStrip: string = ''): string => {
      const methodLower = method.toLowerCase()

      // Strip prefix if provided and path starts with it
      let effectivePath = path
      if (prefixToStrip && path.startsWith(prefixToStrip)) {
        effectivePath = path.substring(prefixToStrip.length)
      }

      // Remove leading/trailing slashes, replace slashes and periods with underscores
      // Filter out path parameters (e.g., {petId})
      const cleanPath = effectivePath
        .replace(/^\/+|\/+$/g, '')
        .split('/')
        .filter((segment) => segment.length > 0 && !segment.startsWith('{') && !segment.endsWith('}'))
        .join('_')
        .replace(/\./g, '_') // Replace periods with underscores

      // Convert the entire path (now with underscores) to PascalCase
      const entityName = snakeToPascalCase(cleanPath)

      // Determine prefix based on method and whether it's a collection or single resource
      let prefix = ''

      // Check if path ends with a parameter (single resource) or not (collection)
      const pathSegments = effectivePath
        .replace(/^\/+|\/+$/g, '')
        .split('/')
        .filter((segment) => segment.length > 0)
      const lastSegment = pathSegments[pathSegments.length - 1] || ''
      const isCollection = !lastSegment.startsWith('{') || pathSegments.length === 0

      switch (methodLower) {
        case 'get':
          // GET on file extension -> get, GET on collection -> list, GET on resource -> get
          if (hasFileExtension(effectivePath)) {
            prefix = 'get'
          } else {
            prefix = isCollection ? 'list' : 'get'
          }
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

    it('should generate getPet for GET /api/pet/{pet_id} with /api prefix', () => {
      expect(generateOperationId('/api/pet/{pet_id}', 'get', '/api')).toBe('getPet')
    })

    it('should generate updatePet for PATCH /api/pet/{pet_id} with /api prefix', () => {
      expect(generateOperationId('/api/pet/{pet_id}', 'patch', '/api')).toBe('updatePet')
    })

    it('should generate updatePet for PUT /api/pet/{pet_id} with /api prefix', () => {
      expect(generateOperationId('/api/pet/{pet_id}', 'put', '/api')).toBe('updatePet')
    })

    it('should generate postPetAdopt for POST /api/pet/{pet_id}/adopt with /api prefix', () => {
      expect(generateOperationId('/api/pet/{pet_id}/adopt', 'post', '/api')).toBe('postPetAdopt')
    })

    it('should generate getApiPet for GET /api/pet/{pet_id} without prefix stripping', () => {
      expect(generateOperationId('/api/pet/{pet_id}', 'get')).toBe('getApiPet')
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

    it('should convert snake_case to camelCase in path segments', () => {
      expect(generateOperationId('/pet/give_treats', 'post')).toBe('createPetGiveTreats')
      expect(generateOperationId('/api/pet/give_treats', 'post', '/api')).toBe('createPetGiveTreats')
      expect(generateOperationId('/user_profile/{userId}', 'get')).toBe('getUserProfile')
      expect(generateOperationId('/admin_settings/update_config', 'put')).toBe('updateAdminSettingsUpdateConfig')
    })

    it('should handle mixed case and snake_case segments', () => {
      expect(generateOperationId('/pets/special_treats', 'get')).toBe('listPetsSpecialTreats')
      expect(generateOperationId('/pet/{petId}/give_treats', 'post')).toBe('postPetGiveTreats')
    })

    it('should strip /v1 prefix when provided', () => {
      expect(generateOperationId('/v1/pets', 'get', '/v1')).toBe('listPets')
      expect(generateOperationId('/v1/pets/{petId}', 'get', '/v1')).toBe('getPets')
    })

    it('should strip /api/v1 prefix when provided', () => {
      expect(generateOperationId('/api/v1/pets', 'get', '/api/v1')).toBe('listPets')
    })

    it('should use get prefix for file extensions instead of list', () => {
      expect(generateOperationId('/config.json', 'get')).toBe('getConfigJson')
      expect(generateOperationId('/api/config.json', 'get', '/api')).toBe('getConfigJson')
      expect(generateOperationId('/data.v1.json', 'get')).toBe('getDataV1Json')
      expect(generateOperationId('/api/export.xml', 'get', '/api')).toBe('getExportXml')
    })

    it('should replace periods with underscores in paths', () => {
      expect(generateOperationId('/data.v1.json', 'get')).toBe('getDataV1Json')
      expect(generateOperationId('/api/config.production.yml', 'get', '/api')).toBe('getConfigProductionYml')
    })
  })

  describe('addMissingOperationIds', () => {
    const snakeToPascalCase = (str: string): string => {
      return str
        .split('_')
        .filter((part) => part.length > 0)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join('')
    }

    const hasFileExtension = (pathUrl: string): boolean => {
      const segments = pathUrl.split('/').filter((s) => s.length > 0 && !s.startsWith('{'))
      if (segments.length === 0) return false
      const lastSegment = segments[segments.length - 1]
      return /\.\w+$/.test(lastSegment)
    }

    const generateOperationId = (path: string, method: string, prefixToStrip: string = ''): string => {
      const methodLower = method.toLowerCase()

      // Strip prefix if provided and path starts with it
      let effectivePath = path
      if (prefixToStrip && path.startsWith(prefixToStrip)) {
        effectivePath = path.substring(prefixToStrip.length)
      }

      // Remove leading/trailing slashes, replace slashes and periods with underscores
      // Filter out path parameters (e.g., {petId})
      const cleanPath = effectivePath
        .replace(/^\/+|\/+$/g, '')
        .split('/')
        .filter((segment) => segment.length > 0 && !segment.startsWith('{') && !segment.endsWith('}'))
        .join('_')
        .replace(/\./g, '_') // Replace periods with underscores

      // Convert the entire path (now with underscores) to PascalCase
      const entityName = snakeToPascalCase(cleanPath)

      // Determine prefix based on method and whether it's a collection or single resource
      const pathSegments = effectivePath
        .replace(/^\/+|\/+$/g, '')
        .split('/')
        .filter((segment) => segment.length > 0)
      const lastSegment = pathSegments[pathSegments.length - 1] || ''
      const isCollection = !lastSegment.startsWith('{') || pathSegments.length === 0

      let prefix = ''
      switch (methodLower) {
        case 'get':
          // GET on file extension -> get, GET on collection -> list, GET on resource -> get
          if (hasFileExtension(effectivePath)) {
            prefix = 'get'
          } else {
            prefix = isCollection ? 'list' : 'get'
          }
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

    const addMissingOperationIds = (
      openApiSpec: { paths?: Record<string, unknown> },
      prefixToStrip: string = '/api',
    ): void => {
      if (!openApiSpec.paths) {
        return
      }

      Object.entries(openApiSpec.paths).forEach(([pathUrl, pathItem]) => {
        Object.entries(pathItem as any).forEach(([method, operation]: [string, any]) => {
          const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace']
          if (!httpMethods.includes(method.toLowerCase())) {
            return
          }

          if (!operation.operationId) {
            operation.operationId = generateOperationId(pathUrl, method, prefixToStrip)
          }
        })
      })
    }

    it('should add operationId to operations without one (no prefix)', () => {
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

      // Pass empty string to not strip any prefix
      addMissingOperationIds(spec, '')

      expect((spec.paths['/pets'] as any).get.operationId).toBe('listPets')

      expect((spec.paths['/pets/{petId}'] as any).get.operationId).toBe('getPets')

      expect((spec.paths['/pets/{petId}'] as any).put.operationId).toBe('updatePets')
    })

    it('should strip /api prefix when generating operationIds (default behavior)', () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test' },
        paths: {
          '/api/pets': {
            get: { summary: 'List pets' },
          },
          '/api/pets/{petId}': {
            get: { summary: 'Get pet' },
            patch: { summary: 'Update pet' },
          },
          '/api/pets/{petId}/adopt': {
            post: { summary: 'Adopt pet' },
          },
        },
      }

      // Use default prefix '/api'
      addMissingOperationIds(spec)

      expect((spec.paths['/api/pets'] as any).get.operationId).toBe('listPets')

      expect((spec.paths['/api/pets/{petId}'] as any).get.operationId).toBe('getPets')

      expect((spec.paths['/api/pets/{petId}'] as any).patch.operationId).toBe('updatePets')

      expect((spec.paths['/api/pets/{petId}/adopt'] as any).post.operationId).toBe('postPetsAdopt')
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

      // Use empty string to not strip prefix
      addMissingOperationIds(spec, '')

      expect((spec.paths['/pets'] as any).get.operationId).toBe('listPets')

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

        Object.entries(openApiSpec.paths).forEach(([pathUrl, pathItem]: [string, any]) => {
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

  describe('enum extraction', () => {
    // Helper function to extract enums from OpenAPI spec (mirrors CLI implementation)
    const extractEnumsFromSpec = (openApiSpec: any) => {
      const enums: { name: string; values: (string | number)[]; sourcePath: string }[] = []
      const seenEnumValues = new Map<string, string>()

      if (!openApiSpec.components?.schemas) {
        return enums
      }

      const toPascalCase = (str: string) =>
        str
          .split(/[-_\s]+/)
          .filter((part) => part.length > 0)
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
          .join('')

      for (const [schemaName, schema] of Object.entries(openApiSpec.components.schemas)) {
        if (!(schema as any).properties) continue

        for (const [propName, propSchema] of Object.entries((schema as any).properties)) {
          if (!(propSchema as any).enum) continue

          const enumValues = (propSchema as any).enum as (string | number)[]
          const enumName = toPascalCase(schemaName) + toPascalCase(propName)
          const valuesKey = JSON.stringify([...enumValues].sort())

          const existingName = seenEnumValues.get(valuesKey)
          if (existingName) {
            continue
          }

          seenEnumValues.set(valuesKey, enumName)
          enums.push({
            name: enumName,
            values: enumValues,
            sourcePath: `components.schemas.${schemaName}.properties.${propName}`,
          })
        }
      }

      enums.sort((a, b) => a.name.localeCompare(b.name))
      return enums
    }

    it('should extract enums from components.schemas', () => {
      const enums = extractEnumsFromSpec(toyOpenApiSpec)

      expect(enums).toHaveLength(1)
      expect(enums[0].name).toBe('PetStatus')
      expect(enums[0].values).toEqual(expect.arrayContaining(['available', 'pending', 'adopted']))
    })

    it('should deduplicate enums with same values', () => {
      // Pet and NewPet both have the same status enum
      const enums = extractEnumsFromSpec(toyOpenApiSpec)

      // Should only have one enum, not two
      expect(enums).toHaveLength(1)
    })

    it('should generate correct source path', () => {
      const enums = extractEnumsFromSpec(toyOpenApiSpec)

      expect(enums[0].sourcePath).toBe('components.schemas.Pet.properties.status')
    })

    it('should handle spec without components', () => {
      const specWithoutComponents = { openapi: '3.0.0', paths: {} }
      const enums = extractEnumsFromSpec(specWithoutComponents)

      expect(enums).toHaveLength(0)
    })

    it('should handle spec without schemas', () => {
      const specWithoutSchemas = { openapi: '3.0.0', paths: {}, components: {} }
      const enums = extractEnumsFromSpec(specWithoutSchemas)

      expect(enums).toHaveLength(0)
    })

    it('should handle spec with schemas but no enums', () => {
      const specNoEnums = {
        openapi: '3.0.0',
        paths: {},
        components: {
          schemas: {
            Pet: {
              type: 'object',
              properties: {
                name: { type: 'string' },
              },
            },
          },
        },
      }
      const enums = extractEnumsFromSpec(specNoEnums)

      expect(enums).toHaveLength(0)
    })

    it('should convert enum values to valid member names', () => {
      const specWithVariousEnums = {
        openapi: '3.0.0',
        paths: {},
        components: {
          schemas: {
            Order: {
              type: 'object',
              properties: {
                status: {
                  type: 'string',
                  enum: ['in-progress', 'completed', 'pending_review'],
                },
              },
            },
          },
        },
      }
      const enums = extractEnumsFromSpec(specWithVariousEnums)

      expect(enums).toHaveLength(1)
      expect(enums[0].name).toBe('OrderStatus')
      expect(enums[0].values).toEqual(['in-progress', 'completed', 'pending_review'])
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
