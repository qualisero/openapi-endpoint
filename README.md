# Vue OpenAPI Query

[![npm version](https://badge.fury.io/js/@qualisero%2Fopenapi-endpoint.svg)](https://badge.fury.io/js/@qualisero%2Fopenapi-endpoint)
[![CI](https://github.com/qualisero/openapi-endpoint/workflows/CI/badge.svg)](https://github.com/qualisero/openapi-endpoint/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/@qualisero/openapi-endpoint)](https://bundlephobia.com/package/@qualisero/openapi-endpoint)

Type-safe OpenAPI integration for Vue Query (TanStack Query).

## Overview

Let's you get TanStack Vue Query composables that enforce consistency (name of endpoints, typing) with your API's `openapi.json` file:

```typescript
const { data, isLoading } = api.useQuery(OperationId.getPet, { petId: '123' })

const createPetMutation = api.useMutation(OperationId.createPet)
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

This will generate two files in your specified output directory:

- `openapi-types.ts` - TypeScript type definitions for your API
- `api-operations.ts` - Streamlined operation definitions combining metadata and types

## Usage

### 1. Initialize the package

```typescript
// api/init.ts
import { useOpenApi } from '@qualisero/openapi-endpoint'
import axios from 'axios'

// Import your generated operations (includes both metadata and types)
import { OperationId, openApiOperations, type OpenApiOperations } from './generated/api-operations'

// Create axios instance
const axiosInstance = axios.create({
  baseURL: 'https://api.example.com',
})

// Initialize the package with the streamlined operations
const api = useOpenApi<OpenApiOperations>({
  operations: openApiOperations,
  axios: axiosInstance,
})

// Export for use in other parts of your application
export { api, OperationId }
```

### 2. Use the API in your components

```typescript
// In your Vue components
import { api, OperationId } from './api/init'

// Use queries for GET operations
const { data: pets, isLoading } = api.useQuery(OperationId.listPets)
const { data: pet } = api.useQuery(OperationId.getPet, { petId: '123' })

// Use mutations for POST/PUT/PATCH/DELETE operations
const createPetMutation = api.useMutation(OperationId.createPet)

// Execute mutations
await createPetMutation.mutateAsync({
  data: { name: 'Fluffy', species: 'cat' },
})
```

## Advanced Usage

### Automatic Operation Type Detection with `api.useEndpoint`

The `api.useEndpoint` method automatically detects whether an operation is a query (GET/HEAD/OPTIONS) or mutation (POST/PUT/PATCH/DELETE) based on the HTTP method defined in your OpenAPI specification:

```typescript
import { ref, computed } from 'vue'
import { api, OperationId } from './api/init'

// Automatically becomes a query for GET operations
const listEndpoint = api.useEndpoint(OperationId.listPets)
// TypeScript knows this has query properties like .data, .isLoading, .refetch()

// Automatically becomes a mutation for POST operations
const createEndpoint = api.useEndpoint(OperationId.createPet)
// TypeScript knows this has mutation properties like .mutate(), .mutateAsync()

// Use the endpoints according to their detected type
const petData = listEndpoint.data // Query data
await createEndpoint.mutateAsync({ data: { name: 'Fluffy' } }) // Mutation execution
```

### Automatic Cache Management and Refetching

By default, mutations automatically:

1. Update cache for matching queries with returned data
2. Invalidate them to trigger a reload
3. Invalidate matching list endpoints

```typescript
// Default behavior: automatic cache management
const createPet = api.useMutation(OperationId.createPet)
// No additional configuration needed - cache management is automatic

// Manual control over cache invalidation
const updatePet = api.useMutation(OperationId.updatePet, {
  dontInvalidate: true, // Disable automatic invalidation
  dontUpdateCache: true, // Disable automatic cache updates
  invalidateOperations: [OperationId.listPets], // Manually specify operations to invalidate
})

// Refetch specific endpoints after mutation
const petListQuery = api.useQuery(OperationId.listPets)
const createPetWithRefetch = api.useMutation(OperationId.createPet, {
  refetchEndpoints: [petListQuery], // Manually refetch these endpoints
})
```

### Reactive Enabling/Disabling Based on Path Parameters

One powerful feature is chaining queries where one query provides the parameters for another:

```typescript
import { ref, computed } from 'vue'

// First query to get user information
const selectedUserId = ref<string>('user1')
const userQuery = api.useQuery(OperationId.getUser, { userId: selectedUserId.value })

// Second query that depends on the first query's result
const userPetsQuery = api.useQuery(
  OperationId.listUserPets,
  computed(() => ({
    userId: userQuery.data.value?.id, // Chain: use ID from first query
  })),
  {
    enabled: computed(() => Boolean(userQuery.data.value?.id)), // Only run when first query has data
  },
)

// Reactive parameter example
const selectedPetId = ref<string | undefined>(undefined)

// Query automatically enables/disables based on parameter availability
const petQuery = api.useQuery(
  OperationId.getPet,
  computed(() => ({ petId: selectedPetId.value })),
  {
    // Optional: add additional enabling logic
    enabled: computed(() => Boolean(selectedPetId.value)),
  },
)

// Query is automatically disabled when petId is null/undefined
console.log(petQuery.isEnabled.value) // false when selectedPetId.value is null

// Enable the query by setting the parameter
selectedPetId.value = '123'
console.log(petQuery.isEnabled.value) // true when selectedPetId.value is set

// Query automatically enables/disables based on parameter availability
const petQuery = api.useQuery(
  OperationId.getPet,
  computed(() => ({ petId: selectedPetId.value })),
  {
    // Optional: add additional enabling logic
    enabled: computed(() => Boolean(selectedPetId.value)),
  },
)

// Query is automatically disabled when petId is null/undefined
console.log(petQuery.isEnabled.value) // false when selectedPetId.value is null

// Enable the query by setting the parameter
selectedPetId.value = '123'
console.log(petQuery.isEnabled.value) // true when selectedPetId.value is set

// Complex conditional enabling
const userId = ref<string>('user1')
const shouldFetchPets = ref(true)

const userPetsQuery = api.useQuery(
  OperationId.listUserPets,
  computed(() => ({ userId: userId.value })),
  {
    enabled: computed(
      () =>
        Boolean(userId.value) && // Path param must be present
        shouldFetchPets.value, // Additional business logic
    ),
  },
)
```

## API Documentation

Full API documentation is available in the [generated docs](./docs/index.html). The documentation includes detailed information about all methods, types, and configuration options.

## Contributing

Contributions are welcome! Please read our contributing guidelines and ensure all tests pass.

## License

MIT
