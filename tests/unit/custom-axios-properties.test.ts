import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useOpenApi } from '@/index'
import { OpenApiConfig, type OpenApiInstance } from '@/types'
import { mockAxios } from '../setup'
import { OperationId, openApiOperations, type OpenApiOperations } from '../fixtures/openapi-typed-operations'

describe('Custom Axios Properties Support', () => {
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

  describe('useQuery with custom axios properties', () => {
    it('should accept custom axios properties like manualErrorHandling', () => {
      // This test verifies that custom properties are accepted by TypeScript
      // The specific property names are from the issue description
      const query = api.useQuery(OperationId.listPets, {
        axiosOptions: {
          // Standard axios properties
          timeout: 5000,
          headers: {
            'X-Custom-Header': 'custom-value',
          },
          // Custom properties that might be added via module augmentation
          manualErrorHandling: true,
          handledByAxios: false,
          customRetryCount: 3,
          debugMode: true,
        },
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })

    it('should accept custom axios properties with path parameters', () => {
      const query = api.useQuery(
        OperationId.getPet,
        { petId: '123' },
        {
          axiosOptions: {
            timeout: 3000,
            // Custom error handling function
            manualErrorHandling: (error: unknown) => {
              console.log('Custom error handler:', error)
              return true
            },
            customMetadata: {
              requestId: 'req-123',
              source: 'unit-test',
            },
          },
        },
      )

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })
  })

  describe('useMutation with custom axios properties', () => {
    it('should accept custom axios properties in mutation setup', () => {
      const mutation = api.useMutation(OperationId.createPet, {
        axiosOptions: {
          timeout: 10000,
          // Custom properties from the issue
          manualErrorHandling: true,
          handledByAxios: false,
          // Additional custom properties
          uploadTracking: true,
          customAuthHandler: (config: unknown) => config,
        },
      })

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })

    it('should accept custom axios properties in mutate call', () => {
      const mutation = api.useMutation(OperationId.createPet)

      expect(() => {
        mutation.mutate({
          data: { name: 'Fluffy' },
          axiosOptions: {
            timeout: 8000,
            // Custom properties
            manualErrorHandling: (error: unknown) => {
              console.log('Handling error:', error)
              return false
            },
            requestTrackingId: 'track-456',
            customValidation: {
              enabled: true,
              strictMode: false,
            },
          },
        })
      }).not.toThrow()
    })

    it('should accept custom axios properties in mutateAsync call', async () => {
      const mutation = api.useMutation(OperationId.createPet)

      await expect(
        mutation.mutateAsync({
          data: { name: 'Fluffy' },
          axiosOptions: {
            timeout: 15000,
            // Complex custom properties
            manualErrorHandling: true,
            customRetryStrategy: {
              maxRetries: 3,
              backoffFactor: 2,
              retryCondition: (error: unknown) => Boolean(error),
            },
            loggingConfig: {
              logLevel: 'debug',
              includeHeaders: true,
              includeBody: false,
            },
          },
        }),
      ).resolves.toBeDefined()
    })

    it('should merge custom axios properties correctly', () => {
      const mutation = api.useMutation(OperationId.createPet, {
        axiosOptions: {
          timeout: 5000,
          manualErrorHandling: true,
          customSetupProperty: 'setup-value',
        },
      })

      expect(() => {
        mutation.mutate({
          data: { name: 'Fluffy' },
          axiosOptions: {
            timeout: 10000, // Should override setup timeout
            handledByAxios: true, // New custom property
            customRuntimeProperty: 'runtime-value',
          },
        })
      }).not.toThrow()
    })
  })

  describe('useEndpoint with custom axios properties', () => {
    it('should accept custom axios properties for query endpoints', () => {
      const endpoint = api.useEndpoint(OperationId.listPets, {
        axiosOptions: {
          headers: {
            'Cache-Control': 'no-cache',
          },
          // Custom properties
          manualErrorHandling: false,
          cacheStrategy: 'aggressive',
          debugInfo: {
            component: 'endpoint-test',
            version: '1.0.0',
          },
        },
      })

      expect(endpoint).toBeTruthy()
      expect(endpoint).toHaveProperty('data')
      expect(endpoint).toHaveProperty('isLoading')
    })

    it('should accept custom axios properties for mutation endpoints', () => {
      const endpoint = api.useEndpoint(OperationId.createPet, {
        axiosOptions: {
          timeout: 8000,
          // Custom properties for mutations
          handledByAxios: true,
          uploadProgressTracking: true,
          customMutationMetadata: {
            operation: 'create',
            entity: 'pet',
            version: 2,
          },
        },
      })

      expect(endpoint).toBeTruthy()
      expect(endpoint).toHaveProperty('mutate')
      expect(endpoint).toHaveProperty('mutateAsync')
    })
  })

  describe('Type safety with custom properties', () => {
    it('should allow any custom property types', () => {
      // This test ensures that various data types are accepted as custom properties
      const query = api.useQuery(OperationId.listPets, {
        axiosOptions: {
          // Standard axios properties
          timeout: 5000,

          // Custom properties of various types
          stringProperty: 'test',
          numberProperty: 42,
          booleanProperty: true,
          objectProperty: { nested: { deep: 'value' } },
          arrayProperty: [1, 2, 3],
          functionProperty: (data: unknown) => data,
          nullProperty: null,
          undefinedProperty: undefined,

          // Properties matching the issue description
          manualErrorHandling: true,
          handledByAxios: false,
        },
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })
  })
})
