# Queries

This guide covers how to use queries for GET, HEAD, and OPTIONS operations with `@qualisero/openapi-endpoint`.

## What is a Query?

Queries are used for fetching data from your API. They wrap TanStack Query's `useQuery` composable with type safety based on your OpenAPI specification.

## Basic Query Usage

### Query Without Parameters

```typescript
import { api } from './api/init'

// Simple query that fetches data on mount
const { data: pets, isLoading, error, refetch } = api.useQuery('listPets')

console.log(pets.value)  // Array of pets
console.log(isLoading.value)  // true while fetching
console.log(error.value)  // Error object if request failed
```

### Query With Path Parameters

```typescript
import { api } from './api/init'

// Query with required path parameter
const { data: pet } = api.useQuery('getPet', { petId: '123' })

console.log(pet.value)  // Pet with id '123'
```

### Query With Query Parameters

```typescript
import { api } from './api/init'

// Query with query parameters
const { data: pets } = api.useQuery('listPets', {
  queryParams: { limit: 10, status: 'available' }
})

// Results in: GET /pets?limit=10&status=available
```

## Query Options

You can pass additional options to customize query behavior:

### Enabled/Disabled Queries

```typescript
const { data: pet } = api.useQuery('getPet', { petId: '123' }, {
  enabled: computed(() => Boolean(selectedPetId.value))
})

// Query only runs when selectedPetId has a value
```

### Stale Time

```typescript
const { data: pets } = api.useQuery('listPets', {}, {
  staleTime: 60 * 1000  // 1 minute
})

// Data is considered fresh for 1 minute, no refetch within that time
```

### Cache Time

```typescript
const { data: pets } = api.useQuery('listPets', {}, {
  cacheTime: 5 * 60 * 1000  // 5 minutes
})

// Data stays in cache for 5 minutes after becoming inactive
```

### Retry Behavior

```typescript
const { data: pets } = api.useQuery('listPets', {}, {
  retry: 3,  // Retry failed requests 3 times
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
})
```

### Custom Success/Error Handlers

```typescript
const { data: pets } = api.useQuery('listPets', {}, {
  onSuccess: (data) => {
    console.log('Pets loaded:', data)
    // Update local state, show notification, etc.
  },
  onError: (error) => {
    console.error('Failed to load pets:', error)
    // Show error message to user
  },
})
```

## Query Return Values

The `useQuery` hook returns a reactive object with the following properties:

```typescript
interface QueryResult {
  data: Ref<T>              // The fetched data
  isLoading: Ref<boolean>     // True while initial fetch is in progress
  isFetching: Ref<boolean>    // True while any fetch is in progress (including refetches)
  isError: Ref<boolean>      // True if an error occurred
  error: Ref<AxiosError>    // Error object if query failed
  refetch: Function          // Manually trigger refetch
  invalidate: Function       // Invalidate cache and refetch
}
```

## Common Query Patterns

### Loading Skeleton

```vue
<script setup lang="ts">
import { api } from './api/init'

const { data: pets, isLoading, error } = api.useQuery('listPets')
</script>

<template>
  <div v-if="isLoading" class="skeleton">
    <div class="skeleton-item"></div>
    <div class="skeleton-item"></div>
    <div class="skeleton-item"></div>
  </div>
  <div v-else-if="error" class="error">
    Failed to load pets. Please try again.
  </div>
  <div v-else>
    <div v-for="pet in pets" :key="pet.id">
      {{ pet.name }}
    </div>
  </div>
</template>
```

### Pull-to-Refresh

```vue
<script setup lang="ts">
import { api } from './api/init'

const { data: pets, refetch, isFetching } = api.useQuery('listPets')

const handleRefresh = () => {
  refetch()
}
</script>

<template>
  <div @scrolltolower="handleRefresh">
    <div v-for="pet in pets" :key="pet.id">{{ pet.name }}</div>
    <div v-if="isFetching" class="loading">Refreshing...</div>
  </div>
</template>
```

### Dependent Queries

```typescript
// First query
const { data: user } = api.useQuery('getUser', { userId: '123' })

// Second query depends on first query's result
const { data: userPets } = api.useQuery(
  'listUserPets',
  { userId: user.value?.id },  // Only fetches when user is loaded
  {
    enabled: computed(() => Boolean(user.value))
  }
)
```

## What's Next?

- [Mutations](./03-mutations.md) - Learn about mutations for POST/PUT/PATCH/DELETE operations
- [Reactive Parameters](./04-reactive-parameters.md) - Learn about reactive query and path parameters
