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
 */
import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest'
import type { QueryClient } from '@tanstack/vue-query'
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

  beforeEach(() => {
    vi.clearAllMocks()
    ;({ api, scope, queryClient, run } = createTestScope())
    setQueryData = vi.spyOn(queryClient, 'setQueryData')
    invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
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
