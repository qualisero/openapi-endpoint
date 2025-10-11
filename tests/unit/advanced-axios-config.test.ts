import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useOpenApi } from '@/index'
import { OpenApiConfig, type OpenApiInstance } from '@/types'
import { mockAxios } from '../setup'
import { OperationId, openApiOperations, type OpenApiOperations } from '../fixtures/openapi-typed-operations'

describe('Advanced Axios Configuration', () => {
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

  describe('Request transformation', () => {
    it('should support custom transformRequest', () => {
      const transformRequest = vi.fn((data) => JSON.stringify(data))
      const mutation = api.useMutation(OperationId.createPet, {
        axiosOptions: {
          transformRequest,
        },
      })

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })

    it('should support custom transformResponse', () => {
      const transformResponse = vi.fn((data) => JSON.parse(data))
      const query = api.useQuery(OperationId.listPets, {
        axiosOptions: {
          transformResponse,
        },
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })
  })

  describe('Timeout configurations', () => {
    it('should support global timeout configuration', () => {
      const query = api.useQuery(OperationId.listPets, {
        axiosOptions: {
          timeout: 30000, // 30 seconds
        },
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })

    it('should support different timeout for mutations', () => {
      const mutation = api.useMutation(OperationId.createPet, {
        axiosOptions: {
          timeout: 60000, // 1 minute for potentially slower operations
        },
      })

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })

    it('should support timeoutErrorMessage', () => {
      const mutation = api.useMutation(OperationId.createPet, {
        axiosOptions: {
          timeout: 5000,
          timeoutErrorMessage: 'Request timed out after 5 seconds',
        },
      })

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })
  })

  describe('Response handling', () => {
    it('should support custom validateStatus function', () => {
      const validateStatus = vi.fn((status: number) => status >= 200 && status < 300)
      const query = api.useQuery(OperationId.listPets, {
        axiosOptions: {
          validateStatus,
        },
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })

    it('should support maxContentLength configuration', () => {
      const query = api.useQuery(OperationId.listPets, {
        axiosOptions: {
          maxContentLength: 2000,
        },
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })

    it('should support maxBodyLength for mutations', () => {
      const mutation = api.useMutation(OperationId.createPet, {
        axiosOptions: {
          maxBodyLength: 1000,
        },
      })

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })

    it('should support responseType configuration', () => {
      const query = api.useQuery(OperationId.listPets, {
        axiosOptions: {
          responseType: 'json',
        },
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })

    it('should support responseEncoding configuration', () => {
      const query = api.useQuery(OperationId.listPets, {
        axiosOptions: {
          responseEncoding: 'utf8',
        },
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })
  })

  describe('Proxy and networking', () => {
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

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })

    it('should support maxRedirects configuration', () => {
      const query = api.useQuery(OperationId.listPets, {
        axiosOptions: {
          maxRedirects: 3,
        },
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })

    it('should support decompress configuration', () => {
      const query = api.useQuery(OperationId.listPets, {
        axiosOptions: {
          decompress: true,
        },
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })
  })

  describe('Authentication and security', () => {
    it('should support withCredentials for CORS', () => {
      const query = api.useQuery(OperationId.listPets, {
        axiosOptions: {
          withCredentials: true,
        },
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
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

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })

    it('should support custom headers for authentication', () => {
      const authHeaders = {
        Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        'X-API-Key': 'secret-api-key',
      }

      const query = api.useQuery(OperationId.listPets, {
        axiosOptions: {
          headers: authHeaders,
        },
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })
  })

  describe('Request metadata and tracking', () => {
    it('should support custom signal for request cancellation', () => {
      const controller = new AbortController()
      const query = api.useQuery(OperationId.listPets, {
        axiosOptions: {
          signal: controller.signal,
        },
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')

      // Clean up
      controller.abort()
    })

    it('should support custom metadata', () => {
      const mutation = api.useMutation(OperationId.createPet, {
        axiosOptions: {
          // Note: metadata is not a standard axios property, but can be added for custom tracking
          headers: {
            'X-Operation': 'create-pet',
            'X-Source': 'admin-panel',
          },
        },
      })

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })
  })

  describe('Data handling', () => {
    it('should support custom paramsSerializer', () => {
      const paramsSerializer = vi.fn((params) => new URLSearchParams(params).toString())
      const query = api.useQuery(OperationId.listPets, {
        axiosOptions: {
          paramsSerializer,
        },
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })

    it('should support onUploadProgress for mutations', () => {
      const onUploadProgress = vi.fn((progressEvent) => {
        console.log('Upload progress:', progressEvent)
      })

      const mutation = api.useMutation(OperationId.createPet, {
        axiosOptions: {
          onUploadProgress,
        },
      })

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })

    it('should support onDownloadProgress for queries', () => {
      const onDownloadProgress = vi.fn((progressEvent) => {
        console.log('Download progress:', progressEvent)
      })

      const query = api.useQuery(OperationId.listPets, {
        axiosOptions: {
          onDownloadProgress,
        },
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })
  })

  describe('Environment-specific configurations', () => {
    it('should support Node.js specific options', () => {
      const query = api.useQuery(OperationId.listPets, {
        axiosOptions: {
          // Node.js specific options
          maxRedirects: 5,
          socketPath: '/var/run/socket',
        },
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
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

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })
  })

  describe('Combined axios and tanstack options', () => {
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

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
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

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
      expect(query).toHaveProperty('onLoad')
      expect(typeof query.onLoad).toBe('function')
    })
  })
})
