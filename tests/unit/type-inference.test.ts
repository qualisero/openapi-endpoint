import { describe, it, expect, beforeEach } from 'vitest'
import { useOpenApi } from '@/index'
import { OpenApiConfig, type OpenApiInstance, type GetPathParameters } from '@/types'
import { mockAxios } from '../setup'

import { OperationId, openApiOperations, type OpenApiOperations } from '../fixtures/openapi-typed-operations'

/**
 * This test file specifically validates that the type inference issue
 * described in the GitHub issue is resolved.
 *
 * The issue was that `useEndpoint` with mutation operations would return
 * a union type, preventing TypeScript from knowing that properties like
 * `mutateAsync` are available.
 */
describe('Type Inference for useEndpoint', () => {
  const mockOperations: OpenApiOperations = openApiOperations

  let mockConfig: OpenApiConfig<OpenApiOperations> = {
    operations: mockOperations,
    axios: mockAxios,
  }

  let api: OpenApiInstance<OpenApiOperations>

  beforeEach(() => {
    api = useOpenApi(mockConfig)
  })

  describe('Mutation operation type inference', () => {
    it('should correctly infer mutation types for createPet operation', () => {
      // This reproduces the exact scenario from the GitHub issue
      const createEndpoint = api.useEndpoint(OperationId.createPet)

      // These should now work without TypeScript errors
      // Previously, this would fail with: Property 'mutateAsync' does not exist on type 'union type'
      expect(createEndpoint).toHaveProperty('mutate')
      expect(createEndpoint).toHaveProperty('mutateAsync')

      // Verify the methods are callable functions
      expect(typeof createEndpoint.mutate).toBe('function')
      expect(typeof createEndpoint.mutateAsync).toBe('function')

      // The key test: we can access mutateAsync directly without type errors
      const mutateAsyncFunction = createEndpoint.mutateAsync
      expect(mutateAsyncFunction).toBeDefined()
      expect(typeof mutateAsyncFunction).toBe('function')
    })

    it('should correctly infer mutation types for updatePet operation', () => {
      const updateEndpoint = api.useEndpoint(OperationId.updatePet)

      expect(updateEndpoint).toHaveProperty('mutate')
      expect(updateEndpoint).toHaveProperty('mutateAsync')

      // Type inference should work for accessing the methods
      const mutateFunction = updateEndpoint.mutate
      const mutateAsyncFunction = updateEndpoint.mutateAsync

      expect(typeof mutateFunction).toBe('function')
      expect(typeof mutateAsyncFunction).toBe('function')
    })

    it('should correctly infer mutation types for deletePet operation', () => {
      const deleteEndpoint = api.useEndpoint(OperationId.deletePet)

      expect(deleteEndpoint).toHaveProperty('mutate')
      expect(deleteEndpoint).toHaveProperty('mutateAsync')

      // Type inference should work
      const mutateAsyncFunction = deleteEndpoint.mutateAsync
      expect(typeof mutateAsyncFunction).toBe('function')
    })
  })

  describe('Query operation type inference', () => {
    it('should correctly infer query types for listPets operation', () => {
      const listEndpoint = api.useEndpoint(OperationId.listPets)

      // Query endpoints should have query-specific properties
      expect(listEndpoint).toHaveProperty('data')
      expect(listEndpoint).toHaveProperty('isLoading')
      expect(listEndpoint).toHaveProperty('refetch')

      // Type inference should work for accessing query properties
      const data = listEndpoint.data
      const isLoading = listEndpoint.isLoading
      const refetch = listEndpoint.refetch

      expect(data).toBeDefined()
      expect(isLoading).toBeDefined()
      expect(typeof refetch).toBe('function')
    })

    it('should correctly infer query types for getPet operation', () => {
      const getEndpoint = api.useEndpoint(OperationId.getPet)

      expect(getEndpoint).toHaveProperty('data')
      expect(getEndpoint).toHaveProperty('isLoading')
      expect(getEndpoint).toHaveProperty('refetch')

      // Type inference should work
      const refetchFunction = getEndpoint.refetch
      expect(typeof refetchFunction).toBe('function')
    })
  })

  describe('Runtime comparison with direct methods', () => {
    it('should have equivalent behavior to useMutation for POST operations', () => {
      const createEndpointViaUseEndpoint = api.useEndpoint(OperationId.createPet)
      const createEndpointViaUseMutation = api.useMutation(OperationId.createPet)

      // Both should have the same properties
      expect(createEndpointViaUseEndpoint).toHaveProperty('mutate')
      expect(createEndpointViaUseEndpoint).toHaveProperty('mutateAsync')
      expect(createEndpointViaUseMutation).toHaveProperty('mutate')
      expect(createEndpointViaUseMutation).toHaveProperty('mutateAsync')

      // Both should have the same property types
      expect(typeof createEndpointViaUseEndpoint.mutate).toBe(typeof createEndpointViaUseMutation.mutate)
      expect(typeof createEndpointViaUseEndpoint.mutateAsync).toBe(typeof createEndpointViaUseMutation.mutateAsync)
    })

    it('should have equivalent behavior to useQuery for GET operations', () => {
      const listEndpointViaUseEndpoint = api.useEndpoint(OperationId.listPets)
      const listEndpointViaUseQuery = api.useQuery(OperationId.listPets)

      // Both should have the same properties
      expect(listEndpointViaUseEndpoint).toHaveProperty('data')
      expect(listEndpointViaUseEndpoint).toHaveProperty('isLoading')
      expect(listEndpointViaUseEndpoint).toHaveProperty('refetch')
      expect(listEndpointViaUseQuery).toHaveProperty('data')
      expect(listEndpointViaUseQuery).toHaveProperty('isLoading')
      expect(listEndpointViaUseQuery).toHaveProperty('refetch')
    })
  })

  describe('Type safety edge cases', () => {
    it('should maintain type safety with path parameters', () => {
      // Mutation with path parameters
      const updateEndpoint = api.useEndpoint(OperationId.updatePet, { petId: '123' })
      expect(updateEndpoint).toHaveProperty('mutateAsync')

      // Query with path parameters
      const getEndpoint = api.useEndpoint(OperationId.getPet, { petId: '123' })
      expect(getEndpoint).toHaveProperty('refetch')
    })

    it('should work with options objects', () => {
      // Mutation with options
      const createEndpoint = api.useEndpoint(OperationId.createPet, {
        onSuccess: () => {},
      })
      expect(createEndpoint).toHaveProperty('mutateAsync')

      // Query with options
      const listEndpoint = api.useEndpoint(OperationId.listPets)
      expect(listEndpoint).toHaveProperty('refetch')
    })
  })

  describe('TypeScript compilation error validation', () => {
    it('should demonstrate compile-time type safety constraints', () => {
      // Test that operation IDs are constrained to known operations
      type ValidOperationIds = keyof OpenApiOperations
      const validOps: ValidOperationIds[] = [
        'listPets',
        'getPet',
        'createPet',
        'updatePet',
        'deletePet',
        'listUserPets',
      ]
      expect(validOps.length).toBe(6)

      // Test that path parameters are properly typed
      type GetPetParams = GetPathParameters<OpenApiOperations, 'getPet'>
      const petParams: GetPetParams = { petId: 'test123' }
      expect(petParams.petId).toBe('test123')

      // Test that operations without path params have empty parameter types
      type ListPetsParams = GetPathParameters<OpenApiOperations, 'listPets'>
      const listParams: ListPetsParams = {}
      expect(Object.keys(listParams).length).toBe(0)
    })

    it('should prevent using wrong operation types with compilation errors', () => {
      // The following lines should fail TypeScript compilation if uncommented:

      // @ts-expect-error - Non-existing operation ID
      api.useQuery('nonExistentOperation')

      // @ts-expect-error - Non-existing operation ID
      api.useMutation('nonExistentOperation')

      // @ts-expect-error - createPet is not a query operation
      api.useQuery(OperationId.createPet)

      // @ts-expect-error - listPets is not a mutation operation
      api.useMutation(OperationId.listPets)

      // @ts-expect-error - Wrong path parameter type (number instead of string)
      api.useQuery(OperationId.getPet, { petId: 123 })

      // @ts-expect-error - Non-existing path parameter
      api.useQuery(OperationId.getPet, { wrongParam: 'test' })

      // @ts-expect-error - Wrong option type (string instead of boolean)
      api.useQuery(OperationId.listPets, { enabled: 'yes' })

      // @ts-expect-error - axiosOptions should be object, not string
      api.useQuery(OperationId.listPets, { axiosOptions: 'invalid' })

      // @ts-expect-error - Wrong path parameter type (number instead of string)
      api.useMutation(OperationId.updatePet, { petId: 123 })

      // @ts-expect-error - Non-existing path parameter
      api.useMutation(OperationId.updatePet, { wrongParam: 'test' })

      // @ts-expect-error - Wrong option type (string instead of boolean)
      api.useMutation(OperationId.createPet, { enabled: 'yes' })

      // @ts-expect-error - axiosOptions should be object, not string
      api.useMutation(OperationId.createPet, { axiosOptions: 'invalid' })

      // @ts-expect-error - Missing required path parameter
      api.useMutation(OperationId.deletePet).mutate()

      // Runtime assertions to ensure the test runs
      expect(true).toBe(true)
    })

    it('should enforce correct typing for query operations', () => {
      // These should compile successfully with correct types
      const listQuery = api.useQuery(OperationId.listPets)
      const getQuery = api.useQuery(OperationId.getPet, { petId: 'pet123' })
      const userPetsQuery = api.useQuery(OperationId.listUserPets, { userId: 'user123' })

      // Verify the correct return types
      expect(listQuery).toHaveProperty('data')
      expect(listQuery).toHaveProperty('isLoading')
      expect(getQuery).toHaveProperty('data')
      expect(userPetsQuery).toHaveProperty('data')
    })

    it('should enforce correct typing for mutation operations', () => {
      // These should compile successfully with correct types
      const createMutation = api.useMutation(OperationId.createPet)
      const updateMutation = api.useMutation(OperationId.updatePet, { petId: 'pet123' })
      const deleteMutation = api.useMutation(OperationId.deletePet, { petId: 'pet123' })

      // Verify the correct return types
      expect(createMutation).toHaveProperty('mutate')
      expect(createMutation).toHaveProperty('mutateAsync')
      expect(updateMutation).toHaveProperty('mutate')
      expect(deleteMutation).toHaveProperty('mutate')
    })

    it('should enforce correct typing for path parameters', () => {
      // Test operations with required path parameters
      type GetPetPathParams = GetPathParameters<OpenApiOperations, 'getPet'>
      type UpdatePetPathParams = GetPathParameters<OpenApiOperations, 'updatePet'>
      type ListUserPetsPathParams = GetPathParameters<OpenApiOperations, 'listUserPets'>

      // Verify parameter structure
      const getPetParams: GetPetPathParams = { petId: 'test' }
      const updatePetParams: UpdatePetPathParams = { petId: 'test' }
      const listUserPetsParams: ListUserPetsPathParams = { userId: 'test' }

      expect(getPetParams.petId).toBe('test')
      expect(updatePetParams.petId).toBe('test')
      expect(listUserPetsParams.userId).toBe('test')

      // Test operations without path parameters
      type ListPetsPathParams = GetPathParameters<OpenApiOperations, 'listPets'>
      type CreatePetPathParams = GetPathParameters<OpenApiOperations, 'createPet'>

      const listPetsParams: ListPetsPathParams = {}
      const createPetParams: CreatePetPathParams = {}

      expect(Object.keys(listPetsParams).length).toBe(0)
      expect(Object.keys(createPetParams).length).toBe(0)
    })

    it('should provide compile-time documentation for type constraints', () => {
      // This test serves as documentation for developers about TypeScript constraints

      // Valid query operations (GET methods)
      type QueryOperations = 'listPets' | 'getPet' | 'listUserPets'

      // Valid mutation operations (POST/PUT/DELETE methods)
      type MutationOperations = 'createPet' | 'updatePet' | 'deletePet'

      // Operations requiring path parameters
      type OperationsWithPathParams = 'getPet' | 'updatePet' | 'deletePet' | 'listUserPets'

      // Operations without path parameters
      type OperationsWithoutPathParams = 'listPets' | 'createPet'

      // Verify these types exist and can be used
      const queryOps: QueryOperations[] = ['listPets', 'getPet', 'listUserPets']
      const mutationOps: MutationOperations[] = ['createPet', 'updatePet', 'deletePet']
      const withParams: OperationsWithPathParams[] = ['getPet', 'updatePet', 'deletePet', 'listUserPets']
      const withoutParams: OperationsWithoutPathParams[] = ['listPets', 'createPet']

      expect(queryOps.length).toBe(3)
      expect(mutationOps.length).toBe(3)
      expect(withParams.length).toBe(4)
      expect(withoutParams.length).toBe(2)
    })
  })
})
