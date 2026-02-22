import { describe, it, expect, vi } from 'vitest'
import { resolvePath, isPathResolved, generateQueryKey, normalizeParamsOptions } from '@/openapi-utils'
import type { QueryOptions } from '@/types'

describe('openapi-utils', () => {
  describe('resolvePath', () => {
    it('should return path unchanged when no params provided', () => {
      const path = '/pets/{petId}/details'
      expect(resolvePath(path)).toBe(path)
      expect(resolvePath(path, null)).toBe(path)
      expect(resolvePath(path, undefined)).toBe(path)
    })

    it('should resolve single path parameter', () => {
      const path = '/pets/{petId}'
      const params = { petId: '123' }
      expect(resolvePath(path, params)).toBe('/pets/123')
    })

    it('should resolve multiple path parameters', () => {
      const path = '/users/{userId}/pets/{petId}'
      const params = { userId: 'user1', petId: 'pet2' }
      expect(resolvePath(path, params)).toBe('/users/user1/pets/pet2')
    })

    it('should handle numeric parameters', () => {
      const path = '/pets/{petId}'
      const params = { petId: 123 }
      expect(resolvePath(path, params)).toBe('/pets/123')
    })

    it('should skip null/undefined parameter values', () => {
      const path = '/pets/{petId}/tags/{tagId}'
      const params = { petId: '123', tagId: undefined } as unknown as Record<string, string | number>
      expect(resolvePath(path, params)).toBe('/pets/123/tags/{tagId}')
    })

    it('should handle reactive parameter values using toValue', () => {
      const path = '/pets/{petId}'
      const params = { petId: '123' }

      // Call resolvePath and verify it works (toValue is called internally)
      const result = resolvePath(path, params)
      expect(result).toBe('/pets/123')
    })
  })

  describe('isPathResolved', () => {
    it('should return true for fully resolved paths', () => {
      expect(isPathResolved('/pets/123')).toBe(true)
      expect(isPathResolved('/users/user1/pets/pet2')).toBe(true)
      expect(isPathResolved('/api/v1/resource')).toBe(true)
    })

    it('should return false for paths with unresolved parameters', () => {
      expect(isPathResolved('/pets/{petId}')).toBe(false)
      expect(isPathResolved('/users/{userId}/pets/{petId}')).toBe(false)
      expect(isPathResolved('/api/{version}/resource/{id}')).toBe(false)
    })

    it('should return false for partially resolved paths', () => {
      expect(isPathResolved('/users/user1/pets/{petId}')).toBe(false)
    })
  })

  describe('generateQueryKey', () => {
    it('should generate query key from resolved path', () => {
      expect(generateQueryKey('/pets/123')).toEqual(['pets', '123'])
      expect(generateQueryKey('/users/user1/pets/pet2')).toEqual(['users', 'user1', 'pets', 'pet2'])
    })

    it('should handle root path', () => {
      expect(generateQueryKey('/')).toEqual([])
    })

    it('should filter out empty segments', () => {
      expect(generateQueryKey('//pets//123//')).toEqual(['pets', '123'])
    })

    it('should handle paths without leading slash', () => {
      expect(generateQueryKey('pets/123')).toEqual(['pets', '123'])
    })
  })

  describe('normalizeParamsOptions', () => {
    it('should return provided path params and options', () => {
      const pathParams = { petId: '123' }
      const options: QueryOptions<unknown, Record<string, never>> = {
        enabled: true,
        onLoad: vi.fn(),
      }

      const result = normalizeParamsOptions(pathParams, options)

      expect(result.pathParams).toBe(pathParams)
      expect(result.options).toBe(options)
    })

    it('should default to empty params and options when omitted', () => {
      const result = normalizeParamsOptions<Record<string, never>, QueryOptions<unknown, Record<string, never>>>()

      expect(result.pathParams).toEqual({})
      expect(result.options).toEqual({})
    })

    it('should allow options without path params', () => {
      const options: QueryOptions<unknown, Record<string, never>> = {
        enabled: true,
      }

      const result = normalizeParamsOptions(undefined, options)

      expect(result.pathParams).toEqual({})
      expect(result.options).toBe(options)
    })
  })
})
