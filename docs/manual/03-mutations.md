# Mutations

This guide covers how to use mutations for POST, PUT, PATCH, and DELETE operations with `@qualisero/openapi-endpoint`.

## What is a Mutation?

Mutations are used for creating, updating, or deleting data on your API. They wrap TanStack Query's `useMutation` composable with type safety based on your OpenAPI specification.

## Basic Mutation Usage

### Mutation Without Path Parameters

```typescript
import { api } from './api/init'
import { OperationId } from './api/generated/api-operations'

// Simple mutation for creating data
const createPet = api.useMutation(OperationId.createPet, {
  onSuccess: (data) => {
    console.log('Pet created:', data)
  },
  onError: (error) => {
    console.error('Failed to create pet:', error)
  },
})

// Execute mutation
await createPet.mutateAsync({
  data: { name: 'Fluffy', species: 'cat' },
})
```

### Mutation With Path Parameters

```typescript
import { api } from './api/init'

// Mutation with path parameters
const updatePet = api.useMutation(OperationId.updatePet, { petId: '123' })

// Execute mutation
await updatePet.mutateAsync({
  data: { name: 'Updated Fluffy' },
})
```

### Mutation With Query Parameters

```typescript
import { api } from './api/init'
import { OperationId } from './api/generated/api-operations'

// Mutation with query parameters
const createPet = api.useMutation(
  OperationId.createPet,
  {},
  {
    queryParams: { userId: '456' },
  },
)

// Execute mutation
await createPet.mutateAsync({
  data: { name: 'Fluffy' },
})
```

## Mutation Methods

The mutation object provides two methods for executing the mutation:

### `mutate`

Executes mutation imperatively (fire and forget):

```typescript
const createPet = api.useMutation(OperationId.createPet)

createPet.mutate({
  data: { name: 'Fluffy' },
})
// Doesn't return promise, continues immediately
```

### `mutateAsync`

Executes mutation and returns a promise:

```typescript
const createPet = api.useMutation(OperationId.createPet)

try {
  const result = await createPet.mutateAsync({
    data: { name: 'Fluffy' },
  })
  console.log('Created:', result)
} catch (error) {
  console.error('Error:', error)
}
```

## Mutation Options

### Success Handler

```typescript
import { OperationId } from './api/generated/api-operations'

const createPet = api.useMutation(
  OperationId.createPet,
  {},
  {
    onSuccess: (data, variables, context) => {
      console.log('Success!', data) // Response data
      console.log('Variables:', variables) // Input parameters
      console.log('Context:', context) // Mutation context
    },
  },
)
```

### Error Handler

```typescript
import { OperationId } from './api/generated/api-operations'

const createPet = api.useMutation(
  OperationId.createPet,
  {},
  {
    onError: (error, variables, context) => {
      console.error('Error:', error)
      console.error('Variables:', variables)

      // Show user-friendly error message
      alert(`Failed to create pet: ${error.message}`)
    },
  },
)
```

### Settled Handler

```typescript
import { OperationId } from './api/generated/api-operations'

const createPet = api.useMutation(
  OperationId.createPet,
  {},
  {
    onSettled: (data, error, variables, context) => {
      console.log('Mutation completed')
      // Always runs, regardless of success or error
    },
  },
)
```

### Optimistic Updates

```typescript
import { OperationId } from './api/generated/api-operations'

const petQuery = api.useQuery(OperationId.getPet, { petId: '123' })
const updatePet = api.useMutation(
  OperationId.updatePet,
  { petId: '123' },
  {
    onMutate: async (variables) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: petQuery.queryKey.value })

      // Snapshot previous value
      const previousPet = queryClient.getQueryData(petQuery.queryKey.value)

      // Optimistically update
      queryClient.setQueryData(petQuery.queryKey.value, variables.data)

      // Return context with snapshot
      return { previousPet }
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousPet) {
        queryClient.setQueryData(petQuery.queryKey.value, context.previousPet)
      }
    },
  },
)
```

## Mutation State

The mutation object provides reactive state properties:

```typescript
const createPet = api.useMutation(OperationId.createPet)

console.log(createPet.isPending.value) // true while mutation is in progress
console.log(createPet.isSuccess.value) // true if mutation succeeded
console.log(createPet.isError.value) // true if mutation failed
console.log(createPet.error.value) // Error object if mutation failed
console.log(createPet.data.value) // Response data if mutation succeeded
```

## Automatic Cache Management

By default, mutations automatically:

1. **Update cache** - Insert returned data into the cache
2. **Invalidate queries** - Mark matching queries as stale to trigger refetch
3. **Invalidate list queries** - Automatically invalidate list endpoints

```typescript
// Automatic cache management (default)
const createPet = api.useMutation(OperationId.createPet, { petId: '123' })

// This will:
// 1. Update cache for getPet/123 with returned data
// 2. Invalidate getPet/123 query
// 3. Invalidate listPets query (detected as related list)
```

## Manual Cache Control

### Disable Automatic Invalidation

```typescript
import { OperationId } from './api/generated/api-operations'

const updatePet = api.useMutation(
  OperationId.updatePet,
  { petId: '123' },
  {
    dontInvalidate: true, // Don't auto-invalidate
    dontUpdateCache: true, // Don't auto-update cache
  },
)
```

### Specify Operations to Invalidate

```typescript
import { OperationId } from './api/generated/api-operations'

const createPet = api.useMutation(
  OperationId.createPet,
  { petId: '123' },
  {
    invalidateOperations: [
      OperationId.listPets, // Invalidate specific operations
      OperationId.getUserPets,
    ],
  },
)
```

### Manually Refetch Endpoints

```typescript
import { OperationId } from './api/generated/api-operations'

const petListQuery = api.useQuery(OperationId.listPets)
const createPet = api.useMutation(
  OperationId.createPet,
  { petId: '123' },
  {
    refetchEndpoints: [petListQuery], // Refetch these endpoints
  },
)
```

## Common Mutation Patterns

### Form Submission

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { api } from './api/init'
import { OperationId } from './api/generated/api-operations'

const name = ref('')
const species = ref('cat')

const createPet = api.useMutation(
  OperationId.createPet,
  {},
  {
    onSuccess: () => {
      name.value = ''
      species.value = 'cat'
      alert('Pet created successfully!')
    },
    onError: (error) => {
      alert(`Failed to create pet: ${error.message}`)
    },
  },
)

const handleSubmit = async () => {
  await createPet.mutateAsync({
    data: { name: name.value, species: species.value },
  })
}
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <input v-model="name" placeholder="Pet name" />
    <select v-model="species">
      <option value="cat">Cat</option>
      <option value="dog">Dog</option>
    </select>
    <button type="submit" :disabled="createPet.isPending">
      {{ createPet.isPending ? 'Creating...' : 'Create Pet' }}
    </button>
  </form>
</template>
```

### Delete with Confirmation

```vue
<script setup lang="ts">
import { api } from './api/init'
import { OperationId } from './api/generated/api-operations'

const deletePet = api.useMutation(
  OperationId.deletePet,
  { petId: '123' },
  {
    onSuccess: () => {
      alert('Pet deleted')
    },
  },
)

const handleDelete = async () => {
  if (confirm('Are you sure you want to delete this pet?')) {
    await deletePet.mutateAsync()
  }
}
</script>

<template>
  <button @click="handleDelete" :disabled="deletePet.isPending">
    {{ deletePet.isPending ? 'Deleting...' : 'Delete Pet' }}
  </button>
</template>
```

### Update with Optimistic UI

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { api } from './api/init'
import { OperationId } from './api/generated/api-operations'

const petName = ref('Fluffy')

const updatePet = api.useMutation(
  OperationId.updatePet,
  { petId: '123' },
  {
    onSuccess: (data) => {
      petName.value = data.name
    },
    onError: () => {
      alert('Failed to update pet')
      // Rollback happens automatically via onError handler in mutation
    },
  },
)

const handleUpdate = async () => {
  await updatePet.mutateAsync({
    data: { name: petName.value },
  })
}
</script>

<template>
  <input v-model="petName" @blur="handleUpdate" />
</template>
```

## What's Next?

- [Reactive Parameters](./04-reactive-parameters.md) - Learn about reactive query and path parameters
- [Cache Management](./06-cache-management.md) - Learn about advanced cache control strategies
