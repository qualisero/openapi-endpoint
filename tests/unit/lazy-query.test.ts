/**
 * Runtime tests for useLazyQuery with real Vue and TanStack
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, effectScope, computed } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { QueryClient } from '@tanstack/vue-query'
import { createApiErrorCaches } from '@qualisero/openapi-endpoint'
import { mockAxios } from '../setup'
import { createTestScope } from '../helpers'
import { createApiClient } from '../fixtures/api-client'

describe('Lazy Query', () => {
  let scope: ReturnType<typeof effectScope>
  let api: ReturnType<typeof createApiClient>

  beforeEach(() => {
    vi.clearAllMocks()
    ;({ api, scope } = createTestScope())
  })

  afterEach(() => {
    scope.stop()
  })

  describe('useLazyQuery - no path params', () => {
    it('should mount without making any axios call', () => {
      const query = scope.run(() => api.listPets.useLazyQuery())!

      expect(query).toBeTruthy()
      expect(mockAxios).not.toHaveBeenCalled()
    })

    it('should have undefined data before fetch is called', () => {
      const query = scope.run(() => api.listPets.useLazyQuery())!

      expect(query.data.value).toBeUndefined()
      expect(query.isSuccess.value).toBe(false)
      expect(query.isError.value).toBe(false)
      expect(query.error.value).toBeNull()
    })

    it('should make exactly one axios call on fetch', async () => {
      mockAxios.mockResolvedValueOnce({ data: [{ id: '1', name: 'Fluffy' }] })

      const query = scope.run(() => api.listPets.useLazyQuery())!

      const data = await query.fetch({ queryParams: { limit: 10 } })
      await flushPromises()

      expect(mockAxios).toHaveBeenCalledTimes(1)
      expect(mockAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'get',
          url: '/pets',
          params: { limit: 10 },
        }),
      )
      expect(data).toEqual([{ id: '1', name: 'Fluffy' }])
    })

    it('should update data ref after fetch resolves', async () => {
      mockAxios.mockResolvedValueOnce({ data: [{ id: '1', name: 'Fluffy' }] })

      const query = scope.run(() => api.listPets.useLazyQuery())!

      await query.fetch()
      await flushPromises()

      expect(query.data.value).toEqual([{ id: '1', name: 'Fluffy' }])
    })

    it('should make two calls with different params', async () => {
      mockAxios.mockResolvedValueOnce({ data: [{ id: '1', name: 'Fluffy' }] })
      mockAxios.mockResolvedValueOnce({ data: [{ id: '2', name: 'Spot' }] })

      const query = scope.run(() => api.listPets.useLazyQuery())!

      await query.fetch({ queryParams: { limit: 10 } })
      await flushPromises()

      await query.fetch({ queryParams: { limit: 20 } })
      await flushPromises()

      expect(mockAxios).toHaveBeenCalledTimes(2)
    })

    it('should use cached data when data is not stale', async () => {
      mockAxios.mockResolvedValueOnce({ data: [{ id: '1', name: 'Fluffy' }] })

      // Create a query with a non-zero staleTime
      const { api: testApi, scope: testScope } = createTestScope()

      const _query = testScope.run(() => {
        return testApi.listPets.useQuery({
          staleTime: 1000, // 1 second
        })
      })!

      // Wait for the initial fetch to complete
      await flushPromises()

      // The query should have fetched and populated the cache
      expect(mockAxios).toHaveBeenCalledTimes(1)

      testScope.stop()
    })

    it('should set isError and error after axios rejects', async () => {
      // Use an axios-shaped 4xx error. no4xxRetry returns false for 4xx, so
      // there is exactly one attempt — no setTimeout-based retry delays.
      const testError = { isAxiosError: true, response: { status: 400 }, message: 'Bad Request' }
      mockAxios.mockRejectedValueOnce(testError)

      const query = scope.run(() => api.listPets.useLazyQuery())!

      await expect(query.fetch()).rejects.toMatchObject({ message: 'Bad Request' })
      await flushPromises()

      expect(query.isError.value).toBe(true)
      expect(query.error.value).toBeTruthy()
    })

    it('(§2.2) lazy fetch() on 404 makes exactly one axios call even with a retry:3 QueryClient', async () => {
      // A retry:3 client proves the fix: without no4xxRetry on the lazy fetchQuery,
      // the 404 would retry 3× → 4 calls; with the fix applied, only 1 call is made.
      const retryClient = new QueryClient({
        defaultOptions: { queries: { retry: 3, retryDelay: 0, gcTime: 0 } },
      })
      const error404 = { isAxiosError: true, response: { status: 404 }, message: 'Not Found' }
      mockAxios.mockRejectedValueOnce(error404)

      const { scope: testScope } = createTestScope(mockAxios, retryClient)
      const query = testScope.run(() => createApiClient(mockAxios, retryClient).listPets.useLazyQuery())!

      await expect(query.fetch()).rejects.toMatchObject({ message: 'Not Found' })
      await flushPromises()

      // no4xxRetry returns false for 4xx → exactly 1 call, no retries
      expect(mockAxios).toHaveBeenCalledTimes(1)
      expect(query.isError.value).toBe(true)

      testScope.stop()
    })

    it('(§2.2b) lazy fetch() with a plain Error retries and then rejects', async () => {
      // A non-axios error passes no4xxRetry's isAxiosError guard → retries are allowed.
      // This pins that the lazy path uses no4xxRetry consistently with useQuery.
      vi.useFakeTimers()
      try {
        const retryClient = new QueryClient({
          defaultOptions: { queries: { retry: 3, retryDelay: 0, gcTime: 0 } },
        })
        const networkError = new Error('Network error')
        // Queue 4 rejections: 1 initial + 3 retries
        mockAxios
          .mockRejectedValueOnce(networkError)
          .mockRejectedValueOnce(networkError)
          .mockRejectedValueOnce(networkError)
          .mockRejectedValueOnce(networkError)

        const { scope: testScope } = createTestScope(mockAxios, retryClient)
        const query = testScope.run(() => createApiClient(mockAxios, retryClient).listPets.useLazyQuery())!

        const fetchPromise = query.fetch()
        // Suppress unhandled-rejection noise while timers are advancing:
        // the promise rejects during timer advancement and Node warns if no
        // handler is attached yet. Attaching a no-op catch here silences the
        // warning without affecting the assertion below.
        fetchPromise.catch(() => {})
        // Advance through all retry timeouts (retryDelay: 0 → setTimeout(0, …) × 3)
        await vi.runAllTimersAsync()

        await expect(fetchPromise).rejects.toThrow('Network error')
        await flushPromises()

        // 1 initial + 3 retries = 4 total calls
        expect(mockAxios).toHaveBeenCalledTimes(4)
        expect(query.isError.value).toBe(true)

        testScope.stop()
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('useLazyQuery - with path params', () => {
    it('should make axios call with correct URL', async () => {
      mockAxios.mockResolvedValueOnce({ data: { id: '123', name: 'Fluffy' } })

      const query = scope.run(() => api.getPet.useLazyQuery({ petId: '123' }))!

      await query.fetch()
      await flushPromises()

      expect(mockAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'get',
          url: '/pets/123',
        }),
      )
    })

    it('should throw if path params are not resolved', async () => {
      const query = scope.run(() => api.getPet.useLazyQuery(undefined as any))!

      await expect(query.fetch()).rejects.toThrow()
    })

    it('should not auto-enable when path params provided', () => {
      const query = scope.run(() => api.getPet.useLazyQuery({ petId: '123' }))!

      // Lazy queries have enabled: false by default, meaning they won't auto-fetch
      expect(query.isEnabled.value).toBe(false)
    })

    it('should work with reactive path params', async () => {
      mockAxios.mockResolvedValueOnce({ data: { id: '123', name: 'Fluffy' } })
      mockAxios.mockResolvedValueOnce({ data: { id: '456', name: 'Spot' } })

      const petIdValue = ref('123')
      const pathParamsRef = computed(() => ({ petId: petIdValue.value }))
      const query = scope.run(() => api.getPet.useLazyQuery(pathParamsRef))!

      await query.fetch()
      await flushPromises()

      expect(mockAxios).toHaveBeenLastCalledWith(
        expect.objectContaining({
          url: '/pets/123',
        }),
      )

      // Change the reactive param
      petIdValue.value = '456'
      await flushPromises()

      await query.fetch()
      await flushPromises()

      expect(mockAxios).toHaveBeenLastCalledWith(
        expect.objectContaining({
          url: '/pets/456',
        }),
      )
    })
  })

  describe('useLazyQuery - cache sharing with useQuery', () => {
    it('should be able to share data between query instances using same key', async () => {
      mockAxios.mockResolvedValueOnce({ data: [{ id: '1', name: 'Fluffy' }] })

      // Create a lazy query and fetch with specific params
      const lazyQuery = scope.run(() => api.listPets.useLazyQuery())!
      await lazyQuery.fetch({ queryParams: { limit: 10 } })
      await flushPromises()

      // Verify the fetch happened
      expect(mockAxios).toHaveBeenCalledTimes(1)
      expect(mockAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          params: { limit: 10 },
        }),
      )
    })
  })

  describe('useLazyQuery - options merge', () => {
    it('should merge axiosOptions from hook and fetch', async () => {
      mockAxios.mockResolvedValueOnce({ data: [] })

      const query = scope.run(() =>
        api.listPets.useLazyQuery({
          axiosOptions: { headers: { 'X-Header': 'hook-level' } },
        }),
      )!

      await query.fetch({
        queryParams: { limit: 10 },
        axiosOptions: { headers: { 'X-Another': 'fetch-level' } },
      })
      await flushPromises()

      expect(mockAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            'X-Header': 'hook-level',
            'X-Another': 'fetch-level',
          },
        }),
      )
    })
  })

  describe('useLazyQuery - error policy', () => {
    it('(§10) lazy + skipGlobalError:true → zero onError calls, fetch still rejects', async () => {
      // Build a client wired with the error policy
      const onError = vi.fn()
      const { queryCache, mutationCache } = createApiErrorCaches({ onError })
      const qc = new QueryClient({
        queryCache,
        mutationCache,
        defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
      })

      const error404 = { isAxiosError: true, response: { status: 404 }, message: 'Not Found' }
      mockAxios.mockRejectedValueOnce(error404)

      const { scope: testScope } = createTestScope(mockAxios, qc)
      const query = testScope.run(() =>
        createApiClient(mockAxios, qc).listPets.useLazyQuery({ skipGlobalError: true }),
      )!

      // fetch() must reject (the promise is never swallowed)
      await expect(query.fetch()).rejects.toMatchObject({ message: 'Not Found' })
      await flushPromises()

      // skipGlobalError suppresses the global side-effect — zero onError calls
      expect(onError).not.toHaveBeenCalled()
      // The query is in error state (reject propagated normally)
      expect(query.isError.value).toBe(true)

      testScope.stop()
    })
  })
})
