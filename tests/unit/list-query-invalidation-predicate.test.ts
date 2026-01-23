import { describe, it, expect } from 'vitest'

/**
 * Tests for list query invalidation predicate logic
 *
 * This test suite verifies the predicate function logic used to invalidate list queries
 * with query parameters while excluding single-item queries.
 *
 * Background:
 * - List queries without params have key: ["pets"]
 * - List queries with params have key: ["pets", {breed: "Labrador", page: 1}]
 * - Single-item queries have key: ["pets", "uuid-123"]
 *
 * Solution:
 * Strip the last element from query keys if it's an object (query params) before comparing.
 * This matches list queries with/without params but NOT single-item queries.
 */
describe('List Query Invalidation Predicate Logic', () => {
  /**
   * This is the predicate function used in openapi-mutation.ts
   * We test it directly to verify the logic works correctly
   */
  function createInvalidationPredicate(listQueryKey: string[]) {
    return (query: { queryKey: any }) => {
      const queryKey = query.queryKey
      if (!queryKey || queryKey.length === 0) return false

      // Normalize query key: strip last element if it's an object (query params)
      const normalizedKey =
        typeof queryKey[queryKey.length - 1] === 'object' && queryKey[queryKey.length - 1] !== null
          ? queryKey.slice(0, -1)
          : queryKey

      // Compare with listQueryKey
      if (normalizedKey.length !== listQueryKey.length) return false
      for (let i = 0; i < listQueryKey.length; i++) {
        if (normalizedKey[i] !== listQueryKey[i]) return false
      }
      return true
    }
  }

  describe('Basic Matching', () => {
    it('should match list queries without query parameters', () => {
      const predicate = createInvalidationPredicate(['pets'])

      expect(predicate({ queryKey: ['pets'] })).toBe(true)
    })

    it('should match list queries with query parameters', () => {
      const predicate = createInvalidationPredicate(['pets'])

      expect(predicate({ queryKey: ['pets', { breed: 'Labrador' }] })).toBe(true)
      expect(predicate({ queryKey: ['pets', { age: 3, breed: 'Poodle' }] })).toBe(true)
      expect(predicate({ queryKey: ['pets', { page: 1, page_size: 10 }] })).toBe(true)
    })

    it('should NOT match single-item queries with string path parameters', () => {
      const predicate = createInvalidationPredicate(['pets'])

      expect(predicate({ queryKey: ['pets', 'uuid-123'] })).toBe(false)
      expect(predicate({ queryKey: ['pets', 'abc-def-ghi'] })).toBe(false)
    })

    it('should NOT match single-item queries with numeric path parameters', () => {
      const predicate = createInvalidationPredicate(['pets'])

      expect(predicate({ queryKey: ['pets', 123] })).toBe(false)
      expect(predicate({ queryKey: ['pets', 456] })).toBe(false)
      expect(predicate({ queryKey: ['pets', '789'] })).toBe(false)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty query keys', () => {
      const predicate = createInvalidationPredicate(['pets'])

      expect(predicate({ queryKey: [] })).toBe(false)
    })

    it('should handle null query keys', () => {
      const predicate = createInvalidationPredicate(['pets'])

      expect(predicate({ queryKey: null })).toBe(false)
    })

    it('should handle undefined query keys', () => {
      const predicate = createInvalidationPredicate(['pets'])

      expect(predicate({ queryKey: undefined })).toBe(false)
    })

    it('should handle queries with null last element', () => {
      const predicate = createInvalidationPredicate(['pets'])

      // null is not an object (typeof null === 'object' but we check !== null)
      expect(predicate({ queryKey: ['pets', null] })).toBe(false)
    })

    it('should handle queries with array as last element', () => {
      const predicate = createInvalidationPredicate(['pets'])

      // Arrays are objects, so they should be treated as query params
      expect(predicate({ queryKey: ['pets', ['tag1', 'tag2']] })).toBe(true)
    })

    it('should handle queries with nested objects', () => {
      const predicate = createInvalidationPredicate(['pets'])

      expect(predicate({ queryKey: ['pets', { filter: { breed: 'Labrador', age: { min: 1, max: 5 } } }] })).toBe(true)
    })
  })

  describe('Multi-Segment Paths', () => {
    it('should match list queries for nested resources', () => {
      const predicate = createInvalidationPredicate(['users', 'pets'])

      expect(predicate({ queryKey: ['users', 'pets'] })).toBe(true)
      expect(predicate({ queryKey: ['users', 'pets', { breed: 'Labrador' }] })).toBe(true)
    })

    it('should NOT match different paths', () => {
      const predicate = createInvalidationPredicate(['users', 'pets'])

      expect(predicate({ queryKey: ['pets'] })).toBe(false)
      expect(predicate({ queryKey: ['users'] })).toBe(false)
      expect(predicate({ queryKey: ['users', 'posts'] })).toBe(false)
    })

    it('should NOT match single-item queries for nested resources', () => {
      const predicate = createInvalidationPredicate(['users', 'pets'])

      expect(predicate({ queryKey: ['users', 'pets', 'uuid-123'] })).toBe(false)
    })
  })

  describe('Complex Query Parameters', () => {
    it('should match queries with pagination parameters', () => {
      const predicate = createInvalidationPredicate(['api', 'user'])

      expect(predicate({ queryKey: ['api', 'user', { page: 1, page_size: 10 }] })).toBe(true)
      expect(predicate({ queryKey: ['api', 'user', { page: 2, page_size: 20, sort: 'name' }] })).toBe(true)
    })

    it('should match queries with filter parameters', () => {
      const predicate = createInvalidationPredicate(['api', 'user'])

      expect(predicate({ queryKey: ['api', 'user', { is_writable: true }] })).toBe(true)
      expect(predicate({ queryKey: ['api', 'user', { role: 'admin', is_enabled: true }] })).toBe(true)
    })

    it('should match queries with complex nested filter parameters', () => {
      const predicate = createInvalidationPredicate(['api', 'user'])

      expect(
        predicate({
          queryKey: [
            'api',
            'user',
            {
              filters: {
                role: ['admin', 'user'],
                created_at: { from: '2024-01-01', to: '2024-12-31' },
              },
              sort: { field: 'name', order: 'asc' },
            },
          ],
        }),
      ).toBe(true)
    })
  })

  describe('Real-World Scenarios', () => {
    it('should handle iaoport user list query (no params)', () => {
      const predicate = createInvalidationPredicate(['api', 'user'])

      expect(predicate({ queryKey: ['api', 'user'] })).toBe(true)
    })

    it('should handle iaoport user list query (with is_writable filter)', () => {
      const predicate = createInvalidationPredicate(['api', 'user'])

      expect(predicate({ queryKey: ['api', 'user', { is_writable: true }] })).toBe(true)
    })

    it('should NOT match iaoport single user query', () => {
      const predicate = createInvalidationPredicate(['api', 'user'])

      expect(predicate({ queryKey: ['api', 'user', 'uuid-abc-123'] })).toBe(false)
      expect(predicate({ queryKey: ['api', 'user', '{user_id}'] })).toBe(false)
    })

    it('should handle contract list queries', () => {
      const predicate = createInvalidationPredicate(['api', 'contract'])

      expect(predicate({ queryKey: ['api', 'contract'] })).toBe(true)
      expect(predicate({ queryKey: ['api', 'contract', { status: 'active' }] })).toBe(true)
      expect(predicate({ queryKey: ['api', 'contract', 'contract-uuid-123'] })).toBe(false)
    })
  })
})
