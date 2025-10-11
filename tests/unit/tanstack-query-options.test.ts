import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useOpenApi } from '@/index'
import { OpenApiConfig, type OpenApiInstance } from '@/types'
import { mockAxios } from '../setup'
import { OperationId, openApiOperations, type OpenApiOperations } from '../fixtures/openapi-typed-operations'

describe('TanStack Query Options Integration', () => {
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

  describe('Query-specific TanStack options', () => {
    it('should support staleTime configuration', () => {
      const query = api.useQuery(OperationId.listPets, {
        staleTime: 10000, // 10 seconds
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })

    it('should support retry configuration', () => {
      const customRetry = vi.fn(() => false)
      const query = api.useQuery(OperationId.listPets, {
        retry: customRetry,
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })

    it('should support refetchOnWindowFocus configuration', () => {
      const query = api.useQuery(OperationId.listPets, {
        refetchOnWindowFocus: false,
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })

    it('should support select data transformation', () => {
      const selectFn = vi.fn((data) => data)
      const query = api.useQuery(OperationId.listPets, {
        select: selectFn,
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })

    it('should support initialData configuration', () => {
      const query = api.useQuery(OperationId.listPets, {
        initialData: undefined,
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })

    it('should support placeholderData configuration', () => {
      const query = api.useQuery(OperationId.listPets, {
        placeholderData: undefined,
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })
  })

  describe('Mutation-specific TanStack options', () => {
    it('should support retry configuration for mutations', () => {
      const customRetry = vi.fn(() => false)
      const mutation = api.useMutation(OperationId.createPet, {
        retry: customRetry,
      })

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })

    it('should support onSuccess callback', () => {
      const onSuccess = vi.fn()
      const mutation = api.useMutation(OperationId.createPet, {
        onSuccess,
      })

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })

    it('should support onError callback', () => {
      const onError = vi.fn()
      const mutation = api.useMutation(OperationId.createPet, {
        onError,
      })

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })

    it('should support onSettled callback', () => {
      const onSettled = vi.fn()
      const mutation = api.useMutation(OperationId.createPet, {
        onSettled,
      })

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })

    it('should support meta data configuration', () => {
      const meta = { description: 'Creating a new pet' }
      const mutation = api.useMutation(OperationId.createPet, {
        meta,
      })

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })
  })

  describe('Cache invalidation options', () => {
    it('should support invalidateOperations configuration', () => {
      const mutation = api.useMutation(OperationId.createPet, {
        invalidateOperations: [OperationId.listPets],
      })

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })

    it('should support complex invalidateOperations with path parameters', () => {
      const mutation = api.useMutation(
        OperationId.updatePet,
        { petId: '123' },
        {
          invalidateOperations: {
            [OperationId.getPet]: { petId: '123' },
            [OperationId.listPets]: {},
          },
        },
      )

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })

    it('should support dontInvalidate flag', () => {
      const mutation = api.useMutation(OperationId.createPet, {
        dontInvalidate: true,
      })

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })

    it('should support dontUpdateCache flag', () => {
      const mutation = api.useMutation(OperationId.createPet, {
        dontUpdateCache: true,
      })

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })
  })

  describe('Error handler functionality', () => {
    it('should support custom error handler in queries', () => {
      const errorHandler = vi.fn()
      const query = api.useQuery(OperationId.listPets, {
        errorHandler,
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })

    it('should support custom error handler in mutations', () => {
      const errorHandler = vi.fn()
      const mutation = api.useMutation(OperationId.createPet, {
        errorHandler,
      })

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })

    it('should support async error handler', () => {
      const errorHandler = vi.fn().mockResolvedValue(undefined)
      const query = api.useQuery(OperationId.listPets, {
        errorHandler,
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })
  })

  describe('onLoad callback functionality', () => {
    it('should support onLoad callback for immediate data access', () => {
      const onLoad = vi.fn()
      const query = api.useQuery(OperationId.listPets, {
        onLoad,
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('onLoad')
      expect(typeof query.onLoad).toBe('function')
    })

    it('should support onLoad callback with path parameters', () => {
      const onLoad = vi.fn()
      const query = api.useQuery(
        OperationId.getPet,
        { petId: '123' },
        {
          onLoad,
        },
      )

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('onLoad')
      expect(typeof query.onLoad).toBe('function')
    })
  })

  describe('Enabled state control', () => {
    it('should support boolean enabled state', () => {
      const query = api.useQuery(OperationId.listPets, {
        enabled: false,
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('isEnabled')
      expect(query.isEnabled.value).toBe(false)
    })

    it('should support reactive enabled state', () => {
      // In a real scenario, this would be a ref or computed
      const enabled = true
      const query = api.useQuery(OperationId.listPets, {
        enabled,
      })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('isEnabled')
    })

    it('should automatically disable queries with unresolved path parameters', () => {
      const query = api.useQuery(OperationId.getPet, { petId: undefined })

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('isEnabled')
      expect(query.isEnabled.value).toBe(false)
    })
  })
})
