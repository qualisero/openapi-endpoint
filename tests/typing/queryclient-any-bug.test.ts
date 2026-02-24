/**
 * Bug test: QueryClient type should work without `as any` casts
 *
 * This test demonstrates that QueryClient from @tanstack/vue-query
 * should be assignable to createApiClient's queryClient parameter
 * without requiring `as any` type assertions.
 */

import { describe, it, expect } from 'vitest'
import { QueryClient } from '@tanstack/vue-query'
import { createApiClient } from '../fixtures/api-client'
import { mockAxios } from '../setup'

describe('QueryClient type compatibility (Bug reproduction)', () => {
  it('should create API client with QueryClient without `as any` cast', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 1000 * 60 * 5,
          refetchOnWindowFocus: false,
        },
      },
    })

    // This should work without `as any` after the fix
    const api = createApiClient(mockAxios, queryClient)

    expect(api).toBeDefined()
    expect(typeof api.createPet.useMutation).toBe('function')
    expect(typeof api.listPets.useQuery).toBe('function')
  })

  it('should work with any QueryClient instance', () => {
    const queryClient: QueryClient = new QueryClient()

    // Create API with QueryClient instance
    const api = createApiClient(mockAxios, queryClient)

    expect(api).toBeDefined()
  })
})
