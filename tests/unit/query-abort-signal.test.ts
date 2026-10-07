/**
 * Tests for AbortSignal forwarding from TanStack Query to axios.
 *
 * The query function built by `buildQueryFn` receives TanStack's
 * `QueryFunctionContext.signal` and forwards it to axios, so a cancelled
 * query (cancelQueries, observer unmount) aborts the network request instead
 * of only being discarded client-side. A caller-supplied `axiosOptions.signal`
 * keeps priority over TanStack's signal.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { effectScope } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockAxios } from '../setup'
import { createTestScope } from '../helpers'
import { createApiClient } from '../fixtures/api-client'

type AxiosCall = { method: string; signal?: AbortSignal }

describe('query AbortSignal forwarding', () => {
  let api: ReturnType<typeof createApiClient>
  let scope: ReturnType<typeof effectScope>
  let queryClient: ReturnType<typeof createTestScope>['queryClient']
  let run: <T>(fn: () => T) => T

  beforeEach(() => {
    vi.clearAllMocks()
    ;({ api, scope, queryClient, run } = createTestScope())
  })

  afterEach(() => {
    scope.stop()
  })

  function lastGetCall(): AxiosCall {
    const calls = mockAxios.mock.calls as unknown as [AxiosCall][]
    const getCalls = calls.filter(([cfg]) => cfg.method === 'get')
    expect(getCalls.length).toBeGreaterThan(0)
    return getCalls[getCalls.length - 1][0]
  }

  describe('useQuery', () => {
    it('forwards the TanStack signal to axios', async () => {
      mockAxios.mockResolvedValueOnce({ data: { id: '1' } })

      run(() => api.getPet.useQuery({ petId: '1' }))
      await flushPromises()

      const { signal } = lastGetCall()
      expect(signal).toBeInstanceOf(AbortSignal)
      expect(signal?.aborted).toBe(false)
    })

    it('an explicit axiosOptions.signal wins over the TanStack signal', async () => {
      mockAxios.mockResolvedValueOnce({ data: { id: '1' } })
      const controller = new AbortController()

      run(() => api.getPet.useQuery({ petId: '1' }, { axiosOptions: { signal: controller.signal } }))
      await flushPromises()

      expect(lastGetCall().signal).toBe(controller.signal)
    })

    it('cancelQueries aborts the forwarded signal while the request is in flight', async () => {
      let release!: (value: { data: unknown }) => void
      mockAxios.mockImplementationOnce(
        () =>
          new Promise<{ data: unknown }>((r) => {
            release = r
          }),
      )

      run(() => api.getPet.useQuery({ petId: '1' }))
      await vi.waitFor(() => expect(mockAxios).toHaveBeenCalledTimes(1))
      const { signal } = lastGetCall()
      expect(signal?.aborted).toBe(false)

      await queryClient.cancelQueries({ queryKey: ['pets', '1'], exact: true })

      expect(signal?.aborted).toBe(true)
      release({ data: { id: '1' } })
    })
  })

  describe('useLazyQuery.fetch', () => {
    it('forwards the TanStack signal to axios', async () => {
      mockAxios.mockResolvedValueOnce({ data: [] })

      const lazy = run(() => api.listPets.useLazyQuery())
      await lazy.fetch()

      const { signal } = lastGetCall()
      expect(signal).toBeInstanceOf(AbortSignal)
    })

    it('a call-time axiosOptions.signal wins over hook-time and TanStack signals', async () => {
      mockAxios.mockResolvedValueOnce({ data: [] })
      const hookController = new AbortController()
      const callController = new AbortController()

      const lazy = run(() => api.listPets.useLazyQuery({ axiosOptions: { signal: hookController.signal } }))
      await lazy.fetch({ axiosOptions: { signal: callController.signal } })

      expect(lastGetCall().signal).toBe(callController.signal)
    })
  })

  describe('abort propagation', () => {
    it('an aborted signal rejects the query (axios abort error surfaces as the query error)', async () => {
      // Simulate axios honouring the signal: reject as soon as it is aborted.
      mockAxios.mockImplementationOnce(
        ({ signal }: { signal?: AbortSignal }) =>
          new Promise((_, reject) => {
            signal?.addEventListener('abort', () => reject(new Error('canceled')))
          }),
      )

      const lazy = run(() => api.listPets.useLazyQuery())
      const pending = lazy.fetch()
      await vi.waitFor(() => expect(mockAxios).toHaveBeenCalledTimes(1))

      const { signal } = lastGetCall()
      await queryClient.cancelQueries({ queryKey: ['pets'], exact: true })

      expect(signal?.aborted).toBe(true)
      await expect(pending).rejects.toBeDefined()
    })
  })
})
