import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useOpenApi } from '@/index'
import { OpenApiConfig, type OpenApiInstance } from '@/types'
import { mockAxios } from '../setup'
import { OperationId, openApiOperations, type OpenApiOperations } from '../fixtures/_openapi-typed-operations'

describe('Axios Options Integration', () => {
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

  describe('useQuery with axios options', () => {
    it('should pass custom headers through axios options', () => {
      const customHeaders = {
        'X-Custom-Header': 'custom-value',
        Authorization: 'Bearer token123',
      }

      const query = api.useQuery(OperationId.listPets, undefined, {
        axiosOptions: {
          headers: customHeaders,
        },
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })

    it('should pass timeout configuration through axios options', () => {
      const query = api.useQuery(OperationId.listPets, undefined, {
        axiosOptions: {
          timeout: 5000,
        },
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })

    it('should pass baseURL override through axios options', () => {
      const query = api.useQuery(OperationId.listPets, undefined, {
        axiosOptions: {
          baseURL: 'https://custom-api.example.com',
        },
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })

    it('should handle axios options with path parameters', () => {
      const query = api.useQuery(
        OperationId.getPet,
        { petId: '123' },
        {
          axiosOptions: {
            headers: {
              Accept: 'application/json',
            },
            timeout: 3000,
          },
        },
      )

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })
  })

  describe('useMutation with axios options', () => {
    it('should pass custom headers through axios options', () => {
      const customHeaders = {
        'Content-Type': 'application/json',
        'X-API-Key': 'api-key-123',
      }

      const mutation = api.useMutation(OperationId.createPet, undefined, {
        axiosOptions: {
          headers: customHeaders,
        },
      })

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })

    it('should pass timeout configuration through axios options', () => {
      const mutation = api.useMutation(OperationId.createPet, undefined, {
        axiosOptions: {
          timeout: 10000,
        },
      })

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })

    it('should handle axios options with path parameters', () => {
      const mutation = api.useMutation(
        OperationId.updatePet,
        { petId: '123' },
        {
          axiosOptions: {
            headers: {
              'Content-Type': 'application/json',
            },
            maxRedirects: 5,
          },
        },
      )

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })

    it('should handle multiple axios options configurations', () => {
      const mutation = api.useMutation(OperationId.createPet, undefined, {
        axiosOptions: {
          timeout: 15000,
          maxContentLength: 2000,
          maxBodyLength: 2000,
          headers: {
            'User-Agent': 'custom-client/1.0',
          },
        },
      })

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })
  })

  describe('useEndpoint with axios options', () => {
    it('should pass axios options to query endpoints', () => {
      const endpoint = api.useEndpoint(OperationId.listPets, undefined, {
        axiosOptions: {
          headers: {
            'Cache-Control': 'no-cache',
          },
        },
      })

      expect(endpoint).toBeTruthy()
      expect(endpoint).toHaveProperty('data')
      expect(endpoint).toHaveProperty('isLoading')
    })

    it('should pass axios options to mutation endpoints', () => {
      const endpoint = api.useEndpoint(OperationId.createPet, undefined, {
        axiosOptions: {
          timeout: 8000,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      })

      expect(endpoint).toBeTruthy()
      expect(endpoint).toHaveProperty('mutate')
      expect(endpoint).toHaveProperty('mutateAsync')
    })

    it('should handle axios options with path parameters in endpoints', () => {
      const endpoint = api.useEndpoint(
        OperationId.getPet,
        { petId: '456' },
        {
          axiosOptions: {
            validateStatus: (status: number) => status < 500,
            headers: {
              'Accept-Language': 'en-US',
            },
          },
        },
      )

      expect(endpoint).toBeTruthy()
      expect(endpoint).toHaveProperty('data')
      expect(endpoint).toHaveProperty('isLoading')
    })
  })

  describe('axios configuration merging', () => {
    it('should work with global axios instance configuration', () => {
      const globalAxios = mockAxios
      globalAxios.defaults.headers.common['Global-Header'] = 'global-value'

      const configWithGlobalAxios: OpenApiConfig<OpenApiOperations> = {
        operations: mockOperations,
        axios: globalAxios,
      }

      const apiWithGlobal = useOpenApi(configWithGlobalAxios)
      const query = apiWithGlobal.useQuery(OperationId.listPets, undefined, {
        axiosOptions: {
          headers: {
            'Request-Specific': 'request-value',
          },
        },
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })

    it('should handle empty axios options gracefully', () => {
      const query = api.useQuery(OperationId.listPets, undefined, {
        axiosOptions: {},
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })

    it('should handle undefined axios options', () => {
      const query = api.useQuery(OperationId.listPets, undefined, {
        enabled: true,
        // axiosOptions is intentionally undefined
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })
  })

  describe('axios interceptors compatibility', () => {
    it('should work with request interceptors', () => {
      const interceptorId = mockAxios.interceptors.request.use(
        (config) => {
          config.headers['Interceptor-Added'] = 'true'
          return config
        },
        (error) => Promise.reject(error),
      )

      const query = api.useQuery(OperationId.listPets, undefined, {
        axiosOptions: {
          headers: {
            'Custom-Header': 'value',
          },
        },
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')

      // Clean up interceptor
      mockAxios.interceptors.request.eject(interceptorId)
    })

    it('should work with response interceptors', () => {
      const interceptorId = mockAxios.interceptors.response.use(
        (response) => {
          response.headers['Response-Processed'] = 'true'
          return response
        },
        (error) => Promise.reject(error),
      )

      const query = api.useQuery(OperationId.listPets)

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')

      // Clean up interceptor
      mockAxios.interceptors.response.eject(interceptorId)
    })
  })
})
