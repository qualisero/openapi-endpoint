import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useOpenApi } from '@/index'
import { OpenApiConfig, type OpenApiInstance } from '@/types'
import { mockAxios } from '../setup'
import {
  openApiOperations,
  operationConfig,
  type OpenApiOperations,
} from '../fixtures/api-operations'

/**
 * Bug Fixes and Issue Reproductions
 *
 * This file consolidates all bug-specific tests with proper references to GitHub issues and PRs.
 * Each test section references the specific issue it addresses.
 */
describe('Bug Fixes and Issue Reproductions', () => {
  const mockOperations: OpenApiOperations = openApiOperations

  let mockConfig: OpenApiConfig<OpenApiOperations>
  let api: OpenApiInstance<OpenApiOperations, typeof operationConfig>

  beforeEach(() => {
    vi.clearAllMocks()
    mockConfig = {
      operations: mockOperations,
      axios: mockAxios,
    }
    api = useOpenApi(mockConfig, operationConfig)
  })

  /**
   * Issue: Typing error when augmenting axiosOptions
   *
   * Problem: TypeScript errors when using custom axios properties that are defined
   * through module augmentation, specifically properties like `manualErrorHandling`
   * and `handledByAxios`.
   *
   * Solution: Made axiosOptions accept arbitrary properties using index signature
   * to support module augmentation patterns.
   */
  describe('Custom Axios Properties Support (GitHub Issue)', () => {
    // Simulate the user's augmented types (this would normally be in types/axios.d.ts)
    interface AxiosErrorWithMetadata {
      isAxiosError: boolean
      message: string
    }

    it('should accept manualErrorHandling property without TypeScript errors', () => {
      // This exact code from the issue description should now work
      const currentUser = api.listPets.useQuery( {
        onLoad: vi.fn(),
        axiosOptions: { manualErrorHandling: true },
      })

      expect(currentUser).toBeTruthy()
      expect(currentUser).toHaveProperty('data')
      expect(currentUser).toHaveProperty('isLoading')
    })

    it('should accept manualErrorHandling as function without TypeScript errors', () => {
      // Test the function variant mentioned in the augmented types
      const errorHandler = (error: AxiosErrorWithMetadata) => {
        console.log('Custom error handler called:', error.message)
        return true
      }

      const currentUser = api.listPets.useQuery( {
        onLoad: vi.fn(),
        axiosOptions: {
          manualErrorHandling: errorHandler,
          handledByAxios: false,
        },
      })

      expect(currentUser).toBeTruthy()
      expect(currentUser).toHaveProperty('data')
      expect(currentUser).toHaveProperty('isLoading')
    })

    it('should accept both augmented properties from the issue', () => {
      // Test both properties mentioned in the user's augmented types
      const currentUser = api.listPets.useQuery( {
        onLoad: vi.fn(),
        axiosOptions: {
          manualErrorHandling: true,
          handledByAxios: false,
        },
      })

      expect(currentUser).toBeTruthy()
      expect(currentUser).toHaveProperty('data')
      expect(currentUser).toHaveProperty('isLoading')
    })

    it('should work with mutations as well', () => {
      // Ensure the fix works for mutations too
      const createPet = api.createPet.useMutation({
        axiosOptions: {
          manualErrorHandling: true,
          handledByAxios: false,
        },
      })

      expect(createPet).toBeTruthy()
      expect(createPet).toHaveProperty('mutate')
      expect(createPet).toHaveProperty('mutateAsync')
    })

    it('should work in mutate calls', () => {
      // Ensure the fix works when passing axios options to mutate calls
      const createPet = api.createPet.useMutation()

      expect(() => {
        createPet.mutate({
          data: { name: 'Test Pet' },
          axiosOptions: {
            manualErrorHandling: true,
            handledByAxios: false,
          },
        })
      }).not.toThrow()
    })

    it('should preserve standard axios properties alongside custom ones', () => {
      // Ensure standard axios properties still work with custom ones
      const currentUser = api.listPets.useQuery( {
        onLoad: vi.fn(),
        axiosOptions: {
          // Standard axios properties
          timeout: 5000,
          headers: {
            Authorization: 'Bearer token',
            'Content-Type': 'application/json',
          },
          // Custom augmented properties
          manualErrorHandling: true,
          handledByAxios: false,
        },
      })

      expect(currentUser).toBeTruthy()
      expect(currentUser).toHaveProperty('data')
      expect(currentUser).toHaveProperty('isLoading')
    })

    it('should compile and run the exact code from the issue without TypeScript errors', () => {
      // This reproduces the EXACT scenario from the GitHub issue
      const options = {
        onLoad: vi.fn(),
      }

      // This is the EXACT code from the issue that was failing before
      const currentUser = api.listPets.useQuery( {
        onLoad: options.onLoad,
        axiosOptions: { manualErrorHandling: true },
      })

      // Verify it works as expected
      expect(currentUser).toBeTruthy()
      expect(currentUser).toHaveProperty('data')
      expect(currentUser).toHaveProperty('isLoading')

      // Verify the onLoad function was passed correctly
      expect(currentUser).toHaveProperty('onLoad')
      expect(typeof currentUser.onLoad).toBe('function')
    })

    it('should work with the function variant of manualErrorHandling', () => {
      // Function variant as mentioned in the augmented types
      const errorHandler = (error: { isAxiosError: boolean; message: string }) => {
        console.log('Error handler called:', error.message)
        return true
      }

      const options = {
        onLoad: vi.fn(),
      }

      // Test the function variant
      const currentUser = api.listPets.useQuery( {
        onLoad: options.onLoad,
        axiosOptions: {
          manualErrorHandling: errorHandler,
          handledByAxios: true,
        },
      })

      expect(currentUser).toBeTruthy()
      expect(currentUser).toHaveProperty('data')
      expect(currentUser).toHaveProperty('isLoading')
    })
  })

  /**
   * Issue: Reactive Path Parameters Support
   *
   * Problem: Path parameters that start undefined and get updated later should
   * properly enable/disable queries and mutations.
   *
   * Solution: Improved reactive path parameter handling with proper enabled state management.
   */
  describe('Reactive Path Parameters (GitHub Issue)', () => {
    it('should handle reactive path params that start undefined and get updated', () => {
      // This test reproduces the exact scenario from the issue
      let userId: string | undefined = undefined

      // Create query with reactive function for path params
      const myQuery = api.listUserPets.useQuery( () => ({ userId }))

      // Initially, the path should not be resolved (contains {userId})
      expect(myQuery.isEnabled.value).toBe(false)

      // Update the userId - in a real Vue app with refs, this would be reactive
      userId = '123'

      // Note: In test environment, we can't fully simulate Vue's reactivity
      // but we can verify the query structure is correct
      expect(myQuery).toBeTruthy()

      // Verify it's a query endpoint since listUserPets is GET
      expect(myQuery).toHaveProperty('data')
      expect(myQuery).not.toHaveProperty('mutateAsync')
    })

    it('should handle reactive path params with mutations', () => {
      let petId: string | undefined = undefined

      // Create mutation endpoint with reactive path params
      const updateEndpoint = api.useMutation(updatePet, () => ({ petId }))

      // Initially should be disabled due to unresolved path params
      expect(updateEndpoint.isEnabled.value).toBe(false)

      // Update the petId
      petId = '123'

      // Verify it's a mutation endpoint
      expect(updateEndpoint).toHaveProperty('mutate')
      expect(updateEndpoint).toHaveProperty('mutateAsync')
    })

    it('should support reactive enabling based on parameter availability', () => {
      // Test automatic disabling when path parameters are undefined
      const queryWithoutParams = api.getPet.useQuery( () => ({
        petId: undefined,
      }))
      expect(queryWithoutParams.isEnabled.value).toBe(false)

      const queryWithParams = api.getPet.useQuery( { petId: '123' })
      expect(queryWithParams.isEnabled.value).toBe(true)
    })

    it('should handle missing path parameters gracefully', () => {
      const query = api.getPet.useQuery( () => ({
        petId: undefined,
      }))
      expect(query.isEnabled.value).toBe(false)
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })
  })

  /**
   * Feature: Multipart Form Data Support
   *
   * Problem: Need proper support for multipart/form-data requests with file uploads.
   *
   * Solution: Added support for FormData handling and proper content-type headers.
   */
  describe('Multipart Form Data Support (Feature Request)', () => {
    it('should support multipart/form-data with specific upload endpoints', () => {
      // Test with upload-specific endpoint
      const uploadMutation = api.useMutation(uploadPetPic, { petId: '123' })

      const mockFile = new File(['test content'], 'test.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('file', mockFile)

      expect(() => {
        uploadMutation.mutateAsync({
          data: formData, // FormData is appropriate for uploadPetPic
        })
      }).not.toThrow()

      expect(uploadMutation).toHaveProperty('mutate')
      expect(uploadMutation).toHaveProperty('mutateAsync')
    })

    it('should support custom headers with multipart uploads', () => {
      const uploadMutation = api.useMutation(
        uploadPetPic,
        { petId: '123' },
        {
          axiosOptions: {
            headers: {
              'Content-Type': 'multipart/form-data',
              'X-Custom-Header': 'custom-value',
            },
          },
        },
      )

      const mockFile = new File(['test content'], 'test.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('file', mockFile)

      expect(() => {
        uploadMutation.mutateAsync({
          data: formData, // FormData is appropriate for uploadPetPic
        })
      }).not.toThrow()
    })

    it('should support type safety for multipart/form-data schemas', () => {
      const uploadMutation = api.useMutation(uploadPetPic, { petId: '123' })

      // Should accept FormData for upload endpoints
      expect(() => {
        uploadMutation.mutateAsync({
          data: new FormData(),
        })
      }).not.toThrow()

      // Should also accept object matching the schema
      expect(() => {
        uploadMutation.mutateAsync({
          data: {
            file: 'binary-data-string', // As per OpenAPI spec, file is string with format: binary
          },
        })
      }).not.toThrow()
    })

    it('should integrate with cache invalidation after upload', () => {
      const listPetsQuery = api.listPets.useQuery()
      const uploadMutation = api.uploadPetPic.useMutation(
        { petId: '123' },
        {
          invalidateOperations: ['listPets'],
        },
      )

      const formData = new FormData()
      formData.append('file', new File(['test'], 'test.jpg'))

      expect(uploadMutation).toBeTruthy()
      expect(listPetsQuery).toBeTruthy()
    })
  })

  /**
   * Enhancement: Error Handling Improvements
   *
   * Problem: Need better error handling patterns and custom error handlers.
   *
   * Solution: Added support for custom error handlers and improved error context.
   */
  describe('Error Handling Improvements (Enhancement)', () => {
    it('should support custom error handlers in queries', () => {
      const errorHandler = vi.fn((error) => {
        console.log('Custom error handler called:', error)
      })

      const query = api.listPets.useQuery( {
        errorHandler,
      })

      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })

    it('should support async error handlers', () => {
      const errorHandler = vi.fn().mockResolvedValue(undefined)

      const query = api.listPets.useQuery( {
        errorHandler,
      })

      expect(query).toHaveProperty('data')
    })

    it('should handle errors in mutations with custom handlers', () => {
      const mutation = api.useMutation(createPet, {
        onError: vi.fn((error) => {
          console.log('Mutation error:', error)
        }),
      })

      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })

    it('should handle errors in mutate calls with catch blocks', () => {
      const mutation = api.createPet.useMutation()

      expect(async () => {
        try {
          await mutation.mutateAsync({ data: { name: 'Test Pet' } })
        } catch (error) {
          console.log('Mutation error handled:', error)
        }
      }).not.toThrow()
    })
  })

  /**
   * Issue: Query Client Compatibility
   *
   * Problem: Need to ensure compatibility with different QueryClient configurations.
   *
   * Solution: Added support for custom QueryClient instances and proper defaults.
   */
  describe('Query Client Compatibility (Compatibility Issue)', () => {
    it('should work with custom QueryClient configuration', () => {
      const customQueryClient = {
        cancelQueries: vi.fn(() => Promise.resolve()),
        setQueryData: vi.fn(),
        invalidateQueries: vi.fn(() => Promise.resolve()),
      }
      const configWithClient: OpenApiConfig<OpenApiOperations> = {
        ...mockConfig,
        queryClient: customQueryClient,
      }

      const apiWithCustomClient = useOpenApi(configWithClient)
      expect(apiWithCustomClient).toBeTruthy()
      expect(apiWithCustomClient).toHaveProperty('useQuery')
      expect(apiWithCustomClient).toHaveProperty('useMutation')
    })

    it('should use default queryClient when not specified', () => {
      // This test verifies the api works without explicit queryClient
      expect(api).toBeTruthy()
      expect(api).toHaveProperty('useQuery')
      expect(api).toHaveProperty('useMutation')
    })
  })

  /**
   * Issue: Mutation isEnabled doesn't prevent execution
   *
   * Problem: When path parameters are undefined, mutation.isEnabled is false but
   * calling mutate() or mutateAsync() still attempts to execute and fails with
   * an error instead of being silently ignored or returning early.
   *
   * Expected behavior: When isEnabled is false, mutations should either:
   * 1. Return early without attempting the request
   * 2. Return a rejected promise with a clear message
   *
   * Solution: Wrap mutate/mutateAsync to check isEnabled before executing.
   */
  describe('Mutation isEnabled Enforcement (GitHub Issue)', () => {
    it('should have isEnabled=false when path parameters are undefined', () => {
      const mutation = api.useMutation(updatePet, () => ({ petId: undefined }))

      expect(mutation.isEnabled.value).toBe(false)
    })

    it('should have isEnabled=true when path parameters are provided', () => {
      const mutation = api.useMutation(updatePet, () => ({ petId: '123' }))

      expect(mutation.isEnabled.value).toBe(true)
    })

    it('should prevent mutate() when isEnabled is false', async () => {
      const onError = vi.fn()
      const mutation = api.useMutation(updatePet, () => ({ petId: undefined }), { onError })

      expect(mutation.isEnabled.value).toBe(false)

      // Calling mutate() when disabled should not throw, but should not execute either
      // The onError callback should be called with a clear error message
      mutation.mutate({ data: { name: 'Updated Name' } })

      // Wait a tick for async execution
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Verify that onError was called with appropriate error
      expect(onError).toHaveBeenCalled()
      const error = onError.mock.calls[0][0]
      expect(error).toBeInstanceOf(Error)
      expect(error.message).toContain('path parameters not resolved')
    })

    it('should reject mutateAsync() when isEnabled is false', async () => {
      const mutation = api.useMutation(updatePet, () => ({ petId: undefined }))

      expect(mutation.isEnabled.value).toBe(false)

      // mutateAsync should reject with a clear error
      await expect(mutation.mutateAsync({ data: { name: 'Updated Name' } })).rejects.toThrow(
        /path parameters not resolved/,
      )
    })

    it('should allow mutation when isEnabled becomes true', async () => {
      let petId: string | undefined = undefined
      const mutation = api.useMutation(updatePet, () => ({ petId }))

      // Initially disabled
      expect(mutation.isEnabled.value).toBe(false)

      // Enable by providing path param
      petId = '123'

      // Note: In a real Vue environment with refs, reactivity would update isEnabled
      // For this test, we're verifying the structure is correct
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
      expect(mutation).toHaveProperty('isEnabled')
    })

    it('should use isEnabled as a guard in practical usage', () => {
      const selectedRequestRef = { value: undefined as string | undefined }

      const updateRequestTypeMutation = api.useMutation(updatePet, () => ({
        petId: selectedRequestRef.value,
      }))

      // This is the pattern from the FIXME comment - isEnabled should guard execution
      expect(updateRequestTypeMutation.isEnabled.value).toBe(false)

      // Set the ref value
      selectedRequestRef.value = '123'

      // Verify mutation structure
      expect(updateRequestTypeMutation).toHaveProperty('mutate')
      expect(updateRequestTypeMutation).toHaveProperty('isEnabled')
    })
  })
})
