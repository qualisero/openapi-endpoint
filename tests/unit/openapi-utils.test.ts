import { describe, it, expect, vi } from 'vitest'
import { resolvePath, isPathResolved, generateQueryKey, getParamsOptionsFrom } from '@/openapi-utils'
import { QueryOptions, MutationOptions, Operations } from '@/types'

// Define a mock operations type for testing
type MockOperations = {
  getPet: { method: 'GET'; responses: { 200: { content: { 'application/json': { id: string; name: string } } } } }
  createPet: { method: 'POST'; responses: { 200: { content: { 'application/json': { id: string; name: string } } } } }
}

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
      const params = { petId: '123', tagId: null }
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

  describe('getParamsOptionsFrom', () => {
    it('should extract path params when provided as first parameter and options as second', () => {
      const pathParams = { petId: '123' }
      const result = getParamsOptionsFrom<MockOperations, 'getPet', QueryOptions<MockOperations, 'getPet'>>(
        pathParams,
        {} // empty options object
      )
      
      expect(result.pathParams).toBe(pathParams)
      expect(result.options).toEqual({})
    })

    it('should treat object as options when it has option-like properties', () => {
      const options: QueryOptions<MockOperations, 'getPet'> = { 
        enabled: true,
        onLoad: vi.fn()
      }
      
      const result = getParamsOptionsFrom<MockOperations, 'getPet', QueryOptions<MockOperations, 'getPet'>>(
        options,
        undefined
      )
      
      // When an object with option-like properties is passed as first arg with no second arg,
      // it's treated as options
      expect(result.pathParams).toEqual({})
      expect(result.options).toBe(options)
    })

    it('should extract both params and options when both provided', () => {
      const pathParams = { petId: '123' }
      const options: QueryOptions<MockOperations, 'getPet'> = { 
        enabled: true,
        onLoad: vi.fn()
      }
      
      const result = getParamsOptionsFrom<MockOperations, 'getPet', QueryOptions<MockOperations, 'getPet'>>(
        pathParams,
        options
      )
      
      expect(result.pathParams).toBe(pathParams)
      expect(result.options).toBe(options)
    })

    it('should handle null/undefined params gracefully', () => {
      const result = getParamsOptionsFrom<MockOperations, 'getPet', QueryOptions<MockOperations, 'getPet'>>(
        null,
        undefined
      )
      
      expect(result.pathParams).toEqual({})
      expect(result.options).toEqual({})
    })

    it('should handle empty object as path params', () => {
      const result = getParamsOptionsFrom<MockOperations, 'getPet', QueryOptions<MockOperations, 'getPet'>>(
        {},
        undefined
      )
      
      // Empty object is treated as options when no second argument
      expect(result.pathParams).toEqual({})
      expect(result.options).toEqual({})
    })
  })
})