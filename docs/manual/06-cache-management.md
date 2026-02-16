# Cache Management

This guide covers cache management strategies with `@qualisero/openapi-endpoint` and TanStack Query.

## Automatic Cache Management

By default, the library provides intelligent cache management for queries and mutations:

### Query Caching

Queries automatically cache their results based on:

- **Query key** - Unique identifier based on resolved path segments and query parameters
- **Stale time** - How long data is considered fresh
- **Cache time** - How long data stays in memory

```typescript
import { api } from './api/init'
import { OperationId } from './api/generated/api-operations'

const { data: pets } = api.useQuery(OperationId.listPets)

// First call: fetches from API
// Second call (with same params): returns cached data immediately
```

### Mutation Cache Updates

Mutations automatically:

1. **Update cache** - Insert returned data into matching cache entries
2. **Invalidate queries** - Mark related queries as stale
3. **Trigger refetch** - Stale queries automatically refetch

```typescript
const createPet = api.useMutation(OperationId.createPet)

await createPet.mutateAsync({
  data: { name: 'Fluffy', species: 'cat' },
})

// After mutation:
// - New pet is in cache
// - listPets query is invalidated and refetches
```

## Cache Configuration

### Stale Time

`staleTime` determines how long data is considered "fresh":

```typescript
import { OperationId } from './api/generated/api-operations'

const { data: pets } = api.useQuery(
  OperationId.listPets,
  {},
  {
    staleTime: 60 * 1000, // 1 minute
  },
)

// Within 1 minute: returns cached data immediately
// After 1 minute: data is stale, may refetch on window focus/reconnect
```

**Common stale times:**

- `0` - Always consider data stale (refetch frequently)
- `5 * 60 * 1000` (5 min) - Good for frequently changing data
- `Infinity` - Never refetch automatically (manual control only)

### Garbage Collection Time (gcTime)

`gcTime` (formerly `cacheTime`) determines how long data stays in memory:

```typescript
import { OperationId } from './api/generated/api-operations'

const { data: pets } = api.useQuery(
  OperationId.listPets,
  {},
  {
    gcTime: 10 * 60 * 1000, // 10 minutes
  },
)

// Data removed from memory 10 minutes after becoming inactive
```

### Default Configuration

Set defaults for all queries:

```typescript
import { useOpenApi, queryClient } from '@qualisero/openapi-endpoint'
import { QueryClient } from '@tanstack/vue-query'

const customQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 3,
    },
  },
})

const api = useOpenApi<OpenApiOperations>({
  operations: openApiOperations,
  axios: axiosInstance,
  queryClient: customQueryClient,
})
```

## Manual Cache Control

### Manual Refetch

```typescript
const { data: pets, refetch } = api.useQuery(OperationId.listPets)

// Manually trigger refetch
refetch()
```

### Manual Invalidation

```typescript
import { queryClient } from '@qualisero/openapi-endpoint'
import { api } from './api/init'
import { OperationId } from './api/generated/api-operations'

const petsQuery = api.useQuery(OperationId.listPets)

// Invalidate specific queries by key
queryClient.invalidateQueries({ queryKey: petsQuery.queryKey.value })

// Invalidate all queries
queryClient.invalidateQueries()

// Invalidate with filters
queryClient.invalidateQueries({
  queryKey: petsQuery.queryKey.value,
  type: 'active', // Only invalidate active queries
})
```

### Set Query Data

```typescript
import { queryClient } from '@qualisero/openapi-endpoint'
import { api } from './api/init'
import { OperationId } from './api/generated/api-operations'

const petQuery = api.useQuery(OperationId.getPet, { petId: '123' })

// Manually set data in cache
queryClient.setQueryData(petQuery.queryKey.value, {
  id: '123',
  name: 'Fluffy',
  species: 'cat',
})

// Useful for optimistic updates or serverless updates
```

### Get Query Data

```typescript
import { queryClient } from '@qualisero/openapi-endpoint'
import { api } from './api/init'
import { OperationId } from './api/generated/api-operations'

const petsQuery = api.useQuery(OperationId.listPets)

// Read cached data
const cachedPets = queryClient.getQueryData(petsQuery.queryKey.value)

if (cachedPets) {
  console.log('Pets from cache:', cachedPets)
}
```

## Mutation Cache Options

### Disable Automatic Invalidation

```typescript
import { OperationId } from './api/generated/api-operations'

const updatePet = api.useMutation(
  OperationId.updatePet,
  { petId: '123' },
  {
    dontInvalidate: true, // Don't auto-invalidate any queries
  },
)
```

### Disable Automatic Cache Updates

```typescript
import { OperationId } from './api/generated/api-operations'

const updatePet = api.useMutation(
  OperationId.updatePet,
  { petId: '123' },
  {
    dontUpdateCache: true, // Don't update cache with mutation result
  },
)
```

### Specify Operations to Invalidate

```typescript
import { OperationId } from './api/generated/api-operations'

const createPet = api.useMutation(
  OperationId.createPet,
  { userId: '123' },
  {
    invalidateOperations: [
      OperationId.listPets, // Invalidate specific operations
      OperationId.getUserPets,
      OperationId.getPet, // Won't auto-detect, manually specified
    ],
  },
)
```

### Refetch Specific Endpoints

```typescript
import { OperationId } from './api/generated/api-operations'

const petListQuery = api.useQuery(OperationId.listPets)
const userPetsQuery = api.useQuery(OperationId.getUserPets, { userId: '123' })

const createPet = api.useMutation(
  OperationId.createPet,
  {},
  {
    refetchEndpoints: [
      petListQuery, // Refetch these specific endpoints
      userPetsQuery,
    ],
  },
)
```

## Optimistic Updates

Optimistic updates show UI changes immediately, then rollback if the mutation fails.

### Basic Optimistic Update

```typescript
import { api, queryClient } from './api/init'
import { OperationId } from './api/generated/api-operations'

const petQueryKey = ['pets', '123']

const updatePet = api.useMutation(
  OperationId.updatePet,
  { petId: '123' },
  {
    onMutate: async (variables) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: petQueryKey })

      // Snapshot previous value
      const previousPet = queryClient.getQueryData(petQueryKey)

      // Optimistically update
      queryClient.setQueryData(petQueryKey, (old: any) => ({
        ...old,
        ...variables.data,
      }))

      // Return context with snapshot
      return { previousPet }
    },

    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousPet) {
        queryClient.setQueryData(petQueryKey, context.previousPet)
      }
    },

    onSettled: () => {
      // Refetch on completion (success or error)
      queryClient.invalidateQueries({ queryKey: petQueryKey })
    },
  },
)

await updatePet.mutateAsync({
  data: { name: 'Updated Name' },
})
```

### Optimistic List Update

```typescript
import { api, queryClient } from './api/init'
import { OperationId } from './api/generated/api-operations'

const listQueryKey = ['pets']

const createPet = api.useMutation(
  OperationId.createPet,
  {},
  {
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: listQueryKey })

      const previousPets = queryClient.getQueryData(listQueryKey)

      // Optimistically add new item
      queryClient.setQueryData(listQueryKey, (old: any) => [...old, { id: 'temp', ...variables.data }])

      return { previousPets }
    },

    onError: (error, variables, context) => {
      if (context?.previousPets) {
        queryClient.setQueryData(listQueryKey, context.previousPets)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: listQueryKey })
    },
  },
)
```

## Advanced Cache Strategies

### Prefetching Data

Load data before it's needed:

```typescript
import { api, queryClient } from './api/init'
import { OperationId } from './api/generated/api-operations'

// Prefetch on hover
const handleMouseEnter = () => {
  queryClient.prefetchQuery({
    queryKey: ['pets', '123'],
    queryFn: async () => {
      const result = await api.useQuery(OperationId.getPet, { petId: '123' })
      return result.data.value
    },
    staleTime: 60 * 1000, // Fresh for 1 minute
  })
}
```

### Pagination Cache Management

```typescript
import { api, queryClient } from './api/init'

const page = ref(1)

const { data: pets } = api.useQuery(OperationId.listPets, {
  queryParams: computed(() => ({
    page: page.value,
    limit: 20,
  })),
})

// Load next page and keep previous pages in cache
const loadNextPage = () => {
  const nextPage = page.value + 1

  // Prefetch next page
  queryClient.prefetchQuery({
    queryKey: ['pets', { page: nextPage, limit: 20 }],
    queryFn: async () => {
      const result = await api.useQuery(OperationId.listPets, {
        queryParams: { page: nextPage, limit: 20 },
      })
      return result.data.value
    },
  })

  page.value = nextPage // Now the next page is already cached!
}
```

### Server-Side Updates Without Refetch

```typescript
import { api, queryClient } from './api/init'
import { OperationId } from './api/generated/api-operations'

const petQueryKey = ['pets', '123']
const listQueryKey = ['pets']

const updatePet = api.useMutation(
  OperationId.updatePet,
  { petId: '123' },
  {
    dontInvalidate: true, // Don't refetch
    dontUpdateCache: true, // Don't use mutation result

    onSuccess: (data, variables) => {
      // Manually update specific cache entry
      queryClient.setQueryData(petQueryKey, (old: any) => ({
        ...old,
        ...variables.data,
        ...data, // Merge with server response
      }))

      // Invalidate other dependent queries
      queryClient.invalidateQueries({ queryKey: listQueryKey })
    },
  },
)
```

## Cache Debugging

### Monitor Cache State

```typescript
import { queryClient } from '@qualisero/openapi-endpoint'

// Get all cached queries
const cacheData = queryClient.getQueryCache().getAll()

cacheData.forEach((query) => {
  console.log('Query:', query.queryKey)
  console.log('State:', query.state)
  console.log('Observers:', query.getObserversCount())
})
```

### Clear Cache

```typescript
import { queryClient } from '@qualisero/openapi-endpoint'

// Clear all cache
queryClient.clear()

// Clear specific queries
queryClient.removeQueries({ queryKey: ['pets'] })

// Clear inactive queries
queryClient.removeQueries({ type: 'inactive' })
```

## Best Practices

1. **Use reasonable stale times** - 5-15 minutes for most data, shorter for real-time data

2. **Leverage automatic invalidation** - The library auto-detects related list endpoints

3. **Use optimistic updates carefully** - Always provide rollback logic in `onError`

4. **Prefetch for better UX** - Load data before user navigates or hovers

5. **Manually control critical data** - Use `refetch` and `invalidateQueries` for critical updates

6. **Monitor cache size** - Large caches can cause memory issues, use appropriate `gcTime`

7. **Test cache behavior** - Verify data freshness and invalidation works as expected

## What's Next?

- [Getting Started](./01-getting-started.md) - Back to basics
- [Queries](./02-queries.md) - Learn about query patterns
- [Mutations](./03-mutations.md) - Learn about mutation patterns
