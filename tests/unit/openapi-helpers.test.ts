import { describe, it, expect } from 'vitest'
import { defaultQueryClient } from '@/openapi-helpers'

/**
 * Tests for openapi-helpers module.
 * The module now only provides `defaultQueryClient`.
 * Helper logic (getListOperationPath, etc.) has been moved to the CLI code generator.
 */
describe('openapi-helpers', () => {
  describe('defaultQueryClient', () => {
    it('should export a default query client', () => {
      expect(defaultQueryClient).toBeDefined()
    })

    it('should have required QueryClientLike methods', () => {
      expect(typeof defaultQueryClient.cancelQueries).toBe('function')
      expect(typeof defaultQueryClient.setQueryData).toBe('function')
      expect(typeof defaultQueryClient.invalidateQueries).toBe('function')
    })
  })
})
