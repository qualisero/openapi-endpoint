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
} as unknown as AxiosInstance

// Set up mocks at the top level before any imports
vi.mock('axios', () => ({
  default: mockAxiosInstance,
  create: vi.fn(() => mockAxiosInstance),
}))

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
  })),
  useQuery: vi.fn(() => ({
    data: { value: null },
    isLoading: { value: false },
    error: { value: null },
    refetch: vi.fn(),
  })),
  useMutation: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    data: { value: null },
    isLoading: { value: false },
    error: { value: null },
  })),
}))

// Export for use in tests if needed
export const mockAxios = mockAxiosInstance
