import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getHelpers } from '@/openapi-helpers'
import { OpenApiConfig } from '@/types'
import { QueryClient } from '@tanstack/vue-query'
import { mockAxios } from '../setup'

import { openApiOperations, operationConfig, type OpenApiOperations } from '../fixtures/api-operations'

const mockOperations: OpenApiOperations = openApiOperations

type MockConfig = OpenApiConfig<OpenApiOperations>

describe('openapi-helpers', () => {
  let mockConfig: MockConfig

  beforeEach(() => {
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
      expect(helpers).toHaveProperty('queryClient')
      expect(helpers.axios).toBe(mockAxios)
    })

    it('should use custom queryClient when provided in config', () => {
      const customQueryClient = {
        getQueryData: vi.fn(),
        setQueryData: vi.fn(),
        invalidateQueries: vi.fn(),
        cancelQueries: vi.fn(),
        refetchQueries: vi.fn(),
      } as unknown as QueryClient

      const configWithCustomClient: MockConfig = {
        operations: mockOperations,
        axios: mockAxios,
        queryClient: customQueryClient,
      }

      const helpers = getHelpers(configWithCustomClient)
      expect(helpers.queryClient).toBe(customQueryClient)
    })

    it('should use default queryClient when not provided in config', () => {
      const helpers = getHelpers(mockConfig)
      expect(helpers.queryClient).toBeDefined()
      expect(helpers.queryClient).toHaveProperty('getQueryData')
      expect(helpers.queryClient).toHaveProperty('setQueryData')
      expect(helpers.queryClient).toHaveProperty('invalidateQueries')
    })

    describe('getOperationInfo', () => {
      it('should return operation info for valid operation ID', () => {
        const helpers = getHelpers(mockConfig)
        const operationInfo = helpers.getOperationInfo('getPet' as keyof OpenApiOperations)

        expect(operationInfo).toEqual({
          method: 'GET',
          path: '/pets/{petId}',
        })
      })

      it('should return operation info for POST operation', () => {
        const helpers = getHelpers(mockConfig)
        const operationInfo = helpers.getOperationInfo('createPet' as keyof OpenApiOperations)

        expect(operationInfo).toEqual({
          method: 'POST',
          path: '/pets',
        })
      })
    })

    describe('isQueryOperation', () => {
      it('should return true for GET operations', () => {
        const helpers = getHelpers(mockConfig)
        expect(helpers.isQueryOperation('getPet' as keyof OpenApiOperations)).toBe(true)
        expect(helpers.isQueryOperation('listPets' as keyof OpenApiOperations)).toBe(true)
        expect(helpers.isQueryOperation('getOwners' as keyof OpenApiOperations)).toBe(true)
      })

      it('should return false for mutation operations', () => {
        const helpers = getHelpers(mockConfig)
        expect(helpers.isQueryOperation('createPet' as keyof OpenApiOperations)).toBe(false)
        expect(helpers.isQueryOperation('updatePet' as keyof OpenApiOperations)).toBe(false)
        expect(helpers.isQueryOperation('deletePet' as keyof OpenApiOperations)).toBe(false)
      })
    })

    describe('isMutationOperation', () => {
      it('should return true for POST operations', () => {
        const helpers = getHelpers(mockConfig)
        expect(helpers.isMutationOperation('createPet' as keyof OpenApiOperations)).toBe(true)
      })

      it('should return true for PUT operations', () => {
        const helpers = getHelpers(mockConfig)
        expect(helpers.isMutationOperation('updatePet' as keyof OpenApiOperations)).toBe(true)
      })

      it('should return true for DELETE operations', () => {
        const helpers = getHelpers(mockConfig)
        expect(helpers.isMutationOperation('deletePet' as keyof OpenApiOperations)).toBe(true)
      })

      it('should return false for query operations', () => {
        const helpers = getHelpers(mockConfig)
        expect(helpers.isMutationOperation('getPet' as keyof OpenApiOperations)).toBe(false)
        expect(helpers.isMutationOperation('listPets' as keyof OpenApiOperations)).toBe(false)
        expect(helpers.isMutationOperation('getOwners' as keyof OpenApiOperations)).toBe(false)
      })
    })

    describe('getListOperationPath', () => {
      it('should find list operation for create operation', () => {
        const helpers = getHelpers(mockConfig)
        const listPath = helpers.getListOperationPath('createPet' as keyof OpenApiOperations)
        expect(listPath).toBe('/pets')
      })

      it('should find list operation for update operation', () => {
        const helpers = getHelpers(mockConfig)
        const listPath = helpers.getListOperationPath('updatePet' as keyof OpenApiOperations)
        expect(listPath).toBe('/pets')
      })

      it('should find list operation for delete operation', () => {
        const helpers = getHelpers(mockConfig)
        const listPath = helpers.getListOperationPath('deletePet' as keyof OpenApiOperations)
        expect(listPath).toBe('/pets')
      })
    })

    describe('getCrudListPathPrefix', () => {
      it('should extract list path prefix from resource with ID parameter', () => {
        const helpers = getHelpers(mockConfig)
        const pathPrefix = helpers.getCrudListPathPrefix('getPet' as keyof OpenApiOperations)
        expect(pathPrefix).toBe('/pets/')
      })

      it('should return null for operations without ID parameter at the end', () => {
        // listUserPets path is '/users/{userId}/pets' which doesn't end with {petId}
        const helpers = getHelpers(mockConfig)
        const pathPrefix = helpers.getCrudListPathPrefix('listUserPets' as keyof OpenApiOperations)
        expect(pathPrefix).toBeNull()
      })

      it('should return null for operations without ID parameter in path', () => {
        const helpers = getHelpers(mockConfig)
        const pathPrefix = helpers.getCrudListPathPrefix('listPets' as keyof OpenApiOperations)
        expect(pathPrefix).toBeNull()
      })
    })
  })
})
