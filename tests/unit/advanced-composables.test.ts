import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useEndpointQuery } from '@/openapi-query'
import { useEndpointMutation } from '@/openapi-mutation'
import { useEndpoint } from '@/openapi-endpoint'
import { getHelpers } from '@/openapi-helpers'
import { OpenApiConfig, QueryOptions } from '@/types'
import { mockAxios } from '../setup'

import { OperationId, OPERATION_INFO } from '../fixtures/api-operations'
import { type operations } from '../fixtures/openapi-types'

type MockOps = typeof OPERATION_INFO
type OperationsWithInfo = operations & MockOps
const mockOperations: OperationsWithInfo = OPERATION_INFO as OperationsWithInfo

describe('Advanced composable functionality', () => {
  let mockConfig: OpenApiConfig<OperationsWithInfo>
  let helpers: ReturnType<typeof getHelpers>

  beforeEach(() => {
    vi.clearAllMocks()

    mockConfig = {
      operations: mockOperations,
      axios: mockAxios,
    }
    helpers = getHelpers(mockConfig)
  })

  describe('useEndpointQuery', () => {
    it('should throw error for non-query operations', () => {
      expect(() => {
        useEndpointQuery<OperationsWithInfo, keyof OperationsWithInfo>(OperationId.createPet, helpers)
      }).toThrow('Operation createPet is not a query operation (GET/HEAD/OPTIONS)')
    })

    it('should accept GET operations', () => {
      const query = useEndpointQuery<OperationsWithInfo, typeof OperationId.listPets>(
        OperationId.listPets,
        helpers,
        {},
        {},
      )
      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })

    it('should handle path parameters correctly', () => {
      const query = useEndpointQuery<OperationsWithInfo, typeof OperationId.getPet>(
        OperationId.getPet,
        helpers,
        { petId: '123' },
        {},
      )
      expect(query).toBeTruthy()
      expect(query).toHaveProperty('queryKey')
    })

    it('should handle options correctly', () => {
      const onLoad = vi.fn()

      const _debug: QueryOptions<OperationsWithInfo, typeof OperationId.listPets> = {
        onLoad,
        axiosOptions: { headers: { 'X-Test': 'value' } },
        errorHandler: (_error) => {},
        staleTime: 3600, // <- type error here even though it is defined in UseQueryOptions
      }

      const query = useEndpointQuery<OperationsWithInfo, typeof OperationId.listPets>(
        OperationId.listPets,
        helpers,
        {},
        {
          onLoad,
          axiosOptions: { headers: { 'X-Test': 'value' } },
          errorHandler: (_error) => {},
          staleTime: 3600, // <- type error here even though it is defined in UseQueryOptions
        },
      )
      expect(query).toBeTruthy()
      expect(query).toHaveProperty('onLoad')
    })

    it('should generate correct query key', () => {
      const query = useEndpointQuery<OperationsWithInfo, typeof OperationId.getPet>(OperationId.getPet, helpers, {
        petId: '123',
      })
      expect(query.queryKey).toBeTruthy()
      expect(query.queryKey.value).toEqual(['pets', '123'])
    })

    it('should handle enabled state based on path resolution', () => {
      const queryWithParams = useEndpointQuery<OperationsWithInfo, typeof OperationId.getPet>(
        OperationId.getPet,
        helpers,
        { petId: '123' },
        {},
      )
      expect(queryWithParams.isEnabled).toBeTruthy()
      expect(queryWithParams.isEnabled.value).toBe(true)

      const queryWithoutParams = useEndpointQuery<OperationsWithInfo, keyof OperationsWithInfo>(
        OperationId.getPet,
        helpers,
        {},
        {},
      )
      expect(queryWithoutParams.isEnabled).toBeTruthy()
      expect(queryWithoutParams.isEnabled.value).toBe(false)
    })
  })

  describe('useEndpointMutation', () => {
    it('should throw error for query operations', () => {
      expect(() => {
        useEndpointMutation<OperationsWithInfo, keyof OperationsWithInfo>(OperationId.listPets, helpers, {}, {})
      }).toThrow('Operation listPets is not a mutation operation (POST/PUT/PATCH/DELETE)')
    })

    it('should accept POST operations', () => {
      const mutation = useEndpointMutation<OperationsWithInfo, keyof OperationsWithInfo>(
        OperationId.createPet,
        helpers,
        {},
        {},
      )
      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })

    it('should accept PUT operations', () => {
      const mutation = useEndpointMutation<OperationsWithInfo, typeof OperationId.updatePet>(
        OperationId.updatePet,
        helpers,
        { petId: '123' },
        {},
      )
      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })

    it('should accept DELETE operations', () => {
      const mutation = useEndpointMutation<OperationsWithInfo, typeof OperationId.deletePet>(
        OperationId.deletePet,
        helpers,
        { petId: '123' },
        {},
      )
      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })

    it('should handle path parameters correctly', () => {
      const mutation = useEndpointMutation<OperationsWithInfo, typeof OperationId.updatePet>(
        OperationId.updatePet,
        helpers,
        { petId: '123' },
        {},
      )
      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('isEnabled')
      expect(mutation.isEnabled.value).toBe(true)
    })

    it('should handle options correctly', () => {
      const onSuccess = vi.fn()
      const mutation = useEndpointMutation<OperationsWithInfo, typeof OperationId.createPet>(
        OperationId.createPet,
        helpers,
        {},
        {
          onSuccess,
          meta: { test: 'value' },
          retry: 2,
          errorHandler: (_error) => {},
          axiosOptions: { headers: { 'X-Test': 'value' } },
        },
      )
      expect(mutation).toBeTruthy()
    })
  })

  describe('useEndpoint', () => {
    it('should delegate to useEndpointQuery for query operations', () => {
      const endpoint = useEndpoint<OperationsWithInfo, typeof OperationId.listPets>(
        OperationId.listPets,
        helpers,
        {},
        {},
      )
      expect(endpoint).toBeTruthy()
      // Should have query-like properties
      expect(endpoint).toHaveProperty('data')
      expect(endpoint).toHaveProperty('isLoading')
    })

    it('should delegate to useEndpointMutation<OperationsWithInfo, keyof OperationsWithInfo> for mutation operations', () => {
      const endpoint = useEndpoint<OperationsWithInfo, typeof OperationId.createPet>(
        OperationId.createPet,
        helpers,
        {},
        {},
      )
      expect(endpoint).toBeTruthy()
      // Should have mutation-like properties
      expect(endpoint).toHaveProperty('mutate')
      expect(endpoint).toHaveProperty('mutateAsync')
    })

    it('should handle path parameters for both query and mutation operations', () => {
      const queryEndpoint = useEndpoint<OperationsWithInfo, typeof OperationId.getPet>(
        OperationId.getPet,
        helpers,
        { petId: '123' },
        {},
      )
      expect(queryEndpoint).toBeTruthy()

      const mutationEndpoint = useEndpoint<OperationsWithInfo, typeof OperationId.updatePet>(
        OperationId.updatePet,
        helpers,
        { petId: '123' },
        {},
      )
      expect(mutationEndpoint).toBeTruthy()
    })
  })

  describe('Integration scenarios', () => {
    it('should handle complex path resolution scenarios', () => {
      // Use existing nested operation from fixtures
      const query = useEndpointQuery<OperationsWithInfo, typeof OperationId.listUserPets>(
        OperationId.listUserPets,
        helpers,
        {
          userId: 'user1',
        },
        {},
      )

      expect(query.queryKey.value).toEqual(['users', 'user1', 'pets'])
      expect(query.isEnabled.value).toBe(true)
    })

    it('should handle missing path parameters gracefully', () => {
      const query = useEndpointQuery<OperationsWithInfo, typeof OperationId.getPet>(
        OperationId.getPet,
        helpers,
        { petId: undefined },
        {},
      )
      expect(query.isEnabled.value).toBe(false)
    })

    it('should support reactive path parameters', () => {
      // Create a ref-like object for testing
      const reactiveParams = { petId: '123' }
      const query = useEndpointQuery<OperationsWithInfo, keyof OperationsWithInfo>(
        OperationId.getPet,
        helpers,
        reactiveParams,
        {},
      )

      expect(query.queryKey.value).toEqual(['pets', '123'])
      expect(query.isEnabled.value).toBe(true)
    })

    it('should handle different axios options', () => {
      const customHeaders = { Authorization: 'Bearer token' }
      const query = useEndpointQuery<OperationsWithInfo, keyof OperationsWithInfo>(
        OperationId.listPets,
        helpers,
        {},
        {
          axiosOptions: { headers: customHeaders },
        },
      )

      expect(query).toBeTruthy()
      // Axios options should be passed through to the actual request
    })

    it('should support onLoad callbacks', () => {
      const onLoad = vi.fn()
      const query = useEndpointQuery<OperationsWithInfo, keyof OperationsWithInfo>(
        OperationId.listPets,
        helpers,
        {},
        { onLoad },
      )

      expect(query).toHaveProperty('onLoad')
      expect(typeof query.onLoad).toBe('function')
    })
  })

  describe('Error handling', () => {
    it('should handle invalid operation IDs gracefully', () => {
      // This would typically be caught at TypeScript compile time,
      // but we can test the runtime behavior
      const invalidHelpers = {
        ...helpers,
        getOperationInfo: vi.fn().mockReturnValue(null),
        isQueryOperation: vi.fn().mockReturnValue(false),
        isMutationOperation: vi.fn().mockReturnValue(false),
      }

      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        useEndpointQuery<OperationsWithInfo, keyof OperationsWithInfo>('invalidOp' as any, invalidHelpers, {}, {})
      }).toThrow()
    })

    it('should validate operation types at runtime', () => {
      // Test that POST operations are rejected by useEndpointQuery
      expect(() => {
        useEndpointQuery<OperationsWithInfo, keyof OperationsWithInfo>(OperationId.createPet, helpers, {}, {})
      }).toThrow('not a query operation')

      // Test that GET operations are rejected by useEndpointMutation
      expect(() => {
        useEndpointMutation<OperationsWithInfo, keyof OperationsWithInfo>(OperationId.listPets, helpers, {}, {})
      }).toThrow('not a mutation operation')
    })
  })

  describe('Type safety validation', () => {
    it('should enforce correct parameter types', () => {
      // These should work at runtime with proper types
      const queryWithCorrectParams = useEndpointQuery<OperationsWithInfo, typeof OperationId.getPet>(
        OperationId.getPet,
        helpers,
        { petId: '123' },
        {},
      )
      expect(queryWithCorrectParams).toBeTruthy()

      const mutationWithCorrectParams = useEndpointMutation<OperationsWithInfo, typeof OperationId.updatePet>(
        OperationId.updatePet,
        helpers,
        { petId: '123' },
        {},
      )
      expect(mutationWithCorrectParams).toBeTruthy()
    })

    it('should handle optional parameters correctly', () => {
      // Test with operations that don't require path parameters
      const query = useEndpointQuery<OperationsWithInfo, keyof OperationsWithInfo>(
        OperationId.listPets,
        helpers,
        {},
        {},
      )
      expect(query.isEnabled.value).toBe(true)

      const mutation = useEndpointMutation<OperationsWithInfo, typeof OperationId.createPet>(
        OperationId.createPet,
        helpers,
        {},
        {},
      )
      expect(mutation).toBeTruthy()
    })
  })
})
