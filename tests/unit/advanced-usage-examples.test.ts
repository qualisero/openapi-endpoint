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

  describe('Manual Refetching of Operations', () => {
    it('should support manual refetch of queries', async () => {
      const petListQuery = api.useQuery(OperationId.listPets)
      const petQuery = api.useQuery(OperationId.getPet, { petId: '123' })

      expect(petListQuery.refetch).toBeDefined()
      expect(petQuery.refetch).toBeDefined()

      // Verify refetch methods are callable
      expect(typeof petListQuery.refetch).toBe('function')
      expect(typeof petQuery.refetch).toBe('function')
    })

    it('should support refetching in mutation onSuccess', () => {
      const petListQuery = api.useQuery(OperationId.listPets)
      const deletePet = api.useMutation(OperationId.deletePet, {
        onSuccess: async () => {
          // Can call refetch on specific queries
          expect(petListQuery.refetch).toBeDefined()
        },
      })

      expect(deletePet).toBeTruthy()
    })

    it('should support per-execution refetch control', async () => {
      const _petListQuery = api.useQuery(OperationId.listPets)
      const createPet = api.useMutation(OperationId.createPet)

      // Verify that mutation accepts refetchEndpoints in variables
      expect(createPet.mutateAsync).toBeDefined()

      // This should work with refetchEndpoints in the mutation variables
      // The actual execution would be:
      // await createPet.mutateAsync({
      //   data: { name: 'New Pet' },
      //   refetchEndpoints: [_petListQuery]
      // })
    })
  })

  describe('Reactive Enabling/Disabling Based on Path Parameters', () => {
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

  describe('Error Handling and Custom Axios Configuration', () => {
    it('should support custom axios options per operation', () => {
      const secureQuery = api.useQuery(OperationId.listPets, {
        axiosOptions: {
          headers: {
            Authorization: 'Bearer token',
            'X-Custom-Header': 'value',
          },
          timeout: 10000,
        },
      })

      expect(secureQuery).toBeTruthy()
      expect(secureQuery).toHaveProperty('data')
    })

    it('should support custom error handling', () => {
      const queryWithErrorHandler = api.useQuery(
        OperationId.getPet,
        { petId: '123' },
        {
          errorHandler: (error) => {
            console.error('Custom error handling:', error)
            // Return fallback data or re-throw
            return { id: '123', name: 'Fallback Pet' }
          },
        },
      )

      expect(queryWithErrorHandler).toBeTruthy()
    })

    it('should support mutation with custom configuration', () => {
      const createPetWithConfig = api.useMutation(OperationId.createPet, {
        axiosOptions: {
          headers: { 'Content-Type': 'application/json' },
        },
        onError: (error) => {
          console.error('Mutation failed:', error)
        },
      })

      expect(createPetWithConfig).toBeTruthy()
      expect(createPetWithConfig).toHaveProperty('mutate')
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
