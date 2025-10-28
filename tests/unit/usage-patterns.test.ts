import { describe, it, expect, vi } from 'vitest'
import { useOpenApi } from '@/index'
import { OpenApiConfig } from '@/types'
import { mockAxios } from '../setup'
import { OperationId, openApiOperations, type OpenApiOperations } from '../fixtures/openapi-typed-operations'

// This demonstrates the recommended usage pattern for users with module augmentation
describe('Recommended Usage Pattern for Module Augmentation', () => {
  it('should work seamlessly with global module augmentation (traditional approach)', () => {
    // Users would have this in their types/axios.d.ts:
    // declare module 'axios' {
    //   export interface AxiosRequestConfig {
    //     manualErrorHandling?: boolean | ((error: AxiosErrorWithMetadata) => boolean)
    //     handledByAxios?: boolean
    //   }
    // }

    // With our new generic approach, users can now choose:

    // Option 1: Default usage (relies on global augmentation)
    const config: OpenApiConfig<OpenApiOperations> = {
      operations: openApiOperations,
      axios: mockAxios,
    }
    const api = useOpenApi(config)

    // This should work if they have global module augmentation
    const query = api.useQuery(OperationId.listPets, {
      axiosOptions: {
        timeout: 5000,
        // These would be recognized if the user has module augmentation
        // manualErrorHandling: true,
        // handledByAxios: false,
      },
    })

    expect(query).toBeTruthy()
    expect(query).toHaveProperty('data')
    expect(query).toHaveProperty('isLoading')
  })

  it('should provide explicit type safety with generic parameter (new approach)', () => {
    // Option 2: Explicit typing (recommended for better type safety)
    interface MyAxiosRequestConfig {
      // All standard axios properties are inherited via intersection
      timeout?: number
      headers?: Record<string, string>
      // Plus their custom properties
      manualErrorHandling?: boolean | ((error: any) => boolean)
      handledByAxios?: boolean
      customRetryConfig?: {
        maxRetries: number
        backoffFactor: number
      }
    }

    const config: OpenApiConfig<OpenApiOperations, MyAxiosRequestConfig> = {
      operations: openApiOperations,
      axios: mockAxios,
    }
    const api = useOpenApi(config)

    // Now TypeScript will enforce the custom type
    const query = api.useQuery(OperationId.listPets, {
      axiosOptions: {
        timeout: 5000,
        headers: {
          Authorization: '******',
        },
        manualErrorHandling: true,
        handledByAxios: false,
        customRetryConfig: {
          maxRetries: 3,
          backoffFactor: 1.5,
        },
      },
    })

    expect(query).toBeTruthy()
    expect(query).toHaveProperty('data')
    expect(query).toHaveProperty('isLoading')
  })

  it('should solve the original issue from the problem statement', () => {
    // This directly addresses the original issue
    interface AxiosErrorWithMetadata {
      isAxiosError: boolean
      message: string
    }

    // Exact interface from the issue
    interface MyAxiosRequestConfig {
      manualErrorHandling?: boolean | ((error: AxiosErrorWithMetadata) => boolean)
      handledByAxios?: boolean
      // Allow all standard axios properties
      [key: string]: any
    }

    const config: OpenApiConfig<OpenApiOperations, MyAxiosRequestConfig> = {
      operations: openApiOperations,
      axios: mockAxios,
    }
    const api = useOpenApi(config)

    const options = {
      onLoad: vi.fn(),
    }

    // This is the EXACT code from the issue that should now work
    const currentUser = api.useQuery(OperationId.listPets, {
      onLoad: options.onLoad,
      axiosOptions: { manualErrorHandling: true },
    })

    expect(currentUser).toBeTruthy()
    expect(currentUser).toHaveProperty('data')
    expect(currentUser).toHaveProperty('isLoading')
    expect(currentUser).toHaveProperty('onLoad')
  })

  it('should work with complex function-based properties', () => {
    interface CustomAxiosConfig {
      manualErrorHandling?: boolean | ((error: any) => boolean)
      handledByAxios?: boolean
      customInterceptor?: (config: any) => any
      [key: string]: any
    }

    const config: OpenApiConfig<OpenApiOperations, CustomAxiosConfig> = {
      operations: openApiOperations,
      axios: mockAxios,
    }
    const api = useOpenApi(config)

    const errorHandler = (error: any) => {
      console.log('Handling error:', error.message)
      return error.status >= 500 // Only handle server errors
    }

    const interceptor = (axiosConfig: any) => {
      axiosConfig.metadata = { timestamp: Date.now() }
      return axiosConfig
    }

    const query = api.useQuery(OperationId.listPets, {
      axiosOptions: {
        manualErrorHandling: errorHandler,
        handledByAxios: false,
        customInterceptor: interceptor,
        timeout: 10000,
      },
    })

    expect(query).toBeTruthy()
    expect(query).toHaveProperty('data')
    expect(query).toHaveProperty('isLoading')
  })

  it('should maintain full backward compatibility', () => {
    // Existing code without any custom types should continue to work
    const config = {
      operations: openApiOperations,
      axios: mockAxios,
    }

    // This uses default typing and should work exactly as before
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
})
