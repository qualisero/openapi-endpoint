# Lazy Queries

This guide covers the `useLazyQuery` hook — an alternative to `useQuery` that gives you full control over when queries execute.

## useLazyQuery vs useQuery

The main difference between `useQuery` and `useLazyQuery` is **who controls execution**:

| Feature              | `useQuery`                | `useLazyQuery`                     |
| -------------------- | ------------------------- | ---------------------------------- |
| Execution            | Automatic (reactive)      | Manual (imperative)                |
| Fire on mount        | Yes                       | No                                 |
| Fire on param change | Yes                       | No                                 |
| Fire via `refetch()` | Yes                       | No                                 |
| Fire via `fetch()`   | No                        | Yes                                |
| Params passed        | At hook time              | At `fetch()` time                  |
| Default `staleTime`  | 1 minute                  | Infinity                           |
| Best for             | Reactive UI, auto-refresh | User-triggered actions, pagination |

**Use `useQuery` when:**

- Data should load immediately on component mount
- Data should refresh automatically when dependencies change
- Search/filter inputs that update on each keystroke

**Use `useLazyQuery` when:**

- User explicitly clicks a button to load data
- Pagination with explicit next/prev buttons
- Prefetching data on hover
- Any time you need precise control over request timing

## Basic Usage

### No Path Parameters

```typescript
const petsQuery = api.listPets.useLazyQuery()

const loadPets = async () => {
  const pets = await petsQuery.fetch()
  console.log('Loaded:', pets)
}
```

### With Path Parameters

```typescript
const petQuery = api.getPet.useLazyQuery({ petId: '123' })

const loadPet = async () => {
  const pet = await petQuery.fetch()
  console.log('Loaded pet:', pet.name)
}
```

### Reactive Path Parameters

Like `useQuery`, `useLazyQuery` supports reactive path params. The difference is the query won't fire when they change — only when you call `fetch()`:

```typescript
import { ref } from 'vue'

const selectedPetId = ref<string>('123')
const petQuery = api.getPet.useLazyQuery({ petId: selectedPetId })

// Changing selectedPetId does NOT fire the query
selectedPetId.value = '456'

// Only explicit fetch() fires
const loadPet = async () => {
  await petQuery.fetch()
}
```

## Passing Query Parameters at Call Time

The key feature of `useLazyQuery` is that query parameters are passed to `fetch()`, not at hook time:

```typescript
const searchQuery = api.searchPets.useLazyQuery()

const search = async (term: string) => {
  // Params passed imperatively at call time
  const results = await searchQuery.fetch({ queryParams: { q: term } })
  return results
}

// Search on button click
const handleSearchClick = async () => {
  const term = searchInput.value
  if (!term) return
  await search(term)
}
```

This solves the problem of `useQuery` with `ref<Params>()` where TypeScript rejects `Ref<T | undefined>` for required params — with `useLazyQuery`, you pass params when you have them.

## Reactive State

Even though execution is manual, all the reactive state is available:

```typescript
const query = api.listPets.useLazyQuery()

// All reactive — updates after each fetch()
console.log(query.isPending.value) // true while fetching
console.log(query.isSuccess.value) // true after success
console.log(query.isError.value) // true after error
console.log(query.error.value) // Error object if failed
console.log(query.data.value) // Fetched data (undefined initially)
```

## Cache Behavior

`useLazyQuery` uses `staleTime: Infinity` by default, meaning:

- First `fetch()` always executes
- Subsequent `fetch()` with **same params** uses cached data (no new request)
- Subsequent `fetch()` with **different params** executes a new request

You can override this:

```typescript
const query = api.listPets.useLazyQuery({
  staleTime: 60 * 1000, // 1 minute — refetch every minute
})
```

### Cache Sharing with useQuery

Lazy queries and eager queries share the same cache:

```typescript
// Eager query — auto-loads on mount
const { data: pets } = api.listPets.useQuery({
  queryParams: { limit: 10 },
})

// Lazy query — fetches on demand
const query = api.listPets.useLazyQuery()

// Calling fetch() populates the eager query's cache too!
await query.fetch({ queryParams: { limit: 10 } })

// Both now have the same data
console.log(pets.value === query.data.value) // true
```

This is useful when:

- You have a list view (eager query) and a detail view (lazy query)
- User clicks to view details → lazy query fetches
- User returns to list → eager query already has the data from cache

## Error Handling

`fetch()` returns a Promise that rejects on error. Wrap with try/catch:

```typescript
const query = api.listPets.useLazyQuery()

const loadPets = async () => {
  try {
    const pets = await query.fetch()
    console.log('Success:', pets)
  } catch (error) {
    console.error('Failed:', error)
    // query.isError and query.error are also updated
  }
}
```

You can also use the reactive `isError` and `error` state:

```vue
<script setup lang="ts">
import { api } from './api/init'

const query = api.listPets.useLazyQuery()

const loadPets = () => query.fetch()
</script>

<template>
  <button @click="loadPets" :disabled="query.isPending.value">Load Pets</button>

  <div v-if="query.isError" class="error">
    {{ query.error?.message }}
  </div>

  <div v-for="pet in query.data" :key="pet.id">
    {{ pet.name }}
  </div>
</template>
```

## Common Patterns

### Search on Submit

```typescript
const searchQuery = api.searchPets.useLazyQuery()

const handleSearch = async () => {
  const term = searchInput.value
  if (!term.trim()) return
  await searchQuery.fetch({ queryParams: { q: term } })
}
```

### Pagination

```typescript
const page = ref(1)
const limit = ref(20)
const query = api.listPets.useLazyQuery()

const nextPage = async () => {
  page.value++
  await query.fetch({ queryParams: { page: page.value, limit: limit.value } })
}

const prevPage = async () => {
  if (page.value > 1) {
    page.value--
    await query.fetch({ queryParams: { page: page.value, limit: limit.value } })
  }
}
```

### Prefetch on Hover

```typescript
const query = api.listPets.useLazyQuery()

const prefetch = async () => {
  try {
    await query.fetch()
  } catch {
    // Silently fail prefetch — user hasn't asked to see this data
  }
}

// In template
<div @mouseenter="prefetch">
  {{ item.name }}
</div>
```

### Loading State with Fallback Data

```typescript
const query = api.listPets.useLazyQuery()

// Show fallback data initially
const displayData = computed(() => query.data.value ?? [])

const load = async () => {
  await query.fetch()
}
```

## Path Params Validation

If path params are not resolved, `fetch()` throws:

```typescript
const query = api.getPet.useLazyQuery() // No petId provided

try {
  await query.fetch()
} catch (error) {
  // Error: Cannot fetch '/pets/{petId}': path parameters not resolved.
  console.error(error.message)
}
```

Use `query.isEnabled` to check:

```typescript
const query = api.getPet.useLazyQuery()

const loadPet = async () => {
  if (!query.isEnabled.value) {
    console.warn('Path params not ready')
    return
  }
  await query.fetch()
}
```

## Advanced Options

You can pass query options (excluding `queryParams`, `onLoad`, and `enabled`):

```typescript
const query = api.listPets.useLazyQuery({
  staleTime: 5 * 60 * 1000, // 5 minutes
  errorHandler: async (error) => {
    console.error('Custom error handler:', error)
    // Return fallback data
    return [{ id: 'fallback', name: 'Fallback' }]
  },
  axiosOptions: {
    headers: { 'X-Custom-Header': 'value' },
  },
})
```

## What's Next?

- [Queries](./02-queries.md) - Learn about `useQuery` for reactive queries
- [Reactive Parameters](./04-reactive-parameters.md) - Learn about reactive path and query parameters
- [Cache Management](./06-cache-management.md) - Learn about advanced cache strategies
