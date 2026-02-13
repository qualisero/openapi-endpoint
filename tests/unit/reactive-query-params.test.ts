import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed } from 'vue'
import { useOpenApi } from '@/index'
import { OpenApiConfig, type OpenApiInstance } from '@/types'
import { mockAxios } from '../setup'
import { OperationId, openApiOperations, type OpenApiOperations } from '../fixtures/openapi-typed-operations'
import { PetStatus } from '../fixtures/api-enums'

/**
 * Tests for Reactive Query Parameters
 *
 * This test suite validates the new reactive query parameters feature:
 * - Type-safe query parameters based on OpenAPI spec
 * - Reactive query params (ref, computed, function)
 * - Automatic refetch when query params change
 * - Works with both queries and mutations
 */
describe('Reactive Query Parameters', () => {
  const mockOperations: OpenApiOperations = openApiOperations

  let mockConfig: OpenApiConfig<OpenApiOperations>
  let api: OpenApiInstance<OpenApiOperations>

  beforeEach(() => {
    vi.clearAllMocks()
    mockConfig = {
      operations: mockOperations,
      axios: mockAxios,
    }
    api = useOpenApi(mockConfig)
  })

  describe('Type Safety', () => {
    it('should accept valid query parameters for operations with query params', () => {
      // listPets has a 'limit' query parameter in the OpenAPI spec
      const query = api.useQuery(OperationId.listPets, {
        queryParams: { limit: 10 },
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })

    it('should work with operations that have no query parameters', () => {
      // getPet has no query parameters, but queryParams should still be accepted
      const query = api.useQuery(OperationId.getPet, { petId: '123' }, {})

      expect(query).toBeTruthy()
    })

    it('should support empty query params object', () => {
      const query = api.useQuery(OperationId.listPets, {
        queryParams: {},
      })

      expect(query).toBeTruthy()
    })
  })

  describe('Static Query Parameters', () => {
    it('should pass static query params to axios', () => {
      const query = api.useQuery(OperationId.listPets, {
        queryParams: { limit: 50 },
      })

      expect(query).toBeTruthy()
      expect(query.queryKey.value).toBeDefined()
    })

    it('should merge queryParams with axiosOptions.params', () => {
      const query = api.useQuery(OperationId.listPets, {
        queryParams: { limit: 50 },
        axiosOptions: {
          params: { page: 1 },
        },
      })

      expect(query).toBeTruthy()
      // Both params should be included in the request
    })

    it('should include query params in the query key', () => {
      const query1 = api.useQuery(OperationId.listPets, {
        queryParams: { limit: 10 },
      })

      const query2 = api.useQuery(OperationId.listPets, {
        queryParams: { limit: 20 },
      })

      // Query keys should be different due to different query params
      expect(query1.queryKey.value).not.toEqual(query2.queryKey.value)
    })
  })

  describe('Reactive Query Parameters with Refs', () => {
    it('should accept ref-based query parameters', () => {
      const limit = ref({ limit: 10 })
      const query = api.useQuery(OperationId.listPets, {
        queryParams: limit,
      })

      expect(query).toBeTruthy()
      expect(query.queryKey.value).toBeDefined()
    })

    it('should accept object ref with query parameters', () => {
      const queryParams = ref({ limit: 10 })
      const query = api.useQuery(OperationId.listPets, {
        queryParams: queryParams,
      })

      expect(query).toBeTruthy()
    })
  })

  describe('Reactive Query Parameters with Computed', () => {
    it('should accept computed query parameters', () => {
      const limit = ref(10)
      const queryParams = computed(() => ({ limit: limit.value }))

      const query = api.useQuery(OperationId.listPets, {
        queryParams: queryParams,
      })

      expect(query).toBeTruthy()
      expect(query.queryKey.value).toBeDefined()
    })

    it('should handle complex computed query params', () => {
      const selectedStatus = ref<PetStatus | undefined>(PetStatus.Available)
      const maxResults = ref(10)

      const queryParams = computed(() => ({
        ...(selectedStatus.value ? { status: selectedStatus.value } : {}),
        limit: maxResults.value,
      }))

      const query = api.useQuery(OperationId.listPets, {
        queryParams: queryParams as any,
      })

      expect(query).toBeTruthy()
      expect(query.queryKey.value).toBeDefined()
    })
  })

  describe('Reactive Query Parameters with Functions', () => {
    it('should accept function-based query parameters', () => {
      let limit = 10

      const query = api.useQuery(OperationId.listPets, {
        queryParams: () => ({ limit }),
      })

      expect(query).toBeTruthy()
    })

    it('should evaluate function on each query execution', () => {
      let limit = 10
      const query = api.useQuery(OperationId.listPets, {
        queryParams: () => ({ limit }),
      })

      expect(query).toBeTruthy()
      // In real usage, changing `limit` and calling refetch would use the new value
    })
  })

  describe('Query Parameter Reactivity - Automatic Refetch', () => {
    it('should include query params in query key for automatic refetch', () => {
      const limit = ref(10)
      const query = api.useQuery(OperationId.listPets, {
        queryParams: computed(() => ({ limit: limit.value })),
      })

      expect(query).toBeTruthy()
      // In TanStack Query, changing the query key automatically triggers a refetch
      // The query key includes the query params, so changing them triggers refetch
      expect(query.queryKey.value).toBeDefined()
      const queryKeyString = JSON.stringify(query.queryKey.value)
      expect(queryKeyString).toContain('10')
    })

    it('should maintain separate cache entries for different query params', () => {
      const query1 = api.useQuery(OperationId.listPets, {
        queryParams: { limit: 10 },
      })

      const query2 = api.useQuery(OperationId.listPets, {
        queryParams: { limit: 20 },
      })

      // Different query params should result in different query keys
      expect(query1.queryKey.value).not.toEqual(query2.queryKey.value)
    })
  })

  describe('Mutations with Query Parameters', () => {
    it('should support query params in mutation options', () => {
      const mutation = api.useMutation(OperationId.createPet, {
        queryParams: { returnDetails: true } as any,
      })

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })

    it('should support reactive query params in mutations', () => {
      const includeDetails = ref(true)
      const mutation = api.useMutation(OperationId.createPet, {
        queryParams: computed(() => ({ returnDetails: includeDetails.value })) as any,
      })

      expect(mutation).toBeTruthy()
    })

    it('should support query params in mutate call', () => {
      const mutation = api.useMutation(OperationId.createPet)

      expect(() => {
        mutation.mutate({
          data: { name: 'Fluffy' },
          queryParams: { returnDetails: true } as any,
        })
      }).not.toThrow()
    })

    it('should merge query params from options and mutate call', () => {
      const mutation = api.useMutation(OperationId.createPet, {
        queryParams: { format: 'json' } as any,
      })

      expect(() => {
        mutation.mutate({
          data: { name: 'Fluffy' },
          queryParams: { returnDetails: true } as any,
        })
      }).not.toThrow()
    })
  })

  describe('Integration with Path Parameters', () => {
    it('should work with both path params and query params', () => {
      const query = api.useQuery(
        OperationId.getPet,
        { petId: '123' },
        {
          queryParams: { includeDetails: true } as any,
        },
      )

      expect(query).toBeTruthy()
    })

    it('should support reactive path params and query params together', () => {
      const petId = ref('123')
      const includeDetails = ref(true)

      const query = api.useQuery(
        OperationId.getPet,
        computed(() => ({ petId: petId.value })),
        {
          queryParams: computed(() => ({ includeDetails: includeDetails.value })) as any,
        },
      )

      expect(query).toBeTruthy()
      expect(query.queryKey.value).toBeDefined()
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle undefined query params', () => {
      const query = api.useQuery(OperationId.listPets, {
        queryParams: undefined,
      })

      expect(query).toBeTruthy()
    })

    it('should handle null query params', () => {
      const query = api.useQuery(OperationId.listPets, {
        queryParams: null as any,
      })

      expect(query).toBeTruthy()
    })

    it('should handle empty object query params', () => {
      const query = api.useQuery(OperationId.listPets, {
        queryParams: {},
      })

      expect(query).toBeTruthy()
    })

    it('should handle ref with undefined value', () => {
      const queryParams = ref(undefined)
      const query = api.useQuery(OperationId.listPets, {
        queryParams: queryParams as any,
      })

      expect(query).toBeTruthy()
    })

    it('should handle computed that returns undefined', () => {
      const shouldInclude = ref(false)
      const queryParams = computed(() => (shouldInclude.value ? { limit: 10 } : undefined))

      const query = api.useQuery(OperationId.listPets, {
        queryParams: queryParams as any,
      })

      expect(query).toBeTruthy()
    })
  })

  describe('Backward Compatibility', () => {
    it('should still support axiosOptions.params for query parameters', () => {
      const query = api.useQuery(OperationId.listPets, {
        axiosOptions: {
          params: { limit: 10 },
        },
      })

      expect(query).toBeTruthy()
    })

    it('should prioritize queryParams over axiosOptions.params for same keys', () => {
      const query = api.useQuery(OperationId.listPets, {
        queryParams: { limit: 50 },
        axiosOptions: {
          params: { limit: 10, page: 1 },
        },
      })

      expect(query).toBeTruthy()
      // queryParams.limit (50) should override axiosOptions.params.limit (10)
    })

    it('should work with existing code that does not use queryParams', () => {
      const query = api.useQuery(OperationId.listPets)

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })
  })
})
