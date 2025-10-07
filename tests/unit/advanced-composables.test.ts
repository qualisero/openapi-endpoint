import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useEndpointQuery } from '@/openapi-query'
import { useEndpointMutation } from '@/openapi-mutation'
import { useEndpoint } from '@/openapi-endpoint'
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
}

type MockOps = typeof mockOperations

describe('Advanced composable functionality', () => {
  let mockAxios: any
  let mockConfig: OpenApiConfig<MockOps>
  let helpers: ReturnType<typeof getHelpers<MockOps>>

  beforeEach(() => {
    vi.clearAllMocks()

    mockAxios = vi.fn().mockResolvedValue({ data: { id: '123', name: 'Test Pet' } })
    mockConfig = {
      operations: mockOperations,
      axios: mockAxios,
    }
    helpers = getHelpers(mockConfig)
  })

  describe('useEndpointQuery', () => {
    it('should throw error for non-query operations', () => {
      expect(() => {
        useEndpointQuery('createPet', helpers, {}, {})
      }).toThrow('Operation createPet is not a query operation (GET/HEAD/OPTIONS)')
    })

    it('should accept GET operations', () => {
      const query = useEndpointQuery('listPets', helpers, {}, {})
      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })

    it('should handle path parameters correctly', () => {
      const query = useEndpointQuery('getPet', helpers, { petId: '123' }, {})
      expect(query).toBeTruthy()
      expect(query).toHaveProperty('queryKey')
    })

    it('should handle options correctly', () => {
      const onLoad = vi.fn()
      const query = useEndpointQuery(
        'listPets',
        helpers,
        {},
        {
          enabled: true,
          onLoad,
          axiosOptions: { headers: { 'X-Test': 'value' } },
        },
      )
      expect(query).toBeTruthy()
      expect(query).toHaveProperty('onLoad')
    })

    it('should generate correct query key', () => {
      const query = useEndpointQuery('getPet', helpers, { petId: '123' }, {})
      expect(query.queryKey).toBeTruthy()
      expect(query.queryKey.value).toEqual(['pets', '123'])
    })

    it('should handle enabled state based on path resolution', () => {
      const queryWithParams = useEndpointQuery('getPet', helpers, { petId: '123' }, {})
      expect(queryWithParams.isEnabled).toBeTruthy()
      expect(queryWithParams.isEnabled.value).toBe(true)

      const queryWithoutParams = useEndpointQuery('getPet', helpers, {}, {})
      expect(queryWithoutParams.isEnabled).toBeTruthy()
      expect(queryWithoutParams.isEnabled.value).toBe(false)
    })
  })

  describe('useEndpointMutation', () => {
    it('should throw error for query operations', () => {
      expect(() => {
        useEndpointMutation('listPets', helpers, {}, {})
      }).toThrow('Operation listPets is not a mutation operation (POST/PUT/PATCH/DELETE)')
    })

    it('should accept POST operations', () => {
      const mutation = useEndpointMutation('createPet', helpers, {}, {})
      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })

    it('should accept PUT operations', () => {
      const mutation = useEndpointMutation('updatePet', helpers, { petId: '123' }, {})
      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })

    it('should accept DELETE operations', () => {
      const mutation = useEndpointMutation('deletePet', helpers, { petId: '123' }, {})
      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })

    it('should handle path parameters correctly', () => {
      const mutation = useEndpointMutation('updatePet', helpers, { petId: '123' }, {})
      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('isEnabled')
      expect(mutation.isEnabled.value).toBe(true)
    })

    it('should handle options correctly', () => {
      const onSuccess = vi.fn()
      const mutation = useEndpointMutation(
        'createPet',
        helpers,
        {},
        {
          onSuccess,
          invalidateQueries: ['listPets'],
        },
      )
      expect(mutation).toBeTruthy()
    })
  })

  describe('useEndpoint', () => {
    it('should delegate to useEndpointQuery for query operations', () => {
      const endpoint = useEndpoint('listPets', helpers, {}, {})
      expect(endpoint).toBeTruthy()
      // Should have query-like properties
      expect(endpoint).toHaveProperty('data')
      expect(endpoint).toHaveProperty('isLoading')
    })

    it('should delegate to useEndpointMutation for mutation operations', () => {
      const endpoint = useEndpoint('createPet', helpers, {}, {})
      expect(endpoint).toBeTruthy()
      // Should have mutation-like properties
      expect(endpoint).toHaveProperty('mutate')
      expect(endpoint).toHaveProperty('mutateAsync')
    })

    it('should handle path parameters for both query and mutation operations', () => {
      const queryEndpoint = useEndpoint('getPet', helpers, { petId: '123' }, {})
      expect(queryEndpoint).toBeTruthy()

      const mutationEndpoint = useEndpoint('updatePet', helpers, { petId: '123' }, {})
      expect(mutationEndpoint).toBeTruthy()
    })
  })

  describe('Integration scenarios', () => {
    it('should handle complex path resolution scenarios', () => {
      // Test with nested path parameters
      const nestedOperations = {
        getUserPet: { method: HttpMethod.GET, path: '/users/{userId}/pets/{petId}' },
      }
      const nestedConfig = {
        operations: nestedOperations,
        axios: mockAxios,
      }
      const nestedHelpers = getHelpers(nestedConfig)

      const query = useEndpointQuery(
        'getUserPet',
        nestedHelpers,
        {
          userId: 'user1',
          petId: 'pet1',
        },
        {},
      )

      expect(query.queryKey.value).toEqual(['users', 'user1', 'pets', 'pet1'])
      expect(query.isEnabled.value).toBe(true)
    })

    it('should handle missing path parameters gracefully', () => {
      const query = useEndpointQuery('getPet', helpers, { petId: null }, {})
      expect(query.isEnabled.value).toBe(false)
    })

    it('should support reactive path parameters', () => {
      // Create a ref-like object for testing
      const reactiveParams = { petId: '123' }
      const query = useEndpointQuery('getPet', helpers, reactiveParams, {})

      expect(query.queryKey.value).toEqual(['pets', '123'])
      expect(query.isEnabled.value).toBe(true)
    })

    it('should handle different axios options', () => {
      const customHeaders = { Authorization: 'Bearer token' }
      const query = useEndpointQuery(
        'listPets',
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
      const query = useEndpointQuery('listPets', helpers, {}, { onLoad })

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
        useEndpointQuery('invalidOp' as any, invalidHelpers, {}, {})
      }).toThrow()
    })

    it('should validate operation types at runtime', () => {
      // Test that POST operations are rejected by useEndpointQuery
      expect(() => {
        useEndpointQuery('createPet', helpers, {}, {})
      }).toThrow('not a query operation')

      // Test that GET operations are rejected by useEndpointMutation
      expect(() => {
        useEndpointMutation('listPets', helpers, {}, {})
      }).toThrow('not a mutation operation')
    })
  })

  describe('Type safety validation', () => {
    it('should enforce correct parameter types', () => {
      // These should work at runtime with proper types
      const queryWithCorrectParams = useEndpointQuery('getPet', helpers, { petId: '123' }, {})
      expect(queryWithCorrectParams).toBeTruthy()

      const mutationWithCorrectParams = useEndpointMutation('updatePet', helpers, { petId: '123' }, {})
      expect(mutationWithCorrectParams).toBeTruthy()
    })

    it('should handle optional parameters correctly', () => {
      // Test with operations that don't require path parameters
      const query = useEndpointQuery('listPets', helpers, {}, {})
      expect(query.isEnabled.value).toBe(true)

      const mutation = useEndpointMutation('createPet', helpers, {}, {})
      expect(mutation).toBeTruthy()
    })
  })
})
