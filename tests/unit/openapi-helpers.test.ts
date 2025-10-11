import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getHelpers } from '@/openapi-helpers'
import { QueryClient } from '@tanstack/vue-query'
import { mockAxios } from '../setup'

import { OperationId, OPERATION_INFO } from '../fixtures/api-operations'
import { type operations } from '../fixtures/openapi-types'

type CombinedOps = operations & typeof OPERATION_INFO

describe('openapi-helpers', () => {
  let mockConfig: {
    operations: CombinedOps
    axios: any
    queryClient?: any
  }

  beforeEach(() => {
    mockConfig = {
      operations: OPERATION_INFO as CombinedOps,
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

      const configWithCustomClient = {
        operations: OPERATION_INFO as CombinedOps,
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
        const operationInfo = helpers.getOperationInfo(OperationId.getPet)

        expect(operationInfo).toEqual({
          method: 'GET',
          path: '/pets/{petId}',
        })
      })

      it('should return operation info for POST operation', () => {
        const helpers = getHelpers(mockConfig)
        const operationInfo = helpers.getOperationInfo(OperationId.createPet)

        expect(operationInfo).toEqual({
          method: 'POST',
          path: '/pets',
        })
      })
    })

    describe('isQueryOperation', () => {
      it('should return true for GET operations', () => {
        const helpers = getHelpers(mockConfig)
        expect(helpers.isQueryOperation(OperationId.listPets)).toBe(true)
        expect(helpers.isQueryOperation(OperationId.getPet)).toBe(true)
        expect(helpers.isQueryOperation(OperationId.listUserPets)).toBe(true)
      })

      it('should return false for mutation operations', () => {
        const helpers = getHelpers(mockConfig)
        expect(helpers.isQueryOperation(OperationId.createPet)).toBe(false)
        expect(helpers.isQueryOperation(OperationId.updatePet)).toBe(false)
        expect(helpers.isQueryOperation(OperationId.deletePet)).toBe(false)
      })
    })

    describe('isMutationOperation', () => {
      it('should return true for POST operations', () => {
        const helpers = getHelpers(mockConfig)
        expect(helpers.isMutationOperation(OperationId.createPet)).toBe(true)
      })

      it('should return true for PUT operations', () => {
        const helpers = getHelpers(mockConfig)
        expect(helpers.isMutationOperation(OperationId.updatePet)).toBe(true)
      })

      it('should return true for DELETE operations', () => {
        const helpers = getHelpers(mockConfig)
        expect(helpers.isMutationOperation(OperationId.deletePet)).toBe(true)
      })

      it('should return false for query operations', () => {
        const helpers = getHelpers(mockConfig)
        expect(helpers.isMutationOperation(OperationId.listPets)).toBe(false)
        expect(helpers.isMutationOperation(OperationId.getPet)).toBe(false)
        expect(helpers.isMutationOperation(OperationId.listUserPets)).toBe(false)
      })
    })

    describe('getListOperationPath', () => {
      it('should find list operation for create operation', () => {
        const helpers = getHelpers(mockConfig)
        const listPath = helpers.getListOperationPath(OperationId.createPet)
        expect(listPath).toBe('/pets')
      })

      it('should find list operation for update operation', () => {
        const helpers = getHelpers(mockConfig)
        const listPath = helpers.getListOperationPath(OperationId.updatePet)
        expect(listPath).toBe('/pets')
      })

      it('should find list operation for delete operation', () => {
        const helpers = getHelpers(mockConfig)
        const listPath = helpers.getListOperationPath(OperationId.deletePet)
        expect(listPath).toBe('/pets')
      })
    })

    describe('getCrudListPathPrefix', () => {
      it('should extract list path prefix from resource with ID parameter', () => {
        const helpers = getHelpers(mockConfig)
        const pathPrefix = helpers.getCrudListPathPrefix(OperationId.updatePet)
        expect(pathPrefix).toBe('/pets/')
      })

      it('should return null for operations without ID parameter at the end', () => {
        // listUserPets path is '/users/{userId}/pets' which doesn't end with {petId}
        const helpers = getHelpers(mockConfig)
        const pathPrefix = helpers.getCrudListPathPrefix(OperationId.listUserPets)
        expect(pathPrefix).toBeNull()
      })

      it('should return null for operations without ID parameter in path', () => {
        const helpers = getHelpers(mockConfig)
        const pathPrefix = helpers.getCrudListPathPrefix(OperationId.createPet)
        expect(pathPrefix).toBeNull()
      })
    })
  })
})
