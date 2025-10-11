import { describe, it, expect, beforeEach } from 'vitest'
import { useOpenApi } from '@/index'
import { OpenApiConfig, type OpenApiInstance } from '@/types'
import { mockAxios } from '../setup'

import { OperationId, OPERATION_INFO } from '../fixtures/api-operations'
import { type operations } from '../fixtures/openapi-types'

/**
 * This test file specifically validates that the type inference issue
 * described in the GitHub issue is resolved.
 *
 * The issue was that `useEndpoint` with mutation operations would return
 * a union type, preventing TypeScript from knowing that properties like
 * `mutateAsync` are available.
 */
describe('Type Inference for useEndpoint', () => {
  let mockConfig: OpenApiConfig<typeof OPERATION_INFO> = {
    operations: OPERATION_INFO,
    axios: mockAxios,
  }

  let api: OpenApiInstance<operations & typeof OPERATION_INFO>

  beforeEach(() => {
    api = useOpenApi<operations>(mockConfig)
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
      const createEndpoint = api.useEndpoint(OperationId.createPet, undefined, {
        onSuccess: () => {},
      })
      expect(createEndpoint).toHaveProperty('mutateAsync')

      // Query with options
      const listEndpoint = api.useEndpoint(OperationId.listPets)
      expect(listEndpoint).toHaveProperty('refetch')
    })
  })
})
