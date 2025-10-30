import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useOpenApi } from '@/index'
import { OpenApiConfig, type OpenApiInstance } from '@/types'
import { OperationId, openApiOperations, type OpenApiOperations } from '../fixtures/openapi-typed-operations'
import type { AxiosInstance } from 'axios'

/**
 * Test for mutation invalidation bug
 * 
 * Issue: When using a list endpoint composable (eg `/pet/`), mutating an individual 
 * entry (eg `/pet/<id>`), correctly triggers `invalidateQueries` on the list endpoint 
 * (`/pet/`), but somehow, this directly triggers an axios reload of the query without 
 * going through the queryFn, resulting in returning a http object instead of `data`
 */
describe('Mutation Invalidation Bug', () => {
  let mockAxios: AxiosInstance
  let mockConfig: OpenApiConfig<OpenApiOperations>
  let api: OpenApiInstance<OpenApiOperations>
  let queryClientMock: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Create a real mock axios that we can spy on
    mockAxios = {
      request: vi.fn(async (config) => {
        // Mock response based on URL
        if (config.url?.includes('/pets') && !config.url?.includes('{')) {
          // List endpoint
          return {
            data: [{ id: '1', name: 'Pet 1' }, { id: '2', name: 'Pet 2' }],
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
          }
        } else if (config.url?.match(/\/pets\/\d+/)) {
          // Single pet endpoint
          return {
            data: { id: '1', name: 'Updated Pet' },
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
          }
        }
        return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
      }),
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      head: vi.fn(),
      options: vi.fn(),
      interceptors: {
        request: { use: vi.fn(), eject: vi.fn() },
        response: { use: vi.fn(), eject: vi.fn() },
      },
      defaults: { headers: { common: {} } },
    } as unknown as AxiosInstance

    // Create a mock QueryClient that tracks what data is set
    const queryDataStore = new Map<string, any>()
    queryClientMock = {
      getQueryData: vi.fn((queryKey: unknown[]) => {
        const key = JSON.stringify(queryKey)
        return queryDataStore.get(key)
      }),
      setQueryData: vi.fn((queryKey: unknown[], data: unknown) => {
        const key = JSON.stringify(queryKey)
        console.log('setQueryData called with key:', key, 'data:', data)
        queryDataStore.set(key, data)
      }),
      invalidateQueries: vi.fn(async () => {
        console.log('invalidateQueries called')
      }),
      cancelQueries: vi.fn(async () => {
        console.log('cancelQueries called')
      }),
    }

    mockConfig = {
      operations: openApiOperations,
      axios: mockAxios,
      queryClient: queryClientMock,
    }
    api = useOpenApi(mockConfig)
  })

  it('should reproduce the bug where mutation invalidation returns axios response instead of data', async () => {
    // Step 1: Create a list query
    const listQuery = api.useQuery(OperationId.listPets)
    
    // Step 2: Create a mutation for updating a pet
    const updatePetMutation = api.useMutation(OperationId.updatePet, { petId: '1' })
    
    // Step 3: Execute the mutation
    const result = await updatePetMutation.mutateAsync({
      data: { name: 'Updated Pet' },
    })
    
    console.log('Mutation result:', result)
    console.log('Mutation result.data:', result?.data)
    
    // Check what was called on queryClient.setQueryData
    expect(queryClientMock.setQueryData).toHaveBeenCalled()
    
    // Get the calls to setQueryData
    const setQueryDataCalls = queryClientMock.setQueryData.mock.calls
    console.log('setQueryData calls:', setQueryDataCalls)
    
    // Check if the data set is the correct format (should be just data, not axios response)
    for (const call of setQueryDataCalls) {
      const [_, data] = call
      console.log('Data set in cache:', data)
      
      // The bug would be if data has axios response properties like status, headers, config
      expect(data).not.toHaveProperty('status')
      expect(data).not.toHaveProperty('headers')
      expect(data).not.toHaveProperty('config')
      expect(data).not.toHaveProperty('statusText')
    }
  })

  it('should verify queryFn returns data not axios response', async () => {
    // Mock axios to track what it returns
    const axiosCallSpy = vi.fn(async (config) => {
      return {
        data: [{ id: '1', name: 'Pet 1' }],
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      }
    })
    
    mockAxios.request = axiosCallSpy
    
    // Create query
    const listQuery = api.useQuery(OperationId.listPets)
    
    // The query should have called axios
    // In the actual implementation, useQuery's queryFn should extract .data from axios response
    expect(listQuery).toHaveProperty('data')
    expect(listQuery.data).toBeDefined()
  })
})
