import { vi, expect } from 'vitest'
import { useOpenApi } from '@/index'
import { OpenApiConfig, type OpenApiInstance } from '@/types'
import { mockAxios } from './setup'
import { OperationId, openApiOperations, type OpenApiOperations } from './fixtures/openapi-typed-operations'

/**
 * Shared Test Utilities and Fixtures
 *
 * This file provides common setup patterns and utilities used across multiple test files
 * to reduce duplication and ensure consistency.
 */

/**
 * Creates a standard API instance with mock configuration
 */
export function createTestApiInstance(): {
  api: OpenApiInstance<OpenApiOperations>
  mockConfig: OpenApiConfig<OpenApiOperations>
} {
  vi.clearAllMocks()

  const mockConfig: OpenApiConfig<OpenApiOperations> = {
    operations: openApiOperations,
    axios: mockAxios,
  }

  const api = useOpenApi(mockConfig)

  return { api, mockConfig }
}

/**
 * Common test data and fixtures
 */
export const testFixtures = {
  // Sample pet data
  petData: {
    name: 'Test Pet',
    breed: 'Labrador',
    age: 3,
  },

  // Sample form data
  createFormData: () => {
    const formData = new FormData()
    formData.append('name', 'Test Pet')
    formData.append('file', new Blob(['test content'], { type: 'text/plain' }), 'test.txt')
    return formData
  },

  // Common headers
  headers: {
    auth: {
      Authorization: 'Bearer test-token',
      'X-API-Key': 'test-api-key',
    },
    contentType: {
      json: { 'Content-Type': 'application/json' },
      xml: { 'Content-Type': 'application/xml' },
      multipart: { 'Content-Type': 'multipart/form-data' },
    },
    custom: {
      'X-Test-Header': 'test-value',
      'X-Source': 'unit-test',
    },
  },

  // Common axios options
  axiosOptions: {
    timeout: {
      short: 5000,
      medium: 15000,
      long: 30000,
    },
    retry: {
      none: 0,
      low: 2,
      medium: 3,
      high: 5,
    },
  },

  // Common TanStack Query options
  queryOptions: {
    staleTime: {
      short: 10000, // 10 seconds
      medium: 60000, // 1 minute
      long: 300000, // 5 minutes
    },
    retry: {
      none: 0,
      standard: 3,
      aggressive: 5,
    },
  },
}

/**
 * Common test patterns and assertions
 */
export const testPatterns = {
  /**
   * Asserts that a query result has the expected properties
   */
  assertQueryResult: (query: any) => {
    expect(query).toBeTruthy()
    expect(query).toHaveProperty('data')
    expect(query).toHaveProperty('isLoading')
    expect(query).toHaveProperty('queryKey')
    expect(query).toHaveProperty('isEnabled')
  },

  /**
   * Asserts that a mutation result has the expected properties
   */
  assertMutationResult: (mutation: any) => {
    expect(mutation).toBeTruthy()
    expect(mutation).toHaveProperty('mutate')
    expect(mutation).toHaveProperty('mutateAsync')
    expect(mutation).toHaveProperty('data')
    expect(mutation).toHaveProperty('error')
    expect(mutation).toHaveProperty('isEnabled')
    expect(typeof mutation.mutate).toBe('function')
    expect(typeof mutation.mutateAsync).toBe('function')
  },

  /**
   * Asserts that an endpoint automatically detected as query has query properties
   */
  assertQueryEndpoint: (endpoint: any) => {
    expect(endpoint).toHaveProperty('data')
    expect(endpoint).toHaveProperty('isLoading')
    expect(endpoint).toHaveProperty('refetch')
    expect(endpoint).not.toHaveProperty('mutate')
    expect(endpoint).not.toHaveProperty('mutateAsync')
  },

  /**
   * Asserts that an endpoint automatically detected as mutation has mutation properties
   */
  assertMutationEndpoint: (endpoint: any) => {
    expect(endpoint).toHaveProperty('mutate')
    expect(endpoint).toHaveProperty('mutateAsync')
    expect(endpoint).toHaveProperty('data')
    expect(endpoint).toHaveProperty('error')
    expect(endpoint).toHaveProperty('isEnabled')
  },

  /**
   * Tests that a function doesn't throw when called
   */
  assertNoThrow: (fn: () => void) => {
    expect(fn).not.toThrow()
  },

  /**
   * Tests that an async function resolves without throwing
   */
  assertAsyncResolves: async (asyncFn: () => Promise<any>) => {
    await expect(asyncFn()).resolves.toBeDefined()
  },
}

/**
 * Mock functions commonly used in tests
 */
export const createMockFunctions = () => ({
  onLoad: vi.fn(),
  onSuccess: vi.fn(),
  onError: vi.fn(),
  onSettled: vi.fn(),
  errorHandler: vi.fn(),
  selectFn: vi.fn((data) => data),
  transformRequest: vi.fn((data) => JSON.stringify(data)),
  transformResponse: vi.fn((data) => JSON.parse(data)),
  validateStatus: vi.fn((status: number) => status >= 200 && status < 300),
  onUploadProgress: vi.fn((progressEvent) => {
    console.log('Upload progress:', progressEvent)
  }),
  onDownloadProgress: vi.fn((progressEvent) => {
    console.log('Download progress:', progressEvent)
  }),
  customRetry: vi.fn(() => false),
  paramsSerializer: vi.fn((params) => new URLSearchParams(params).toString()),
})

/**
 * Test scenarios for common patterns
 */
export const testScenarios = {
  /**
   * Standard query test scenario
   */
  basicQuery: (api: OpenApiInstance<OpenApiOperations>) => {
    const query = api.useQuery(OperationId.listPets)
    testPatterns.assertQueryResult(query)
    return query
  },

  /**
   * Query with path parameters test scenario
   */
  queryWithParams: (api: OpenApiInstance<OpenApiOperations>, petId = '123') => {
    const query = api.useQuery(OperationId.getPet, { petId })
    testPatterns.assertQueryResult(query)
    expect(query.queryKey.value).toEqual(['pets', petId])
    return query
  },

  /**
   * Standard mutation test scenario
   */
  basicMutation: (api: OpenApiInstance<OpenApiOperations>) => {
    const mutation = api.useMutation(OperationId.createPet)
    testPatterns.assertMutationResult(mutation)
    return mutation
  },

  /**
   * Mutation with path parameters test scenario
   */
  mutationWithParams: (api: OpenApiInstance<OpenApiOperations>, petId = '123') => {
    const mutation = api.useMutation(OperationId.updatePet, { petId })
    testPatterns.assertMutationResult(mutation)
    expect(mutation.isEnabled.value).toBe(true)
    return mutation
  },
}

/**
 * Common test data for different operation types
 */
export const operationExamples = {
  queries: {
    simple: OperationId.listPets,
    withParams: OperationId.getPet,
    nested: OperationId.listUserPets,
  },
  mutations: {
    create: OperationId.createPet,
    update: OperationId.updatePet,
    delete: OperationId.deletePet,
  },
}

/**
 * Common axios configuration examples
 */
export const axiosConfigExamples = {
  basic: {
    timeout: testFixtures.axiosOptions.timeout.medium,
    headers: testFixtures.headers.custom,
  },

  authentication: {
    headers: testFixtures.headers.auth,
    withCredentials: true,
  },

  upload: {
    timeout: testFixtures.axiosOptions.timeout.long,
    headers: testFixtures.headers.contentType.multipart,
    onUploadProgress: createMockFunctions().onUploadProgress,
  },

  advanced: {
    timeout: testFixtures.axiosOptions.timeout.medium,
    maxContentLength: 2000,
    maxBodyLength: 1000,
    responseType: 'json' as const,
    validateStatus: createMockFunctions().validateStatus,
  },
}

export { OperationId, openApiOperations, type OpenApiOperations }
