import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useOpenApi } from '@/index'
import { useEndpointQuery } from '@/openapi-query'
import { useEndpointMutation } from '@/openapi-mutation'
import { getHelpers } from '@/openapi-helpers'
import { OpenApiConfig } from '@/types'
import { mockAxios } from '../setup'
import {
  QueryOperationId,
  MutationOperationId,
  OpType,
  openApiOperations,
  type OpenApiOperations,
  type ApiPathParams,
} from '../fixtures/openapi-typed-operations'

/**
 * Query and Mutation Options Testing
 *
 * This file consolidates all testing related to:
 * - TanStack Query options for queries and mutations
 * - Advanced composable functionality
 * - Type inference and path parameter handling
 * - Option merging and validation
 */
describe('Query and Mutation Options', () => {
  const mockOperations: OpenApiOperations = openApiOperations

  let mockConfig: OpenApiConfig<OpenApiOperations>
  let api: ReturnType<typeof useOpenApi<OpenApiOperations>>
  let helpers: ReturnType<typeof getHelpers<OpenApiOperations, keyof OpenApiOperations>>

  beforeEach(() => {
    vi.clearAllMocks()
    mockConfig = {
      operations: mockOperations,
      axios: mockAxios,
    }
    api = useOpenApi(mockConfig)
    helpers = getHelpers(mockConfig)
  })

  describe('Query-Specific TanStack Options', () => {
    it('should support staleTime configuration', () => {
      const query = api.useQuery(QueryOperationId.listPets, {
        staleTime: 10000, // 10 seconds
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })

    it('should support retry configuration', () => {
      const customRetry = vi.fn(() => false)
      const query = api.useQuery(QueryOperationId.listPets, {
        retry: customRetry,
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })

    it('should support refetchOnWindowFocus configuration', () => {
      const query = api.useQuery(QueryOperationId.listPets, {
        refetchOnWindowFocus: false,
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })

    it('should support select data transformation', () => {
      const selectFn = vi.fn((data) => data)
      const query = api.useQuery(QueryOperationId.listPets, {
        select: selectFn,
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })

    it('should support initialData and placeholderData configuration', () => {
      const queryWithInitial = api.useQuery(QueryOperationId.listPets, {
        initialData: undefined,
      })

      const queryWithPlaceholder = api.useQuery(QueryOperationId.listPets, {
        placeholderData: undefined,
      })

      expect(queryWithInitial).toBeTruthy()
      expect(queryWithPlaceholder).toBeTruthy()
    })

    it('should support comprehensive query options', () => {
      const onLoad = vi.fn()
      const errorHandler = vi.fn()
      const selectFn = vi.fn((data) => data)

      const query = api.useQuery(QueryOperationId.listPets, {
        // Custom options
        onLoad,
        errorHandler,
        enabled: true,

        // TanStack Query options
        staleTime: 60000,
        refetchOnWindowFocus: false,
        retry: 3,
        select: selectFn,
        initialData: undefined,
        placeholderData: undefined,

        // Axios options
        axiosOptions: {
          timeout: 15000,
          headers: {
            'Accept-Language': 'en-US',
            'Cache-Control': 'no-cache',
          },
        },
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('onLoad')
      expect(typeof query.onLoad).toBe('function')
    })
  })

  describe('Mutation-Specific TanStack Options', () => {
    it('should support retry configuration for mutations', () => {
      const customRetry = vi.fn(() => false)
      const mutation = api.useMutation(MutationOperationId.createPet, {
        retry: customRetry,
      })

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })

    it('should support lifecycle callbacks', () => {
      const onSuccess = vi.fn()
      const onError = vi.fn()
      const onSettled = vi.fn()

      const mutation = api.useMutation(MutationOperationId.createPet, {
        onSuccess,
        onError,
        onSettled,
      })

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })

    it('should support meta data configuration', () => {
      const meta = { description: 'Creating a new pet' }
      const mutation = api.useMutation(MutationOperationId.createPet, {
        meta,
      })

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })

    it('should support comprehensive mutation options', () => {
      const onSuccess = vi.fn()
      const onError = vi.fn()
      const customRetry = vi.fn(() => false)

      const mutation = api.useMutation(MutationOperationId.createPet, {
        // TanStack Query options
        onSuccess,
        onError,
        retry: customRetry,
        meta: { operation: 'create' },

        // Cache management options
        invalidateOperations: [QueryOperationId.listPets],
        dontInvalidate: false,
        dontUpdateCache: false,

        // Axios options
        axiosOptions: {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      })

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })
  })

  describe('Cache Invalidation Options', () => {
    it('should support invalidateOperations configuration', () => {
      const mutation = api.useMutation(MutationOperationId.createPet, {
        invalidateOperations: [QueryOperationId.listPets],
      })

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
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
      expect(mutation).toHaveProperty('mutateAsync')
    })

    it('should support dontInvalidate and dontUpdateCache flags', () => {
      const mutationWithDontInvalidate = api.useMutation(MutationOperationId.createPet, {
        dontInvalidate: true,
      })

      const mutationWithDontUpdateCache = api.useMutation(MutationOperationId.createPet, {
        dontUpdateCache: true,
      })

      expect(mutationWithDontInvalidate).toBeTruthy()
      expect(mutationWithDontUpdateCache).toBeTruthy()
    })

    it('should support refetchEndpoints configuration', () => {
      const petListQuery = api.useQuery(QueryOperationId.listPets)
      const mutation = api.useMutation(MutationOperationId.createPet, {
        refetchEndpoints: [petListQuery],
      })

      expect(mutation).toBeTruthy()
      expect(petListQuery).toHaveProperty('refetch')
    })

    it('should support combining different cache management options', () => {
      const petListQuery = api.useQuery(QueryOperationId.listPets)
      const mutation = api.useMutation(
        MutationOperationId.updatePet,
        { petId: '123' },
        {
          invalidateOperations: [QueryOperationId.listPets],
          refetchEndpoints: [petListQuery],
          dontInvalidate: false,
          dontUpdateCache: false,
        },
      )

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
    })
  })

  describe('Advanced Composable Functionality', () => {
    it('should validate operation types at runtime for useEndpointQuery', () => {
      expect(() => {
        useEndpointQuery<OpenApiOperations, 'createPet'>(MutationOperationId.createPet, helpers)
      }).toThrow("Operation 'createPet' uses method POST and cannot be used with useQuery()")

      const query = useEndpointQuery<OpenApiOperations, 'listPets'>(QueryOperationId.listPets, helpers)
      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })

    it('should validate operation types at runtime for useEndpointMutation', () => {
      expect(() => {
        useEndpointMutation<OpenApiOperations, 'listPets'>(QueryOperationId.listPets, helpers)
      }).toThrow("Operation 'listPets' uses method GET and cannot be used with useMutation()")

      const mutation = useEndpointMutation<OpenApiOperations, 'createPet'>(MutationOperationId.createPet, helpers)
      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })

    it('should handle different HTTP methods in mutations', () => {
      const postMutation = api.useMutation(MutationOperationId.createPet)
      const putMutation = api.useMutation(MutationOperationId.updatePet, { petId: '123' })
      const deleteMutation = api.useMutation(MutationOperationId.deletePet, { petId: '123' })

      expect(postMutation).toHaveProperty('mutate')
      expect(putMutation).toHaveProperty('mutate')
      expect(deleteMutation).toHaveProperty('mutate')
    })

    it('should handle path parameters correctly in advanced composables', () => {
      const queryWithParams = api.useQuery(QueryOperationId.getPet, { petId: '123' })
      expect(queryWithParams.queryKey.value).toEqual(['pets', '123'])
      expect(queryWithParams.isEnabled.value).toBe(true)

      const queryWithoutParams = api.useQuery(QueryOperationId.getPet, () => ({ petId: undefined }))
      expect(queryWithoutParams.isEnabled.value).toBe(false)

      const mutationWithParams = api.useMutation(MutationOperationId.updatePet, { petId: '123' })
      expect(mutationWithParams.isEnabled.value).toBe(true)
    })

    it('should support complex scenarios with advanced composables', () => {
      // Use existing nested operation from fixtures
      const query = api.useQuery(QueryOperationId.listUserPets, { userId: 'user1' })

      expect(query.queryKey.value).toEqual(['users', 'user1', 'pets'])
      expect(query.isEnabled.value).toBe(true)
    })

    it('should handle missing path parameters gracefully in advanced composables', () => {
      const query = api.useQuery(QueryOperationId.getPet, () => ({ petId: undefined }))
      expect(query.isEnabled.value).toBe(false)
    })

    it('should support options in advanced composables', () => {
      const onLoad = vi.fn()
      const query = api.useQuery(QueryOperationId.listPets, {
        onLoad,
        axiosOptions: { headers: { 'X-Test': 'value' } },
        staleTime: 3600,
      })
      expect(query).toHaveProperty('onLoad')

      const onSuccess = vi.fn()
      const mutation = api.useMutation(MutationOperationId.createPet, {
        onSuccess,
        invalidateOperations: [QueryOperationId.listPets],
        axiosOptions: { headers: { 'X-Test': 'value' } },
        retry: 3,
      })
      expect(mutation).toBeTruthy()
    })
  })

  describe('Type Safety and Parameter Validation', () => {
    it('should enforce correct parameter types', () => {
      // These should work at runtime with proper types
      const queryWithCorrectParams = api.useQuery(QueryOperationId.getPet, { petId: '123' })
      expect(queryWithCorrectParams).toBeTruthy()

      const mutationWithCorrectParams = api.useMutation(MutationOperationId.updatePet, { petId: '123' })
      expect(mutationWithCorrectParams).toBeTruthy()
    })

    it('should handle optional parameters correctly', () => {
      // Test with operations that don't require path parameters
      const query = api.useQuery(QueryOperationId.listPets)
      expect(query.isEnabled.value).toBe(true)

      const mutation = api.useMutation(MutationOperationId.createPet)
      expect(mutation).toBeTruthy()
    })

    it('should validate ApiPathParams type utility', () => {
      // This is a compile-time type test - using ApiPathParams with OpType namespace
      type UpdatePetParams = ApiPathParams<OpType.updatePet>

      const mutation = api.useMutation(MutationOperationId.updatePet, {
        petId: '123',
      } as UpdatePetParams)
      expect(mutation).toBeTruthy()
    })

    it('should support reactive parameters with proper typing', () => {
      // Create a ref-like object for testing
      const reactiveParams = { petId: '123' }
      const query = api.useQuery(QueryOperationId.getPet, reactiveParams)

      expect(query.queryKey.value).toEqual(['pets', '123'])
      expect(query.isEnabled.value).toBe(true)
    })
  })

  describe('Error Handling in Options', () => {
    it('should handle invalid operation IDs gracefully', () => {
      // This would typically be caught at TypeScript compile time,
      // but we can test the runtime behavior
      const invalidHelpers = {
        ...helpers,
        getOperationInfo: vi.fn().mockReturnValue(null),
        isQueryOperation: vi.fn().mockReturnValue(false),
        isMutationOperation: vi.fn().mockReturnValue(false),
      }

      expect(() => {
        useEndpointQuery<OpenApiOperations, any>('invalidOp' as any, invalidHelpers)
      }).toThrow()
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

    it('should support async error handlers', () => {
      const errorHandler = vi.fn().mockResolvedValue(undefined)
      const query = api.useQuery(QueryOperationId.listPets, {
        errorHandler,
      })

      expect(query).toBeTruthy()
    })

    it('should handle errors in mutations with onError callback', () => {
      const onError = vi.fn()
      const mutation = api.useMutation(MutationOperationId.createPet, {
        onError,
      })

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
    })
  })

  describe('Enabled State Control', () => {
    it('should support boolean enabled state', () => {
      const query = api.useQuery(QueryOperationId.listPets, {
        enabled: false,
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('isEnabled')
      expect(query.isEnabled.value).toBe(false)
    })

    it('should support reactive enabled state', () => {
      // In a real scenario, this would be a ref or computed
      const enabled = true
      const query = api.useQuery(QueryOperationId.listPets, {
        enabled,
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('isEnabled')
    })

    it('should automatically disable queries with unresolved path parameters', () => {
      const query = api.useQuery(QueryOperationId.getPet, () => ({ petId: undefined }))

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('isEnabled')
      expect(query.isEnabled.value).toBe(false)
    })

    it('should handle enabled state based on path resolution in advanced composables', () => {
      const queryWithParams = api.useQuery(QueryOperationId.getPet, { petId: '123' })
      expect(queryWithParams.isEnabled).toBeTruthy()

      const queryWithoutParams = api.useQuery(QueryOperationId.getPet, () => ({ petId: undefined }))
      expect(queryWithoutParams.isEnabled).toBeTruthy()
      expect(queryWithoutParams.isEnabled.value).toBe(false)
    })
  })

  describe('Option Merging and Precedence', () => {
    it('should properly merge axios options from different sources', () => {
      const mutation = api.useMutation(MutationOperationId.createPet, {
        axiosOptions: {
          timeout: 5000,
          headers: {
            'X-Setup-Header': 'setup-value',
            'Content-Type': 'application/json',
          },
        },
      })

      expect(() => {
        mutation.mutate({
          data: { name: 'Fluffy' },
          axiosOptions: {
            timeout: 10000, // Should override setup timeout
            headers: {
              'X-Override-Header': 'override-value',
              'Content-Type': 'application/xml', // Should override setup Content-Type
            },
          },
        })
      }).not.toThrow()
    })

    it('should handle different axios option configurations', () => {
      const customHeaders = { 'X-Custom': 'value' }

      const query = api.useQuery(QueryOperationId.listPets, {
        axiosOptions: {
          headers: customHeaders,
          timeout: 10000,
        },
      })

      const mutation = api.useMutation(MutationOperationId.createPet, {
        axiosOptions: {
          headers: customHeaders,
          timeout: 15000,
        },
      })

      expect(query).toHaveProperty('data')
      expect(mutation).toHaveProperty('mutate')
    })

    it('should support different axios options in advanced composables', () => {
      const customHeaders = { Authorization: 'Bearer token' }
      const query = api.useQuery(QueryOperationId.listPets, {
        axiosOptions: { headers: customHeaders },
      })

      expect(query).toBeTruthy()
      // Axios options should be passed through to the actual request
    })

    it('should handle empty or undefined options gracefully', () => {
      const queryWithEmpty = api.useQuery(QueryOperationId.listPets, {})
      const mutationWithEmpty = api.useMutation(MutationOperationId.createPet, {})

      expect(queryWithEmpty).toHaveProperty('data')
      expect(mutationWithEmpty).toHaveProperty('mutate')
    })
  })
})
