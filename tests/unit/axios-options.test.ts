import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// IMPORTANT: Unmock axios before importing it to get the real implementation
vi.unmock('axios')

import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'
import { QueryClient, useQuery, useMutation } from '@tanstack/vue-query'

// Mock Vue and TanStack Query specifically for this test
vi.mock('vue', () => ({
  computed: vi.fn((fn) => ({ value: fn() })),
  ref: vi.fn((value) => ({ value })),
  toValue: vi.fn((value) => (typeof value === 'function' ? value() : value)),
  watch: vi.fn(),
}))

vi.mock('@tanstack/vue-query', () => ({
  QueryClient: vi.fn(() => ({
    getQueryData: vi.fn(),
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
    cancelQueries: vi.fn(),
    refetchQueries: vi.fn(),
    clear: vi.fn(),
  })),
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}))

import { useOpenApi } from '@/index'
import { OpenApiConfig } from '@/types'
import { OperationId, OPERATION_INFO } from '../fixtures/api-operations'
import { type operations } from '../fixtures/openapi-types'

// Create a real axios instance for testing (not mocked)
let realAxiosInstance: AxiosInstance
let interceptorRequestSpy: ReturnType<typeof vi.fn>
let interceptorResponseSpy: ReturnType<typeof vi.fn>

describe('axiosOptions integration', () => {
  type MockOps = typeof OPERATION_INFO
  type OperationsWithInfo = operations & MockOps
  const mockOperations: OperationsWithInfo = OPERATION_INFO as OperationsWithInfo

  let api: ReturnType<typeof useOpenApi<OperationsWithInfo>>
  let queryClient: QueryClient
  let capturedConfig: AxiosRequestConfig | null = null

  beforeEach(() => {
    // Create a real axios instance with interceptors
    realAxiosInstance = axios.create({
      baseURL: 'https://api.example.com',
    })

    // Reset captured config
    capturedConfig = null

    // Set up spies for interceptors
    interceptorRequestSpy = vi.fn((config) => {
      capturedConfig = { ...config }
      return config
    })

    interceptorResponseSpy = vi.fn((response) => {
      // Mock successful response
      return {
        ...response,
        data: { id: 123, name: 'Test Pet' },
        status: 200,
        statusText: 'OK',
      }
    })

    // Add interceptors to capture the actual axios config
    realAxiosInstance.interceptors.request.use(interceptorRequestSpy)
    realAxiosInstance.interceptors.response.use(interceptorResponseSpy)

    // Create a real query client
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: 0 },
        mutations: { retry: false },
      },
    })

    // Mock useQuery to capture and execute the queryFn
    vi.mocked(useQuery).mockImplementation((options: any) => {
      const queryFn = options.queryFn
      return {
        data: { value: null },
        isLoading: { value: false },
        error: { value: null },
        refetch: async () => {
          if (queryFn) {
            try {
              await queryFn()
            } catch (_error) {
              // Expected - we want to capture the axios call, not succeed
            }
          }
        },
      }
    })

    // Mock useMutation to capture and execute the mutationFn
    vi.mocked(useMutation).mockImplementation((options: any) => {
      const mutationFn = options.mutationFn
      return {
        mutate: vi.fn(),
        mutateAsync: async (vars: any) => {
          if (mutationFn) {
            try {
              await mutationFn(vars)
            } catch (_error) {
              // Expected - we want to capture the axios call, not succeed
            }
          }
        },
        data: { value: null },
        isLoading: { value: false },
        error: { value: null },
      }
    })

    const config: OpenApiConfig<OperationsWithInfo> = {
      operations: mockOperations,
      axios: realAxiosInstance,
      queryClient,
    }

    api = useOpenApi(config)
  })

  afterEach(() => {
    // Clean up interceptors
    realAxiosInstance.interceptors.request.clear()
    realAxiosInstance.interceptors.response.clear()
    queryClient.clear()
  })

  describe('useQuery with axiosOptions', () => {
    it('should pass axiosOptions to axios for query operations', async () => {
      const customHeaders = { 'X-Client': 'webapp', Authorization: 'Bearer test-token' }
      const skipErrorHandling = true

      // Create a query with axiosOptions
      const query = api.useQuery(OperationId.listPets, {
        enabled: true,
        axiosOptions: {
          headers: customHeaders,
          skipErrorHandling,
        },
      })

      // Trigger the query by accessing query.data or calling refetch
      try {
        await query.refetch()
      } catch (_error) {
        // We expect this to fail since we're not actually hitting a real API
        // but the interceptor should still capture the config
      }

      // Verify the interceptor was called
      expect(interceptorRequestSpy).toHaveBeenCalled()
      expect(capturedConfig).not.toBeNull()

      // Verify that the axiosOptions were passed through
      expect(capturedConfig?.headers).toMatchObject(customHeaders)
      expect(capturedConfig?.skipErrorHandling).toBe(skipErrorHandling)
    })

    it('should pass axiosOptions to axios for parameterized query operations', async () => {
      const customHeaders = { 'X-Request-ID': '12345' }

      // Create a query with path parameters and axiosOptions
      const query = api.useQuery(
        OperationId.getPet,
        { petId: '123' },
        {
          enabled: true,
          axiosOptions: {
            headers: customHeaders,
            timeout: 5000,
          },
        },
      )

      try {
        await query.refetch()
      } catch (_error) {
        // Expected to fail, but interceptor should capture config
      }

      expect(interceptorRequestSpy).toHaveBeenCalled()
      expect(capturedConfig).not.toBeNull()
      expect(capturedConfig?.headers).toMatchObject(customHeaders)
      expect(capturedConfig?.timeout).toBe(5000)
      expect(capturedConfig?.url).toBe('/pets/123')
    })
  })

  describe('useMutation with axiosOptions', () => {
    it('should pass axiosOptions to axios for mutation operations', async () => {
      const customHeaders = { 'X-Client': 'webapp', 'Content-Type': 'application/json' }
      const skipErrorHandling = true

      // Create a mutation with axiosOptions
      const mutation = api.useMutation(OperationId.createPet, {
        axiosOptions: {
          headers: customHeaders,
          skipErrorHandling,
        },
      })

      try {
        await mutation.mutateAsync({
          data: { name: 'New Pet', status: 'available' },
        })
      } catch (_error) {
        // Expected to fail, but interceptor should capture config
      }

      expect(interceptorRequestSpy).toHaveBeenCalled()
      expect(capturedConfig).not.toBeNull()
      expect(capturedConfig?.headers).toMatchObject(customHeaders)
      expect(capturedConfig?.skipErrorHandling).toBe(skipErrorHandling)
      expect(capturedConfig?.method).toBe('post')
      expect(capturedConfig?.url).toBe('/pets')
    })

    it('should pass axiosOptions to axios for parameterized mutation operations', async () => {
      const customHeaders = { 'X-Request-ID': '67890' }

      // Create a mutation with path parameters and axiosOptions
      const mutation = api.useMutation(
        OperationId.updatePet,
        { petId: '456' },
        {
          axiosOptions: {
            headers: customHeaders,
            validateStatus: (status) => status < 500,
          },
        },
      )

      try {
        await mutation.mutateAsync({
          data: { name: 'Updated Pet', status: 'sold' },
        })
      } catch (_error) {
        // Expected to fail, but interceptor should capture config
      }

      expect(interceptorRequestSpy).toHaveBeenCalled()
      expect(capturedConfig).not.toBeNull()
      expect(capturedConfig?.headers).toMatchObject(customHeaders)
      expect(capturedConfig?.validateStatus).toBeDefined()
      expect(capturedConfig?.method).toBe('put')
      expect(capturedConfig?.url).toBe('/pets/456')
    })
  })

  describe('useEndpoint with axiosOptions', () => {
    it('should pass axiosOptions to axios for query operations via useEndpoint', async () => {
      const customHeaders = { 'X-Endpoint': 'useEndpoint' }

      // Create an endpoint with axiosOptions (query operation)
      const endpoint = api.useEndpoint(OperationId.listPets, {
        enabled: true,
        axiosOptions: {
          headers: customHeaders,
        },
      })

      try {
        await endpoint.refetch()
      } catch (_error) {
        // Expected to fail, but interceptor should capture config
      }

      expect(interceptorRequestSpy).toHaveBeenCalled()
      expect(capturedConfig).not.toBeNull()
      expect(capturedConfig?.headers).toMatchObject(customHeaders)
    })

    it('should pass axiosOptions to axios for mutation operations via useEndpoint', async () => {
      const customHeaders = { 'X-Endpoint': 'useEndpoint' }

      // Create an endpoint with axiosOptions (mutation operation)
      const endpoint = api.useEndpoint(OperationId.createPet, {
        axiosOptions: {
          headers: customHeaders,
        },
      })

      try {
        await endpoint.mutateAsync({
          data: { name: 'Endpoint Pet', status: 'available' },
        })
      } catch (_error) {
        // Expected to fail, but interceptor should capture config
      }

      expect(interceptorRequestSpy).toHaveBeenCalled()
      expect(capturedConfig).not.toBeNull()
      expect(capturedConfig?.headers).toMatchObject(customHeaders)
    })
  })

  describe('interceptor error handling scenarios', () => {
    it('should allow interceptors to access skipErrorHandling flag', async () => {
      let errorInterceptorCalled = false
      let errorConfig: AxiosRequestConfig | undefined

      // Add error interceptor
      realAxiosInstance.interceptors.response.use(
        (response) => response,
        (error) => {
          errorInterceptorCalled = true
          errorConfig = error.config
          // Check if skipErrorHandling is present
          if (error.config?.skipErrorHandling) {
            // Don't throw error if skipErrorHandling is true
            return { data: null, status: 200 }
          }
          throw error
        },
      )

      const mutation = api.useMutation(OperationId.createPet, {
        axiosOptions: {
          skipErrorHandling: true,
        },
      })

      try {
        await mutation.mutateAsync({
          data: { name: 'Test Pet', status: 'available' },
        })
      } catch (_error) {
        // Should not throw because skipErrorHandling is true
      }

      expect(errorInterceptorCalled).toBe(true)
      expect(errorConfig?.skipErrorHandling).toBe(true)
    })
  })
})
