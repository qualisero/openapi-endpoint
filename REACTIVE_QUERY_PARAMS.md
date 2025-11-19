# Reactive Query Parameters Example

This example demonstrates how to use reactive query parameters with the OpenAPI endpoint library.

## Basic Usage

### Static Query Parameters

```typescript
import { useOpenApi } from '@qualisero/openapi-endpoint'
import { OperationId, openApiOperations, type OpenApiOperations } from './generated/api-operations'
import axios from 'axios'

const api = useOpenApi<OpenApiOperations>({
  operations: openApiOperations,
  axios: axios.create({ baseURL: 'https://api.example.com' }),
})

// Use static query parameters
const petsQuery = api.useQuery(OperationId.listPets, {
  queryParams: { limit: 10 },
})
// Results in: GET /pets?limit=10
```

### Reactive Query Parameters with Refs

```typescript
import { ref } from 'vue'

// Use reactive query parameters
const limit = ref(10)
const petsQuery = api.useQuery(OperationId.listPets, {
  queryParams: { limit: limit.value },
})

// When limit changes, the query automatically refetches
limit.value = 20 // Query refetches with new parameter
// Results in: GET /pets?limit=20
```

### Reactive Query Parameters with Computed

```typescript
import { ref, computed } from 'vue'

const maxResults = ref(10)
const selectedStatus = ref<'available' | 'pending' | 'sold'>('available')

// Use computed for complex reactive query params
const queryParams = computed(() => ({
  limit: maxResults.value,
  status: selectedStatus.value,
}))

const petsQuery = api.useQuery(OperationId.listPets, {
  queryParams: queryParams,
})

// Changing any dependency triggers automatic refetch
maxResults.value = 20
selectedStatus.value = 'pending'
// Query automatically refetches with: GET /pets?limit=20&status=pending
```

## Real-World Examples

### Searchable List with Pagination

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { api, OperationId } from './api/init'

const searchTerm = ref('')
const currentPage = ref(1)
const itemsPerPage = ref(10)
const statusFilter = ref<'available' | 'pending' | 'sold' | undefined>(undefined)

// Reactive query params automatically trigger refetch when any value changes
const queryParams = computed(() => ({
  limit: itemsPerPage.value,
  offset: (currentPage.value - 1) * itemsPerPage.value,
  search: searchTerm.value || undefined,
  status: statusFilter.value,
}))

const petsQuery = api.useQuery(OperationId.listPets, {
  queryParams: queryParams,
})

function nextPage() {
  currentPage.value++
  // Query automatically refetches with new offset
}

function previousPage() {
  if (currentPage.value > 1) {
    currentPage.value--
    // Query automatically refetches
  }
}

function changeItemsPerPage(newValue: number) {
  itemsPerPage.value = newValue
  currentPage.value = 1 // Reset to first page
  // Query automatically refetches
}
</script>

<template>
  <div>
    <input v-model="searchTerm" placeholder="Search pets..." />

    <select v-model="statusFilter">
      <option :value="undefined">All statuses</option>
      <option value="available">Available</option>
      <option value="pending">Pending</option>
      <option value="sold">Sold</option>
    </select>

    <div v-if="petsQuery.isLoading.value">Loading...</div>
    <div v-else-if="petsQuery.error.value">Error: {{ petsQuery.error.value.message }}</div>
    <div v-else>
      <div v-for="pet in petsQuery.data.value" :key="pet.id">{{ pet.name }} - {{ pet.status }}</div>
    </div>

    <div class="pagination">
      <button @click="previousPage" :disabled="currentPage === 1">Previous</button>
      <span>Page {{ currentPage }}</span>
      <button @click="nextPage">Next</button>

      <select v-model="itemsPerPage" @change="changeItemsPerPage">
        <option :value="10">10 per page</option>
        <option :value="25">25 per page</option>
        <option :value="50">50 per page</option>
      </select>
    </div>
  </div>
</template>
```

### Combining Path Parameters and Query Parameters

```typescript
import { ref, computed } from 'vue'

const userId = ref('user-123')
const includeArchived = ref(false)
const sortBy = ref<'date' | 'name'>('date')

// Combine path parameters with query parameters
const userPetsQuery = api.useQuery(
  OperationId.listUserPets,
  computed(() => ({ userId: userId.value })), // Path params
  {
    queryParams: computed(() => ({
      includeArchived: includeArchived.value,
      sortBy: sortBy.value,
    })), // Query params
  },
)
// Results in: GET /users/user-123/pets?includeArchived=false&sortBy=date
```

## Backward Compatibility

The new `queryParams` option works alongside the existing `axiosOptions.params`:

```typescript
// Old way (still works)
const query1 = api.useQuery(OperationId.listPets, {
  axiosOptions: {
    params: { limit: 10 },
  },
})

// New way (type-safe and reactive)
const query2 = api.useQuery(OperationId.listPets, {
  queryParams: { limit: 10 },
})

// Both together (merged)
const query3 = api.useQuery(OperationId.listPets, {
  queryParams: { limit: 10 },
  axiosOptions: {
    params: { page: 1 },
  },
})
// Results in: GET /pets?limit=10&page=1
```

## Type Safety

Query parameters are automatically typed based on your OpenAPI specification:

```typescript
// If your OpenAPI spec defines listPets with a 'limit' parameter of type number:
const query = api.useQuery(OperationId.listPets, {
  queryParams: { limit: 10 }, // ✓ TypeScript knows 'limit' should be a number
})

// TypeScript will catch type errors:
const invalidQuery = api.useQuery(OperationId.listPets, {
  queryParams: { limit: 'invalid' }, // ✗ TypeScript error
})
```

## Migration Guide

### From axiosOptions.params

Before:

```typescript
const colorFilter = ref('white')

const petsQuery = api.useQuery(OperationId.listPets, {
  axiosOptions: {
    params: { color: colorFilter.value }, // ✗ Not reactive
  },
})
```

After:

```typescript
const colorFilter = ref('white')

const petsQuery = api.useQuery(OperationId.listPets, {
  queryParams: computed(() => ({ color: colorFilter.value })), // ✓ Reactive and type-safe
})
```
