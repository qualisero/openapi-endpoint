import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useOpenApi } from '@/index'
import { OpenApiConfig, type OpenApiInstance } from '@/types'
import { mockAxios } from '../setup'
import { OperationId, openApiOperations, type OpenApiOperations } from '../fixtures/openapi-typed-operations'

// Simulate the user's augmented types (this would normally be in types/axios.d.ts)
// This demonstrates that our fix allows such properties even though they're defined elsewhere
interface AxiosErrorWithMetadata {
  isAxiosError: boolean
  message: string
  // Additional metadata properties could be here
}

describe('Issue Reproduction: Typing error when augmenting axiosOptions', () => {
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

  it('should accept manualErrorHandling property without TypeScript errors', () => {
    // This exact code from the issue description should now work
    const currentUser = api.useQuery(OperationId.listPets, {
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

    const currentUser = api.useQuery(OperationId.listPets, {
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
    const currentUser = api.useQuery(OperationId.listPets, {
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
    const createPet = api.useMutation(OperationId.createPet, {
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
    const createPet = api.useMutation(OperationId.createPet)

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
    const currentUser = api.useQuery(OperationId.listPets, {
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
})
