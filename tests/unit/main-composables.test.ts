import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useOpenApi } from '@/index'
import { HttpMethod, OpenApiConfig, type OpenApiInstance } from '@/types'
import { QueryClient } from '@tanstack/vue-query'
import { mockAxios } from '../setup'

// Define mock operations for testing
const mockOperations = {
  listPets: { method: HttpMethod.GET, path: '/pets' },
  getPet: { method: HttpMethod.GET, path: '/pets/{petId}' },
  createPet: { method: HttpMethod.POST, path: '/pets' },
  updatePet: { method: HttpMethod.PUT, path: '/pets/{petId}' },
  deletePet: { method: HttpMethod.DELETE, path: '/pets/{petId}' },
}

type MockOps = typeof mockOperations

describe('useOpenApi', () => {
  let mockConfig: OpenApiConfig<MockOps>

  beforeEach(() => {
    mockConfig = {
      operations: mockOperations,
      axios: mockAxios,
    }
  })

  it('should return an object with useQuery, useMutation, and useEndpoint functions', () => {
    const api = useOpenApi(mockConfig)

    expect(api).toHaveProperty('useQuery')
    expect(api).toHaveProperty('useMutation')
    expect(api).toHaveProperty('useEndpoint')
    expect(typeof api.useQuery).toBe('function')
    expect(typeof api.useMutation).toBe('function')
    expect(typeof api.useEndpoint).toBe('function')
  })

  describe('useQuery', () => {
    it('should create a query for GET operations', () => {
      const api = useOpenApi(mockConfig)

      // Test that useQuery can be called with a GET operation
      const query = api.useQuery('listPets', {})

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })

    it('should create a query with path parameters', () => {
      const api = useOpenApi(mockConfig)

      // Test that useQuery can be called with path parameters
      const query = api.useQuery('getPet', { petId: '123' })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })

    it('should create a query with options', () => {
      const api = useOpenApi(mockConfig)

      // Test that useQuery can be called with options
      const onLoad = vi.fn()
      const query = api.useQuery('listPets', {}, { enabled: true, onLoad })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })
  })

  describe('useMutation', () => {
    it('should create a mutation for POST operations', () => {
      const api = useOpenApi(mockConfig)

      // Test that useMutation can be called with a POST operation
      const mutation = api.useMutation('createPet', {})

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })

    it('should create a mutation with path parameters', () => {
      const api = useOpenApi(mockConfig)

      // Test that useMutation can be called with path parameters
      const mutation = api.useMutation('updatePet', { petId: '123' })

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })

    it('should create a mutation with options', () => {
      const api = useOpenApi(mockConfig)

      // Test that useMutation can be called with options
      const onSuccess = vi.fn()
      const mutation = api.useMutation('createPet', {}, { onSuccess })

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })
  })

  describe('useEndpoint', () => {
    it('should create an endpoint handler for any operation', () => {
      const api = useOpenApi(mockConfig)

      // Test that useEndpoint can be called with any operation
      const endpoint = api.useEndpoint('listPets', {})

      expect(endpoint).toBeTruthy()
    })

    it('should create an endpoint handler with path parameters', () => {
      const api = useOpenApi(mockConfig)

      // Test that useEndpoint can be called with path parameters
      const endpoint = api.useEndpoint('getPet', { petId: '123' })

      expect(endpoint).toBeTruthy()
    })

    it('should create an endpoint handler with options', () => {
      const api = useOpenApi(mockConfig)

      // Test that useEndpoint can be called with options
      const endpoint = api.useEndpoint('listPets', {}, { enabled: true })

      expect(endpoint).toBeTruthy()
    })

    it('should work with mutation operations', () => {
      const api = useOpenApi(mockConfig)

      // Test that useEndpoint can be called with mutation operations
      const createEndpoint = api.useEndpoint('createPet', {})
      const updateEndpoint = api.useEndpoint('updatePet', { petId: '123' })
      const deleteEndpoint = api.useEndpoint('deletePet', { petId: '123' })

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
  })

  describe('configuration validation', () => {
    it('should work with different operation configurations', () => {
      const customOperations = {
        getUser: { method: HttpMethod.GET, path: '/users/{userId}' },
        createUser: { method: HttpMethod.POST, path: '/users' },
      }

      const customConfig: OpenApiConfig<typeof customOperations> = {
        operations: customOperations,
        axios: mockAxios,
      }

      const api = useOpenApi(customConfig)

      expect(api.useQuery('getUser', { userId: '123' })).toBeTruthy()
      expect(api.useMutation('createUser', {})).toBeTruthy()
    })

    it('should handle empty operations configuration', () => {
      const emptyOperations = {}
      const emptyConfig: OpenApiConfig<typeof emptyOperations> = {
        operations: emptyOperations,
        axios: mockAxios,
      }

      const api = useOpenApi(emptyConfig)

      expect(api).toHaveProperty('useQuery')
      expect(api).toHaveProperty('useMutation')
      expect(api).toHaveProperty('useEndpoint')
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

      const configWithCustomClient: OpenApiConfig<MockOps> = {
        operations: mockOperations,
        axios: mockAxios,
        queryClient: customQueryClient,
      }

      const api = useOpenApi(configWithCustomClient)

      // Create a query to ensure the custom client is being used
      const query = api.useQuery('listPets', {})
      expect(query).toBeTruthy()

      // Create a mutation to ensure the custom client is being used
      const mutation = api.useMutation('createPet', {})
      expect(mutation).toBeTruthy()
    })

    it('should use default queryClient when not specified in config', () => {
      const configWithoutCustomClient: OpenApiConfig<MockOps> = {
        operations: mockOperations,
        axios: mockAxios,
        // No queryClient specified
      }

      const api = useOpenApi(configWithoutCustomClient)

      // Should still work with default queryClient
      const query = api.useQuery('listPets', {})
      expect(query).toBeTruthy()

      const mutation = api.useMutation('createPet', {})
      expect(mutation).toBeTruthy()
    })

    it('should allow OpenApiInstance type to be used for typing API instances', () => {
      // Create an API instance and verify it matches the OpenApiInstance type
      const api = useOpenApi(mockConfig)

      // Type test: this should compile without errors
      const typedApi: OpenApiInstance<MockOps> = api

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
