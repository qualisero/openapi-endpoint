# Reactive Parameters

This guide covers how to use reactive parameters for queries and mutations with `@qualisero/openapi-endpoint`.

## What are Reactive Parameters?

Reactive parameters allow your API calls to automatically refetch when their dependencies change. This is powerful for:

- Search/filter functionality
- Pagination
- Dependent queries
- Conditional fetching

## Reactive Path Parameters

### Using `ref`

```typescript
import { ref } from 'vue'
import { api } from './api/init'
import { OperationId } from './api/generated/api-operations'

const selectedPetId = ref<string | null>(null)

const { data: pet } = api.useQuery(
  OperationId.getPet,
  { petId: selectedPetId.value }, // Static value - won't refetch
)

const { data: reactivePet } = api.useQuery(
  OperationId.getPet,
  computed(() => ({ petId: selectedPetId.value })), // Reactive!
)

// When selectedPetId changes, reactivePet automatically refetches
selectedPetId.value = '123' // Triggers refetch
```

### Using `computed`

```typescript
import { computed } from 'vue'
import { api } from './api/init'

const userId = ref('123')
const includeArchived = ref(false)

const { data: userPets } = api.useQuery(
  'listUserPets',
  computed(() => ({ userId: userId.value })), // Reactive path param
  {
    queryParams: computed(() => ({
      includeArchived: includeArchived.value, // Reactive query param
    })),
  },
)

// Changes trigger refetch
userId.value = '456' // Refetches /users/456/pets
includeArchived.value = true // Refetches with ?includeArchived=true
```

## Reactive Query Parameters

### Simple Reactive Query Params

```typescript
import { ref, computed } from 'vue'
import { api } from './api/init'
import { OperationId } from './api/generated/api-operations'
import { PetStatus } from './api/generated/api-enums'

const searchTerm = ref('')
const statusFilter = ref<PetStatus>(PetStatus.Available)

const { data: pets } = api.useQuery(OperationId.listPets, {
  queryParams: computed(() => ({
    search: searchTerm.value,
    status: statusFilter.value,
  })),
})

// Query refetches when search or status changes
searchTerm.value = 'fluffy' // Triggers refetch
statusFilter.value = PetStatus.Sold // Triggers refetch
```

### Pagination

```typescript
import { ref } from 'vue'
import { api } from './api/init'

const page = ref(1)
const limit = ref(20)

const { data: pets } = api.useQuery(OperationId.listPets, {
  queryParams: computed(() => ({
    page: page.value,
    limit: limit.value,
  })),
})

const nextPage = () => {
  page.value++ // Automatically refetches
}

const prevPage = () => {
  if (page.value > 1) {
    page.value-- // Automatically refetches
  }
}
```

## Dependent Queries

### Chaining Queries

```typescript
import { computed } from 'vue'
import { api } from './api/init'

// First query
const { data: user } = api.useQuery(OperationId.getUser, { userId: '123' })

// Second query depends on first query's result
const { data: userPets } = api.useQuery(
  'listUserPets',
  computed(() => ({
    userId: user.value?.id, // Only runs when user is loaded
  })),
)
```

### Conditional Fetching with Reactive Parameters

```typescript
import { ref, computed } from 'vue'
import { api } from './api/init'

const selectedUserId = ref<string | undefined>(undefined)
const shouldFetchPets = ref(true)

const { data: userPets } = api.useQuery(
  'listUserPets',
  computed(() => {
    if (!selectedUserId.value || !shouldFetchPets.value) {
      return null // Return null to disable query
    }
    return { userId: selectedUserId.value }
  }),
)

// Query enables/disables based on reactive parameters
selectedUserId.value = '123' // Enables and fetches
shouldFetchPets.value = false // Disables query
```

### Using `enabled` Option with Reactive Parameters

```typescript
import { ref, computed } from 'vue'
import { api } from './api/init'

const isAuthenticated = ref(false)

const { data: profile } = api.useQuery(
  'getProfile',
  {},
  {
    enabled: computed(() => isAuthenticated.value),
  },
)

// Query only runs when authenticated
isAuthenticated.value = true // Starts fetching
```

## Reactive Mutation Parameters

### Mutation With Reactive Path Params

```typescript
import { ref } from 'vue'
import { api } from './api/init'

const selectedPetId = ref('123')

const updatePet = api.useMutation(
  'updatePet',
  { petId: selectedPetId.value }, // Not reactive - static value
)

// To use reactive path params, create a new mutation when ID changes
watch(selectedPetId, () => {
  // Re-create mutation with new path params
})
```

**Note:** Mutations don't support reactive path parameters like queries. Create a new mutation instance when path parameters change.

## Common Reactive Patterns

### Search with Debounce

```typescript
import { ref, watch, computed } from 'vue'
import { api } from './api/init'

const searchTerm = ref('')
const debouncedSearch = ref('')

// Debounce search input
let debounceTimer: ReturnType<typeof setTimeout>
watch(searchTerm, (newValue) => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debouncedSearch.value = newValue
  }, 300)
})

const { data: pets } = api.useQuery(OperationId.listPets, {
  queryParams: computed(() => ({
    search: debouncedSearch.value,
  })),
})
```

### Multi-Filter Search

```typescript
import { ref, computed } from 'vue'
import { api } from './api/init'

const filters = ref({
  search: '',
  category: '',
  minPrice: 0,
  maxPrice: 1000,
  sortBy: 'name',
  sortOrder: 'asc',
})

const { data: products } = api.useQuery(OperationId.listProducts, {
  queryParams: computed(() => {
    const params: Record<string, any> = {}

    if (filters.value.search) params.search = filters.value.search
    if (filters.value.category) params.category = filters.value.category
    if (filters.value.minPrice > 0) params.minPrice = filters.value.minPrice
    if (filters.value.maxPrice < 1000) params.maxPrice = filters.value.maxPrice
    params.sortBy = filters.value.sortBy
    params.sortOrder = filters.value.sortOrder

    return params
  }),
})

// All filter changes trigger refetch
filters.value.search = 'laptop'
filters.value.category = 'electronics'
filters.value.sortOrder = 'desc'
```

### Toggle-based Fetching

```typescript
import { ref, computed } from 'vue'
import { api } from './api/init'

const showDetails = ref(false)
const petId = ref('123')

const { data: pet } = api.useQuery(
  'getPet',
  computed(() => {
    // Return null when details shouldn't be shown
    if (!showDetails.value) return null
    return { petId: petId.value }
  }),
)

// Toggle details view
const toggleDetails = () => {
  showDetails.value = !showDetails.value
  // Query will start/stop automatically
}
```

### Lazy Loading on Click

```typescript
import { ref, computed } from 'vue'
import { api } from './api/init'

const shouldLoad = ref(false)
const petId = ref('123')

const { data: pet, refetch } = api.useQuery(
  'getPet',
  computed(() => {
    if (!shouldLoad.value) return null
    return { petId: petId.value }
  }),
)

const loadDetails = () => {
  shouldLoad.value = true // Triggers fetch
}

const refreshDetails = () => {
  refetch() // Manually refetch
}
```

## Best Practices

1. **Use `computed` for reactive parameters** - Wrap reactive values in `computed()` to trigger automatic refetches

2. **Return `null` to disable queries** - When a reactive computation should disable the query, return `null` instead of an object

3. **Combine with `enabled` option** - Use `enabled` for additional control beyond just parameter availability

4. **Debounce frequent updates** - Use debounce for search inputs to avoid excessive requests

5. **Mutations don't support reactive path params** - Create new mutation instances when path parameters need to change

## What's Next?

- [File Uploads](./05-file-uploads.md) - Learn about handling multipart/form-data and file uploads
- [Cache Management](./06-cache-management.md) - Learn about advanced cache control strategies
