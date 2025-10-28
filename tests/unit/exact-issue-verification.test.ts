import { describe, it, expect, vi } from 'vitest'
import { useOpenApi } from '@/index'
import { OpenApiConfig } from '@/types'
import { mockAxios } from '../setup'
import { OperationId, openApiOperations, type OpenApiOperations } from '../fixtures/openapi-typed-operations'

// This test simulates the exact scenario from the issue
describe('Exact Issue Reproduction', () => {
  it('should compile and run the exact code from the issue without TypeScript errors', () => {
    const mockConfig: OpenApiConfig<OpenApiOperations> = {
      operations: openApiOperations,
      axios: mockAxios,
    }
    const api = useOpenApi(mockConfig)

    // Mock the onLoad function that would come from options
    const options = {
      onLoad: vi.fn(),
    }

    // This is the EXACT code from the issue that was failing before
    const currentUser = api.useQuery(OperationId.listPets, {
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

  it('should also work with the function variant of manualErrorHandling', () => {
    const mockConfig: OpenApiConfig<OpenApiOperations> = {
      operations: openApiOperations,
      axios: mockAxios,
    }
    const api = useOpenApi(mockConfig)

    // Function variant as mentioned in the augmented types
    const errorHandler = (error: { isAxiosError: boolean; message: string }) => {
      console.log('Error handler called:', error.message)
      return true
    }

    const options = {
      onLoad: vi.fn(),
    }

    // Test the function variant
    const currentUser = api.useQuery(OperationId.listPets, {
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
