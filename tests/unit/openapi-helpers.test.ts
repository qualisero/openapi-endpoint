import { describe, it, expect, vi } from 'vitest'
import { getHelpers } from '@/openapi-helpers'
import { HttpMethod, OpenApiConfig } from '@/types'

// Define mock operations for testing
const mockOperations = {
  listPets: { method: HttpMethod.GET, path: '/pets' },
  getPet: { method: HttpMethod.GET, path: '/pets/{petId}' },
  createPet: { method: HttpMethod.POST, path: '/pets' },
  updatePet: { method: HttpMethod.PUT, path: '/pets/{petId}' },
  deletePet: { method: HttpMethod.DELETE, path: '/pets/{petId}' },
  listUsers: { method: HttpMethod.GET, path: '/users' },
  getUser: { method: HttpMethod.GET, path: '/users/{userId}' },
  createUser: { method: HttpMethod.POST, path: '/users' },
  listItems: { method: HttpMethod.GET, path: '/items' },
  createItem: { method: HttpMethod.POST, path: '/items' },
  updateItem: { method: HttpMethod.PUT, path: '/items/{itemId}' },
  deleteItem: { method: HttpMethod.DELETE, path: '/items/{itemId}' },
  listCategories: { method: HttpMethod.GET, path: '/categories' },
  createCategory: { method: HttpMethod.POST, path: '/categories' },
  updateCategory: { method: HttpMethod.PUT, path: '/categories/{categoryId}' },
  deleteCategory: { method: HttpMethod.DELETE, path: '/categories/{categoryId}' },
  headPets: { method: HttpMethod.HEAD, path: '/pets' },
  optionsPets: { method: HttpMethod.OPTIONS, path: '/pets' },
}

type MockOps = typeof mockOperations
type MockConfig = OpenApiConfig<MockOps>

describe('openapi-helpers', () => {
  let mockAxios: any
  let mockConfig: MockConfig

  beforeEach(() => {
    mockAxios = vi.fn()
    mockConfig = {
      operations: mockOperations,
      axios: mockAxios,
    }
  })

  describe('getHelpers', () => {
    it('should return all helper functions', () => {
      const helpers = getHelpers(mockConfig)

      expect(helpers).toHaveProperty('getOperationInfo')
      expect(helpers).toHaveProperty('getListOperationPath')
      expect(helpers).toHaveProperty('getCrudListPathPrefix')
      expect(helpers).toHaveProperty('isQueryOperation')
      expect(helpers).toHaveProperty('isMutationOperation')
      expect(helpers).toHaveProperty('axios')
      expect(helpers.axios).toBe(mockAxios)
    })

    describe('getOperationInfo', () => {
      it('should return operation info for valid operation ID', () => {
        const helpers = getHelpers(mockConfig)
        const operationInfo = helpers.getOperationInfo('getPet')

        expect(operationInfo).toEqual({
          method: HttpMethod.GET,
          path: '/pets/{petId}',
        })
      })

      it('should return operation info for POST operation', () => {
        const helpers = getHelpers(mockConfig)
        const operationInfo = helpers.getOperationInfo('createPet')

        expect(operationInfo).toEqual({
          method: HttpMethod.POST,
          path: '/pets',
        })
      })
    })

    describe('isQueryOperation', () => {
      it('should return true for GET operations', () => {
        const helpers = getHelpers(mockConfig)
        expect(helpers.isQueryOperation('listPets')).toBe(true)
        expect(helpers.isQueryOperation('getPet')).toBe(true)
      })

      it('should return true for HEAD operations', () => {
        const helpers = getHelpers(mockConfig)
        expect(helpers.isQueryOperation('headPets')).toBe(true)
      })

      it('should return true for OPTIONS operations', () => {
        const helpers = getHelpers(mockConfig)
        expect(helpers.isQueryOperation('optionsPets')).toBe(true)
      })

      it('should return false for mutation operations', () => {
        const helpers = getHelpers(mockConfig)
        expect(helpers.isQueryOperation('createPet')).toBe(false)
        expect(helpers.isQueryOperation('updatePet')).toBe(false)
        expect(helpers.isQueryOperation('deletePet')).toBe(false)
      })
    })

    describe('isMutationOperation', () => {
      it('should return true for POST operations', () => {
        const helpers = getHelpers(mockConfig)
        expect(helpers.isMutationOperation('createPet')).toBe(true)
      })

      it('should return true for PUT operations', () => {
        const helpers = getHelpers(mockConfig)
        expect(helpers.isMutationOperation('updatePet')).toBe(true)
      })

      it('should return true for DELETE operations', () => {
        const helpers = getHelpers(mockConfig)
        expect(helpers.isMutationOperation('deletePet')).toBe(true)
      })

      it('should return false for query operations', () => {
        const helpers = getHelpers(mockConfig)
        expect(helpers.isMutationOperation('listPets')).toBe(false)
        expect(helpers.isMutationOperation('getPet')).toBe(false)
        expect(helpers.isMutationOperation('headPets')).toBe(false)
        expect(helpers.isMutationOperation('optionsPets')).toBe(false)
      })
    })

    describe('getListOperationPath', () => {
      it('should find list operation for create operation', () => {
        const helpers = getHelpers(mockConfig)
        const listPath = helpers.getListOperationPath('createPet')
        expect(listPath).toBe('/pets')
      })

      it('should find list operation for update operation', () => {
        const helpers = getHelpers(mockConfig)
        const listPath = helpers.getListOperationPath('updatePet')
        expect(listPath).toBe('/pets')
      })

      it('should find list operation for delete operation', () => {
        const helpers = getHelpers(mockConfig)
        const listPath = helpers.getListOperationPath('deletePet')
        expect(listPath).toBe('/pets')
      })

      it('should handle plural resource names', () => {
        const helpers = getHelpers(mockConfig)
        const listPath = helpers.getListOperationPath('createCategory')
        expect(listPath).toBe('/categories')
      })

      it('should return null when list operation not found', () => {
        const helpers = getHelpers(mockConfig)
        // For an operation without a corresponding list operation
        const listPath = helpers.getListOperationPath('getUser')
        expect(listPath).toBe('/users')
      })
    })

    describe('getCrudListPathPrefix', () => {
      it('should extract list path prefix from resource with ID parameter', () => {
        const helpers = getHelpers(mockConfig)
        const pathPrefix = helpers.getCrudListPathPrefix('updatePet')
        expect(pathPrefix).toBe('/pets/')
      })

      it('should extract list path prefix from nested resource', () => {
        // Add a nested resource operation for testing
        const nestedConfig = {
          operations: {
            ...mockOperations,
            updateUserPet: { method: HttpMethod.PUT, path: '/users/{userId}/pets/{petId}' },
          },
          axios: mockAxios,
        }
        const nestedHelpers = getHelpers(nestedConfig)
        const pathPrefix = nestedHelpers.getCrudListPathPrefix('updateUserPet')
        expect(pathPrefix).toBe('/users/{userId}/pets/')
      })

      it('should return null for operations without ID parameter in path', () => {
        const helpers = getHelpers(mockConfig)
        const pathPrefix = helpers.getCrudListPathPrefix('createPet')
        expect(pathPrefix).toBeNull()
      })

      it('should handle single segment paths', () => {
        // Add a simple resource for testing
        const simpleConfig = {
          operations: {
            ...mockOperations,
            updateRoot: { method: HttpMethod.PUT, path: '/{id}' },
          },
          axios: mockAxios,
        }
        const simpleHelpers = getHelpers(simpleConfig)
        const pathPrefix = simpleHelpers.getCrudListPathPrefix('updateRoot')
        expect(pathPrefix).toBeNull()
      })
    })
  })
})
