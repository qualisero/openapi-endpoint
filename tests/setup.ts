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
  useMutation: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(() => Promise.resolve({})),
    data: { value: null },
    isLoading: { value: false },
    error: { value: null },
  })),
}))

// Export for use in tests if needed
export const mockAxios = mockAxiosInstance
