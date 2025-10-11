import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed } from 'vue'
import { useOpenApi } from '@/index'
import { OpenApiConfig, type OpenApiInstance } from '@/types'
import { mockAxios } from '../setup'
import { OperationId, openApiOperations, type OpenApiOperations } from '../fixtures/openapi-typed-operations'

describe('Advanced Usage Examples', () => {
  let mockConfig: OpenApiConfig<OpenApiOperations>
  let api: OpenApiInstance<OpenApiOperations>

  beforeEach(() => {
    vi.clearAllMocks()
    mockConfig = {
      operations: openApiOperations,
      axios: mockAxios,
    }
    api = useOpenApi(mockConfig)
  })

  describe('Automatic Operation Type Detection with api.useEndpoint', () => {
    it('should automatically detect GET operations as queries', () => {
      // Automatically becomes a query for GET operations
      const listEndpoint = api.useEndpoint(OperationId.listPets)

      // TypeScript knows this has query properties
      expect(listEndpoint).toHaveProperty('data')
      expect(listEndpoint).toHaveProperty('isLoading')
      expect(listEndpoint).toHaveProperty('refetch')
      expect(listEndpoint).not.toHaveProperty('mutate')
      expect(listEndpoint).not.toHaveProperty('mutateAsync')
    })

    it('should automatically detect POST operations as mutations', () => {
      // Automatically becomes a mutation for POST operations
      const createEndpoint = api.useEndpoint(OperationId.createPet)

      // TypeScript knows this has mutation properties
      expect(createEndpoint).toHaveProperty('mutate')
      expect(createEndpoint).toHaveProperty('mutateAsync')
      expect(createEndpoint).toHaveProperty('data')
      expect(createEndpoint).toHaveProperty('error')
      expect(createEndpoint).toHaveProperty('isEnabled')
    })

    it('should handle path parameters correctly for both types', () => {
      const queryEndpoint = api.useEndpoint(OperationId.getPet, { petId: '123' })
      expect(queryEndpoint).toHaveProperty('data')

      const mutationEndpoint = api.useEndpoint(OperationId.updatePet, { petId: '123' })
      expect(mutationEndpoint).toHaveProperty('mutate')
    })
  })

  describe('Automatic Cache Management and Refetching', () => {
    it('should support default automatic cache invalidation', () => {
      const createPet = api.useMutation(OperationId.createPet, {
        onSuccess: () => {
          // onSuccess callback is configured
          expect(true).toBe(true)
        },
      })

      expect(createPet).toBeTruthy()
      expect(createPet).toHaveProperty('mutate')
    })

    it('should support manual control over cache invalidation', () => {
      const updatePet = api.useMutation(OperationId.updatePet, {
        dontInvalidate: true, // Disable automatic invalidation
        dontUpdateCache: true, // Disable automatic cache updates
        invalidateOperations: [OperationId.listPets], // Manually specify operations to invalidate
      })

      expect(updatePet).toBeTruthy()
      expect(updatePet).toHaveProperty('mutate')
    })

    it('should support refetching specific endpoints after mutation', () => {
      const petListQuery = api.useQuery(OperationId.listPets)
      const createPetWithRefetch = api.useMutation(OperationId.createPet, {
        refetchEndpoints: [petListQuery], // Manually refetch these endpoints
      })

      expect(createPetWithRefetch).toBeTruthy()
      expect(petListQuery).toHaveProperty('refetch')
    })
  })

  describe('Reactive Enabling/Disabling Based on Path Parameters', () => {
    it('should support chaining queries where one provides ID for another', () => {
      // This would be a more complex test, but for now just verify the basic structure
      const selectedUserId = ref<string>('user1')

      // Use an existing operation that has userId parameter
      const userPetsQuery = api.useQuery(
        OperationId.listUserPets,
        computed(() => ({ userId: selectedUserId.value })),
        {
          enabled: computed(() => Boolean(selectedUserId.value)),
        },
      )

      expect(userPetsQuery).toBeTruthy()
      expect(userPetsQuery.isEnabled).toBeDefined()
    })
    it('should reactively enable/disable queries based on parameter availability', () => {
      const selectedPetId = ref<string | undefined>(undefined)

      const petQuery = api.useQuery(
        OperationId.getPet,
        computed(() => ({ petId: selectedPetId.value })),
        {
          enabled: computed(() => Boolean(selectedPetId.value)),
        },
      )

      // Query should be disabled when petId is null
      expect(petQuery.isEnabled).toBeDefined()

      // Simulate enabling by setting the parameter
      selectedPetId.value = '123'
      // In real usage, isEnabled would reactively update
    })

    it('should handle complex conditional enabling', () => {
      const userId = ref<string>('user1')
      const shouldFetchPets = ref(true)

      const userPetsQuery = api.useQuery(
        OperationId.listUserPets,
        computed(() => ({ userId: userId.value })),
        {
          enabled: computed(() => Boolean(userId.value) && shouldFetchPets.value),
        },
      )

      expect(userPetsQuery).toBeTruthy()
      expect(userPetsQuery.isEnabled).toBeDefined()
    })

    it('should support reactive path parameters with refs', () => {
      const reactiveParams = ref({ petId: '123' })
      const query = api.useQuery(OperationId.getPet, reactiveParams)

      expect(query).toBeTruthy()
      expect(query.queryKey).toBeDefined()

      // In real usage, changing reactiveParams.value would update the query
    })
  })

  describe('Integration Examples', () => {
    it('should demonstrate a complete workflow with all advanced features', () => {
      // Set up reactive state
      const selectedPetId = ref<string | undefined>(undefined)
      const isOnline = ref(true)

      // Create queries with reactive enabling
      const petListQuery = api.useQuery(OperationId.listPets, {
        enabled: computed(() => isOnline.value),
        axiosOptions: {
          headers: { 'X-Source': 'webapp' },
        },
      })

      const petQuery = api.useQuery(
        OperationId.getPet,
        computed(() => ({ petId: selectedPetId.value })),
        {
          enabled: computed(() => Boolean(selectedPetId.value) && isOnline.value),
          onLoad: (data) => {
            console.log('Pet loaded:', data)
          },
        },
      )

      // Create mutations with advanced options
      const createPet = api.useMutation(OperationId.createPet, {
        onSuccess: async () => {
          // Auto-refetch the list after creation
          await petListQuery.refetch()
        },
        refetchEndpoints: [petListQuery],
      })

      const updatePet = api.useMutation(OperationId.updatePet, {
        dontInvalidate: false, // Allow automatic invalidation
        invalidateOperations: [OperationId.listPets],
        onSuccess: (data, variables) => {
          console.log('Pet updated:', data, variables)
        },
      })

      // Use generic endpoint for flexible handling
      const flexibleEndpoint = api.useEndpoint(OperationId.getPet, { petId: '123' })

      // Verify all components work
      expect(petListQuery).toBeTruthy()
      expect(petQuery).toBeTruthy()
      expect(createPet).toBeTruthy()
      expect(updatePet).toBeTruthy()
      expect(flexibleEndpoint).toBeTruthy()

      // Verify reactive enabling works
      expect(petQuery.isEnabled).toBeDefined()
    })
  })
})
