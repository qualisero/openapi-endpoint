import { describe, it, expect, beforeEach } from 'vitest'
import { useOpenApi } from '@/index'
import { OpenApiConfig } from '@/types'
import { mockAxios } from '../setup'

import { OperationId, OPERATION_INFO } from '../fixtures/api-operations'
import { type operations } from '../fixtures/openapi-types'

/**
 * Test file specifically for the new simplified API creation flow
 */
describe('New Simplified API Creation Flow', () => {
  // Test new simplified API configuration
  let simplifiedConfig: OpenApiConfig<typeof OPERATION_INFO> = {
    operations: OPERATION_INFO,
    axios: mockAxios,
  }

  // Using the internal combined type approach
  type CombinedOperations = operations & typeof OPERATION_INFO
  let simplifiedApi: ReturnType<typeof useOpenApi<CombinedOperations, typeof OPERATION_INFO>>

  beforeEach(() => {
    simplifiedApi = useOpenApi<CombinedOperations, typeof OPERATION_INFO>(simplifiedConfig)
  })

  it('should work with the new simplified API creation flow', () => {
    // Test that the new simplified API works
    expect(simplifiedApi).toHaveProperty('useQuery')
    expect(simplifiedApi).toHaveProperty('useMutation')
    expect(simplifiedApi).toHaveProperty('useEndpoint')
    expect(typeof simplifiedApi.useQuery).toBe('function')
    expect(typeof simplifiedApi.useMutation).toBe('function')
    expect(typeof simplifiedApi.useEndpoint).toBe('function')

    // Test that it can create queries and mutations
    const query = simplifiedApi.useQuery(OperationId.listPets)
    expect(query).toBeTruthy()
    expect(query).toHaveProperty('data')
    expect(query).toHaveProperty('isLoading')

    const mutation = simplifiedApi.useMutation(OperationId.createPet)
    expect(mutation).toBeTruthy()
    expect(mutation).toHaveProperty('mutate')
    expect(mutation).toHaveProperty('mutateAsync')
  })

  it('should maintain type safety with the simplified API', () => {
    // Test that the simplified API maintains the same type inference
    const createEndpoint = simplifiedApi.useEndpoint(OperationId.createPet)
    expect(createEndpoint).toHaveProperty('mutate')
    expect(createEndpoint).toHaveProperty('mutateAsync')

    const listEndpoint = simplifiedApi.useEndpoint(OperationId.listPets)
    expect(listEndpoint).toHaveProperty('data')
    expect(listEndpoint).toHaveProperty('isLoading')
    expect(listEndpoint).toHaveProperty('refetch')
  })

  it('should work with path parameters in simplified API', () => {
    // Test that path parameters work correctly
    const getEndpoint = simplifiedApi.useEndpoint(OperationId.getPet, { petId: '123' })
    expect(getEndpoint).toHaveProperty('data')
    expect(getEndpoint).toHaveProperty('isLoading')
    expect(getEndpoint).toHaveProperty('refetch')

    const updateEndpoint = simplifiedApi.useEndpoint(OperationId.updatePet, { petId: '123' })
    expect(updateEndpoint).toHaveProperty('mutate')
    expect(updateEndpoint).toHaveProperty('mutateAsync')
  })
})
