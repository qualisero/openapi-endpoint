/**
 * Bugfix test: QueryClient should work without `as any` cast
 *
 * This test verifies the fix for the reported bug where users
 * needed to use `legacyQueryClient as any` when calling
 * createApiClient. The exact scenario from the bug report:
 *
 * ```ts
 * const legacyQueryClient = new QueryClient({...})
 * const wLegacyApi = createApiClient(axiosInstance, legacyQueryClient as any)
 * //                                                                      ^^^^^ required ❌
 * ```
 *
 * After the fix, no cast should be required:
 * ```ts
 * const queryClient = new QueryClient({...})
 * const api = createApiClient(axiosInstance, queryClient)
 * // ✅ Works perfectly!
 * ```
 */

import { describe, it, expect } from 'vitest'
import { QueryClient } from '@tanstack/vue-query'
import { createApiClient } from '../fixtures/api-client'
import { mockAxios } from '../setup'

describe('Bugfix: QueryClient no cast required', () => {
  describe('Exact bug scenario', () => {
    it('should work with QueryClient - exact user scenario', () => {
      // This is the exact pattern from the user's file
      const legacyQueryClient = new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
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

    it('should accept QueryClient without type assertions', () => {
      // This test ensures TypeScript doesn't complain about type mismatch
      const qc = new QueryClient()

      // If TypeScript requires any type assertion here, the test will fail to compile
      const api = createApiClient(mockAxios, qc)

      expect(api).toBeDefined()
    })
  })

  describe('QueryClient configurations', () => {
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
  })

  describe('QueryClient reuse patterns', () => {
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
})
