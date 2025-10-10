import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// IMPORTANT: Unmock axios before importing it to get the real implementation
vi.unmock('axios')

import axios, { type AxiosInstance } from 'axios'
import { QueryClient } from '@tanstack/vue-query'
import { useOpenApi } from '../../src/index.js'
import type { OpenApiConfig } from '../../src/types.js'
import { OperationId, OPERATION_INFO } from '../fixtures/api-operations.js'
import { type operations } from '../fixtures/openapi-types.js'

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
  useQuery: vi.fn(() => ({
    data: { value: null },
    isLoading: { value: false },
    error: { value: null },
    refetch: vi.fn().mockRejectedValue(new Error('Test error')),
  })),
  useMutation: vi.fn(() => ({
    data: { value: null },
    isLoading: { value: false },
    error: { value: null },
    mutateAsync: vi.fn().mockRejectedValue(new Error('Test error')),
  })),
}))

import { useQuery, useMutation } from '@tanstack/vue-query'

// Test operations type
type MockOps = typeof OPERATION_INFO
type OperationsWithInfo = operations & MockOps

describe('Error Handler', () => {
  let queryClient: QueryClient
  let realAxiosInstance: AxiosInstance
  let api: ReturnType<typeof useOpenApi<OperationsWithInfo>>
  let axiosMock: ReturnType<typeof vi.fn>
  let useQueryMock: ReturnType<typeof vi.mocked<typeof useQuery>>
  let useMutationMock: ReturnType<typeof vi.mocked<typeof useMutation>>

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })

    realAxiosInstance = axios.create()
    axiosMock = vi.fn()

    // Setup mocked returns
    useQueryMock = vi.mocked(useQuery)
    useMutationMock = vi.mocked(useMutation)

    const mockOperations: OperationsWithInfo = OPERATION_INFO as OperationsWithInfo
    const config: OpenApiConfig<OperationsWithInfo> = {
      operations: mockOperations,
      axios: axiosMock as any,
      queryClient,
    }

    // Setup the composable
    api = useOpenApi(config)
  })

  afterEach(() => {
    vi.clearAllMocks()
    queryClient.clear()
  })

  describe('Query errorHandler', () => {
    it('should call custom errorHandler when query fails and not throw when handled', async () => {
      const errorHandlerMock = vi.fn()
      const testError = new Error('Network error')

      axiosMock.mockRejectedValue(testError)

      let capturedQueryFn: (() => Promise<any>) | undefined

      useQueryMock.mockImplementation((options) => {
        capturedQueryFn = options.queryFn as () => Promise<any>
        return {
          data: { value: null },
          isLoading: { value: false },
          error: { value: null },
          refetch: vi.fn(),
        } as any
      })

      api.useQuery(OperationId.listPets, {
        enabled: true,
        errorHandler: errorHandlerMock,
      })

      // Call the captured queryFn - should not throw when errorHandler is present
      expect(capturedQueryFn).toBeDefined()
      await expect(capturedQueryFn!()).resolves.toBeUndefined()

      // Verify errorHandler was called with the error
      expect(errorHandlerMock).toHaveBeenCalledTimes(1)
      expect(errorHandlerMock).toHaveBeenCalledWith(testError)
    })

    it('should not throw error when errorHandler is present and handles the error', async () => {
      const errorHandlerMock = vi.fn()
      const testError = new Error('Network error')

      axiosMock.mockRejectedValue(testError)

      let capturedQueryFn: (() => Promise<any>) | undefined

      useQueryMock.mockImplementation((options) => {
        capturedQueryFn = options.queryFn as () => Promise<any>
        return {
          data: { value: null },
          isLoading: { value: false },
          error: { value: null },
          refetch: vi.fn(),
        } as any
      })

      api.useQuery(OperationId.listPets, {
        enabled: true,
        errorHandler: errorHandlerMock,
      })

      // Call the captured queryFn - should not throw when errorHandler is present
      expect(capturedQueryFn).toBeDefined()
      await expect(capturedQueryFn!()).resolves.toBeUndefined()

      // Verify errorHandler was called with the error
      expect(errorHandlerMock).toHaveBeenCalledTimes(1)
      expect(errorHandlerMock).toHaveBeenCalledWith(testError)
    })

    it('should throw error when errorHandler can rethrow if desired', async () => {
      const errorHandlerMock = vi.fn().mockImplementation((error) => {
        // ErrorHandler can choose to rethrow
        throw error
      })
      const testError = new Error('Network error')

      axiosMock.mockRejectedValue(testError)

      let capturedQueryFn: (() => Promise<any>) | undefined

      useQueryMock.mockImplementation((options) => {
        capturedQueryFn = options.queryFn as () => Promise<any>
        return {
          data: { value: null },
          isLoading: { value: false },
          error: { value: null },
          refetch: vi.fn(),
        } as any
      })

      api.useQuery(OperationId.listPets, {
        enabled: true,
        errorHandler: errorHandlerMock,
      })

      expect(capturedQueryFn).toBeDefined()
      await expect(capturedQueryFn!()).rejects.toThrow('Network error')
      expect(errorHandlerMock).toHaveBeenCalledTimes(1)
    })

    it('should not call errorHandler when no errors occur', async () => {
      const errorHandlerMock = vi.fn()

      axiosMock.mockResolvedValue({ data: [{ id: 1, name: 'Test Pet' }] })

      let capturedQueryFn: (() => Promise<any>) | undefined

      useQueryMock.mockImplementation((options) => {
        capturedQueryFn = options.queryFn as () => Promise<any>
        return {
          data: { value: [{ id: 1, name: 'Test Pet' }] },
          isLoading: { value: false },
          error: { value: null },
          refetch: vi.fn(),
        } as any
      })

      api.useQuery(OperationId.listPets, {
        enabled: true,
        errorHandler: errorHandlerMock,
      })

      expect(capturedQueryFn).toBeDefined()
      const result = await capturedQueryFn!()
      expect(result).toEqual([{ id: 1, name: 'Test Pet' }])

      // Verify errorHandler was NOT called
      expect(errorHandlerMock).not.toHaveBeenCalled()
    })

    it('should work without errorHandler (no change in behavior)', async () => {
      const testError = new Error('Network error')

      axiosMock.mockRejectedValue(testError)

      let capturedQueryFn: (() => Promise<any>) | undefined

      useQueryMock.mockImplementation((options) => {
        capturedQueryFn = options.queryFn as () => Promise<any>
        return {
          data: { value: null },
          isLoading: { value: false },
          error: { value: null },
          refetch: vi.fn(),
        } as any
      })

      api.useQuery(OperationId.listPets, {
        enabled: true,
        // No errorHandler provided - should still throw error
      })

      expect(capturedQueryFn).toBeDefined()
      await expect(capturedQueryFn!()).rejects.toThrow('Network error')
    })

    it('should support async errorHandler and not throw when handled', async () => {
      const errorHandlerMock = vi.fn().mockResolvedValue(undefined)
      const testError = new Error('Network error')

      axiosMock.mockRejectedValue(testError)

      let capturedQueryFn: (() => Promise<any>) | undefined

      useQueryMock.mockImplementation((options) => {
        capturedQueryFn = options.queryFn as () => Promise<any>
        return {
          data: { value: null },
          isLoading: { value: false },
          error: { value: null },
          refetch: vi.fn(),
        } as any
      })

      api.useQuery(OperationId.listPets, {
        enabled: true,
        errorHandler: errorHandlerMock,
      })

      expect(capturedQueryFn).toBeDefined()
      await expect(capturedQueryFn!()).resolves.toBeUndefined()

      // Verify async errorHandler was called
      expect(errorHandlerMock).toHaveBeenCalledTimes(1)
      expect(errorHandlerMock).toHaveBeenCalledWith(testError)
    })
  })

  describe('Mutation errorHandler', () => {
    it('should call custom errorHandler when mutation fails and not throw when handled', async () => {
      const errorHandlerMock = vi.fn()
      const testError = new Error('Mutation failed')

      axiosMock.mockRejectedValue(testError)

      let capturedMutationFn: ((vars: any) => Promise<any>) | undefined

      useMutationMock.mockImplementation((options) => {
        capturedMutationFn = options.mutationFn as (vars: any) => Promise<any>
        return {
          data: { value: null },
          isLoading: { value: false },
          error: { value: null },
          mutateAsync: vi.fn(),
        } as any
      })

      api.useMutation(OperationId.createPet, {
        errorHandler: errorHandlerMock,
      })

      expect(capturedMutationFn).toBeDefined()
      await expect(
        capturedMutationFn!({
          data: { name: 'Test Pet', status: 'available' },
        }),
      ).resolves.toBeUndefined()

      // Verify errorHandler was called with the error
      expect(errorHandlerMock).toHaveBeenCalledTimes(1)
      expect(errorHandlerMock).toHaveBeenCalledWith(testError)
    })

    it('should not throw error when errorHandler is present and handles the error', async () => {
      const errorHandlerMock = vi.fn()
      const testError = new Error('Mutation failed')

      axiosMock.mockRejectedValue(testError)

      let capturedMutationFn: ((vars: any) => Promise<any>) | undefined

      useMutationMock.mockImplementation((options) => {
        capturedMutationFn = options.mutationFn as (vars: any) => Promise<any>
        return {
          data: { value: null },
          isLoading: { value: false },
          error: { value: null },
          mutateAsync: vi.fn(),
        } as any
      })

      api.useMutation(OperationId.createPet, {
        errorHandler: errorHandlerMock,
      })

      expect(capturedMutationFn).toBeDefined()
      await expect(
        capturedMutationFn!({
          data: { name: 'Test Pet', status: 'available' },
        }),
      ).resolves.toBeUndefined()

      // Verify errorHandler was called with the error
      expect(errorHandlerMock).toHaveBeenCalledTimes(1)
      expect(errorHandlerMock).toHaveBeenCalledWith(testError)
    })

    it('should throw error when errorHandler can rethrow if desired', async () => {
      const errorHandlerMock = vi.fn().mockImplementation((error) => {
        // ErrorHandler can choose to rethrow
        throw error
      })
      const testError = new Error('Mutation failed')

      axiosMock.mockRejectedValue(testError)

      let capturedMutationFn: ((vars: any) => Promise<any>) | undefined

      useMutationMock.mockImplementation((options) => {
        capturedMutationFn = options.mutationFn as (vars: any) => Promise<any>
        return {
          data: { value: null },
          isLoading: { value: false },
          error: { value: null },
          mutateAsync: vi.fn(),
        } as any
      })

      api.useMutation(OperationId.createPet, {
        errorHandler: errorHandlerMock,
      })

      expect(capturedMutationFn).toBeDefined()
      await expect(
        capturedMutationFn!({
          data: { name: 'Test Pet', status: 'available' },
        }),
      ).rejects.toThrow('Mutation failed')

      expect(errorHandlerMock).toHaveBeenCalledTimes(1)
    })

    it('should not call errorHandler when no errors occur', async () => {
      const errorHandlerMock = vi.fn()

      axiosMock.mockResolvedValue({ data: { id: 1, name: 'Test Pet', status: 'available' } })

      let capturedMutationFn: ((vars: any) => Promise<any>) | undefined

      useMutationMock.mockImplementation((options) => {
        capturedMutationFn = options.mutationFn as (vars: any) => Promise<any>
        return {
          data: { value: { id: 1, name: 'Test Pet', status: 'available' } },
          isLoading: { value: false },
          error: { value: null },
          mutateAsync: vi.fn(),
        } as any
      })

      api.useMutation(OperationId.createPet, {
        errorHandler: errorHandlerMock,
      })

      expect(capturedMutationFn).toBeDefined()
      const result = await capturedMutationFn!({
        data: { name: 'Test Pet', status: 'available' },
      })
      expect(result).toEqual({ id: 1, name: 'Test Pet', status: 'available' })

      // Verify errorHandler was NOT called
      expect(errorHandlerMock).not.toHaveBeenCalled()
    })

    it('should work without errorHandler (no change in behavior)', async () => {
      const testError = new Error('Mutation failed')

      axiosMock.mockRejectedValue(testError)

      let capturedMutationFn: ((vars: any) => Promise<any>) | undefined

      useMutationMock.mockImplementation((options) => {
        capturedMutationFn = options.mutationFn as (vars: any) => Promise<any>
        return {
          data: { value: null },
          isLoading: { value: false },
          error: { value: null },
          mutateAsync: vi.fn(),
        } as any
      })

      api.useMutation(OperationId.createPet, {
        // No errorHandler provided - should still throw error
      })

      expect(capturedMutationFn).toBeDefined()
      await expect(
        capturedMutationFn!({
          data: { name: 'Test Pet', status: 'available' },
        }),
      ).rejects.toThrow('Mutation failed')
    })

    it('should support async errorHandler and not throw when handled', async () => {
      const errorHandlerMock = vi.fn().mockResolvedValue(undefined)
      const testError = new Error('Mutation failed')

      axiosMock.mockRejectedValue(testError)

      let capturedMutationFn: ((vars: any) => Promise<any>) | undefined

      useMutationMock.mockImplementation((options) => {
        capturedMutationFn = options.mutationFn as (vars: any) => Promise<any>
        return {
          data: { value: null },
          isLoading: { value: false },
          error: { value: null },
          mutateAsync: vi.fn(),
        } as any
      })

      api.useMutation(OperationId.createPet, {
        errorHandler: errorHandlerMock,
      })

      expect(capturedMutationFn).toBeDefined()
      await expect(
        capturedMutationFn!({
          data: { name: 'Test Pet', status: 'available' },
        }),
      ).resolves.toBeUndefined()

      // Verify async errorHandler was called
      expect(errorHandlerMock).toHaveBeenCalledTimes(1)
      expect(errorHandlerMock).toHaveBeenCalledWith(testError)
    })
  })
})
