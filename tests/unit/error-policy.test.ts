/**
 * Runtime tests for createApiErrorCaches error policy
 *
 * Numbered to match the plan's §3.5 test list:
 * (1) onError fires exactly once after all retries exhaust
 * (2) skipGlobalError:true → zero calls
 * (3) predicate: suppressed when true, fires when false, receives error
 * (4) unstamped ad-hoc query on same client → zero calls
 * (5) caller-supplied meta survives the stamp
 * (6) mutation error fires once with kind:'mutation'
 * (7) swallowing errorHandler → zero onError calls (query resolves null)
 */

import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { QueryClient } from '@tanstack/vue-query'
import type { AxiosError } from 'axios'
import { createApiErrorCaches, ERROR_POLICY_META_KEY, type ApiErrorContext } from '@qualisero/openapi-endpoint'
import { mockAxios } from '../setup'
import { createTestScope } from '../helpers'

// ---------------------------------------------------------------------------
// Helper: build a QueryClient that uses the error caches.
// The default options mirror createTestQueryClient() so existing helpers work.
// ---------------------------------------------------------------------------
function makeErrorClient(onError: (error: unknown, ctx: ApiErrorContext) => void) {
  const { queryCache, mutationCache } = createApiErrorCaches({ onError })
  return new QueryClient({
    queryCache,
    mutationCache,
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  })
}

// Shared axios errors used across tests
const error500 = { isAxiosError: true, response: { status: 500 }, message: 'Server error' }
const error409 = { isAxiosError: true, response: { status: 409 }, message: 'Conflict' }
const error422 = { isAxiosError: true, response: { status: 422 }, message: 'Unprocessable' }

describe('createApiErrorCaches — error policy', () => {
  // -------------------------------------------------------------------------
  // (1) retry:2 → 3 axios calls, exactly 1 onError
  // -------------------------------------------------------------------------
  it('(1) fires onError exactly once for a query with retry:2 (3 axios calls → 1 onError)', async () => {
    vi.useFakeTimers()
    try {
      const onError = vi.fn()
      const { queryCache, mutationCache } = createApiErrorCaches({ onError })
      const qc = new QueryClient({
        queryCache,
        mutationCache,
        // retryDelay:0 avoids real time waits; retry is overridden per-hook
        defaultOptions: { queries: { gcTime: 0, staleTime: 0, retryDelay: 0 } },
      })

      mockAxios.mockRejectedValue(error500)

      const { api, run, scope } = createTestScope(mockAxios, qc)

      // retry:2 overrides no4xxRetry (spread comes after retry:no4xxRetry in queryOptions)
      run(() => api.listPets.useQuery({ retry: 2, retryDelay: 0 }))

      // Advance through all retry timers and flush resulting promises
      await vi.runAllTimersAsync()

      expect(mockAxios).toHaveBeenCalledTimes(3) // initial + 2 retries
      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError).toHaveBeenCalledWith(
        error500,
        expect.objectContaining({
          operationId: 'listPets',
          path: '/pets',
          method: 'GET',
          kind: 'query',
        }),
      )

      scope.stop()
    } finally {
      vi.useRealTimers()
    }
  })

  // -------------------------------------------------------------------------
  // (2) skipGlobalError:true → zero onError calls
  // -------------------------------------------------------------------------
  it('(2) skipGlobalError:true → zero onError calls', async () => {
    const onError = vi.fn()
    const qc = makeErrorClient(onError)
    mockAxios.mockRejectedValueOnce(error500)

    const { api, run, scope } = createTestScope(mockAxios, qc)
    run(() => api.listPets.useQuery({ skipGlobalError: true }))
    await flushPromises()

    expect(onError).not.toHaveBeenCalled()
    scope.stop()
  })

  // -------------------------------------------------------------------------
  // (3) predicate: suppressed when returns true; fires when returns false;
  //     the error object is forwarded to onError when it fires
  // -------------------------------------------------------------------------
  it('(3) predicate: suppressed when true, fires when false, forwards the error', async () => {
    // Sub-test A: predicate returns true (409) → suppress
    {
      const onError = vi.fn()
      const qc = makeErrorClient(onError)
      mockAxios.mockRejectedValueOnce(error409)
      const { api, run, scope } = createTestScope(mockAxios, qc)
      // retry:false overrides no4xxRetry so 4xx doesn't retry AND 5xx fails cleanly
      run(() =>
        api.listPets.useQuery({
          skipGlobalError: (e: AxiosError<unknown>) => e.response?.status === 409,
          retry: false,
        }),
      )
      await flushPromises()
      expect(onError).not.toHaveBeenCalled()
      scope.stop()
    }

    // Sub-test B: predicate returns false (500) → onError fires, receives error;
    //             the query itself still enters error state (never-swallows contract)
    {
      const onError = vi.fn()
      const qc = makeErrorClient(onError)
      mockAxios.mockRejectedValueOnce(error500)
      const { api, run, scope } = createTestScope(mockAxios, qc)
      // retry:false ensures the 5xx error is not retried (no4xxRetry would retry 5xx)
      const query = run(() =>
        api.listPets.useQuery({
          skipGlobalError: (e: AxiosError<unknown>) => e.response?.status === 409,
          retry: false,
        }),
      )
      await flushPromises()
      expect(onError).toHaveBeenCalledTimes(1)
      // The error forwarded is the original rejection value
      expect(onError.mock.calls[0][0]).toBe(error500)
      // The promise still rejects: onError is observe-only, it never swallows.
      expect(query.isError.value).toBe(true)
      scope.stop()
    }
  })

  // -------------------------------------------------------------------------
  // (4) zero onError calls for an ad-hoc unstamped query on the same client
  // -------------------------------------------------------------------------
  it('(4) zero onError calls for an unstamped ad-hoc query on the same client', async () => {
    const onError = vi.fn()
    const { queryCache, mutationCache } = createApiErrorCaches({ onError })
    const qc = new QueryClient({
      queryCache,
      mutationCache,
      defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
    })

    mockAxios.mockRejectedValueOnce(error500)

    // Direct fetchQuery call without any library stamp in meta
    await qc
      .fetchQuery({
        queryKey: ['ad-hoc-unstamped'],
        queryFn: () => (mockAxios as any)({ method: 'get', url: '/external' }),
        retry: false,
        // No meta → no stamp → cache onError returns immediately without calling opts.onError
      })
      .catch(() => {
        /* expected to reject */
      })

    expect(onError).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // (5) caller-supplied meta keys survive the error policy stamp
  // -------------------------------------------------------------------------
  it('(5) caller-supplied meta survives the error policy stamp', async () => {
    const onError = vi.fn()
    const qc = makeErrorClient(onError)

    const { api, run, scope } = createTestScope(mockAxios, qc)
    // Mount with caller-supplied meta; default mockAxios resolves { data: {} }
    run(() => api.listPets.useQuery({ meta: { myKey: 'myValue', anotherKey: 42 } }))
    await flushPromises()

    const queries = qc.getQueryCache().getAll()
    expect(queries.length).toBeGreaterThan(0)
    const meta = queries[0].meta as Record<string, unknown>
    // Caller keys must survive
    expect(meta?.myKey).toBe('myValue')
    expect(meta?.anotherKey).toBe(42)
    // Stamp must also be present
    expect(meta?.[ERROR_POLICY_META_KEY]).toBeDefined()

    scope.stop()
  })

  // -------------------------------------------------------------------------
  // (5b) Ref-valued meta is unwrapped before spreading (toValue guard)
  // -------------------------------------------------------------------------
  it('(5b) Ref-valued meta keys survive the stamp (toValue unwrap)', async () => {
    const onError = vi.fn()
    const qc = makeErrorClient(onError)
    const { api, run, scope } = createTestScope(mockAxios, qc)
    // as any: TanStack's QueryMeta is Record<string,unknown>; passing a Ref object
    // satisfies the structural type (all Ref properties extend unknown) but the
    // intent is to test runtime toValue() unwrapping, so we cast for clarity.
    run(() => api.listPets.useQuery({ meta: ref({ refKey: 'fromRef' }) } as any))
    await flushPromises()
    const queries = qc.getQueryCache().getAll()
    expect(queries.length).toBeGreaterThan(0)
    const meta = queries[0].meta as Record<string, unknown>
    // The ref was unwrapped by toValue(); the key must be present as a plain value.
    expect(meta?.refKey).toBe('fromRef')
    // __v_isRef must NOT be present (would indicate the ref itself was spread).
    expect(meta?.__v_isRef).toBeUndefined()
    scope.stop()
  })

  // -------------------------------------------------------------------------
  // (6) mutation error fires onError exactly once with kind:'mutation'
  // -------------------------------------------------------------------------
  it('(6) mutation error fires onError once with kind:mutation', async () => {
    const onError = vi.fn()
    const { queryCache, mutationCache } = createApiErrorCaches({ onError })
    const qc = new QueryClient({
      queryCache,
      mutationCache,
      defaultOptions: { mutations: { retry: false }, queries: { retry: false, gcTime: 0, staleTime: 0 } },
    })

    mockAxios.mockRejectedValueOnce(error422)

    const { api, run, scope } = createTestScope(mockAxios, qc)
    const mutation = run(() => api.createPet.useMutation())

    await mutation.mutateAsync({ data: { name: 'test' } } as any).catch(() => {
      /* expected to reject */
    })
    await flushPromises()

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(
      error422,
      expect.objectContaining({
        operationId: 'createPet',
        path: '/pets',
        method: 'POST',
        kind: 'mutation',
      }),
    )

    scope.stop()
  })

  // -------------------------------------------------------------------------
  // (7) swallowing errorHandler → zero onError calls (query resolves null)
  // -------------------------------------------------------------------------
  it('(7) swallowing errorHandler yields zero onError calls and query resolves', async () => {
    const onError = vi.fn()
    const qc = makeErrorClient(onError)

    // Mock an axios-shaped error so the errorHandler guard fires
    mockAxios.mockRejectedValueOnce(error500)

    const { api, run, scope } = createTestScope(mockAxios, qc)
    // errorHandler swallows: returns undefined → buildQueryFn returns null → query resolves
    const query = run(() =>
      api.listPets.useQuery({
        errorHandler: vi.fn().mockResolvedValue(undefined),
      }),
    )
    await flushPromises()

    // The cache never sees a rejection (errorHandler swallowed it → queryFn
    // returned null to satisfy TanStack v5's no-undefined constraint) →
    // onError is never called.
    expect(onError).not.toHaveBeenCalled()
    // The query resolved (not error state); data.value is null (the swallowed
    // path returns null to satisfy TanStack v5's non-undefined requirement).
    expect(query.isError.value).toBe(false)
    expect(query.data.value).toBe(null)

    scope.stop()
  })
})
