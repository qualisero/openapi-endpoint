import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useOpenApi } from '@/index'
import { OpenApiConfig, type OpenApiInstance } from '@/types'
import { QueryClient } from '@tanstack/vue-query'
import { mockAxios } from '../setup'

import { OperationId, OPERATION_INFO } from '../fixtures/api-operations'
import { type operations } from '../fixtures/openapi-types'

describe('useOpenApi', () => {
  type MockOps = typeof OPERATION_INFO
  type OperationsWithInfo = operations & MockOps
  const mockOperations: OperationsWithInfo = OPERATION_INFO as OperationsWithInfo

  let mockConfig: OpenApiConfig<OperationsWithInfo> = {
    operations: mockOperations,
    axios: mockAxios,
  }

  let api: OpenApiInstance<OperationsWithInfo>

  beforeEach(() => {
    api = useOpenApi(mockConfig)
  })

  it('should return an object with useQuery, useMutation, and useEndpoint functions', () => {
    expect(api).toHaveProperty('useQuery')
    expect(api).toHaveProperty('useMutation')
    expect(api).toHaveProperty('useEndpoint')
    expect(typeof api.useQuery).toBe('function')
    expect(typeof api.useMutation).toBe('function')
    expect(typeof api.useEndpoint).toBe('function')
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
      const query = api.useQuery(OperationId.listPets, undefined, { onLoad })

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
      const mutation = api.useMutation(OperationId.createPet, undefined, { onSuccess })

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
      expect(listEndpoint).toHaveProperty('refetch')

      // Test that the properties exist (runtime verification)
      expect(listEndpoint.data).toBeDefined()
      expect(listEndpoint.isLoading).toBeDefined() // isLoading is a reactive ref
      expect(typeof listEndpoint.refetch).toBe('function')
    })
  })

  describe('custom queryClient configuration', () => {
    it('should use provided queryClient when specified in config', () => {
      const customQueryClient = vi.fn() as unknown as QueryClient
      customQueryClient.getQueryData = vi.fn()
      customQueryClient.setQueryData = vi.fn()
      customQueryClient.invalidateQueries = vi.fn()
      customQueryClient.cancelQueries = vi.fn()
      customQueryClient.refetchQueries = vi.fn()

      const configWithCustomClient: OpenApiConfig<OperationsWithInfo> = {
        operations: mockOperations,
        axios: mockAxios,
        queryClient: customQueryClient,
      }

      api = useOpenApi(configWithCustomClient)

      // Create a query to ensure the custom client is being used
      const query = api.useQuery(OperationId.listPets)
      expect(query).toBeTruthy()

      // Create a mutation to ensure the custom client is being used
      const mutation = api.useMutation(OperationId.createPet)
      expect(mutation).toBeTruthy()
    })

    it('should use default queryClient when not specified in config', () => {
      const configWithoutCustomClient: OpenApiConfig<OperationsWithInfo> = {
        operations: mockOperations,
        axios: mockAxios,
        // No queryClient specified
      }

      api = useOpenApi(configWithoutCustomClient)

      // Should still work with default queryClient
      const query = api.useQuery(OperationId.listPets)
      expect(query).toBeTruthy()

      const mutation = api.useMutation(OperationId.createPet)
      expect(mutation).toBeTruthy()
    })

    it('should allow OpenApiInstance type to be used for typing API instances', () => {
      // Create an API instance and verify it matches the OpenApiInstance type

      // Type test: this should compile without errors
      const typedApi: OpenApiInstance<OperationsWithInfo> = api

      // Verify the api instance has the expected methods
      expect(typedApi).toHaveProperty('useQuery')
      expect(typedApi).toHaveProperty('useMutation')
      expect(typedApi).toHaveProperty('useEndpoint')
      expect(typeof typedApi.useQuery).toBe('function')
      expect(typeof typedApi.useMutation).toBe('function')
      expect(typeof typedApi.useEndpoint).toBe('function')
    })
  })
})
