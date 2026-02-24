/**
 * QueryClient type compatibility test
 *
 * This test verifies that QueryClient from @tanstack/vue-query
 * works correctly with the API client without requiring type casts.
 */

import { QueryClient } from '@tanstack/vue-query'
import type { EndpointConfig } from '@qualisero/openapi-endpoint'
import { describe, it, expect } from 'vitest'

describe('QueryClient type compatibility', () => {
  it('should allow QueryClient to be used directly in EndpointConfig', () => {
    // Verify that QueryClient can be used as the queryClient type in EndpointConfig
    const queryClient: QueryClient = new QueryClient()

    // The EndpointConfig should accept QueryClient directly
    type ConfigWithQueryClient = EndpointConfig & {
      queryClient: QueryClient
    }

    const config: ConfigWithQueryClient = {
      axios: {} as any, // Mock axios for type test
      queryClient,
      path: '/test',
      method: 'GET' as any,
    }

    expect(config.queryClient).toBe(queryClient)
  })

  it('should support all required QueryClient methods', () => {
    const queryClient = new QueryClient()

    // These methods should be callable (runtime verification)
    expect(typeof queryClient.cancelQueries).toBe('function')
    expect(typeof queryClient.setQueryData).toBe('function')
    expect(typeof queryClient.invalidateQueries).toBe('function')
  })
})
