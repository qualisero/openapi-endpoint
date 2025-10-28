import { describe, it, expect } from 'vitest'
import { useOpenApi } from '@/index'
import { OpenApiConfig, type OpenApiInstance } from '@/types'
import { mockAxios } from '../setup'
import { OperationId, openApiOperations, type OpenApiOperations } from '../fixtures/openapi-typed-operations'
import type { AxiosRequestConfig } from 'axios'

// Define a custom axios config type with augmented properties
interface CustomAxiosRequestConfig extends AxiosRequestConfig {
  manualErrorHandling?: boolean | ((error: any) => boolean)
  handledByAxios?: boolean
  customProperty?: string
  complexCustomProperty?: {
    enabled: boolean
    settings: Record<string, unknown>
  }
}

describe('Generic AxiosConfig Type Support', () => {
  const mockOperations: OpenApiOperations = openApiOperations

  describe('Default AxiosRequestConfig (backward compatibility)', () => {
    it('should work with default axios config type', () => {
      const mockConfig: OpenApiConfig<OpenApiOperations> = {
        operations: mockOperations,
        axios: mockAxios,
      }
      const api = useOpenApi(mockConfig)

      const query = api.useQuery(OperationId.listPets, {
        axiosOptions: {
          timeout: 5000,
          headers: {
            'X-Standard-Header': 'value',
          },
        },
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })
  })

  describe('Custom AxiosConfig Type', () => {
    it('should accept custom axios config type with type parameter', () => {
      // Use the generic type parameter approach
      const mockConfig: OpenApiConfig<OpenApiOperations, CustomAxiosRequestConfig> = {
        operations: mockOperations,
        axios: mockAxios,
      }
      const api = useOpenApi(mockConfig)

      const query = api.useQuery(OperationId.listPets, {
        axiosOptions: {
          // Standard axios properties
          timeout: 5000,
          headers: {
            Authorization: '******',
          },
          // Custom properties from our interface
          manualErrorHandling: true,
          handledByAxios: false,
          customProperty: 'test-value',
          complexCustomProperty: {
            enabled: true,
            settings: {
              retryCount: 3,
              backoffFactor: 2,
            },
          },
        },
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })

    it('should work with mutations using custom axios config', () => {
      const mockConfig: OpenApiConfig<OpenApiOperations, CustomAxiosRequestConfig> = {
        operations: mockOperations,
        axios: mockAxios,
      }
      const api = useOpenApi(mockConfig)

      const mutation = api.useMutation(OperationId.createPet, {
        axiosOptions: {
          timeout: 10000,
          manualErrorHandling: (error) => {
            console.log('Custom error handling:', error)
            return false
          },
          handledByAxios: true,
          customProperty: 'mutation-test',
        },
      })

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })

    it('should work with useEndpoint using custom axios config', () => {
      const mockConfig: OpenApiConfig<OpenApiOperations, CustomAxiosRequestConfig> = {
        operations: mockOperations,
        axios: mockAxios,
      }
      const api = useOpenApi(mockConfig)

      const endpoint = api.useEndpoint(OperationId.listPets, {
        axiosOptions: {
          manualErrorHandling: false,
          customProperty: 'endpoint-test',
          complexCustomProperty: {
            enabled: false,
            settings: {},
          },
        },
      })

      expect(endpoint).toBeTruthy()
      expect(endpoint).toHaveProperty('data')
      expect(endpoint).toHaveProperty('isLoading')
    })

    it('should properly type the API instance', () => {
      const mockConfig: OpenApiConfig<OpenApiOperations, CustomAxiosRequestConfig> = {
        operations: mockOperations,
        axios: mockAxios,
      }

      // This should infer the correct type including the custom axios config
      const api: OpenApiInstance<OpenApiOperations, CustomAxiosRequestConfig> = useOpenApi(mockConfig)

      expect(api).toBeTruthy()
      expect(typeof api.useQuery).toBe('function')
      expect(typeof api.useMutation).toBe('function')
      expect(typeof api.useEndpoint).toBe('function')
      expect(typeof api._debugIsQueryOperation).toBe('function')
    })

    it('should allow function-based custom properties', () => {
      const mockConfig: OpenApiConfig<OpenApiOperations, CustomAxiosRequestConfig> = {
        operations: mockOperations,
        axios: mockAxios,
      }
      const api = useOpenApi(mockConfig)

      const errorHandler = (error: any) => {
        console.log('Custom error handler called:', error)
        return true
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
  })

  describe('Type safety verification', () => {
    it('should enforce custom type constraints', () => {
      const mockConfig: OpenApiConfig<OpenApiOperations, CustomAxiosRequestConfig> = {
        operations: mockOperations,
        axios: mockAxios,
      }
      const api = useOpenApi(mockConfig)

      // This should compile without errors
      const query = api.useQuery(OperationId.listPets, {
        axiosOptions: {
          manualErrorHandling: true, // boolean is allowed
          customProperty: 'valid-string', // string is expected
          complexCustomProperty: {
            enabled: true,
            settings: { key: 'value' },
          },
        },
      })

      expect(query).toBeTruthy()
    })
  })
})
