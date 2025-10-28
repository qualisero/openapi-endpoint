import { describe, it, expect, vi } from 'vitest'
import { useOpenApi } from '@/index'
import { OpenApiConfig } from '@/types'
import { mockAxios } from '../setup'
import { OperationId, openApiOperations, type OpenApiOperations } from '../fixtures/openapi-typed-operations'

// This demonstrates the final approach with AxiosRequestConfigExtended
describe('Final Solution: AxiosRequestConfigExtended Approach', () => {
  it('should work seamlessly for users (satisfies original issue)', () => {
    // This solves the original issue perfectly
    const config: OpenApiConfig<OpenApiOperations> = {
      operations: openApiOperations,
      axios: mockAxios,
    }
    const api = useOpenApi(config)

    const options = {
      onLoad: vi.fn(),
    }

    // This is the EXACT code from the issue that now works
    const currentUser = api.useQuery(OperationId.listPets, {
      onLoad: options.onLoad,
      axiosOptions: { manualErrorHandling: true }, // ✅ No longer throws TypeScript error
    })

    expect(currentUser).toBeTruthy()
    expect(currentUser).toHaveProperty('data')
    expect(currentUser).toHaveProperty('isLoading')
    expect(currentUser).toHaveProperty('onLoad')
  })

  it('should accept all types of custom properties', () => {
    const config: OpenApiConfig<OpenApiOperations> = {
      operations: openApiOperations,
      axios: mockAxios,
    }
    const api = useOpenApi(config)

    // All these work because of AxiosRequestConfig & Record<string, unknown>
    const query = api.useQuery(OperationId.listPets, {
      axiosOptions: {
        // Standard axios properties
        timeout: 5000,
        headers: {
          Authorization: '******',
          'Content-Type': 'application/json',
        },
        // Custom properties mentioned in the issue
        manualErrorHandling: true,
        handledByAxios: false,
        // Any other custom properties users might add
        customRetryConfig: {
          maxRetries: 3,
          backoffFactor: 1.5,
        },
        loggingEnabled: true,
        requestId: 'req-123',
        customInterceptor: (axiosConfig: any) => axiosConfig,
      },
    })

    expect(query).toBeTruthy()
    expect(query).toHaveProperty('data')
    expect(query).toHaveProperty('isLoading')
  })

  it('should work with function-based custom properties', () => {
    const config: OpenApiConfig<OpenApiOperations> = {
      operations: openApiOperations,
      axios: mockAxios,
    }
    const api = useOpenApi(config)

    // Function variant as mentioned in the issue
    const errorHandler = (error: any) => {
      console.log('Handling error:', error.message)
      return error.status >= 500 // Only handle server errors
    }

    const query = api.useQuery(OperationId.listPets, {
      axiosOptions: {
        manualErrorHandling: errorHandler,
        handledByAxios: false,
      },
    })

    expect(query).toBeTruthy()
    expect(query).toHaveProperty('data')
    expect(query).toHaveProperty('isLoading')
  })

  it('should work with mutations', () => {
    const config: OpenApiConfig<OpenApiOperations> = {
      operations: openApiOperations,
      axios: mockAxios,
    }
    const api = useOpenApi(config)

    const createPet = api.useMutation(OperationId.createPet, {
      axiosOptions: {
        manualErrorHandling: true,
        handledByAxios: false,
        uploadProgressTracking: true,
      },
    })

    expect(createPet).toBeTruthy()
    expect(createPet).toHaveProperty('mutate')
    expect(createPet).toHaveProperty('mutateAsync')
  })

  it('should work in mutate calls', () => {
    const config: OpenApiConfig<OpenApiOperations> = {
      operations: openApiOperations,
      axios: mockAxios,
    }
    const api = useOpenApi(config)

    const createPet = api.useMutation(OperationId.createPet)

    expect(() => {
      createPet.mutate({
        data: { name: 'Test Pet' },
        axiosOptions: {
          manualErrorHandling: true,
          handledByAxios: false,
          requestTrackingId: 'track-456',
        },
      })
    }).not.toThrow()
  })

  it('should maintain full backward compatibility', () => {
    // Existing code without any custom types should continue to work exactly as before
    const config = {
      operations: openApiOperations,
      axios: mockAxios,
    }

    const api = useOpenApi(config)

    const query = api.useQuery(OperationId.listPets, {
      axiosOptions: {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    })

    expect(query).toBeTruthy()
    expect(query).toHaveProperty('data')
    expect(query).toHaveProperty('isLoading')
  })

  it('should preserve standard axios properties alongside custom ones', () => {
    const config: OpenApiConfig<OpenApiOperations> = {
      operations: openApiOperations,
      axios: mockAxios,
    }
    const api = useOpenApi(config)

    // Ensure standard axios properties still work with custom ones
    const query = api.useQuery(OperationId.listPets, {
      axiosOptions: {
        // Standard axios properties
        timeout: 5000,
        headers: {
          Authorization: '******',
          'Content-Type': 'application/json',
        },
        withCredentials: true,
        maxRedirects: 3,
        validateStatus: (status: number) => status < 500,
        // Custom augmented properties
        manualErrorHandling: true,
        handledByAxios: false,
        customMetadata: {
          requestId: 'req-789',
          source: 'unit-test',
        },
      },
    })

    expect(query).toBeTruthy()
    expect(query).toHaveProperty('data')
    expect(query).toHaveProperty('isLoading')
  })
})
