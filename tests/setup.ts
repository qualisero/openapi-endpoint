import { vi } from 'vitest'

// Mock Axios before any other imports
const mockAxiosInstance = vi.fn(() => Promise.resolve({ data: { id: '123', name: 'Test' } }))
mockAxiosInstance.create = vi.fn(() => mockAxiosInstance)
mockAxiosInstance.get = vi.fn(() => Promise.resolve({ data: {} }))
mockAxiosInstance.post = vi.fn(() => Promise.resolve({ data: {} }))
mockAxiosInstance.put = vi.fn(() => Promise.resolve({ data: {} }))
mockAxiosInstance.patch = vi.fn(() => Promise.resolve({ data: {} }))
mockAxiosInstance.delete = vi.fn(() => Promise.resolve({ data: {} }))
mockAxiosInstance.head = vi.fn(() => Promise.resolve({ data: {} }))
mockAxiosInstance.options = vi.fn(() => Promise.resolve({ data: {} }))
mockAxiosInstance.request = vi.fn(() => Promise.resolve({ data: {} }))

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
