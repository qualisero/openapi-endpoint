# Getting Started

This guide will help you set up and start using `@qualisero/openapi-endpoint` in your Vue project.

## Prerequisites

- Vue 3.3 or higher
- TanStack Vue Query 5.90 or higher
- Axios 1.12 or higher
- An OpenAPI specification (JSON or YAML) for your API

## Installation

```bash
npm install @qualisero/openapi-endpoint
```

Or with yarn:

```bash
yarn add @qualisero/openapi-endpoint
```

## Step 1: Generate Types and Operations

This package includes a CLI tool to generate TypeScript types and operation definitions from your OpenAPI specification.

### From a local file

```bash
npx @qualisero/openapi-endpoint ./api/openapi.json ./src/generated
```

### From a remote URL

```bash
npx @qualisero/openapi-endpoint https://api.example.com/openapi.json ./src/api
```

This will generate three files:

- `openapi-types.ts` - TypeScript type definitions for your API
- `api-operations.ts` - Operation definitions combining metadata and types
- `api-enums.ts` - Type-safe enum constants from your API schema

## Step 2: Configure Axios

Create an axios instance with your API configuration:

```typescript
// api/axios.ts
import axios from 'axios'

export const axiosInstance = axios.create({
  baseURL: 'https://api.example.com',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add authentication interceptor if needed
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
```

## Step 3: Initialize the API Client

Create a typed API client using the generated operations:

```typescript
// api/init.ts
import { useOpenApi } from '@qualisero/openapi-endpoint'
import { axiosInstance } from './axios'
import { openApiOperations, type OpenApiOperations } from './generated/api-operations'

const api = useOpenApi<OpenApiOperations>({
  operations: openApiOperations,
  axios: axiosInstance,
})

export { api }
```

### Optional: Custom QueryClient

If you need to customize the TanStack Query client, you can provide your own:

```typescript
import { useOpenApi } from '@qualisero/openapi-endpoint'
import { QueryClient } from '@tanstack/vue-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 3,
    },
    mutations: {
      retry: 1,
    },
  },
})

const api = useOpenApi<OpenApiOperations>({
  operations: openApiOperations,
  axios: axiosInstance,
  queryClient,
})
```

## Step 4: Use in Your Components

### Using Queries

```vue
<script setup lang="ts">
import { api } from './api/init'
import { operationConfig } from './api/generated/api-operations'

const { data: pets, isLoading, error } = api.listPets.useQuery()

if (error.value) {
  console.error('Failed to load pets:', error.value)
}
</script>

<template>
  <div v-if="isLoading">Loading pets...</div>
  <div v-else-if="error">Error loading pets</div>
  <ul v-else>
    <li v-for="pet in pets" :key="pet.id">{{ pet.name }}</li>
  </ul>
</template>
```

### Using Mutations

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { api } from './api/init'
import { operationConfig } from './api/generated/api-operations'

const name = ref('')

const createPet = api.createPet.useMutation( {
  onSuccess: () => {
    console.log('Pet created!')
    name.value = ''
  },
  onError: (error) => {
    console.error('Failed to create pet:', error)
  },
})

const handleSubmit = async () => {
  await createPet.mutateAsync({ data: { name: name.value } })
}
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <input v-model="name" placeholder="Pet name" />
    <button type="submit" :disabled="createPet.isPending">
      {{ createPet.isPending ? 'Creating...' : 'Create Pet' }}
    </button>
  </form>
</template>
```

## Using Enum Values

The CLI generates type-safe enum constants from your OpenAPI spec:

```vue
<script setup lang="ts">
import { api } from './api/init'
import { operationConfig } from './api/generated/api-operations'
import { PetStatus } from './api/generated/api-enums'

// Use enum constants for intellisense and typo safety
const { data: availablePets } = api.listPets.useQuery( {
  queryParams: { status: PetStatus.Available },
})

const createPet = api.createPet.useMutation()

const handleSubmit = async () => {
  await createPet.mutateAsync({
    data: { name: 'Fluffy', status: PetStatus.Pending },
  })
}
</script>
```

## What's Next?

- [Queries](./02-queries.md) - Learn about using queries for GET operations
- [Mutations](./03-mutations.md) - Learn about mutations for POST/PUT/PATCH/DELETE operations
- [Reactive Parameters](./04-reactive-parameters.md) - Learn about reactive query and path parameters
- [Cache Management](./06-cache-management.md) - Learn about automatic and manual cache control
