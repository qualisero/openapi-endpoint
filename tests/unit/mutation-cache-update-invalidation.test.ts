/**
 * Tests for the interaction between automatic cache updates and automatic
 * invalidation after mutations.
 *
 * Default behavior: when a PUT/PATCH response body is written into the cache
 * via setQueryData, the exact item query is NOT additionally invalidated — the
 * cached value already is the server's latest state, and refetching it would
 * mark fresh data stale and spawn a GET that races with subsequent mutations.
 * List-path invalidation still runs.
 *
 * When the cache update does not happen (dontUpdateCache: true, empty response
 * body, POST/DELETE), item-level invalidation behaves as before.
 *
 * Race guard: a GET on the same key that starts *during* the mutation round
 * trip is not covered by the pre-request cancelQueries. Without a second
 * cancel right before setQueryData, that GET's (older) body would land after
 * the write and overwrite it (TanStack's Query.setData has no timestamp
 * guard). The mutation therefore cancels the exact item key again immediately
 * before writing the response body.
 */
import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest'
import { QueryClient } from '@tanstack/vue-query'
import { effectScope } from 'vue'
import { createApiClient } from '../fixtures/api-client'
import { createTestScope } from '../helpers'
import { mockAxios } from '../setup'

describe('mutation cache update vs invalidation', () => {
  let api: ReturnType<typeof createApiClient>
  let scope: ReturnType<typeof effectScope>
  let queryClient: ReturnType<typeof createTestScope>['queryClient']
  let run: <T>(fn: () => T) => T
  let setQueryData: MockInstance<QueryClient['setQueryData']>
  let invalidateQueries: MockInstance<QueryClient['invalidateQueries']>
  let cancelQueries: MockInstance<QueryClient['cancelQueries']>

  beforeEach(() => {
    vi.clearAllMocks()
    ;({ api, scope, queryClient, run } = createTestScope())
    setQueryData = vi.spyOn(queryClient, 'setQueryData')
    invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
    cancelQueries = vi.spyOn(queryClient, 'cancelQueries')
  })

  afterEach(() => {
    scope.stop()
  })

  /**
   * invalidateQueries calls whose `queryKey` filter equals the given key.
   * Matches by queryKey only — callers assert on `exact` separately where
   * relevant (item invalidations use exact: true, POST prefix invalidation
   * uses exact: false).
   */
  function itemInvalidations(itemKey: unknown[]) {
    return invalidateQueries.mock.calls.filter(
      ([filters]) => JSON.stringify((filters as { queryKey?: unknown[] })?.queryKey) === JSON.stringify(itemKey),
    )
  }

  /** cancelQueries calls whose filter is `{ queryKey: itemKey, exact: true }`. */
  function exactCancels(itemKey: unknown[]) {
    return cancelQueries.mock.calls.filter(([filters]) => {
      const f = filters as { queryKey?: unknown[]; exact?: boolean } | undefined
      return f?.exact === true && JSON.stringify(f.queryKey) === JSON.stringify(itemKey)
    })
  }

  /**
   * Returns a deferred promise so a test can hold a request open and release
   * it at a chosen point in the timeline.
   */
  function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((r) => {
      resolve = r
    })
    return { promise, resolve }
  }

  it('PUT with response body: updates cache and does NOT invalidate the exact item query', async () => {
    mockAxios.mockResolvedValueOnce({ data: { id: '123', name: 'Updated' } })
    const mutation = run(() => api.updatePet.useMutation({ petId: '123' }))

    await mutation.mutateAsync({ data: { name: 'Updated' } })

    expect(setQueryData).toHaveBeenCalledWith(['pets', '123'], { id: '123', name: 'Updated' })
    expect(itemInvalidations(['pets', '123'])).toHaveLength(0)
  })

  it('PUT with response body: list-path invalidation still runs', async () => {
    mockAxios.mockResolvedValueOnce({ data: { id: '123', name: 'Updated' } })
    const mutation = run(() => api.updatePet.useMutation({ petId: '123' }))

    await mutation.mutateAsync({ data: { name: 'Updated' } })

    // List invalidation uses a predicate filter (no queryKey)
    const predicateCalls = invalidateQueries.mock.calls.filter(
      ([filters]) => typeof (filters as { predicate?: unknown })?.predicate === 'function',
    )
    expect(predicateCalls).toHaveLength(1)
  })

  it('PATCH with response body: updates cache and does NOT invalidate the exact item query', async () => {
    mockAxios.mockResolvedValueOnce({ data: { id: '42', name: 'Patched' } })
    const mutation = run(() => api.updatePetPetId.useMutation({ pet_id: '42' }))

    await mutation.mutateAsync({ data: { name: 'Patched' } })

    expect(setQueryData).toHaveBeenCalledWith(['api', 'pet', '42'], { id: '42', name: 'Patched' })
    expect(itemInvalidations(['api', 'pet', '42'])).toHaveLength(0)
  })

  it('PATCH with dontUpdateCache: true: skips cache update and invalidates the exact item query', async () => {
    mockAxios.mockResolvedValueOnce({ data: { id: '42', name: 'Patched' } })
    const mutation = run(() => api.updatePetPetId.useMutation({ pet_id: '42' }, { dontUpdateCache: true }))

    await mutation.mutateAsync({ data: { name: 'Patched' } })

    expect(setQueryData).not.toHaveBeenCalled()
    expect(itemInvalidations(['api', 'pet', '42'])).toHaveLength(1)
    expect(itemInvalidations(['api', 'pet', '42'])[0][0]).toMatchObject({ exact: true })
  })

  it('PUT with empty response body: skips cache update and invalidates the exact item query', async () => {
    mockAxios.mockResolvedValueOnce({ data: undefined })
    const mutation = run(() => api.updatePet.useMutation({ petId: '123' }))

    await mutation.mutateAsync({ data: { name: 'Updated' } })

    expect(setQueryData).not.toHaveBeenCalled()
    expect(itemInvalidations(['pets', '123'])).toHaveLength(1)
  })

  it("PUT with '' response body (204 No Content via axios): skips cache update and invalidates", async () => {
    mockAxios.mockResolvedValueOnce({ data: '' })
    const mutation = run(() => api.updatePet.useMutation({ petId: '123' }))

    await mutation.mutateAsync({ data: { name: 'Updated' } })

    expect(setQueryData).not.toHaveBeenCalled()
    expect(itemInvalidations(['pets', '123'])).toHaveLength(1)
  })

  it('PUT with valid falsy response body (false): updates cache and does NOT invalidate', async () => {
    mockAxios.mockResolvedValueOnce({ data: false })
    const mutation = run(() => api.updatePet.useMutation({ petId: '123' }))

    await mutation.mutateAsync({ data: { name: 'Updated' } })

    expect(setQueryData).toHaveBeenCalledWith(['pets', '123'], false)
    expect(itemInvalidations(['pets', '123'])).toHaveLength(0)
  })

  it('mutate-time dontUpdateCache: true overrides hook-time default and restores invalidation', async () => {
    mockAxios.mockResolvedValueOnce({ data: { id: '123', name: 'Updated' } })
    const mutation = run(() => api.updatePet.useMutation({ petId: '123' }))

    await mutation.mutateAsync({ data: { name: 'Updated' }, dontUpdateCache: true })

    expect(setQueryData).not.toHaveBeenCalled()
    expect(itemInvalidations(['pets', '123'])).toHaveLength(1)
  })

  it('PUT with dontInvalidate: true: updates cache and performs no invalidation at all', async () => {
    mockAxios.mockResolvedValueOnce({ data: { id: '123', name: 'Updated' } })
    const mutation = run(() => api.updatePet.useMutation({ petId: '123' }, { dontInvalidate: true }))

    await mutation.mutateAsync({ data: { name: 'Updated' } })

    expect(setQueryData).toHaveBeenCalled()
    expect(invalidateQueries).not.toHaveBeenCalled()
  })

  describe('stale GET started during the mutation round trip', () => {
    /**
     * Timeline:
     *   1. mutation request is sent (pre-request cancel has already run)
     *   2. a GET on the same key starts and is held open
     *   3. mutation resolves with `fresh` and writes it to the cache
     *   4. the GET is released with the older `stale` body
     * Asserts the cache holds `fresh`, the query is idle and not invalidated,
     * and exactly one exact-key cancel ran before the write.
     */
    async function assertStaleGetDiscarded(
      method: 'put' | 'patch',
      itemKey: unknown[],
      startMutation: () => Promise<unknown>,
      startQuery: () => { data: { value: unknown } },
      stale: unknown,
      fresh: unknown,
    ) {
      const mutationRequest = deferred<{ data: unknown }>()
      const getRequest = deferred<{ data: unknown }>()
      mockAxios.mockImplementation((cfg: { method: string }) =>
        cfg.method === 'get' ? getRequest.promise : mutationRequest.promise,
      )

      const mutationPromise = startMutation()
      // Let mutationFn run past its pre-request cancelQueries and send the request.
      await vi.waitFor(() => expect(mockAxios).toHaveBeenCalledWith(expect.objectContaining({ method })))

      const query = startQuery()
      await vi.waitFor(() => expect(mockAxios).toHaveBeenCalledWith(expect.objectContaining({ method: 'get' })))
      expect(queryClient.getQueryState(itemKey)?.fetchStatus).toBe('fetching')

      mutationRequest.resolve({ data: fresh })
      await mutationPromise

      getRequest.resolve({ data: stale })
      // Flush the GET's continuation; it must be discarded, not written.
      await new Promise((r) => setTimeout(r, 0))

      expect(queryClient.getQueryData(itemKey)).toEqual(fresh)
      expect(query.data.value).toEqual(fresh)
      const state = queryClient.getQueryState(itemKey)
      expect(state?.isInvalidated).toBe(false)
      expect(state?.fetchStatus).toBe('idle')
      // Pre-request cancel (exact: false) plus the pre-write cancel (exact: true).
      expect(exactCancels(itemKey)).toHaveLength(1)
      const cancelOrder = cancelQueries.mock.invocationCallOrder.at(-1)!
      const writeOrder = setQueryData.mock.invocationCallOrder.at(-1)!
      expect(cancelOrder).toBeLessThan(writeOrder)
    }

    it('PATCH: the GET is cancelled before the write and the cache keeps the PATCH body', async () => {
      const mutation = run(() => api.updatePetPetId.useMutation({ pet_id: '42' }))
      await assertStaleGetDiscarded(
        'patch',
        ['api', 'pet', '42'],
        () => mutation.mutateAsync({ data: { name: 'Patched' } }),
        () => run(() => api.getPetPetId.useQuery({ pet_id: '42' })),
        { id: '42', name: 'Old' },
        { id: '42', name: 'Patched' },
      )
    })

    it('PUT: the GET is cancelled before the write and the cache keeps the PUT body', async () => {
      const mutation = run(() => api.updatePet.useMutation({ petId: '123' }))
      await assertStaleGetDiscarded(
        'put',
        ['pets', '123'],
        () => mutation.mutateAsync({ data: { name: 'Updated' } }),
        () => run(() => api.getPet.useQuery({ petId: '123' })),
        { id: '123', name: 'Old' },
        { id: '123', name: 'Updated' },
      )
    })

    it('the cache write happens in the same synchronous turn as the pre-write cancel (no await gap)', async () => {
      // If an `await` sat between cancelQueries and setQueryData, a GET started
      // in that microtask gap (e.g. a component mounting in a Vue flush) would
      // escape the cancel. Hold the exact-key cancel promise open and assert
      // the write has already happened while it is still pending.
      const itemKey = ['api', 'pet', '42']
      const exactCancel = deferred<void>()
      const realCancel = (filters: Parameters<QueryClient['cancelQueries']>[0]) =>
        QueryClient.prototype.cancelQueries.call(queryClient, filters)
      cancelQueries.mockImplementation((filters) => {
        const f = filters as { exact?: boolean } | undefined
        if (f?.exact === true) {
          void realCancel(filters)
          return exactCancel.promise
        }
        return realCancel(filters)
      })
      mockAxios.mockResolvedValueOnce({ data: { id: '42', name: 'Patched' } })
      const mutation = run(() => api.updatePetPetId.useMutation({ pet_id: '42' }))

      const mutationPromise = mutation.mutateAsync({ data: { name: 'Patched' } })
      await vi.waitFor(() => expect(exactCancels(itemKey)).toHaveLength(1))

      // Cancel promise is still pending here, yet the write has already run.
      expect(setQueryData).toHaveBeenCalledWith(itemKey, { id: '42', name: 'Patched' })

      exactCancel.resolve()
      await mutationPromise
    })

    it('PATCH with dontUpdateCache: true: no pre-write cancel, item invalidation still runs', async () => {
      mockAxios.mockResolvedValueOnce({ data: { id: '42', name: 'Patched' } })
      const mutation = run(() => api.updatePetPetId.useMutation({ pet_id: '42' }, { dontUpdateCache: true }))

      await mutation.mutateAsync({ data: { name: 'Patched' } })

      expect(setQueryData).not.toHaveBeenCalled()
      expect(exactCancels(['api', 'pet', '42'])).toHaveLength(0)
      // Only the pre-request cancel ran.
      expect(cancelQueries).toHaveBeenCalledTimes(1)
      expect(cancelQueries).toHaveBeenCalledWith({ queryKey: ['api', 'pet', '42'], exact: false })
      expect(itemInvalidations(['api', 'pet', '42'])).toHaveLength(1)
    })

    it('POST: no cache write and no pre-write cancel', async () => {
      mockAxios.mockResolvedValueOnce({ data: { id: 'new', name: 'Fluffy' } })
      const mutation = run(() => api.createPet.useMutation())

      await mutation.mutateAsync({ data: { name: 'Fluffy' } })

      expect(setQueryData).not.toHaveBeenCalled()
      expect(exactCancels(['pets'])).toHaveLength(0)
      expect(cancelQueries).toHaveBeenCalledTimes(1)
    })

    it('DELETE: no cache write and no pre-write cancel', async () => {
      mockAxios.mockResolvedValueOnce({ data: {} })
      const mutation = run(() => api.deletePet.useMutation({ petId: '123' }))

      await mutation.mutateAsync()

      expect(setQueryData).not.toHaveBeenCalled()
      expect(exactCancels(['pets', '123'])).toHaveLength(0)
      expect(cancelQueries).toHaveBeenCalledTimes(1)
    })
  })

  it('POST: invalidation is unchanged (prefix invalidation, no cache update)', async () => {
    mockAxios.mockResolvedValueOnce({ data: { id: 'new', name: 'Fluffy' } })
    const mutation = run(() => api.createPet.useMutation())

    await mutation.mutateAsync({ data: { name: 'Fluffy' } })

    expect(setQueryData).not.toHaveBeenCalled()
    expect(itemInvalidations(['pets'])).toHaveLength(1)
    expect(itemInvalidations(['pets'])[0][0]).toMatchObject({ exact: false })
  })

  it('DELETE: invalidation is unchanged (no item invalidation, list invalidation runs)', async () => {
    mockAxios.mockResolvedValueOnce({ data: {} })
    const mutation = run(() => api.deletePet.useMutation({ petId: '123' }))

    await mutation.mutateAsync()

    expect(setQueryData).not.toHaveBeenCalled()
    expect(itemInvalidations(['pets', '123'])).toHaveLength(0)
    const predicateCalls = invalidateQueries.mock.calls.filter(
      ([filters]) => typeof (filters as { predicate?: unknown })?.predicate === 'function',
    )
    expect(predicateCalls).toHaveLength(1)
  })
})
