import { vi } from 'vitest'

// Mock Vue reactivity functions
export const mockVue = {
  computed: vi.fn((fn) => ({ value: fn() })),
  ref: vi.fn((value) => ({ value })),
  toValue: vi.fn((value) => (typeof value === 'function' ? value() : value)),
  watch: vi.fn(),
}

// Mock TanStack Query
export const mockTanStackQuery = {
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
}

// Mock Axios
export const mockAxios = vi.fn(() => Promise.resolve({ data: { id: '123', name: 'Test' } }))
mockAxios.create = vi.fn(() => mockAxios)
mockAxios.get = vi.fn()
mockAxios.post = vi.fn()
mockAxios.put = vi.fn()
mockAxios.patch = vi.fn()
mockAxios.delete = vi.fn()
mockAxios.head = vi.fn()
mockAxios.options = vi.fn()
mockAxios.request = vi.fn()

// Set up global mocks
vi.mock('vue', () => mockVue)
vi.mock('@tanstack/vue-query', () => mockTanStackQuery)
vi.mock('axios', () => ({ default: mockAxios }))
