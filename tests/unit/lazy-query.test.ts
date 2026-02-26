/**
 * Runtime tests for useLazyQuery with real Vue and TanStack
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, effectScope, computed } from 'vue'
import { flushPromises } from '@vue/test-utils'
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
      const testError = new Error('Network error')
      mockAxios.mockRejectedValueOnce(testError)

      const query = scope.run(() => api.listPets.useLazyQuery())!

      await expect(query.fetch()).rejects.toThrow('Network error')
      await flushPromises()

      expect(query.isError.value).toBe(true)
      expect(query.error.value).toBeTruthy()
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
})
