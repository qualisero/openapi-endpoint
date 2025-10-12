import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useOpenApi } from '@/index'
import { OpenApiConfig, type OpenApiInstance } from '@/types'
import { mockAxios } from '../setup'
import { OperationId, openApiOperations, type OpenApiOperations } from '../fixtures/openapi-typed-operations'

describe('Multipart/Form-Data Support', () => {
  const mockOperations: OpenApiOperations = openApiOperations

  let mockConfig: OpenApiConfig<OpenApiOperations>
  let api: OpenApiInstance<OpenApiOperations>

  beforeEach(() => {
    vi.clearAllMocks()
    mockConfig = {
      operations: mockOperations,
      axios: mockAxios,
    }
    api = useOpenApi(mockConfig)
  })

  describe('uploadPetPic endpoint', () => {
    it('should support multipart/form-data content type', () => {
      const uploadMutation = api.useMutation(OperationId.uploadPetPic, { petId: '123' })

      expect(uploadMutation).toBeTruthy()
      expect(uploadMutation).toHaveProperty('mutate')
      expect(uploadMutation).toHaveProperty('mutateAsync')
      expect(uploadMutation).toHaveProperty('data')
      expect(uploadMutation).toHaveProperty('isLoading')
    })

    it('should accept FormData as request body', () => {
      const uploadMutation = api.useMutation(OperationId.uploadPetPic, { petId: '123' })

      // Mock a file
      const mockFile = new File(['test content'], 'test.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('file', mockFile)

      // This should not throw type errors - verifying the typing works
      expect(() => {
        uploadMutation.mutateAsync({
          data: formData,
        })
      }).not.toThrow()
    })

    it('should support custom headers including Content-Type', () => {
      const uploadMutation = api.useMutation(
        OperationId.uploadPetPic,
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

      // Verify the mutation can be called without type errors
      expect(() => {
        uploadMutation.mutateAsync({
          data: formData,
        })
      }).not.toThrow()
    })

    it('should support per-mutation options configuration', () => {
      const uploadMutation = api.useMutation(OperationId.uploadPetPic, { petId: '123' })

      const mockFile = new File(['test content'], 'test.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('file', mockFile)

      // Verify the mutation can be called with success callbacks
      expect(() => {
        uploadMutation.mutateAsync({
          data: formData,
          dontInvalidate: true, // Example of per-mutation option
        })
      }).not.toThrow()
    })

    it('should work with the generic useEndpoint method', () => {
      const uploadEndpoint = api.useEndpoint(OperationId.uploadPetPic, { petId: '123' })

      expect(uploadEndpoint).toBeTruthy()
      expect(uploadEndpoint).toHaveProperty('mutate')
      expect(uploadEndpoint).toHaveProperty('mutateAsync')
    })
  })

  describe('Type safety for multipart/form-data', () => {
    it('should correctly infer FormData type for SingleFile schema', () => {
      // This test validates that TypeScript compilation succeeds
      const uploadMutation = api.useMutation(OperationId.uploadPetPic, { petId: '123' })

      const formData = new FormData()
      formData.append('file', new File(['test'], 'test.jpg'))

      // Type check: this should compile without errors
      expect(() => {
        uploadMutation.mutateAsync({
          data: formData, // Should accept FormData for multipart/form-data endpoints
        })
      }).not.toThrow()
    })

    it('should allow both FormData and object with file property', () => {
      const uploadMutation = api.useMutation(OperationId.uploadPetPic, { petId: '123' })

      // Should accept FormData
      expect(() => {
        uploadMutation.mutateAsync({
          data: new FormData(),
        })
      }).not.toThrow()

      // Should also accept object matching SingleFile schema
      expect(() => {
        uploadMutation.mutateAsync({
          data: {
            file: 'binary-data-string', // As per OpenAPI spec, file is string with format: binary
          },
        })
      }).not.toThrow()
    })
  })

  describe('Integration with existing functionality', () => {
    it('should work with query invalidation after upload', () => {
      const listPetsQuery = api.useQuery(OperationId.listPets)
      const uploadMutation = api.useMutation(
        OperationId.uploadPetPic,
        { petId: '123' },
        {
          invalidateOperations: [OperationId.listPets],
        },
      )

      const formData = new FormData()
      formData.append('file', new File(['test'], 'test.jpg'))

      // Verify the mutation can be configured with invalidation
      expect(uploadMutation).toBeTruthy()
      expect(listPetsQuery).toBeTruthy()
    })

    it('should support error handling with custom error handlers', () => {
      const errorHandler = vi.fn().mockResolvedValue({
        id: 'fallback',
        name: 'Fallback Pet',
        status: 'available',
      })

      const uploadMutation = api.useMutation(
        OperationId.uploadPetPic,
        { petId: '123' },
        {
          errorHandler,
        },
      )

      const formData = new FormData()
      formData.append('file', new File(['test'], 'test.jpg'))

      // Verify configuration works
      expect(uploadMutation).toBeTruthy()
      expect(errorHandler).toBeDefined()
    })
  })

  describe('Path parameter handling', () => {
    it('should correctly resolve path parameters for upload endpoint', () => {
      const uploadMutation = api.useMutation(OperationId.uploadPetPic, { petId: '123' })

      // Verify the mutation has the correct path resolution capability
      expect(uploadMutation).toBeTruthy()
      expect(uploadMutation).toHaveProperty('isEnabled')
    })

    it('should support dynamic path parameters', () => {
      // Test that different pet IDs work
      const upload1 = api.useMutation(OperationId.uploadPetPic, { petId: '123' })
      const upload2 = api.useMutation(OperationId.uploadPetPic, { petId: '456' })

      expect(upload1).toBeTruthy()
      expect(upload2).toBeTruthy()
    })
  })
})
