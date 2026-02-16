import { vi } from 'vitest'
import type { AxiosInstance } from 'axios'

// Mock Axios before any other imports
const mockAxiosInstance = {
  get: vi.fn(() => Promise.resolve({ data: {} })),
  post: vi.fn(() => Promise.resolve({ data: {} })),
  put: vi.fn(() => Promise.resolve({ data: {} })),
  patch: vi.fn(() => Promise.resolve({ data: {} })),
  delete: vi.fn(() => Promise.resolve({ data: {} })),
  head: vi.fn(() => Promise.resolve({ data: {} })),
  options: vi.fn(() => Promise.resolve({ data: {} })),
  request: vi.fn(() => Promise.resolve({ data: {} })),
  interceptors: {
    request: { use: vi.fn(), eject: vi.fn() },
    response: { use: vi.fn(), eject: vi.fn() },
  },
  defaults: { headers: { common: {} } },
} as unknown as AxiosInstance

// Set up mocks at the top level before any imports
vi.mock('axios', () => ({
  default: mockAxiosInstance,
  create: vi.fn(() => mockAxiosInstance),
}))

vi.mock('vue', () => {
  // Create a more realistic mock for Vue reactivity
  const createReactiveRef = (initialValue: any) => {
    let value = initialValue
    const reactiveRef = {
      get value() {
        return value
      },
      set value(newValue) {
        value = newValue
      },
    }
    return reactiveRef
  }

  const createComputed = (fn: () => any) => {
    // For testing purposes, create a computed that recalculates on access
    return {
      get value() {
        return fn()
      },
    }
  }

  const toValueImpl = (value: any): any => {
    if (typeof value === 'function') {
      return value()
    }
    if (value && typeof value === 'object' && 'value' in value) {
      return value.value
    }
    return value
  }

  return {
    computed: vi.fn(createComputed),
    ref: vi.fn(createReactiveRef),
    toValue: vi.fn(toValueImpl),
    watch: vi.fn(),
  }
})

vi.mock('@tanstack/vue-query', () => ({
  QueryClient: vi.fn(() => ({
    getQueryData: vi.fn(),
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
    cancelQueries: vi.fn(),
    refetchQueries: vi.fn(),
  })),
  useQuery: vi.fn(() => ({
    data: { value: null },
    isLoading: { value: false },
    error: { value: null },
    refetch: vi.fn(),
  })),
  useMutation: vi.fn((options: any) => {
    // Store the mutationFn so we can call it
    const mutationFn = options?.mutationFn
    
    return {
      mutate: vi.fn((vars: any, mutateOptions?: any) => {
        if (mutationFn) {
          mutationFn(vars).catch((err: any) => {
            if (mutateOptions?.onError) {
              mutateOptions.onError(err)
            }
          })
        }
      }),
      mutateAsync: vi.fn((vars: any) => {
        // If no mutationFn or it fails, return default response
        if (!mutationFn) {
          return Promise.resolve({})
        }
        return mutationFn(vars).catch((err: any) => {
          // If error is about missing axios, return default response
          // Otherwise, propagate the error
          if (err?.message?.includes('axios is not a function')) {
            return {}
          }
          throw err
        })
      }),
      data: { value: null },
      isLoading: { value: false },
      error: { value: null },
    }
  }),
}))

// Export for use in tests if needed
export const mockAxios = mockAxiosInstance
