/**
 * Bugfix type tests: QueryClient type compatibility
 *
 * This file contains tests that verify QueryClient from @tanstack/vue-query
 * works correctly with the library's types. Tests provide both runtime
 * execution and compile-time type checking - if the types are incompatible,
 * these tests will fail both at compile time and at runtime.
 */

import type { AxiosInstance } from 'axios'
import { QueryClient } from '@tanstack/vue-query'
import type { EndpointConfig } from '@qualisero/openapi-endpoint'
import { HttpMethod } from '@qualisero/openapi-endpoint'
import { defaultQueryClient } from '@qualisero/openapi-endpoint'
import { describe, it, expect } from 'vitest'

describe('Bugfix: QueryClient type compatibility', () => {
  it('should allow QueryClient to be used directly in EndpointConfig', () => {
    // Verify that QueryClient can be used as the queryClient type in EndpointConfig
    const queryClient: QueryClient = new QueryClient()

    // The EndpointConfig should accept QueryClient directly
    type ConfigWithQueryClient = EndpointConfig & {
      queryClient: QueryClient
    }

    // Use proper types instead of `as any` to ensure compile-time type checking
    const mockAxios = {} as AxiosInstance

    const config: ConfigWithQueryClient = {
      axios: mockAxios,
      queryClient,
      path: '/test',
      method: HttpMethod.GET,
    }

    expect(config.queryClient).toBe(queryClient)
  })

  it('should support all required QueryClient methods', () => {
    // Verify that QueryClient has all methods used by the library
    const queryClient = new QueryClient()

    // These methods are used internally by openapi-query and openapi-mutation
    expect(typeof queryClient.cancelQueries).toBe('function')
    expect(typeof queryClient.setQueryData).toBe('function')
    expect(typeof queryClient.invalidateQueries).toBe('function')
  })

  it('should work with defaultQueryClient from library', () => {
    // This verifies that the library's defaultQueryClient has correct type
    // defaultQueryClient should be assignable to QueryClient type
    const qc: QueryClient = defaultQueryClient

    expect(qc).toBeDefined()
    expect(typeof qc.cancelQueries).toBe('function')
    expect(typeof qc.setQueryData).toBe('function')
    expect(typeof qc.invalidateQueries).toBe('function')
  })
})
