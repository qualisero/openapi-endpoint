/**
 * Tests for responseHeaders feature on useQuery and useLazyQuery
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { effectScope } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockAxios } from '../setup'
import { createTestScope } from '../helpers'
import { createApiClient } from '../fixtures/api-client'

describe('Response Headers', () => {
  let scope: ReturnType<typeof effectScope>
  let api: ReturnType<typeof createApiClient>

  beforeEach(() => {
    vi.clearAllMocks()
    ;({ api, scope } = createTestScope())
  })

  afterEach(() => {
    scope.stop()
  })

  describe('useQuery - responseHeaders', () => {
    it('should have empty headers initially', () => {
      mockAxios.mockResolvedValueOnce({ data: [] })
      const query = scope.run(() => api.listPets.useQuery({ enabled: false }))!
      expect(query.responseHeaders.value).toEqual({})
    })

    it('should populate responseHeaders after successful fetch', async () => {
      mockAxios.mockResolvedValueOnce({
        data: [{ id: '1', name: 'Fluffy' }],
        headers: { 'x-pagination': '{"total":100}', 'x-request-id': 'abc123' },
      })

      const query = scope.run(() => api.listPets.useQuery())!
      await flushPromises()

      expect(query.responseHeaders.value).toEqual({
        'x-pagination': '{"total":100}',
        'x-request-id': 'abc123',
      })
    })

    it('should update responseHeaders on refetch', async () => {
      mockAxios.mockResolvedValueOnce({
        data: [{ id: '1', name: 'Fluffy' }],
        headers: { 'x-request-id': 'first-request' },
      })

      const query = scope.run(() => api.listPets.useQuery())!
      await flushPromises()

      expect(query.responseHeaders.value['x-request-id']).toBe('first-request')

      mockAxios.mockResolvedValueOnce({
        data: [{ id: '2', name: 'Spot' }],
        headers: { 'x-request-id': 'second-request' },
      })

      await query.refetch()
      await flushPromises()

      expect(query.responseHeaders.value['x-request-id']).toBe('second-request')
    })

    it('should have responseHeaders as a ShallowRef', () => {
      mockAxios.mockResolvedValueOnce({ data: [] })
      const query = scope.run(() => api.listPets.useQuery({ enabled: false }))!
      // ShallowRef has a .value property and is reactive
      expect(query.responseHeaders).toHaveProperty('value')
      expect(typeof query.responseHeaders.value).toBe('object')
    })

    it('should default to empty object when response has no headers', async () => {
      mockAxios.mockResolvedValueOnce({ data: [{ id: '1', name: 'Fluffy' }] })

      const query = scope.run(() => api.listPets.useQuery())!
      await flushPromises()

      expect(query.responseHeaders.value).toEqual({})
    })
  })

  describe('useLazyQuery - responseHeaders', () => {
    it('should have empty headers before fetch', () => {
      const query = scope.run(() => api.listPets.useLazyQuery())!
      expect(query.responseHeaders.value).toEqual({})
    })

    it('should populate responseHeaders after lazy fetch', async () => {
      mockAxios.mockResolvedValueOnce({
        data: [{ id: '1', name: 'Fluffy' }],
        headers: { 'x-pagination': '{"total":50}', 'x-request-id': 'lazy-abc' },
      })

      const query = scope.run(() => api.listPets.useLazyQuery())!

      await query.fetch()
      await flushPromises()

      expect(query.responseHeaders.value).toEqual({
        'x-pagination': '{"total":50}',
        'x-request-id': 'lazy-abc',
      })
    })

    it('should update responseHeaders on repeated lazy fetch', async () => {
      mockAxios.mockResolvedValueOnce({
        data: [{ id: '1', name: 'Fluffy' }],
        headers: { 'x-request-id': 'lazy-first' },
      })
      mockAxios.mockResolvedValueOnce({
        data: [{ id: '2', name: 'Spot' }],
        headers: { 'x-request-id': 'lazy-second' },
      })

      const query = scope.run(() => api.listPets.useLazyQuery())!

      await query.fetch({ queryParams: { limit: 10 } })
      await flushPromises()
      expect(query.responseHeaders.value['x-request-id']).toBe('lazy-first')

      await query.fetch({ queryParams: { limit: 20 } })
      await flushPromises()
      expect(query.responseHeaders.value['x-request-id']).toBe('lazy-second')
    })

    it('should not have headers if fetch has not been called', () => {
      const query = scope.run(() => api.listPets.useLazyQuery())!

      expect(mockAxios).not.toHaveBeenCalled()
      expect(query.responseHeaders.value).toEqual({})
    })
  })
})
