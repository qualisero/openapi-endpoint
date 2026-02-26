import { vi } from 'vitest'
import type { AxiosInstance } from 'axios'

/**
 * Callable axios mock. The real implementation calls config.axios(requestConfig)
 * directly — it never calls config.axios.get() or config.axios.post().
 *
 * Tests control responses with:
 *   mockAxios.mockResolvedValueOnce({ data: [...] })
 *   mockAxios.mockRejectedValueOnce(new Error('Network error'))
 *
 * Tests assert calls with:
 *   expect(mockAxios).toHaveBeenCalledWith(expect.objectContaining({
 *     method: 'get', url: '/pets', params: { limit: 10 }
 *   }))
 */
export const mockAxios = vi.fn(() => Promise.resolve({ data: {} })) as unknown as AxiosInstance &
  ReturnType<typeof vi.fn>

// Add properties that some tests expect
;(mockAxios as any).defaults = {
  headers: {
    common: {},
  },
}
;(mockAxios as any).interceptors = {
  request: { use: vi.fn(), eject: vi.fn() },
  response: { use: vi.fn(), eject: vi.fn() },
}

vi.mock('axios', () => ({
  default: mockAxios,
  isAxiosError: vi.fn((e) => e?.isAxiosError === true),
  create: vi.fn(() => mockAxios),
}))
