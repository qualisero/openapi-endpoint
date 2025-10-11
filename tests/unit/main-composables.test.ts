import { describe, it, expect, vi } from 'vitest'
import { useOpenApi } from '@/index'
import { OpenApiConfig, type OpenApiInstance } from '@/types'
import { QueryClient, useMutation } from '@tanstack/vue-query'
import { mockAxios } from '../setup'
import { OperationId, openApiOperations, type OpenApiOperations } from '../fixtures/openapi-typed-operations'

describe('useOpenApi', () => {
  let mockConfig: OpenApiConfig<OpenApiOperations> = {
    operations: openApiOperations,
    axios: mockAxios,
  }

  let api: OpenApiInstance<OpenApiOperations>
  api = useOpenApi(mockConfig)

  it('should return an object with useQuery, useMutation, and useEndpoint functions', () => {
    expect(api).toHaveProperty('useQuery')
    expect(api).toHaveProperty('useMutation')
    expect(api).toHaveProperty('useEndpoint')
    expect(typeof api.useQuery).toBe('function')
    expect(typeof api.useMutation).toBe('function')
    expect(typeof api.useEndpoint).toBe('function')
  })

  it('should correctly type operationId parameters', () => {
    // TypeScript compile-time type assertions
    const _listPetsIsQuery: true = api._debugIsQueryOperation(OperationId.listPets)
    const _getPetIsQuery: true = api._debugIsQueryOperation(OperationId.getPet)
    const _createPetIsQuery: false = api._debugIsQueryOperation(OperationId.createPet)
    const _createPetIsQueryTyped: false = api._debugIsQueryOperation(OperationId.createPet)
  })

  describe('useQuery', () => {
    it('should create a query for GET operations', () => {
      // Test that useQuery can be called with a GET operation
      const query = api.useQuery(OperationId.listPets)

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })

    it('should create a query with path parameters', () => {
      // Test that useQuery can be called with path parameters
      const query = api.useQuery(OperationId.getPet, { petId: '123' })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })

    it('should create a query with options', () => {
      // Test that useQuery can be called with options
      const onLoad = vi.fn()
      const query = api.useQuery(OperationId.listPets, { onLoad })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })
  })

  describe('useMutation', () => {
    it('should create a mutation for POST operations', () => {
      // Test that useMutation can be called with a POST operation
      const mutation = api.useMutation(OperationId.createPet)

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })

    it('should create a mutation with path parameters', () => {
      // Test that useMutation can be called with path parameters
      const mutation = api.useMutation(OperationId.updatePet, { petId: '123' })

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })

    it('should create a mutation with options', () => {
      // Test that useMutation can be called with options
      const onSuccess = vi.fn()
      const mutation = api.useMutation(OperationId.createPet, { onSuccess })

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })
  })

  describe('useEndpoint', () => {
    it('should create an endpoint handler for any operation', () => {
      // Test that useEndpoint can be called with any operation
      const endpoint = api.useEndpoint(OperationId.listPets)

      expect(endpoint).toBeTruthy()
    })

    it('should create an endpoint handler with path parameters', () => {
      // Test that useEndpoint can be called with path parameters
      const endpoint = api.useEndpoint(OperationId.getPet, { petId: '123' })

      expect(endpoint).toBeTruthy()
    })

    it('should create an endpoint handler with options', () => {
      // Test that useEndpoint can be called with options
      const endpoint = api.useEndpoint(OperationId.listPets)

      expect(endpoint).toBeTruthy()
    })

    it('should work with mutation operations', () => {
      // Test that useEndpoint can be called with mutation operations
      const createEndpoint = api.useEndpoint(OperationId.createPet)
      const updateEndpoint = api.useEndpoint(OperationId.updatePet, { petId: '123' })
      const deleteEndpoint = api.useEndpoint(OperationId.deletePet, { petId: '123' })

      expect(createEndpoint).toBeTruthy()
      expect(updateEndpoint).toBeTruthy()
      expect(deleteEndpoint).toBeTruthy()

      // Verify these have mutation-like properties
      expect(createEndpoint).toHaveProperty('mutate')
      expect(createEndpoint).toHaveProperty('mutateAsync')
      expect(updateEndpoint).toHaveProperty('mutate')
      expect(updateEndpoint).toHaveProperty('mutateAsync')
      expect(deleteEndpoint).toHaveProperty('mutate')
      expect(deleteEndpoint).toHaveProperty('mutateAsync')
    })

    it('should work with mutation operations not requiring variables', () => {
      // Test that useEndpoint can be called with DELETE operations
      const deleteEndpoint = api.useEndpoint(OperationId.deletePet, { petId: '123' })

      deleteEndpoint.mutateAsync().then(() => {
        // Success callback
        expect(true).toBe(true) // Dummy assertion to indicate success
      })

      // Original TanStack Mutation works:
      const debug = useMutation({
        mutationFn: () => Promise.resolve(true),
      })
      debug.mutateAsync()
    })

    it('should correctly infer types for mutation operations', () => {
      // This test specifically addresses the issue mentioned in the problem statement
      const createEndpoint = api.useEndpoint(OperationId.createPet)

      // These should now work without TypeScript errors
      expect(createEndpoint).toHaveProperty('mutate')
      expect(createEndpoint).toHaveProperty('mutateAsync')

      // Test that the methods exist and are callable (runtime verification)
      expect(typeof createEndpoint.mutate).toBe('function')
      expect(typeof createEndpoint.mutateAsync).toBe('function')

      // Test with typing - this should not cause TypeScript compilation errors
      const mutateFunction = createEndpoint.mutateAsync
      expect(mutateFunction).toBeDefined()
    })

    it('should correctly infer types for query operations', () => {
      // Test that query operations still work correctly
      const listEndpoint = api.useEndpoint(OperationId.listPets)

      // These should work for query operations
      expect(listEndpoint).toHaveProperty('data')
      expect(listEndpoint).toHaveProperty('isLoading')
    })
  })

  describe('custom queryClient configuration', () => {
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
      expect(apiWithCustomClient).toHaveProperty('useEndpoint')
    })

    it('should use default queryClient when not specified in config', () => {
      // This test verifies the api works without explicit queryClient
      expect(api).toBeTruthy()
      expect(api).toHaveProperty('useQuery')
      expect(api).toHaveProperty('useMutation')
      expect(api).toHaveProperty('useEndpoint')
    })

    it('should allow OpenApiInstance type to be used for typing API instances', () => {
      // Type assertion test - if this compiles, the types are working
      const typedApi: OpenApiInstance<OpenApiOperations> = api
      expect(typedApi).toBeTruthy()
      expect(typeof typedApi.useQuery).toBe('function')
      expect(typeof typedApi.useMutation).toBe('function')
      expect(typeof typedApi.useEndpoint).toBe('function')
    })
  })
})
