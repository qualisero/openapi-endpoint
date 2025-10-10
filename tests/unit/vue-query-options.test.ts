import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useEndpointQuery } from '@/openapi-query'
import { useEndpointMutation } from '@/openapi-mutation'
import { getHelpers } from '@/openapi-helpers'
import { OpenApiConfig } from '@/types'
import { mockAxios } from '../setup'
import { useOpenApi } from '@/index'

import { OperationId, OPERATION_INFO } from '../fixtures/api-operations'
import { type operations } from '../fixtures/openapi-types'

type MockOps = typeof OPERATION_INFO
type OperationsWithInfo = operations & MockOps
const mockOperations: OperationsWithInfo = OPERATION_INFO as OperationsWithInfo

describe('Vue Query Options Support', () => {
  let mockConfig: OpenApiConfig<OperationsWithInfo>
  let helpers: ReturnType<typeof getHelpers<OperationsWithInfo>>

  beforeEach(() => {
    vi.clearAllMocks()

    mockConfig = {
      operations: mockOperations,
      axios: mockAxios,
    }
    helpers = getHelpers(mockConfig)
  })

  describe('Query Options Type Support', () => {
    it('should accept staleTime option without typing errors', () => {
      // This test verifies that Vue Query options like staleTime are properly typed
      const query = useEndpointQuery(
        OperationId.listPets,
        helpers,
        {},
        {
          staleTime: 1000, // This should not cause a typing error
          retry: 2, // This should not cause a typing error
          refetchOnWindowFocus: false, // This should not cause a typing error
        },
      )

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('data')
      expect(query).toHaveProperty('isLoading')
    })

    it('should accept staleTime with custom options', () => {
      const onLoad = vi.fn()

      // This test verifies that Vue Query options work alongside custom options
      const query = useEndpointQuery(
        OperationId.listPets,
        helpers,
        {},
        {
          staleTime: 2000,
          retry: false,
          refetchOnMount: true,
          onLoad: onLoad,
          axiosOptions: { headers: { 'X-Test': 'value' } },
        },
      )

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('onLoad')
    })

    it('should accept staleTime with path parameters', () => {
      // This test verifies that Vue Query options work with parameterized queries
      const query = useEndpointQuery(
        OperationId.getPet,
        helpers,
        { petId: '123' },
        {
          staleTime: 3000,
          refetchInterval: 10000,
          enabled: true,
        },
      )

      expect(query).toBeTruthy()
      expect(query).toHaveProperty('queryKey')
    })
  })

  describe('Mutation Options Type Support', () => {
    it('should accept Vue Query mutation options without typing errors', () => {
      // This test verifies that mutation options from Vue Query are properly typed
      const mutation = useEndpointMutation(
        OperationId.createPet,
        helpers,
        {},
        {
          retry: 1,
          retryDelay: 500,
          useErrorBoundary: false,
          onSuccess: vi.fn(),
          onError: vi.fn(),
          onSettled: vi.fn(),
          onMutate: vi.fn(),
          meta: { operation: 'create' },
        },
      )

      expect(mutation).toBeTruthy()
      expect(mutation).toHaveProperty('mutate')
      expect(mutation).toHaveProperty('mutateAsync')
    })
  })

  describe('Real API Integration', () => {
    it('should accept Vue Query options through the main API - reproduces exact issue from problem statement', () => {
      // This reproduces the exact scenario from the problem statement
      const api = useOpenApi({
        operations: mockOperations,
        axios: mockAxios,
      })

      // This should work but was failing before the fix
      const currentUser = api.useQuery(OperationId.listPets, {
        onLoad: () => console.log('loaded'),
        staleTime: 1000, // ← This was causing a typing error in the original issue
        retry: 2,
        refetchOnWindowFocus: false,
      })

      expect(currentUser).toBeTruthy()
      expect(currentUser).toHaveProperty('data')
    })

    it('should work with path parameters and Vue Query options through main API', () => {
      const api = useOpenApi({
        operations: mockOperations,
        axios: mockAxios,
      })

      const pet = api.useQuery(
        OperationId.getPet,
        { petId: '123' },
        {
          staleTime: 2000,
          enabled: true,
          refetchInterval: 5000,
          onLoad: (data) => console.log('Pet loaded:', data),
        },
      )

      expect(pet).toBeTruthy()
      expect(pet).toHaveProperty('queryKey')
    })

    it('should work with mutations and Vue Query options through main API', () => {
      const api = useOpenApi({
        operations: mockOperations,
        axios: mockAxios,
      })

      const createPet = api.useMutation(OperationId.createPet, {
        retry: 1,
        onSuccess: (data) => console.log('Created pet:', data),
        onError: (error) => console.error('Error creating pet:', error),
        retryDelay: 1000,
      })

      expect(createPet).toBeTruthy()
      expect(createPet).toHaveProperty('mutate')
    })
  })
})
