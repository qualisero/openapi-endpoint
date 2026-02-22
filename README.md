# OpenApiEndpoint

[![npm version](https://badge.fury.io/js/@qualisero%2Fopenapi-endpoint.svg?refresh=1763799820)](https://badge.fury.io/js/@qualisero%2Fopenapi-endpoint)
[![CI](https://github.com/qualisero/openapi-endpoint/workflows/CI/badge.svg)](https://github.com/qualisero/openapi-endpoint/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/@qualisero%2Fopenapi-endpoint)](https://bundlephobia.com/package/@qualisero%2Fopenapi-endpoint)
[![Documentation](https://img.shields.io/badge/docs-online-brightgreen.svg)](https://qualisero.github.io/openapi-endpoint/)

Type-safe API composables for Vue using TanStack Query. Generate fully-typed API clients from your OpenAPI specification.

## Quick Start

```typescript
// 1. Generate types from your OpenAPI spec
npx @qualisero/openapi-endpoint ./api/openapi.json ./src/generated

// 2. Initialize the API client
import { createApiClient } from '@qualisero/openapi-endpoint'
import axios from 'axios'

const api = createApiClient(axios.create({ baseURL: 'https://api.example.com' }))

// 3. Use in your Vue components
const { data: pets, isLoading } = api.listPets.useQuery()
const { data: pet } = api.getPet.useQuery({ petId: '123' })

const createPet = api.createPet.useMutation()
await createPet.mutateAsync({ data: { name: 'Fluffy', species: 'cat' } })
```

## Features

- **Fully typed** - Operations, parameters, and responses type-checked against your OpenAPI spec
- **Reactive parameters** - Query params automatically refetch when values change
- **Automatic cache management** - Mutations invalidate and update related queries
- **Vue 3 + TanStack Query** - Built on proven reactive patterns
- **File uploads** - Support for multipart/form-data endpoints

## Installation

```bash
npm install @qualisero/openapi-endpoint
```

## Code Generation

```bash
# From local file
npx @qualisero/openapi-endpoint ./api/openapi.json ./src/generated

# From remote URL
npx @qualisero/openapi-endpoint https://api.example.com/openapi.json ./src/generated
```

Generated files:

| File                | Description                                  |
| ------------------- | -------------------------------------------- |
| `api-client.ts`     | `createApiClient` factory (main entry point) |
| `api-operations.ts` | Operations map and type helpers              |
| `api-types.ts`      | Type namespace for response/request types    |
| `api-enums.ts`      | Schema enums                                 |
| `api-schemas.ts`    | Schema type aliases                          |
| `openapi-types.ts`  | Raw OpenAPI types                            |

## API Reference

### Initialization

```typescript
import { createApiClient } from '@qualisero/openapi-endpoint'
import axios from 'axios'

const api = createApiClient(axiosInstance, queryClient?)
```

### Queries (GET/HEAD/OPTIONS)

```typescript
// No parameters
const { data, isLoading, error, refetch } = api.listPets.useQuery()

// With path parameters
const { data } = api.getPet.useQuery({ petId: '123' })

// With query parameters
const { data } = api.listPets.useQuery({
  queryParams: { limit: 10, status: 'available' },
})

// Reactive parameters
const limit = ref(10)
const { data } = api.listPets.useQuery({
  queryParams: computed(() => ({ limit: limit.value })),
})
// Automatically refetches when limit.value changes

// With options
const { data, onLoad } = api.listPets.useQuery({
  enabled: computed(() => isLoggedIn.value),
  staleTime: 5000,
  onLoad: (data) => console.log('Loaded:', data),
})

// onLoad callback method
const query = api.getPet.useQuery({ petId: '123' })
query.onLoad((pet) => console.log('Pet:', pet.name))
```

### Mutations (POST/PUT/PATCH/DELETE)

```typescript
// Simple mutation
const createPet = api.createPet.useMutation()
await createPet.mutateAsync({ data: { name: 'Fluffy' } })

// With path parameters
const updatePet = api.updatePet.useMutation({ petId: '123' })
await updatePet.mutateAsync({ data: { name: 'Updated' } })

// Override path params at call time
const deletePet = api.deletePet.useMutation()
await deletePet.mutateAsync({ pathParams: { petId: '123' } })

// With options
const mutation = api.createPet.useMutation({
  dontInvalidate: true,
  invalidateOperations: ['listPets'],
  onSuccess: (response) => console.log('Created:', response.data),
})
```

### Return Types

**Query Return:**

```typescript
{
  data: ComputedRef<T | undefined>
  isLoading: ComputedRef<boolean>
  error: ComputedRef<Error | null>
  isEnabled: ComputedRef<boolean>
  queryKey: ComputedRef<unknown[]>
  onLoad: (cb: (data: T) => void) => void
  refetch: () => Promise<void>
}
```

**Mutation Return:**

```typescript
{
  data: ComputedRef<AxiosResponse<T> | undefined>
  isPending: ComputedRef<boolean>
  error: ComputedRef<Error | null>
  mutate: (vars) => void
  mutateAsync: (vars) => Promise<AxiosResponse>
  extraPathParams: Ref<PathParams> // for dynamic path params
}
```

### Type Helpers

```typescript
import type {
  ApiResponse, // Response type (all fields required)
  ApiResponseSafe, // Response with optional fields
  ApiRequest, // Request body type
  ApiPathParams, // Path parameters type
  ApiQueryParams, // Query parameters type
} from './generated/api-operations'

// ApiResponse - ALL fields required
type PetResponse = ApiResponse<OpType.getPet>
// { readonly id: string, name: string, tag: string, status: 'available' | ... }

// ApiResponseSafe - only readonly required, others optional
type PetResponseSafe = ApiResponseSafe<OpType.getPet>
// { readonly id: string, name: string, tag?: string, status?: 'available' | ... }
```

### Enums

The CLI generates type-safe enum constants:

```typescript
import { PetStatus } from './generated/api-enums'

// Use enum for intellisense and typo safety
const { data } = api.listPets.useQuery({
  queryParams: { status: PetStatus.Available },
})

// Still works with string literals
const { data } = api.listPets.useQuery({
  queryParams: { status: 'available' }, // also valid
})
```

## Documentation

For detailed guides, see [docs/manual/](docs/manual/):

- [Getting Started](docs/manual/01-getting-started.md)
- [Queries](docs/manual/02-queries.md)
- [Mutations](docs/manual/03-mutations.md)
- [Reactive Parameters](docs/manual/04-reactive-parameters.md)
- [File Uploads](docs/manual/05-file-uploads.md)
- [Cache Management](docs/manual/06-cache-management.md)

## License

MIT
