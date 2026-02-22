import { QueryClient } from '@tanstack/vue-query'
import type { QueryClientLike } from './types'

/**
 * Default QueryClient with sensible defaults (5-minute stale time).
 * Used when no custom QueryClient is provided to the generated `createApiClient`.
 */
export const defaultQueryClient: QueryClientLike = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5 },
  },
})
