/**
 * Test for the exact user scenario from ~/iaoport/webapp/src/api/w-legacy/index.ts
 *
 * This test verifies that the user's code should work without `as any`:
 *
 * ```ts
 * const legacyQueryClient = new QueryClient({...})
 * const wLegacyApi: ApiClient = createApiClient(axiosInstance, legacyQueryClient)
 * ```
 */

import { describe, it, expect } from 'vitest'
import { QueryClient } from '@tanstack/vue-query'
import { createApiClient } from '../fixtures/api-client'
import { mockAxios } from '../setup'

describe('User scenario: QueryClient with createApiClient', () => {
  it('should work without `as any` cast - exact user scenario', () => {
    // This is the exact pattern from the user's file
    const legacyQueryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 1000 * 60 * 5, // 5 minutes
          refetchOnWindowFocus: false,
        },
      },
    })

    // This should work WITHOUT `as any` after the fix
    const wLegacyApi = createApiClient(mockAxios, legacyQueryClient)

    expect(wLegacyApi).toBeDefined()
    expect(typeof wLegacyApi.listPets.useQuery).toBe('function')
    expect(typeof wLegacyApi.createPet.useMutation).toBe('function')
  })

  it('should support custom QueryClient instances', () => {
    // Test with a custom QueryClient
    const customClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 1000 * 60 * 2, // 2 minutes
          refetchOnWindowFocus: true,
          refetchInterval: 1000 * 30, // 30 seconds
        },
        mutations: {
          retry: 1,
        },
      },
    })

    const api = createApiClient(mockAxios, customClient)

    expect(api).toBeDefined()
    expect(typeof api.listPets.useQuery).toBe('function')
  })

  it('should work with the defaultQueryClient', () => {
    // This is what happens when you don't pass a queryClient
    const api = createApiClient(mockAxios)

    expect(api).toBeDefined()
    expect(typeof api.listPets.useQuery).toBe('function')
  })
})
