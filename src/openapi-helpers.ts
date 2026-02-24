import { QueryClient } from '@tanstack/vue-query'

/**
 * Default QueryClient with sensible defaults (5-minute stale time).
 * Used when no custom QueryClient is provided to the generated `createApiClient`.
 */
export const defaultQueryClient: QueryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5 },
  },
})
