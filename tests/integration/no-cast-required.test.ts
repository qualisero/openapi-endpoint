/**
 * Integration test: Verify that QueryClient can be used without `as any` cast
 *
 * This test replicates the exact scenario from the bug report where users
 * thought they needed to use `legacyQueryClient as any` when calling
 * createApiClient.
 */

import { describe, it, expect } from 'vitest'
import { QueryClient } from '@tanstack/vue-query'
import { createApiClient } from '../fixtures/api-client'
import { mockAxios } from '../setup'

describe('QueryClient usage without casts', () => {
  it('should work with QueryClient - exact bug scenario', () => {
    // This is the exact pattern from the user's file:
    // const legacyQueryClient = new QueryClient({...})
    // const wLegacyApi: ApiClient = createApiClient(axiosInstance, legacyQueryClient as any)
    //
    // The 'as any' should NOT be necessary!

    const legacyQueryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 1000 * 60 * 5,
          refetchOnWindowFocus: false,
        },
      },
    })

    // Verify NO 'as any' cast is needed here:
    const api = createApiClient(mockAxios, legacyQueryClient)

    expect(api).toBeDefined()
    expect(typeof api.listPets.useQuery).toBe('function')
    expect(typeof api.createPet.useMutation).toBe('function')
  })

  it('should work with minimal QueryClient configuration', () => {
    const queryClient = new QueryClient()

    const api = createApiClient(mockAxios, queryClient)

    expect(api).toBeDefined()
    expect(typeof api.listPets.useQuery).toBe('function')
  })

  it('should work with custom QueryClient options', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 1000 * 60 * 2,
          refetchOnWindowFocus: true,
          refetchInterval: 1000 * 30,
        },
        mutations: {
          retry: 3,
          retryDelay: 1000,
        },
      },
    })

    const api = createApiClient(mockAxios, queryClient)

    expect(api).toBeDefined()
  })

  it('should accept QueryClient without type assertions', () => {
    // This test ensures TypeScript doesn't complain about type mismatch
    const qc = new QueryClient()

    // If TypeScript requires any type assertion here, the test will fail to compile
    const api = createApiClient(mockAxios, qc)

    expect(api).toBeDefined()
  })

  it('should work when reusing QueryClient instances', () => {
    // Common pattern: share one QueryClient across multiple APIs
    const sharedQueryClient = new QueryClient({
      defaultOptions: {
        queries: { staleTime: 1000 * 60 * 5 },
      },
    })

    const api1 = createApiClient(mockAxios, sharedQueryClient)
    const api2 = createApiClient(mockAxios, sharedQueryClient)

    expect(api1).toBeDefined()
    expect(api2).toBeDefined()
    expect(typeof api1.listPets.useQuery).toBe('function')
    expect(typeof api2.createPet.useMutation).toBe('function')
  })
})
