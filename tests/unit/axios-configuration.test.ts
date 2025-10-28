import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useOpenApi } from '@/index'
import { OpenApiConfig, type OpenApiInstance } from '@/types'
import { mockAxios } from '../setup'
import { OperationId, openApiOperations, type OpenApiOperations } from '../fixtures/openapi-typed-operations'

/**
 * Consolidated Axios Configuration Tests
 * 
 * This file consolidates all axios-related configuration testing:
 * - Basic axios options integration
 * - Advanced axios configurations  
 * - Custom properties support
 * - Request/response transformations
 * - Authentication and security
 * - Error handling and timeout configurations
 */
describe('Axios Configuration Integration', () => {
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

  describe('Basic Axios Options', () => {
    it('should pass custom headers through axios options', () => {
      const customHeaders = {
        'X-Custom-Header': 'custom-value',
        Authorization: 'Bearer token123',
        'Content-Type': 'application/json',
      }

      const query = api.useQuery(OperationId.listPets, {
        axiosOptions: { headers: customHeaders },
      })

      const mutation = api.useMutation(OperationId.createPet, {
        axiosOptions: { headers: customHeaders },
      })

      expect(query).toHaveProperty('data')
      expect(mutation).toHaveProperty('mutate')
    })

    it('should handle timeout configurations', () => {
      const query = api.useQuery(OperationId.listPets, {
        axiosOptions: { timeout: 5000 },
      })

      const mutation = api.useMutation(OperationId.createPet, {
        axiosOptions: { timeout: 10000 },
      })

      expect(query).toHaveProperty('data')
      expect(mutation).toHaveProperty('mutate')
    })

    it('should handle baseURL override', () => {
      const query = api.useQuery(OperationId.listPets, {
        axiosOptions: { baseURL: 'https://custom-api.example.com' },
      })

      expect(query).toHaveProperty('data')
    })

    it('should handle axios options with path parameters', () => {
      const query = api.useQuery(
        OperationId.getPet,
        { petId: '123' },
        {
          axiosOptions: {
            headers: { Accept: 'application/json' },
            timeout: 3000,
          },
        },
      )

      const mutation = api.useMutation(
        OperationId.updatePet,
        { petId: '123' },
        {
          axiosOptions: {
            headers: { 'Content-Type': 'application/json' },
            maxRedirects: 5,
          },
        },
      )

      expect(query).toHaveProperty('data')
      expect(mutation).toHaveProperty('mutate')
    })
  })

  describe('Advanced Request/Response Handling', () => {
    it('should support custom transformRequest and transformResponse', () => {
      const transformRequest = vi.fn((data) => JSON.stringify(data))
      const transformResponse = vi.fn((data) => JSON.parse(data))

      const query = api.useQuery(OperationId.listPets, {
        axiosOptions: { transformResponse },
      })

      const mutation = api.useMutation(OperationId.createPet, {
        axiosOptions: { transformRequest },
      })

      expect(query).toHaveProperty('data')
      expect(mutation).toHaveProperty('mutate')
    })

    it('should support custom validateStatus function', () => {
      const validateStatus = vi.fn((status: number) => status >= 200 && status < 300)

      const query = api.useQuery(OperationId.listPets, {
        axiosOptions: { validateStatus },
      })

      expect(query).toHaveProperty('data')
    })

    it('should support response configuration options', () => {
      const query = api.useQuery(OperationId.listPets, {
        axiosOptions: {
          responseType: 'json',
          responseEncoding: 'utf8',
          maxContentLength: 2000,
        },
      })

      const mutation = api.useMutation(OperationId.createPet, {
        axiosOptions: {
          maxBodyLength: 1000,
        },
      })

      expect(query).toHaveProperty('data')
      expect(mutation).toHaveProperty('mutate')
    })

    it('should support progress tracking', () => {
      const onUploadProgress = vi.fn((progressEvent) => {
        console.log('Upload progress:', progressEvent)
      })

      const onDownloadProgress = vi.fn((progressEvent) => {
        console.log('Download progress:', progressEvent)
      })

      const query = api.useQuery(OperationId.listPets, {
        axiosOptions: { onDownloadProgress },
      })

      const mutation = api.useMutation(OperationId.createPet, {
        axiosOptions: { onUploadProgress },
      })

      expect(query).toHaveProperty('data')
      expect(mutation).toHaveProperty('mutate')
    })
  })

  describe('Authentication and Security', () => {
    it('should support CORS and credentials configuration', () => {
      const query = api.useQuery(OperationId.listPets, {
        axiosOptions: {
          withCredentials: true,
          xsrfCookieName: 'XSRF-TOKEN',
          xsrfHeaderName: 'X-XSRF-TOKEN',
        },
      })

      expect(query).toHaveProperty('data')
    })

    it('should support custom auth configuration', () => {
      const mutation = api.useMutation(OperationId.createPet, {
        axiosOptions: {
          auth: {
            username: 'user',
            password: 'pass',
          },
        },
      })

      expect(mutation).toHaveProperty('mutate')
    })

    it('should support authentication headers', () => {
      const authHeaders = {
        Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        'X-API-Key': 'secret-api-key',
      }

      const query = api.useQuery(OperationId.listPets, {
        axiosOptions: { headers: authHeaders },
      })

      expect(query).toHaveProperty('data')
    })
  })

  describe('Network and Proxy Configuration', () => {
    it('should support proxy configuration', () => {
      const query = api.useQuery(OperationId.listPets, {
        axiosOptions: {
          proxy: {
            protocol: 'http',
            host: 'proxy.example.com',
            port: 8080,
          },
        },
      })

      expect(query).toHaveProperty('data')
    })

    it('should support redirect and compression settings', () => {
      const query = api.useQuery(OperationId.listPets, {
        axiosOptions: {
          maxRedirects: 3,
          decompress: true,
        },
      })

      expect(query).toHaveProperty('data')
    })

    it('should support custom parameters serialization', () => {
      const paramsSerializer = vi.fn((params) => new URLSearchParams(params).toString())

      const query = api.useQuery(OperationId.listPets, {
        axiosOptions: { paramsSerializer },
      })

      expect(query).toHaveProperty('data')
    })
  })

  describe('Custom Properties Support', () => {
    it('should accept custom axios properties like manualErrorHandling', () => {
      // This addresses the original issue with custom axios properties
      const query = api.useQuery(OperationId.listPets, {
        axiosOptions: {
          // Standard axios properties
          timeout: 5000,
          headers: { 'X-Custom-Header': 'custom-value' },
          // Custom properties that might be added via module augmentation
          manualErrorHandling: true,
          handledByAxios: false,
          customRetryCount: 3,
          debugMode: true,
        },
      })

      expect(query).toHaveProperty('data')
    })

    it('should accept custom properties with various data types', () => {
      const query = api.useQuery(OperationId.listPets, {
        axiosOptions: {
          // Custom properties of various types
          stringProperty: 'test',
          numberProperty: 42,
          booleanProperty: true,
          objectProperty: { nested: { deep: 'value' } },
          arrayProperty: [1, 2, 3],
          functionProperty: (data: unknown) => data,
          nullProperty: null,
          undefinedProperty: undefined,
          // Properties from the original issue
          manualErrorHandling: true,
          handledByAxios: false,
        },
      })

      expect(query).toHaveProperty('data')
    })

    it('should accept custom error handling functions', () => {
      const customErrorHandler = (error: unknown) => {
        console.log('Custom error handler:', error)
        return true
      }

      const query = api.useQuery(OperationId.getPet, { petId: '123' }, {
        axiosOptions: {
          manualErrorHandling: customErrorHandler,
          customMetadata: {
            requestId: 'req-123',
            source: 'unit-test',
          },
        },
      })

      expect(query).toHaveProperty('data')
    })
  })

  describe('Axios Options in Mutation Calls', () => {
    it('should support axios options override in mutate calls', () => {
      const mutation = api.useMutation(OperationId.createPet, {
        axiosOptions: {
          timeout: 5000,
          headers: { 'X-Setup-Header': 'setup-value' },
        },
      })

      expect(() => {
        mutation.mutate({
          data: { name: 'Fluffy' },
          axiosOptions: {
            timeout: 10000, // Should override setup timeout
            headers: { 'X-Override-Header': 'override-value' },
          },
        })
      }).not.toThrow()
    })

    it('should support axios options in mutateAsync calls', async () => {
      const mutation = api.useMutation(OperationId.createPet)

      await expect(
        mutation.mutateAsync({
          data: { name: 'Fluffy' },
          axiosOptions: {
            timeout: 15000,
            headers: { 'X-Async-Header': 'async-value' },
            // Custom properties in mutateAsync
            manualErrorHandling: true,
            customRetryStrategy: {
              maxRetries: 3,
              backoffFactor: 2,
            },
          },
        }),
      ).resolves.toBeDefined()
    })

    it('should merge axios options from setup and runtime calls', () => {
      const mutation = api.useMutation(OperationId.createPet, {
        axiosOptions: {
          timeout: 5000,
          maxRedirects: 3,
          headers: {
            'X-Setup-Header': 'setup-value',
            'Content-Type': 'application/json',
          },
        },
      })

      expect(() => {
        mutation.mutate({
          data: { name: 'Fluffy' },
          axiosOptions: {
            timeout: 10000, // Should override setup timeout
            headers: {
              'X-Override-Header': 'override-value',
              'Content-Type': 'application/xml', // Should override setup Content-Type
            },
          },
        })
      }).not.toThrow()
    })

    it('should handle complex custom properties in mutation calls', () => {
      const mutation = api.useMutation(OperationId.createPet)

      expect(() => {
        mutation.mutate({
          data: { name: 'Fluffy' },
          axiosOptions: {
            timeout: 8000,
            // Complex custom properties
            manualErrorHandling: (error: unknown) => {
              console.log('Handling error:', error)
              return false
            },
            requestTrackingId: 'track-456',
            customValidation: {
              enabled: true,
              strictMode: false,
            },
            loggingConfig: {
              logLevel: 'debug',
              includeHeaders: true,
              includeBody: false,
            },
          },
        })
      }).not.toThrow()
    })
  })

  describe('useEndpoint with Axios Options', () => {
    it('should pass axios options to both query and mutation endpoints', () => {
      const queryEndpoint = api.useEndpoint(OperationId.listPets, {
        axiosOptions: {
          headers: { 'Cache-Control': 'no-cache' },
          // Custom properties
          manualErrorHandling: false,
          cacheStrategy: 'aggressive',
        },
      })

      const mutationEndpoint = api.useEndpoint(OperationId.createPet, {
        axiosOptions: {
          timeout: 8000,
          headers: { 'Content-Type': 'application/json' },
          // Custom properties for mutations
          handledByAxios: true,
          uploadProgressTracking: true,
        },
      })

      expect(queryEndpoint).toHaveProperty('data')
      expect(mutationEndpoint).toHaveProperty('mutate')
    })

    it('should handle axios options with path parameters in endpoints', () => {
      const endpoint = api.useEndpoint(
        OperationId.getPet,
        { petId: '456' },
        {
          axiosOptions: {
            validateStatus: (status: number) => status < 500,
            headers: { 'Accept-Language': 'en-US' },
          },
        },
      )

      expect(endpoint).toHaveProperty('data')
    })
  })

  describe('Environment and Browser-Specific Configuration', () => {
    it('should support Node.js specific options', () => {
      const query = api.useQuery(OperationId.listPets, {
        axiosOptions: {
          // Node.js specific options
          maxRedirects: 5,
          socketPath: '/var/run/socket',
        },
      })

      expect(query).toHaveProperty('data')
    })

    it('should support browser specific options', () => {
      const query = api.useQuery(OperationId.listPets, {
        axiosOptions: {
          // Browser specific options
          withCredentials: true,
          xsrfCookieName: 'XSRF-TOKEN',
          xsrfHeaderName: 'X-XSRF-TOKEN',
        },
      })

      expect(query).toHaveProperty('data')
    })
  })

  describe('Axios Integration with Global Configuration', () => {
    it('should work with global axios instance configuration', () => {
      const globalAxios = mockAxios
      globalAxios.defaults.headers.common['Global-Header'] = 'global-value'

      const configWithGlobalAxios: OpenApiConfig<OpenApiOperations> = {
        operations: mockOperations,
        axios: globalAxios,
      }

      const apiWithGlobal = useOpenApi(configWithGlobalAxios)
      const query = apiWithGlobal.useQuery(OperationId.listPets, {
        axiosOptions: {
          headers: { 'Request-Specific': 'request-value' },
        },
      })

      expect(query).toHaveProperty('data')
    })

    it('should work with axios interceptors', () => {
      const requestInterceptorId = mockAxios.interceptors.request.use(
        (config) => {
          config.headers['Interceptor-Added'] = 'true'
          return config
        },
        (error) => Promise.reject(error),
      )

      const responseInterceptorId = mockAxios.interceptors.response.use(
        (response) => {
          response.headers['Response-Processed'] = 'true'
          return response
        },
        (error) => Promise.reject(error),
      )

      const query = api.useQuery(OperationId.listPets, {
        axiosOptions: {
          headers: { 'Custom-Header': 'value' },
        },
      })

      expect(query).toHaveProperty('data')

      // Clean up interceptors
      mockAxios.interceptors.request.eject(requestInterceptorId)
      mockAxios.interceptors.response.eject(responseInterceptorId)
    })

    it('should handle empty or undefined axios options gracefully', () => {
      const queryWithEmpty = api.useQuery(OperationId.listPets, {
        axiosOptions: {},
      })

      const queryWithUndefined = api.useQuery(OperationId.listPets, {
        enabled: true,
        // axiosOptions is intentionally undefined
      })

      expect(queryWithEmpty).toHaveProperty('data')
      expect(queryWithUndefined).toHaveProperty('data')
    })

    it('should support request cancellation with AbortController', () => {
      const controller = new AbortController()
      const query = api.useQuery(OperationId.listPets, {
        axiosOptions: {
          signal: controller.signal,
        },
      })

      expect(query).toHaveProperty('data')

      // Clean up
      controller.abort()
    })
  })

  describe('Combined Configurations', () => {
    it('should support both axios and tanstack options together', () => {
      const onSuccess = vi.fn()
      const customHeaders = { 'X-Custom': 'value' }

      const mutation = api.useMutation(OperationId.createPet, {
        // TanStack Query options
        onSuccess,
        retry: 3,
        // Axios options
        axiosOptions: {
          headers: customHeaders,
          timeout: 10000,
        },
      })

      expect(mutation).toHaveProperty('mutate')
    })

    it('should support complex configuration scenarios', () => {
      const errorHandler = vi.fn()
      const onLoad = vi.fn()

      const query = api.useQuery(
        OperationId.getPet,
        { petId: '123' },
        {
          // Custom options
          errorHandler,
          onLoad,
          enabled: true,
          // TanStack Query options
          staleTime: 60000,
          refetchOnWindowFocus: false,
          // Axios options
          axiosOptions: {
            timeout: 15000,
            headers: {
              'Accept-Language': 'en-US',
              'Cache-Control': 'no-cache',
            },
          },
        },
      )

      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('onLoad')
      expect(typeof query.onLoad).toBe('function')
    })
  })
})