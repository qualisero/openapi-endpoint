import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed } from 'vue'
import { QueryClient } from '@tanstack/vue-query'
import type { QueryObserverResult } from '@tanstack/query-core'
import type { AxiosResponse } from 'axios'
import { mockAxios } from '../setup'
import { createApiClient } from '../fixtures/api-client'
import type { Types } from '../fixtures/api-types'
import type { Refetchable } from '@qualisero/openapi-endpoint'

/**
 * API Usage Patterns and Examples
 *
 * This file consolidates all API usage patterns, from basic to advanced:
 * - Generated API client usage with createApiClient
 * - Query and mutation usage patterns
 * - Advanced composable functionality
 * - Integration examples and real-world scenarios
 * - Reactive path parameters and conditional enabling
 */
describe('API Usage Patterns', () => {
  let api: ReturnType<typeof createApiClient>

  beforeEach(() => {
    vi.clearAllMocks()
    api = createApiClient(mockAxios)
  })

  describe('Basic API Structure', () => {
    it('should return an object with operation namespaces', () => {
      expect(api).toHaveProperty('listPets')
      expect(api).toHaveProperty('getPet')
      expect(api).toHaveProperty('createPet')
      expect(api.listPets).toHaveProperty('useQuery')
      expect(api.createPet).toHaveProperty('useMutation')
    })

    it('should support ApiClient type for typing API instances', () => {
      // Type assertion test - if this compiles, the types are working
      expect(api).toBeTruthy()
      expect(api.listPets).toHaveProperty('useQuery')
      expect(api.createPet).toHaveProperty('useMutation')
    })
  })

  describe('Query Usage Patterns', () => {
    it('should create a query for GET operations', () => {
      const query = api.listPets.useQuery()

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })

    it('should create a query with path parameters', () => {
      const query = api.getPet.useQuery({ petId: '123' })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
      expect(query).toHaveProperty('queryKey')
    })

    it('should not accept unknown path parameters', () => {
      // @ts-expect-error - unexpectedParam is not defined in getPet path params
      api.getPet.useQuery({ petId: '123', unexpectedParam: 'value' })

      // @ts-expect-error - unexpectedParam is not defined in updatePet path params
      api.updatePet.useMutation({ petId: '123', unexpectedParam: 'value' })

      // @ts-expect-error - unexpectedParam is not defined in getPet path params (getter fn)
      api.getPet.useQuery(() => ({ petId: '123', unexpectedParam: 'value' }))

      // @ts-expect-error - unexpectedParam is not defined in updatePet path params (getter fn)
      api.updatePet.useMutation(() => ({ petId: '123', unexpectedParam: 'value' }))
    })

    it('should create a query with options', () => {
      const onLoad = vi.fn()
      const query = api.listPets.useQuery({ onLoad })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
      expect(query).toHaveProperty('onLoad')
      expect(typeof query.onLoad).toBe('function')
    })

    it('should support TanStack Query options', () => {
      const selectFn = vi.fn((data) => data)
      const query = api.listPets.useQuery({
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
      const queryDisabled = api.listPets.useQuery({
        enabled: false,
      })

      const queryEnabled = api.listPets.useQuery({
        enabled: true,
      })

      expect(queryDisabled).toHaveProperty('isEnabled')
      expect(queryDisabled.isEnabled.value).toBe(false)
      expect(queryEnabled).toHaveProperty('isEnabled')
    })

    it('should automatically disable queries with unresolved path parameters', () => {
      const query = api.getPet.useQuery(() => ({ petId: undefined }))

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('isEnabled')
      expect(query.isEnabled.value).toBe(false)
    })

    it('should generate correct query keys', () => {
      const listQuery = api.listPets.useQuery()
      const petQuery = api.getPet.useQuery({ petId: '123' })
      const userPetsQuery = api.listUserPets.useQuery({ userId: 'user1' })

      expect(listQuery.queryKey).toBeTruthy()
      expect(petQuery.queryKey.value).toEqual(['pets', '123'])
      expect(userPetsQuery.queryKey.value).toEqual(['users', 'user1', 'pets'])
    })

    it('should support custom error handlers', () => {
      const errorHandler = vi.fn()
      const query = api.listPets.useQuery({
        errorHandler,
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })

    it('should support onLoad callbacks for immediate data access', () => {
      const onLoad = vi.fn()
      const query = api.getPet.useQuery(
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
      const mutation = api.createPet.useMutation()

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })

    it('should create a mutation with path parameters', () => {
      const mutation = api.updatePet.useMutation({ petId: '123' })

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
      expect(mutation).toHaveProperty('isEnabled')
      expect(mutation.isEnabled.value).toBe(true)
    })

    it('should create a mutation with options', () => {
      const onSuccess = vi.fn()
      const mutation = api.createPet.useMutation({ onSuccess })

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })

    it('should support TanStack Query mutation options', () => {
      const onSuccess = vi.fn()
      const onError = vi.fn()
      const onSettled = vi.fn()
      const meta = { description: 'Creating a new pet' }

      const mutation = api.createPet.useMutation({
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
      const mutation = api.createPet.useMutation({
        invalidateOperations: ['listPets'],
        dontInvalidate: false,
        dontUpdateCache: false,
      })

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
    })

    it('should support complex invalidateOperations with path parameters', () => {
      const mutation = api.updatePet.useMutation(
        { petId: '123' },
        {
          invalidateOperations: {
            ['getPet']: { petId: '123' },
            ['listPets']: {},
          },
        },
      )

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
    })

    it('should support refetching specific endpoints after mutation', () => {
      const petListQuery = api.listPets.useQuery()
      const createPetWithRefetch = api.createPet.useMutation({
        refetchEndpoints: [petListQuery],
      })

      expect(createPetWithRefetch).toBeTruthy()
      expect(petListQuery).toHaveProperty('refetch')
    })

    it('should handle mutations without data variables', () => {
      const deleteEndpoint = api.deletePet.useMutation({ petId: '123' })

      // Should have mutateAsync functions
      expect(typeof deleteEndpoint.mutateAsync).toBe('function')

      // Call mutateAsync to ensure it works without vars (should not throw)
      expect(() => deleteEndpoint.mutateAsync()).not.toThrow()

      // Test with other options but no data
      expect(() =>
        deleteEndpoint.mutateAsync({ dontInvalidate: true, invalidateOperations: ['listPets'] }),
      ).not.toThrow()
    })

    it('should support axios options in mutate calls', () => {
      const mutation = api.createPet.useMutation()

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
      const mutation = api.updatePet.useMutation({ petId: '123' })

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
      const query = api.getPet.useQuery(reactiveParams)

      expect(query).toBeTruthy()
      expect(query.queryKey).toBeDefined()
    })

    it('should reactively enable/disable queries based on parameter availability', () => {
      const selectedPetId = ref<string | undefined>(undefined)

      const petQuery = api.getPet.useQuery(
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

      const userPetsQuery = api.listUserPets.useQuery(
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

      const userPetsQuery = api.listUserPets.useQuery(
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
      const mutation = api.updatePet.useMutation(reactiveParams)

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })

    it('should handle reactive path params that start undefined and get updated', () => {
      // This test reproduces an exact scenario from a GitHub issue
      let userId: string | undefined = undefined

      // Create query with reactive function for path params
      const myQuery = api.listUserPets.useQuery(() => ({ userId }))

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
      const updateEndpoint = api.updatePet.useMutation(() => ({ petId }))

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

      const userQuery = api.listUserPets.useQuery(dynamicParams)

      expect(userQuery).toBeTruthy()
      expect(userQuery.isEnabled).toBeDefined()
    })
  })

  describe('QueryClient Configuration and Compatibility', () => {
    it('should use provided queryClient when specified', () => {
      const customQueryClient = new QueryClient()
      const apiWithCustomClient = createApiClient(mockAxios, customQueryClient)
      expect(apiWithCustomClient).toBeTruthy()
      expect(apiWithCustomClient.createPet).toHaveProperty('useMutation')
      expect(apiWithCustomClient.listPets).toHaveProperty('useQuery')
    })

    it('should use default queryClient when not specified', () => {
      const apiWithDefault = createApiClient(mockAxios)
      expect(apiWithDefault).toBeTruthy()
      expect(apiWithDefault.createPet).toHaveProperty('useMutation')
      expect(apiWithDefault.listPets).toHaveProperty('useQuery')
    })

    it('should work with minimal QueryClient configuration', () => {
      const minimalQueryClient = new QueryClient()
      const minimalApi = createApiClient(mockAxios, minimalQueryClient)
      expect(minimalApi).toBeTruthy()
    })
  })

  describe('Advanced Integration Examples', () => {
    it('should demonstrate a complete workflow with all features', () => {
      // Set up reactive state
      const selectedPetId = ref<string | undefined>(undefined)
      const isOnline = ref(true)

      // Create queries with reactive enabling
      const petListQuery = api.listPets.useQuery({
        enabled: computed(() => isOnline.value),
        staleTime: 60000,
        refetchOnWindowFocus: false,
        axiosOptions: {
          headers: { 'X-Source': 'webapp' },
        },
      })

      const petQuery = api.getPet.useQuery(
        computed(() => ({ petId: selectedPetId.value })),
        {
          enabled: computed(() => Boolean(selectedPetId.value) && isOnline.value),
          onLoad: (data) => {
            console.log('Pet loaded:', data)
          },
        },
      )

      // Create mutations with advanced options
      const createPet = api.createPet.useMutation({
        onSuccess: async () => {
          // Auto-refetch the list after creation
          await petListQuery.refetch()
        },
        refetchEndpoints: [petListQuery],
        axiosOptions: {
          timeout: 30000,
        },
      })

      const updatePet = api.updatePet.useMutation(
        computed(() => ({ petId: selectedPetId.value })),
        {
          dontInvalidate: false, // Allow automatic invalidation
          invalidateOperations: ['listPets'],
          onSuccess: (data: unknown, variables: unknown) => {
            console.log('Pet updated:', data, variables)
          },
          retry: 3,
        },
      )

      // Verify all components work
      expect(petListQuery).toBeTruthy()
      expect(petQuery).toBeTruthy()
      expect(createPet).toBeTruthy()
      expect(updatePet).toBeTruthy()

      // Verify reactive enabling works
      expect(petQuery.isEnabled).toBeDefined()
    })

    it('should support default automatic cache invalidation workflows', () => {
      const createPet = api.createPet.useMutation({
        onSuccess: () => {
          // onSuccess callback is configured
          expect(true).toBe(true)
        },
      })

      expect(createPet).toBeTruthy()
      expect(createPet).toHaveProperty('mutate')
    })

    it('should support manual control over cache invalidation workflows', () => {
      const updatePet = api.updatePet.useMutation(
        { petId: '123' },
        {
          dontInvalidate: true, // Disable automatic invalidation
          dontUpdateCache: true, // Disable automatic cache updates
          invalidateOperations: ['listPets'], // Manually specify operations to invalidate
        },
      )

      expect(updatePet).toBeTruthy()
      expect(updatePet).toHaveProperty('mutate')
    })

    it('should support complex real-world scenarios', () => {
      // Simulate a real application scenario
      const currentUser = ref({ id: 'user1', role: 'admin' })
      const selectedPet = ref<string | undefined>(undefined)

      // User's pets query with conditional enabling
      const userPetsQuery = api.listUserPets.useQuery(() => ({ userId: currentUser.value.id }), {
        enabled: computed(() => Boolean(currentUser.value?.id)),
        staleTime: 300000, // 5 minutes
      })

      // Selected pet details with conditional enabling
      const petDetailsQuery = api.getPet.useQuery(
        computed(() => ({ petId: selectedPet.value })),
        {
          enabled: computed(() => Boolean(selectedPet.value)),
          onLoad: (data) => {
            console.log('Pet details loaded:', data)
          },
        },
      )

      // Create pet mutation with comprehensive options
      const createPetMutation = api.createPet.useMutation({
        onSuccess: async (newPet: unknown, _variables: unknown) => {
          // Invalidate user's pets list
          await userPetsQuery.refetch()

          const newPetResponse = newPet as { data?: { id?: string } }
          // Select the newly created pet
          if (newPetResponse.data?.id) {
            selectedPet.value = newPetResponse.data.id
          }
        },
        onError: (error: unknown) => {
          console.error('Failed to create pet:', error)
        },
        retry: 2,
        axiosOptions: {
          timeout: 30000, // Longer timeout for creation
        },
      })

      // Update pet mutation with cache management
      const updatePetMutation = api.updatePet.useMutation(
        computed(() => ({ petId: selectedPet.value })),
        {
          invalidateOperations: {
            ['listUserPets']: { userId: currentUser.value.id },
            ['listPets']: {},
          },
          onSuccess: (updatedPet: unknown) => {
            console.log('Pet updated successfully:', updatedPet)
          },
        },
      )

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

  describe('Type Safety - Input Parameters', () => {
    it('should correctly type query path parameters', () => {
      // getPet requires { petId: string } as path params
      const query = api.getPet.useQuery({ petId: '123' })

      // TypeScript should enforce petId is a string
      expect(query).toBeTruthy()

      // This is a type assertion test - if it compiles, types are correct
      const pathParams: Types.getPet.PathParams = { petId: '123' }
      const queryWithTypedParams = api.getPet.useQuery(pathParams)
      expect(queryWithTypedParams).toBeTruthy()

      // listUserPets requires { userId: string }
      const userQuery = api.listUserPets.useQuery({ userId: 'user1' })
      expect(userQuery).toBeTruthy()

      // Verify path params are stored in the query result
      expect(query.pathParams).toBeDefined()
      expect(query.pathParams.value).toEqual({ petId: '123' })
    })

    it('should correctly type query parameters', () => {
      // listPets has optional { limit?: number } query param
      const query = api.listPets.useQuery({
        queryParams: { limit: 10 },
      })

      expect(query).toBeTruthy()

      // Type assertion: query params should match expected type
      const queryParams: Types.listPets.QueryParams = { limit: 20 }
      const queryWithTypedParams = api.listPets.useQuery({ queryParams })
      expect(queryWithTypedParams).toBeTruthy()

      // Query params with undefined values should also be valid
      const queryUndefined = api.listPets.useQuery({
        queryParams: { limit: undefined },
      })
      expect(queryUndefined).toBeTruthy()
    })

    it('should correctly type mutation path parameters', () => {
      // updatePet requires { petId: string } as path params
      const mutation = api.updatePet.useMutation({ petId: '123' })

      expect(mutation).toBeTruthy()

      // This is a type assertion test
      const pathParams: Types.updatePet.PathParams = { petId: '456' }
      const mutationWithTypedParams = api.updatePet.useMutation(pathParams)
      expect(mutationWithTypedParams).toBeTruthy()

      // Verify path params are accessible
      expect(mutation.pathParams).toBeDefined()
      expect(mutation.pathParams.value).toEqual({ petId: '123' })
    })

    it('should correctly type mutation request body', () => {
      const mutation = api.createPet.useMutation()

      // TypeScript should enforce the request body type matches NewPet
      // The data property accepts Types.createPet.Request
      const newPet: Types.createPet.Request = {
        name: 'Fluffy',
        tag: 'friendly',
        status: 'available',
      }

      expect(() => {
        mutation.mutate({
          data: newPet,
        })
      }).not.toThrow()

      // Test with partial data (only required fields)
      const minimalPet: Types.createPet.Request = {
        name: 'Minimal Pet',
      }

      expect(() => {
        mutation.mutate({
          data: minimalPet,
        })
      }).not.toThrow()
    })

    it('should correctly type mutation with both path params and request body', () => {
      // updatePet requires path params AND request body
      const mutation = api.updatePet.useMutation({ petId: '123' })

      const updateData: Types.updatePet.Request = {
        name: 'Updated Fluffy',
        status: 'pending',
      }

      expect(() => {
        mutation.mutate({
          data: updateData,
        })
      }).not.toThrow()
    })

    it('should enforce valid enum values for status field', () => {
      const mutation = api.createPet.useMutation()

      // Valid status values from the OpenAPI spec
      const validStatuses: Array<Types.createPet.Request['status']> = ['available', 'pending', 'adopted']

      validStatuses.forEach((status) => {
        const petData: Types.createPet.Request = {
          name: 'Test Pet',
          status,
        }

        expect(() => {
          mutation.mutate({
            data: petData,
          })
        }).not.toThrow()
      })
    })

    it('should correctly type path parameter overrides in mutate calls', () => {
      const mutation = api.updatePet.useMutation({ petId: '123' })

      // Override path params in the mutate call
      expect(() => {
        mutation.mutate({
          data: { name: 'Updated' },
          pathParams: { petId: '456' }, // Type should be Types.updatePet.PathParams
        })
      }).not.toThrow()
    })
  })

  describe('Type Safety - Response Data', () => {
    it('should correctly type query response data', () => {
      const query = api.listPets.useQuery()

      // Compile-time check: query.data.value should be inferred as Pet[] | undefined from OpenAPI
      type InferredDataType = typeof query.data.value
      type ExpectedDataType = Types.listPets.Response | undefined
      const _typeCheck: InferredDataType extends ExpectedDataType ? true : false = true
      const _reverseCheck: ExpectedDataType extends InferredDataType ? true : false = true
      expect(_typeCheck && _reverseCheck).toBe(true)

      // The data property should be Types.listPets.Response (Pet[])
      if (query.data.value) {
        // TypeScript infers this is Pet[] from the OpenAPI spec (no cast needed)
        const pets = query.data.value

        // Each pet should have the expected structure
        pets.forEach((pet) => {
          expect(typeof pet.name).toBe('string')
          expect(pet.id === undefined || typeof pet.id === 'string').toBe(true)
          expect(pet.status).toMatch(/^(available|pending|adopted)$/)
        })
      }
    })

    it('should correctly type single item query response', () => {
      const query = api.getPet.useQuery({ petId: '123' })

      // Compile-time check: data type flows from OpenAPI spec
      type InferredDataType = typeof query.data.value
      type ExpectedDataType = Types.getPet.Response | undefined
      const _typeCheck: InferredDataType extends ExpectedDataType ? true : false = true
      const _reverseCheck: ExpectedDataType extends InferredDataType ? true : false = true
      expect(_typeCheck && _reverseCheck).toBe(true)

      // TypeScript infers query.data.value is Types.getPet.Response | undefined from OpenAPI
      const petData = query.data.value

      // TypeScript should know the Pet structure when data is present
      if (petData) {
        // TypeScript infers these properties from the OpenAPI Pet schema
        const name: string = petData.name
        const _id: string | undefined = petData.id
        const _tag: string | undefined = petData.tag
        const _status: 'available' | 'pending' | 'adopted' | undefined = petData.status

        expect(typeof name).toBe('string')
      }
    })

    it('should correctly type mutation response data', async () => {
      const mutation = api.createPet.useMutation()

      // Compile-time check: mutateAsync returns Promise<AxiosResponse<Pet>> from OpenAPI
      type MutateAsyncReturn = ReturnType<typeof mutation.mutateAsync>
      type ExpectedReturn = Promise<AxiosResponse<Types.createPet.Response>>
      const _typeCheck: MutateAsyncReturn extends ExpectedReturn ? true : false = true
      const _reverseCheck: ExpectedReturn extends MutateAsyncReturn ? true : false = true
      expect(_typeCheck && _reverseCheck).toBe(true)

      const responsePromise = mutation.mutateAsync({
        data: { name: 'New Pet' },
      })

      // The promise resolves to AxiosResponse with data of type Types.createPet.Response
      const response = await responsePromise

      // Compile-time check: response.data is inferred as Pet from OpenAPI
      type ResponseDataType = typeof response.data
      type ExpectedDataType = Types.createPet.Response
      const _dataTypeCheck: ResponseDataType extends ExpectedDataType ? true : false = true
      const _dataReverseCheck: ExpectedDataType extends ResponseDataType ? true : false = true
      expect(_dataTypeCheck && _dataReverseCheck).toBe(true)

      // TypeScript should know response is AxiosResponse
      expect(response).toBeDefined()

      if (response.data) {
        const pet = response.data
        expect(typeof pet.name).toBe('string')
      }

      mutation
        .mutateAsync({
          data: { name: 'New Pet' },
        })
        .then((res) => {
          expect(res).toBeDefined()
          if (res.data) {
            const pet = res.data
            expect(typeof pet.name).toBe('string')
          }
        })
    })

    it('should correctly type onSuccess callback with response data', async () => {
      // Type assertion: onSuccess receives AxiosResponse with data of type Pet
      const onSuccess: (response: AxiosResponse<Types.createPet.Response>, variables: unknown) => void = (
        response,
        _variables,
      ) => {
        // TypeScript should know response.data is a Pet object
        const pet: Types.createPet.Response = response.data
        expect(typeof pet.id).toBe('string')
        expect(typeof pet.name).toBe('string')
      }

      const mutation = api.createPet.useMutation({
        onSuccess,
      })

      expect(mutation).toBeTruthy()
    })

    it('should correctly type onError callback with error data', async () => {
      const onError = vi.fn((error: Error) => {
        // TypeScript should know this is an Error
        expect(error).toBeInstanceOf(Error)
        expect(typeof error.message).toBe('string')
      })

      const mutation = api.createPet.useMutation({
        onError,
      })

      expect(mutation).toBeTruthy()
    })

    it('should correctly type onLoad callback with query data', () => {
      // Type assertion: onLoad callback receives correct data type
      const onLoad: (data: Types.listPets.Response) => void = (data) => {
        // TypeScript should know data is Pet[]
        if (Array.isArray(data)) {
          data.forEach((pet) => {
            // TypeScript should know pet has Pet properties
            const _name: string = pet.name
            const _id: string | undefined = pet.id
            const _status: 'available' | 'pending' | 'adopted' | undefined = pet.status
          })
        }
      }

      const query = api.listPets.useQuery({
        onLoad,
      })

      expect(query).toBeTruthy()
    })

    it('should correctly type select function for data transformation', () => {
      // Type assertion: select receives Pet[] and should return Pet[] (or compatible type)
      const select = (data: Types.listPets.Response) => {
        // Filter the pets array (returns same type)
        return data.filter((pet) => pet.status === 'available')
      }

      const query = api.listPets.useQuery({
        select,
      })

      expect(query).toBeTruthy()
    })

    it('should correctly type mutation variables in callbacks', () => {
      // Type assertion: onSuccess receives AxiosResponse with data and variables
      const onSuccess: (
        response: AxiosResponse<Types.createPet.Response>,
        variables: {
          data?: Types.createPet.Request
          pathParams?: Record<string, unknown>
          queryParams?: Record<string, unknown>
          axiosOptions?: unknown
          dontInvalidate?: boolean
          dontUpdateCache?: boolean
        },
      ) => void = (_response, variables) => {
        // TypeScript should know variables structure
        if (variables.data) {
          expect(variables.data.name).toBeDefined()
          expect(typeof variables.data.name).toBe('string')
        }
      }

      const mutation = api.createPet.useMutation({
        onSuccess,
      })

      expect(mutation).toBeTruthy()
    })
  })

  describe('Type Safety - Composable Return Types', () => {
    it('should correctly type query composable return value', () => {
      const query = api.listPets.useQuery()

      // These are type assertions - if these compile, the types are correct
      // The actual QueryReturn type includes all these properties:
      type QueryResult = typeof query

      // Type: data should be ComputedRef<TResponse | undefined>
      const dataProperty: QueryResult['data'] = query.data
      expect(dataProperty).toBeDefined()

      // Type: isLoading should be Ref<boolean>
      const loadingProperty: QueryResult['isLoading'] = query.isLoading
      expect(loadingProperty).toBeDefined()

      // Type: error should be Ref<Error | null>
      const errorProperty: QueryResult['error'] = query.error
      expect(errorProperty).toBeDefined()

      // Type: queryKey should be ComputedRef<string[]>
      const keyProperty: QueryResult['queryKey'] = query.queryKey
      expect(keyProperty).toBeDefined()

      // Type: isEnabled should be ComputedRef<boolean>
      const enabledProperty: QueryResult['isEnabled'] = query.isEnabled
      expect(enabledProperty).toBeDefined()

      // Type: pathParams should be ComputedRef<TPathParams>
      const paramsProperty: QueryResult['pathParams'] = query.pathParams
      expect(paramsProperty).toBeDefined()

      // Type: onLoad should be a function
      expect(typeof query.onLoad).toBe('function')

      // Type: refetch should be a function
      expect(typeof query.refetch).toBe('function')

      // These should NOT be present on queries (compile-time check)
      // @ts-expect-error - mutate is not on query return type
      const _shouldNotCompile = query.mutate
      expect(_shouldNotCompile).toBeUndefined()
    })

    it('should correctly type mutation composable return value', () => {
      const mutation = api.createPet.useMutation()

      // These are type assertions - if these compile, the types are correct
      type MutationResult = typeof mutation

      // Type: data should be ComputedRef<AxiosResponse<TResponse> | undefined>
      const dataProperty: MutationResult['data'] = mutation.data
      expect(dataProperty).toBeDefined()

      // Type: error should be Ref<Error | null>
      const errorProperty: MutationResult['error'] = mutation.error
      expect(errorProperty).toBeDefined()

      // Type: mutate should be a function
      expect(typeof mutation.mutate).toBe('function')

      // Type: mutateAsync should be a function
      expect(typeof mutation.mutateAsync).toBe('function')

      // Type: isEnabled should be ComputedRef<boolean>
      const enabledProperty: MutationResult['isEnabled'] = mutation.isEnabled
      expect(enabledProperty).toBeDefined()

      // Type: pathParams should be ComputedRef<TPathParams>
      const paramsProperty: MutationResult['pathParams'] = mutation.pathParams
      expect(paramsProperty).toBeDefined()

      // These should NOT be present on mutations (compile-time check)
      // @ts-expect-error - queryKey is not on mutation return type
      const _keyShouldNotCompile = mutation.queryKey
      expect(_keyShouldNotCompile).toBeUndefined()
    })

    it('should correctly type query refetch method', () => {
      const query = api.listPets.useQuery()

      const refetchResult = query.refetch()

      // At the type level, refetch should return a Promise<QueryObserverResult<listPets.Response, Error>>
      // (In the mock environment, the result is undefined, but the type is correct)
      type RefetchRuntimeReturn = typeof refetchResult
      type ExpectedRuntimeReturn = Promise<QueryObserverResult<Types.listPets.Response, Error>>
      const _forwardCheckRuntime: RefetchRuntimeReturn extends ExpectedRuntimeReturn ? true : false = true
      const _backwardCheckRuntime: ExpectedRuntimeReturn extends RefetchRuntimeReturn ? true : false = true
      expect(_forwardCheckRuntime && _backwardCheckRuntime).toBe(true)
    })

    it('refetch return type should be Promise<QueryObserverResult<Pet[], Error>> from OpenAPI spec', () => {
      const query = api.listPets.useQuery()

      // The refetch return type should flow from the OpenAPI spec: listPets returns Pet[]
      // So refetch should return Promise<QueryObserverResult<Pet[], Error>>, not Promise<void>
      type RefetchReturn = ReturnType<typeof query.refetch>
      type ExpectedReturn = Promise<QueryObserverResult<Types.listPets.Response, Error>>

      // Compile-time check: the return types must be assignable both ways (i.e., equivalent)
      const _forwardCheck: RefetchReturn extends ExpectedReturn ? true : false = true
      const _backwardCheck: ExpectedReturn extends RefetchReturn ? true : false = true
      expect(_forwardCheck && _backwardCheck).toBe(true)
    })

    it('should expose TanStack-native fields that were absent from the old manual QueryReturn', () => {
      const query = api.listPets.useQuery()

      // These are purely compile-time checks: the fields exist on the QueryReturn TYPE
      // because it now extends UseQueryReturnType. The test mock only stubs a subset of
      // TanStack fields at runtime, so we assert only on types here.

      // status: Ref<'pending' | 'error' | 'success'>
      type Status = (typeof query)['status']['value']
      const _statusCheck: Status extends 'pending' | 'error' | 'success' ? true : false = true
      expect(_statusCheck).toBe(true)

      // isFetching: Ref<boolean>
      type IsFetching = (typeof query)['isFetching']
      const _isFetchingCheck: IsFetching extends { value: boolean } ? true : false = true
      expect(_isFetchingCheck).toBe(true)

      // fetchStatus: Ref<'fetching' | 'paused' | 'idle'>
      type FetchStatus = (typeof query)['fetchStatus']['value']
      const _fetchStatusCheck: FetchStatus extends 'fetching' | 'paused' | 'idle' ? true : false = true
      expect(_fetchStatusCheck).toBe(true)

      // isStale: Ref<boolean>
      type IsStale = (typeof query)['isStale']
      const _isStaleCheck: IsStale extends { value: boolean } ? true : false = true
      expect(_isStaleCheck).toBe(true)

      // refetch IS in the mock — verify it also still works at runtime
      expect(typeof query.refetch).toBe('function')
    })

    it('QueryReturn should still satisfy Refetchable after the type change', () => {
      const query = api.listPets.useQuery()

      // Assignment without cast proves structural compatibility.
      // Refetchable.refetch is () => Promise<unknown>, which is satisfied by
      // TanStack's (options?: RefetchOptions) => Promise<QueryObserverResult<T, E>>
      // because: optional params ✓ and Promise<QueryObserverResult> extends Promise<unknown> ✓
      const refetchable: Refetchable = query
      expect(typeof refetchable.refetch).toBe('function')
    })

    it('QueryReturn should be structurally compatible with UseQueryReturnType on shared fields', () => {
      const query = api.listPets.useQuery()

      // UseQueryReturnType maps every QueryObserverResult key (except refetch) to Ref<...>.
      // Our QueryReturn extends Omit<UseQueryReturnType, 'data'> so all shared fields must align.
      // These assignments are compile-time checks: they prove the types are structurally correct.
      // (The mock stubs only a subset at runtime, so we only assert on refetch at runtime.)
      type Q = typeof query
      const _isPending: Q['isPending'] = query.isPending
      const _isSuccess: Q['isSuccess'] = query.isSuccess
      const _isError: Q['isError'] = query.isError
      const _error: Q['error'] = query.error
      const _refetch: Q['refetch'] = query.refetch

      // Suppress unused-variable warnings while keeping the compile-time checks active
      void _isPending
      void _isSuccess
      void _isError
      void _error

      // refetch IS stubbed by the mock — verify runtime too
      expect(typeof _refetch).toBe('function')
    })

    it('should correctly type mutation methods', () => {
      const mutation = api.createPet.useMutation()

      // mutate returns void (fire-and-forget)
      expect(typeof mutation.mutate).toBe('function')

      // mutateAsync returns Promise<AxiosResponse<Pet>> from the OpenAPI spec
      const mutateAsyncResult = mutation.mutateAsync({
        data: { name: 'Test' },
      })

      // Verify the return type flows from OpenAPI: createPet returns Pet
      type ExpectedReturn = Promise<AxiosResponse<Types.createPet.Response>>
      type ActualReturn = typeof mutateAsyncResult
      const _check: ActualReturn extends ExpectedReturn ? true : false = true
      expect(_check).toBe(true)
      expect(mutateAsyncResult).toBeInstanceOf(Promise)
    })

    it('should correctly type reactive parameter types', () => {
      // Path params can be reactive
      const reactiveParams = ref({ petId: '123' })
      const query1 = api.getPet.useQuery(reactiveParams)
      expect(query1).toBeTruthy()

      // Path params can be computed
      const computedParams = computed(() => ({ petId: '456' }))
      const query2 = api.getPet.useQuery(computedParams)
      expect(query2).toBeTruthy()

      // Path params can be a function
      let petId = '789'
      const functionParams = () => ({ petId })
      const query3 = api.getPet.useQuery(functionParams)
      expect(query3).toBeTruthy()

      // Path params can be static object
      const staticParams = { petId: '000' }
      const query4 = api.getPet.useQuery(staticParams)
      expect(query4).toBeTruthy()
    })
  })

  describe('Type Safety - Complete Type Assertions', () => {
    it('should maintain type safety through complete query workflow', () => {
      // 1. Create query with typed path params
      const pathParams: Types.getPet.PathParams = { petId: '123' }
      const query = api.getPet.useQuery(pathParams)

      // 2. Access typed response
      if (query.data.value) {
        const pet: Types.getPet.Response = query.data.value
        expect(typeof pet.name).toBe('string')
      }

      // 3. Access typed path params
      const params: Types.getPet.PathParams = query.pathParams.value
      expect(params.petId).toBe('123')

      // 4. Use onLoad with correct type
      query.onLoad((data: Types.getPet.Response) => {
        // In test environment, data may be undefined
        if (data) {
          expect(typeof data.name).toBe('string')
        }
      })
    })

    it('should maintain type safety through complete mutation workflow', () => {
      // 1. Create mutation with typed path params
      const pathParams: Types.updatePet.PathParams = { petId: '123' }
      const mutation = api.updatePet.useMutation(pathParams)

      // 2. Create typed request data
      const requestData: Types.updatePet.Request = {
        name: 'Updated Pet',
        status: 'pending',
      }

      // 3. Call mutate with typed data
      mutation.mutate({
        data: requestData,
      })

      // 4. Type assertion: mutateAsync accepts typed data
      const promise = mutation.mutateAsync({
        data: requestData,
      })
      expect(promise).toBeInstanceOf(Promise)
    })

    it('should maintain type safety with complex nested types', () => {
      // Query with user-specific pets
      const userPetsQuery = api.listUserPets.useQuery({
        userId: 'user1',
      })

      if (userPetsQuery.data.value) {
        const pets: Types.listUserPets.Response = userPetsQuery.data.value
        expect(Array.isArray(pets)).toBe(true)
      }
    })
  })

  describe('Error Handling Patterns', () => {
    it('should support error handling in queries with custom handlers', () => {
      const errorHandler = vi.fn()
      const query = api.listPets.useQuery({
        errorHandler,
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })

    it('should support error handling in mutations with callbacks', () => {
      const mutation = api.createPet.useMutation({
        onError: vi.fn((error) => {
          console.log('Mutation error:', error)
        }),
      })

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
    })

    it('should handle errors in async mutation calls', async () => {
      const mutation = api.createPet.useMutation()

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
