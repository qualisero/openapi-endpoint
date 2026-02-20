# OpenApiEndpoint

[![npm version](https://badge.fury.io/js/@qualisero%2Fopenapi-endpoint.svg?refresh=1763799820)](https://badge.fury.io/js/@qualisero%2Fopenapi-endpoint)
[![CI](https://github.com/qualisero/openapi-endpoint/workflows/CI/badge.svg)](https://github.com/qualisero/openapi-endpoint/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/@qualisero/openapi-endpoint)](https://bundlephobia.com/package/@qualisero/openapi-endpoint)
[![Documentation](https://img.shields.io/badge/docs-online-brightgreen.svg)](https://qualisero.github.io/openapi-endpoint/)

Turns your `openapi.json` into typesafe API composables using Vue Query (TanStack Query): guaranteeing that your frontend and backend share the same contract.

## Overview

Let's you get TanStack Vue Query composables that enforce consistency (name of endpoints, typing) with your API's `openapi.json` file:

```typescript
const { data, isLoading } = api.getPet.useQuery({ petId: '123' })

const createPetMutation = api.createPet.useMutation()
createPetMutation.mutate({ data: { name: 'Fluffy', species: 'cat' } })
```

## Installation

```bash
npm install @qualisero/openapi-endpoint
```

## Code Generation

This package includes a command-line tool to generate TypeScript types and operation definitions from your OpenAPI specification:

```bash
# Generate from local file
npx @qualisero/openapi-endpoint ./api/openapi.json ./src/generated

# Generate from remote URL
npx @qualisero/openapi-endpoint https://api.example.com/openapi.json ./src/api
```

This will generate the following files in your specified output directory:

- `openapi-types.ts` - TypeScript type definitions for your API (via openapi-typescript)
- `api-client.ts` - Fully-typed createApiClient factory (main file to use)
- `api-operations.ts` - Operations map and type helper aliases
- `api-types.ts` - Types namespace for convenient type-only access
- `api-enums.ts` - Schema enums (if present in your OpenAPI spec)
- `api-schemas.ts` - Schema type aliases (if present in your OpenAPI spec)

## Usage

### 1. Initialize the package

```typescript
// api/init.ts
import { createApiClient } from '@qualisero/openapi-endpoint'
import axios from 'axios'

const axiosInstance = axios.create({
  baseURL: 'https://api.example.com',
})

// Create a fully-typed API client
const api = createApiClient(axiosInstance)

export default api
```

### Optional: Custom QueryClient

```typescript
// api/init.ts
import { createApiClient } from '@qualisero/openapi-endpoint'
import { QueryClient } from '@tanstack/vue-query'
import axios from 'axios'

const axiosInstance = axios.create({
  baseURL: 'https://api.example.com',
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000 }, // 5 minutes
  },
})

// Create API client with custom QueryClient
const api = createApiClient(axiosInstance, queryClient)

export default api
```

### 2. Use the API in your components

```typescript
// In your Vue components
import { api } from './api/init'

// Use queries for GET operations
const { data: pets, isLoading } = api.listPets.useQuery()
const { data: pet } = api.getPet.useQuery({ petId: '123' })

// Use mutations for POST/PUT/PATCH/DELETE operations
const createPetMutation = api.createPet.useMutation()

// Execute mutations
await createPetMutation.mutateAsync({
  data: { name: 'Fluffy', species: 'cat' },
})
```

## Advanced Usage

### Reactive Query Parameters

The library supports type-safe, reactive query parameters that automatically trigger refetches when their values change:

```typescript
import { ref, computed } from 'vue'
import { api } from './api/init'

// Static query parameters
const { data: pets } = api.listPets.useQuery( {
  queryParams: { limit: 10 },
})
// Results in: GET /pets?limit=10

// Reactive query parameters with computed
const limit = ref(10)
const status = ref<'available' | 'pending' | 'sold'>('available')

const petsQuery = api.listPets.useQuery( {
  queryParams: computed(() => ({
    limit: limit.value,
    status: status.value,
  })),
})

// When limit or status changes, query automatically refetches
limit.value = 20
status.value = 'pending'
// Query refetches with: GET /pets?limit=20&status=pending

// Combine with path parameters
const userPetsQuery = api.listUserPets.useQuery(
  computed(() => ({ userId: userId.value })),
  {
    queryParams: computed(() => ({
      includeArchived: includeArchived.value,
    })),
  },
)
// Results in: GET /users/user-123/pets?includeArchived=false
```

**Key Features:**

- **Type-safe**: Query parameters are typed based on your OpenAPI specification
- **Reactive**: Supports `ref`, `computed`, and function-based values
- **Automatic refetch**: Changes to query params trigger automatic refetch via TanStack Query's key mechanism
- **Backward compatible**: Works alongside existing `axiosOptions.params`

### Automatic Cache Management and Refetching

By default, mutations automatically:

1. Update cache for matching queries with returned data
2. Invalidate them to trigger a reload
3. Invalidate matching list endpoints

```typescript
// Default behavior: automatic cache management
const createPet = api.createPet.useMutation()
// No additional configuration needed - cache management is automatic

// Manual control over cache invalidation
const updatePet = api.updatePet.useMutation({
  dontInvalidate: true, // Disable automatic invalidation
  dontUpdateCache: true, // Disable automatic cache updates
  invalidateOperations: ['listPets'], // Manually specify operations to invalidate
})

// Refetch specific endpoints after mutation
const petListQuery = api.listPets.useQuery()
const createPetWithRefetch = api.createPet.useMutation({
  refetchEndpoints: [petListQuery], // Manually refetch these endpoints
})
```

### File Upload Support with Multipart/Form-Data

The library supports file uploads through endpoints that accept `multipart/form-data` content type. For these endpoints, you can pass either a `FormData` object or the schema-defined object structure:

```typescript
// Example file upload endpoint usage
async function uploadPetPicture(petId: string, file: File) {
  const formData = new FormData()
  formData.append('file', file)

  const uploadMutation = api.uploadPetPic.useMutation( { petId })

  return uploadMutation.mutateAsync({
    data: formData,
    axiosOptions: {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  })
}

// Alternative: using the object structure (if your API supports binary strings)
async function uploadPetPictureAsString(petId: string, binaryData: string) {
  const uploadMutation = api.uploadPetPic.useMutation( { petId })

  return uploadMutation.mutateAsync({
    data: {
      file: binaryData, // Binary data as string
    },
  })
}

// Complete example with error handling and cache invalidation
async function handleFileUpload(event: Event, petId: string) {
  const files = (event.target as HTMLInputElement).files
  if (!files || files.length === 0) return

  const file = files[0]
  const formData = new FormData()
  formData.append('file', file)

  const uploadMutation = api.uploadPetPic.useMutation(
    { petId },
    {
      invalidateOperations: ["getPet", "listPets"],
      onSuccess: (data) => {
        console.log('Upload successful:', data)
      },
      onError: (error) => {
        console.error('Upload failed:', error)
      },
    },
  )

  try {
    await uploadMutation.mutateAsync({ data: formData })
  } catch (error) {
    console.error('Upload error:', error)
  }
}
```

### Reactive Enabling/Disabling Based on Path Parameters

You can chain queries where one query provides the parameters for another:

```typescript
import { ref, computed } from 'vue'

// First query to get user information
const userQuery = api.getUser.useQuery( { userId: 123 })

// Second query that depends on the first query's result
const userPetsQuery = api.listUserPets.useQuery(
  computed(() => ({
    userId: userQuery.data.value?.id, // Chain: use ID from first query
  })),
)

// Reactive parameter example
const selectedPetId = ref<string | undefined>(undefined)

const petQuery = api.getPet.useQuery(
  computed(() => ({ petId: selectedPetId.value })),
)

// Query is automatically disabled when petId is null/undefined
console.log(petQuery.isEnabled.value) // false when selectedPetId.value is null

// Enable the query by setting the parameter
selectedPetId.value = '123'
console.log(petQuery.isEnabled.value) // true when selectedPetId.value is set

// Complex conditional enabling
const userId = ref<string>('user1')
const shouldFetchPets = ref(true)

const userPetsQuery = api.listUserPets.useQuery(
  computed(() => ({ userId: userId.value })),
  {
    enabled: computed(
      () => shouldFetchPets.value, // Additional business logic
    ),
  },
)
```

### Reactive Query Parameters with Refs

```typescript
import { ref } from 'vue'

// Use reactive query parameters
const limit = ref(10)
const petsQuery = api.listPets.useQuery({
  queryParams: { limit: limit.value },
})

// When limit changes, the query automatically refetches
limit.value = 20 // Query refetches with new parameter
// Results in: GET /pets?limit=20
```

## API Documentation

Full API documentation is available at [https://qualisero.github.io/openapi-endpoint/](https://qualisero.github.io/openapi-endpoint/). The documentation includes detailed information about all methods, types, and configuration options.

## Contributing

Contributions are welcome! Please read our contributing guidelines and ensure all tests pass.

## License

MIT
