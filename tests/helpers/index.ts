import { effectScope } from 'vue'
import { QueryClient } from '@tanstack/vue-query'
import { mockAxios } from '../setup'
import { createApiClient } from '../fixtures/api-client'

/**
 * Creates a fresh QueryClient for each test with sensible testing defaults.
 *
 * - retry: false  → errors surface immediately without retry delays
 * - gcTime: 0     → cache entries removed immediately on scope dispose
 * - staleTime: 0  → data is always considered stale (forces re-fetch in tests
 *                    that need it; override per-test when testing stale-time logic)
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
    },
  })
}

/**
 * Creates a Vue effectScope, runs the provided factory inside it, and returns
 * { api, scope, queryClient, mockAxios, run }. Call scope.stop() in afterEach to clean up watchers.
 *
 * Required for all tests that call TanStack composables (useQuery, useMutation, useLazyQuery)
 * so that:
 * - watch() calls are tracked and cleaned up
 * - onScopeDispose callbacks fire (allowing TanStack to unsubscribe observers)
 * - TanStack observer subscriptions are properly managed
 *
 * The api is created fresh per test to avoid cross-test cache contamination.
 *
 * Usage:
 *   let api, scope, run
 *   beforeEach(() => { ({ api, scope, run } = createTestScope()) })
 *   afterEach(() => { scope.stop() })
 *   it('...', () => {
 *     const query = run(() => api.listPets.useQuery())
 *     // assertions on query...
 *   })
 *
 * @param axiosMock - Optional custom axios mock (defaults to the global mockAxios)
 * @param queryClient - Optional custom QueryClient (defaults to fresh test QueryClient)
 * @returns { api, scope, queryClient, mockAxios, run }
 */
export function createTestScope(axiosMock = mockAxios, queryClient = createTestQueryClient()) {
  const scope = effectScope()
  const api = scope.run(() => createApiClient(axiosMock, queryClient))!
  /** Run a callback inside the test scope — use this to create composables. */
  const run = <T>(fn: () => T): T => scope.run(fn)!
  return { api, scope, queryClient, mockAxios: axiosMock, run }
}
