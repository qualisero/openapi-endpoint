import { describe, it, expect, vi } from 'vitest'
import { useOpenApi } from '@/index'
import type { OpenApiConfig, QueryClientLike } from '@/types'
import { mockAxios } from '../setup'
import { OperationId, openApiOperations, type OpenApiOperations } from '../fixtures/openapi-typed-operations'

describe('QueryClient Compatibility', () => {
  describe('QueryClientLike interface', () => {
    it('should accept any object that implements QueryClientLike interface', () => {
      // Create a custom QueryClient-like object with only the required methods
      const customQueryClient: QueryClientLike = {
        cancelQueries: vi.fn(() => Promise.resolve()),
        setQueryData: vi.fn(),
        invalidateQueries: vi.fn(() => Promise.resolve()),
      }

      const config: OpenApiConfig<OpenApiOperations> = {
        operations: openApiOperations,
        axios: mockAxios,
        queryClient: customQueryClient,
      }

      // This should compile and work without type errors
      const api = useOpenApi(config)

      expect(api).toBeTruthy()
      expect(api).toHaveProperty('useQuery')
      expect(api).toHaveProperty('useMutation')
      expect(api).toHaveProperty('useEndpoint')
    })

    it('should work with a QueryClient that has additional properties', () => {
      // Simulate a QueryClient from a different version with extra properties
      const extendedQueryClient: QueryClientLike & { someExtraProperty?: string; __private?: unknown } = {
        cancelQueries: vi.fn(() => Promise.resolve()),
        setQueryData: vi.fn(),
        invalidateQueries: vi.fn(() => Promise.resolve()),
        someExtraProperty: 'extra value',
        __private: { internalState: true }, // Simulate the private property that caused the original issue
      }

      const config: OpenApiConfig<OpenApiOperations> = {
        operations: openApiOperations,
        axios: mockAxios,
        queryClient: extendedQueryClient,
      }

      const api = useOpenApi(config)

      expect(api).toBeTruthy()
      expect(api).toHaveProperty('useQuery')
      expect(api).toHaveProperty('useMutation')
      expect(api).toHaveProperty('useEndpoint')
    })

    it('should work with a minimal QueryClient mock', () => {
      // Test with a very minimal implementation
      const minimalQueryClient: QueryClientLike = {
        cancelQueries: async () => {},
        setQueryData: () => {},
        invalidateQueries: async () => {},
      }

      const config: OpenApiConfig<OpenApiOperations> = {
        operations: openApiOperations,
        axios: mockAxios,
        queryClient: minimalQueryClient,
      }

      const api = useOpenApi(config)

      expect(api).toBeTruthy()

      // Test that we can create queries and mutations without errors
      const query = api.useQuery(OperationId.listPets)
      const mutation = api.useMutation(OperationId.createPet)

      expect(query).toBeTruthy()
      expect(mutation).toBeTruthy()
    })

    it('should handle QueryClient with promise-returning methods', () => {
      // Test that the interface works with different promise return patterns
      const promiseQueryClient: QueryClientLike = {
        cancelQueries: () => new Promise<void>((resolve) => setTimeout(resolve, 1)),
        setQueryData: () => {},
        invalidateQueries: () => Promise.resolve(),
      }

      const config: OpenApiConfig<OpenApiOperations> = {
        operations: openApiOperations,
        axios: mockAxios,
        queryClient: promiseQueryClient,
      }

      const api = useOpenApi(config)

      expect(api).toBeTruthy()
      expect(typeof api.useQuery).toBe('function')
      expect(typeof api.useMutation).toBe('function')
    })
  })

  describe('Original Issue Reproduction', () => {
    it('should handle the type error scenario from the original issue', () => {
      // This test reproduces the scenario from the original issue where
      // a user has a QueryClient from a different version with a '#private' property

      // Mock a QueryClient that might come from user's @tanstack/vue-query version
      const userQueryClient = {
        // Standard methods required by our interface
        cancelQueries: vi.fn(() => Promise.resolve()),
        setQueryData: vi.fn(),
        invalidateQueries: vi.fn(() => Promise.resolve()),

        // Additional methods/properties that might exist in real QueryClient
        getQueryData: vi.fn(),
        isFetching: false,
        isMutating: false,

        // The problematic private property from the error message
        __private: {
          hydration: true,
          // ... other internal state
        },
      } as QueryClientLike & Record<string, unknown>

      // This configuration should work without type errors
      const config: OpenApiConfig<OpenApiOperations> = {
        operations: openApiOperations,
        axios: mockAxios,
        queryClient: userQueryClient,
      }

      // The API should be created successfully
      const api = useOpenApi(config)

      expect(api).toBeTruthy()

      // All API methods should be available
      expect(typeof api.useQuery).toBe('function')
      expect(typeof api.useMutation).toBe('function')
      expect(typeof api.useEndpoint).toBe('function')
      expect(typeof api._debugIsQueryOperation).toBe('function')
    })
  })

  describe('Default QueryClient Fallback', () => {
    it('should use default QueryClient when none is provided', () => {
      const config: OpenApiConfig<OpenApiOperations> = {
        operations: openApiOperations,
        axios: mockAxios,
        // No queryClient provided
      }

      const api = useOpenApi(config)

      expect(api).toBeTruthy()
      expect(api).toHaveProperty('useQuery')
      expect(api).toHaveProperty('useMutation')
      expect(api).toHaveProperty('useEndpoint')
    })
  })
})
