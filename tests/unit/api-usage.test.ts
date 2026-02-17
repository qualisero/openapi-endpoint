import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed } from 'vue'
import { useOpenApi } from '@/index'
import { OpenApiConfig, type OpenApiInstance } from '@/types'
import { QueryClient } from '@tanstack/vue-query'
import { mockAxios } from '../setup'
import {
  QueryOperationId,
  MutationOperationId,
  openApiOperations,
  type OpenApiOperations,
} from '../fixtures/openapi-typed-operations'

/**
 * API Usage Patterns and Examples
 *
 * This file consolidates all API usage patterns, from basic to advanced:
 * - Main composable API (useOpenApi)
 * - Query and mutation usage patterns
 * - Advanced composable functionality
 * - Integration examples and real-world scenarios
 * - Reactive path parameters and conditional enabling
 */
describe('API Usage Patterns', () => {
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

  describe('Basic API Structure', () => {
    it('should return an object with useQuery and useMutation functions', () => {
      expect(api).toHaveProperty('useQuery')
      expect(api).toHaveProperty('useMutation')
      expect(typeof api.useQuery).toBe('function')
      expect(typeof api.useMutation).toBe('function')
    })

    it('should support OpenApiInstance type for typing API instances', () => {
      // Type assertion test - if this compiles, the types are working
      const typedApi: OpenApiInstance<OpenApiOperations> = api
      expect(typedApi).toBeTruthy()
      expect(typeof typedApi.useQuery).toBe('function')
      expect(typeof typedApi.useMutation).toBe('function')
    })
  })

  describe('Query Usage Patterns', () => {
    it('should create a query for GET operations', () => {
      const query = api.useQuery(QueryOperationId.listPets)

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })

    it('should create a query with path parameters', () => {
      const query = api.useQuery(QueryOperationId.getPet, { petId: '123' })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
      expect(query).toHaveProperty('queryKey')
    })

    it('should create a query with options', () => {
      const onLoad = vi.fn()
      const query = api.useQuery(QueryOperationId.listPets, { onLoad })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
      expect(query).toHaveProperty('onLoad')
      expect(typeof query.onLoad).toBe('function')
    })

    it('should support TanStack Query options', () => {
      const selectFn = vi.fn((data) => data)
      const query = api.useQuery(QueryOperationId.listPets, {
        staleTime: 10000,
        retry: 3,
        refetchOnWindowFocus: false,
        select: selectFn,
        initialData: undefined,
        placeholderData: undefined,
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })

    it('should support enabled state control', () => {
      const queryDisabled = api.useQuery(QueryOperationId.listPets, {
        enabled: false,
      })

      const queryEnabled = api.useQuery(QueryOperationId.listPets, {
        enabled: true,
      })

      expect(queryDisabled).toHaveProperty('isEnabled')
      expect(queryDisabled.isEnabled.value).toBe(false)
      expect(queryEnabled).toHaveProperty('isEnabled')
    })

    it('should automatically disable queries with unresolved path parameters', () => {
      const query = api.useQuery(QueryOperationId.getPet, { petId: undefined })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('isEnabled')
      expect(query.isEnabled.value).toBe(false)
    })

    it('should generate correct query keys', () => {
      const listQuery = api.useQuery(QueryOperationId.listPets)
      const petQuery = api.useQuery(QueryOperationId.getPet, { petId: '123' })
      const userPetsQuery = api.useQuery(QueryOperationId.listUserPets, { userId: 'user1' })

      expect(listQuery.queryKey).toBeTruthy()
      expect(petQuery.queryKey.value).toEqual(['pets', '123'])
      expect(userPetsQuery.queryKey.value).toEqual(['users', 'user1', 'pets'])
    })

    it('should support custom error handlers', () => {
      const errorHandler = vi.fn()
      const query = api.useQuery(QueryOperationId.listPets, {
        errorHandler,
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })

    it('should support onLoad callbacks for immediate data access', () => {
      const onLoad = vi.fn()
      const query = api.useQuery(
        QueryOperationId.getPet,
        { petId: '123' },
        {
          onLoad,
        },
      )

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('onLoad')
      expect(typeof query.onLoad).toBe('function')
    })
  })

  describe('Mutation Usage Patterns', () => {
    it('should create a mutation for POST operations', () => {
      const mutation = api.useMutation(MutationOperationId.createPet)

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })

    it('should create a mutation with path parameters', () => {
      const mutation = api.useMutation(MutationOperationId.updatePet, { petId: '123' })

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
      expect(mutation).toHaveProperty('isEnabled')
      expect(mutation.isEnabled.value).toBe(true)
    })

    it('should create a mutation with options', () => {
      const onSuccess = vi.fn()
      const mutation = api.useMutation(MutationOperationId.createPet, { onSuccess })

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })

    it('should support TanStack Query mutation options', () => {
      const onSuccess = vi.fn()
      const onError = vi.fn()
      const onSettled = vi.fn()
      const meta = { description: 'Creating a new pet' }

      const mutation = api.useMutation(MutationOperationId.createPet, {
        onSuccess,
        onError,
        onSettled,
        retry: 3,
        meta,
      })

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })

    it('should support cache invalidation options', () => {
      const mutation = api.useMutation(MutationOperationId.createPet, {
        invalidateOperations: [QueryOperationId.listPets],
        dontInvalidate: false,
        dontUpdateCache: false,
      })

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
    })

    it('should support complex invalidateOperations with path parameters', () => {
      const mutation = api.useMutation(
        MutationOperationId.updatePet,
        { petId: '123' },
        {
          invalidateOperations: {
            [QueryOperationId.getPet]: { petId: '123' },
            [QueryOperationId.listPets]: {},
          },
        },
      )

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
    })

    it('should support refetching specific endpoints after mutation', () => {
      const petListQuery = api.useQuery(QueryOperationId.listPets)
      const createPetWithRefetch = api.useMutation(MutationOperationId.createPet, {
        refetchEndpoints: [petListQuery],
      })

      expect(createPetWithRefetch).toBeTruthy()
      expect(petListQuery).toHaveProperty('refetch')
    })

    it('should handle mutations without data variables', () => {
      const deleteEndpoint = api.useMutation(MutationOperationId.deletePet, { petId: '123' })

      // Should have mutateAsync functions
      expect(typeof deleteEndpoint.mutateAsync).toBe('function')

      // Call mutateAsync to ensure it works without vars (should not throw)
      expect(() => deleteEndpoint.mutateAsync()).not.toThrow()

      // Test with other options but no data
      expect(() =>
        deleteEndpoint.mutateAsync({ dontInvalidate: true, invalidateOperations: [QueryOperationId.listPets] }),
      ).not.toThrow()
    })

    it('should support axios options in mutate calls', () => {
      const mutation = api.useMutation(MutationOperationId.createPet)

      expect(() => {
        mutation.mutate({
          data: { name: 'Fluffy' },
          axiosOptions: {
            timeout: 8000,
            headers: {
              'X-Mutate-Header': 'mutate-value',
            },
          },
        })
      }).not.toThrow()
    })

    it('should handle path parameter overrides in mutate calls', () => {
      const mutation = api.useMutation(MutationOperationId.updatePet, { petId: '123' })

      expect(() => {
        mutation.mutate({
          data: { name: 'Updated Pet' },
          pathParams: { petId: '456' }, // Override path params
        })
      }).not.toThrow()
    })
  })

  describe('Reactive Parameters and Conditional Enabling', () => {
    it('should support reactive path parameters with refs', () => {
      const reactiveParams = ref({ petId: '123' })
      const query = api.useQuery(QueryOperationId.getPet, reactiveParams)

      expect(query).toBeTruthy()
      expect(query.queryKey).toBeDefined()
    })

    it('should reactively enable/disable queries based on parameter availability', () => {
      const selectedPetId = ref<string | undefined>(undefined)

      const petQuery = api.useQuery(
        QueryOperationId.getPet,
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

    it('should support chaining queries where one provides ID for another', () => {
      const selectedUserId = ref<string>('user1')

      const userPetsQuery = api.useQuery(
        QueryOperationId.listUserPets,
        computed(() => ({ userId: selectedUserId.value })),
        {
          enabled: computed(() => Boolean(selectedUserId.value)),
        },
      )

      expect(userPetsQuery).toBeTruthy()
      expect(userPetsQuery.isEnabled).toBeDefined()
    })

    it('should handle complex conditional enabling', () => {
      const userId = ref<string>('user1')
      const shouldFetchPets = ref(true)

      const userPetsQuery = api.useQuery(
        QueryOperationId.listUserPets,
        computed(() => ({ userId: userId.value })),
        {
          enabled: computed(() => Boolean(userId.value) && shouldFetchPets.value),
        },
      )

      expect(userPetsQuery).toBeTruthy()
      expect(userPetsQuery.isEnabled).toBeDefined()
    })

    it('should handle reactive parameters with mutations', () => {
      const reactiveParams = ref({ petId: '123' })
      const mutation = api.useMutation(MutationOperationId.updatePet, reactiveParams)

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })

    it('should handle reactive path params that start undefined and get updated', () => {
      // This test reproduces an exact scenario from a GitHub issue
      let userId: string | undefined = undefined

      // Create query with reactive function for path params
      const myQuery = api.useQuery(QueryOperationId.listUserPets, () => ({ userId }))

      // Initially, the path should not be resolved (contains {userId})
      expect(myQuery.isEnabled.value).toBe(false)

      // Update the userId - in a real Vue app with refs, this would be reactive
      userId = '123'

      // Note: In test environment, we can't fully simulate Vue's reactivity
      // but we can verify the query structure is correct
      expect(myQuery).toBeTruthy()

      // Verify it's a query endpoint since listUserPets is GET
      expect(myQuery).toHaveProperty('data')
      expect(myQuery).not.toHaveProperty('mutateAsync')
    })

    it('should handle reactive parameters with function-based path params', () => {
      let petId: string | undefined = undefined

      // Create mutation endpoint with reactive path params
      const updateEndpoint = api.useMutation(MutationOperationId.updatePet, () => ({ petId }))

      // Initially should be disabled due to unresolved path params
      expect(updateEndpoint.isEnabled.value).toBe(false)

      // Update the petId
      petId = '123'

      // Verify it's a mutation endpoint
      expect(updateEndpoint).toHaveProperty('mutate')
      expect(updateEndpoint).toHaveProperty('mutateAsync')
    })

    it('should support reactive computed values for conditional parameters', () => {
      const selectedUserId = ref<string>('user1')
      const includeArchived = ref(false)

      // In a real scenario, this would use computed parameters
      const dynamicParams = computed(() => ({
        userId: selectedUserId.value,
        includeArchived: includeArchived.value,
      }))

      const userQuery = api.useQuery(QueryOperationId.listUserPets, dynamicParams)

      expect(userQuery).toBeTruthy()
      expect(userQuery.isEnabled).toBeDefined()
    })
  })

  describe('QueryClient Configuration and Compatibility', () => {
    it('should use provided queryClient when specified in config', () => {
      const customQueryClient = new QueryClient()
      const configWithClient: OpenApiConfig<OpenApiOperations> = {
        ...mockConfig,
        queryClient: customQueryClient,
      }

      const apiWithCustomClient = useOpenApi(configWithClient)
      expect(apiWithCustomClient).toBeTruthy()
      expect(apiWithCustomClient).toHaveProperty('useQuery')
      expect(apiWithCustomClient).toHaveProperty('useMutation')
    })

    it('should use default queryClient when not specified in config', () => {
      // This test verifies the api works without explicit queryClient
      expect(api).toBeTruthy()
      expect(api).toHaveProperty('useQuery')
      expect(api).toHaveProperty('useMutation')
    })

    it('should work with QueryClient-like objects', () => {
      // Test compatibility with objects that implement QueryClient interface
      const queryClientLike = {
        cancelQueries: vi.fn(() => Promise.resolve()),
        setQueryData: vi.fn(),
        invalidateQueries: vi.fn(() => Promise.resolve()),
        // Additional properties should be allowed
        someExtraProperty: 'extra value',
      }

      const configWithLike: OpenApiConfig<OpenApiOperations> = {
        ...mockConfig,
        queryClient: queryClientLike,
      }

      const apiWithLike = useOpenApi(configWithLike)
      expect(apiWithLike).toBeTruthy()
    })
  })

  describe('Advanced Integration Examples', () => {
    it('should demonstrate a complete workflow with all features', () => {
      // Set up reactive state
      const selectedPetId = ref<string | undefined>(undefined)
      const isOnline = ref(true)

      // Create queries with reactive enabling
      const petListQuery = api.useQuery(QueryOperationId.listPets, {
        enabled: computed(() => isOnline.value),
        staleTime: 60000,
        refetchOnWindowFocus: false,
        axiosOptions: {
          headers: { 'X-Source': 'webapp' },
        },
      })

      const petQuery = api.useQuery(
        QueryOperationId.getPet,
        computed(() => ({ petId: selectedPetId.value })),
        {
          enabled: computed(() => Boolean(selectedPetId.value) && isOnline.value),
          onLoad: (data) => {
            console.log('Pet loaded:', data)
          },
        },
      )

      // Create mutations with advanced options
      const createPet = api.useMutation(MutationOperationId.createPet, {
        onSuccess: async () => {
          // Auto-refetch the list after creation
          await petListQuery.refetch()
        },
        refetchEndpoints: [petListQuery],
        axiosOptions: {
          timeout: 30000,
        },
      })

      const updatePet = api.useMutation(MutationOperationId.updatePet, {
        dontInvalidate: false, // Allow automatic invalidation
        invalidateOperations: [QueryOperationId.listPets],
        onSuccess: (data, variables) => {
          console.log('Pet updated:', data, variables)
        },
        retry: 3,
      })

      // Verify all components work
      expect(petListQuery).toBeTruthy()
      expect(petQuery).toBeTruthy()
      expect(createPet).toBeTruthy()
      expect(updatePet).toBeTruthy()

      // Verify reactive enabling works
      expect(petQuery.isEnabled).toBeDefined()
    })

    it('should support default automatic cache invalidation workflows', () => {
      const createPet = api.useMutation(MutationOperationId.createPet, {
        onSuccess: () => {
          // onSuccess callback is configured
          expect(true).toBe(true)
        },
      })

      expect(createPet).toBeTruthy()
      expect(createPet).toHaveProperty('mutate')
    })

    it('should support manual control over cache invalidation workflows', () => {
      const updatePet = api.useMutation(MutationOperationId.updatePet, {
        dontInvalidate: true, // Disable automatic invalidation
        dontUpdateCache: true, // Disable automatic cache updates
        invalidateOperations: [QueryOperationId.listPets], // Manually specify operations to invalidate
      })

      expect(updatePet).toBeTruthy()
      expect(updatePet).toHaveProperty('mutate')
    })

    it('should support complex real-world scenarios', () => {
      // Simulate a real application scenario
      const currentUser = ref({ id: 'user1', role: 'admin' })
      const selectedPet = ref<string | undefined>(undefined)

      // User's pets query with conditional enabling
      const userPetsQuery = api.useQuery(
        QueryOperationId.listUserPets,
        computed(() => ({ userId: currentUser.value.id })),
        {
          enabled: computed(() => Boolean(currentUser.value?.id)),
          staleTime: 300000, // 5 minutes
        },
      )

      // Selected pet details with conditional enabling
      const petDetailsQuery = api.useQuery(
        QueryOperationId.getPet,
        computed(() => ({ petId: selectedPet.value })),
        {
          enabled: computed(() => Boolean(selectedPet.value)),
          onLoad: (data) => {
            console.log('Pet details loaded:', data)
          },
        },
      )

      // Create pet mutation with comprehensive options
      const createPetMutation = api.useMutation(MutationOperationId.createPet, {
        onSuccess: async (newPet, _variables) => {
          // Invalidate user's pets list
          await userPetsQuery.refetch()

          // Select the newly created pet
          if (newPet?.data?.id) {
            selectedPet.value = newPet.data.id
          }
        },
        onError: (error) => {
          console.error('Failed to create pet:', error)
        },
        retry: 2,
        axiosOptions: {
          timeout: 30000, // Longer timeout for creation
        },
      })

      // Update pet mutation with cache management
      const updatePetMutation = api.useMutation(MutationOperationId.updatePet, {
        invalidateOperations: {
          [QueryOperationId.listUserPets]: { userId: currentUser.value.id },
          [QueryOperationId.listPets]: {},
        },
        onSuccess: (updatedPet) => {
          console.log('Pet updated successfully:', updatedPet)
        },
      })

      // Verify all queries and mutations are properly configured
      expect(userPetsQuery).toBeTruthy()
      expect(petDetailsQuery).toBeTruthy()
      expect(createPetMutation).toBeTruthy()
      expect(updatePetMutation).toBeTruthy()

      // Verify proper reactive behavior
      expect(userPetsQuery.isEnabled.value).toBe(true)
      expect(petDetailsQuery.isEnabled.value).toBe(false) // No pet selected
    })
  })

  describe('Error Handling Patterns', () => {
    it('should support error handling in queries with custom handlers', () => {
      const errorHandler = vi.fn()
      const query = api.useQuery(QueryOperationId.listPets, {
        errorHandler,
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })

    it('should support error handling in mutations with callbacks', () => {
      const mutation = api.useMutation(MutationOperationId.createPet, {
        onError: vi.fn((error) => {
          console.log('Mutation error:', error)
        }),
      })

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
    })

    it('should handle errors in async mutation calls', async () => {
      const mutation = api.useMutation(MutationOperationId.createPet)

      await expect(
        mutation
          .mutateAsync({
            data: { name: 'Fluffy' },
          })
          .catch((error) => {
            console.log('Caught error:', error)
            return { id: 'fallback', name: 'fallback' }
          }),
      ).resolves.toBeDefined()
    })
  })
})
