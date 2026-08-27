# OpenApiEndpoint

[![npm version](https://badge.fury.io/js/@qualisero%2Fopenapi-endpoint.svg?v=0.25.0)](https://badge.fury.io/js/@qualisero%2Fopenapi-endpoint)
[![CI](https://github.com/qualisero/openapi-endpoint/workflows/CI/badge.svg?refresh=20260827)](https://github.com/qualisero/openapi-endpoint/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
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

### Getting a URL without fetching

Every query operation also exposes `urlFor()`, which returns a plain URL string without performing a request. This is the right tool for `<img :src>`, anchor `href`, `window.open`, or native `fetch`:

```ts
const url = api.getAssetDocumentFile.urlFor({ asset_id, document_ref }, { view: true })
// → "https://api.example.com/api/v3/document/asset/.../file?view=true"
```

Notes:

- Synchronous; takes plain values only (not refs or getters). Wrap in `computed(...)` for reactivity.
- Only flat scalar query params (`string | number | boolean`) are supported.
- `baseURL` is read from the axios instance at call time.
- Available on query operations only (GET / HEAD / OPTIONS), not mutations.

### Mutations (POST/PUT/PATCH/DELETE)

```typescript
// Simple mutation
const createPet = api.createPet.useMutation()
await createPet.mutateAsync({ data: { name: 'Fluffy' } })

// With path parameters
const updatePet = api.updatePet.useMutation({ petId: '123' })
await updatePet.mutateAsync({ data: { name: 'Updated' } })

// Deferred path params: omit at hook time, provide at call time
const deletePet = api.deletePet.useMutation()
await deletePet.mutateAsync({ pathParams: { petId: '123' } })

// Deferred path params with options
const updateWithCache = api.updatePet.useMutation(undefined, {
  invalidateOperations: { listPets: {} },
})
await updateWithCache.mutateAsync({
  data: { name: 'Updated' },
  pathParams: { petId: '123' },
})

// With options
const mutation = api.createPet.useMutation({
  dontInvalidate: true,
  invalidateOperations: ['listPets'],
  onSuccess: (response) => console.log('Created:', response.data),
})
```

### Serialised mutations

The `serialize` option queues mutations so they run one at a time in submission order, preventing last-write-wins races in auto-save flows. It maps directly to TanStack Query v5's `scope` mechanism.

```typescript
// Auto-scope: derived from the resolved path — same resource, same queue
const patch = api.updateContract.useMutation({ contract_id: '123' }, { serialize: true })
await patch.mutateAsync({ data: changes1 })
await patch.mutateAsync({ data: changes2 }) // waits for changes1 to complete first

// String scope: share a queue across different operations
const updatePet = api.updatePet.useMutation({ petId: '1' }, { serialize: 'pet-editor' })
const updateStatus = api.updatePetStatus.useMutation({ petId: '1' }, { serialize: 'pet-editor' })
// Both mutations queue behind each other in submission order

// Raw TanStack scope passthrough also works without serialize:
const mutation = api.updatePet.useMutation({ petId: '1' }, { scope: { id: 'my-scope' } })
```

**`serialize: true` scope derivation:** the scope id is `serialize:<METHOD>:<resolvedPath>`, e.g. `serialize:PATCH:/api/contract/123`. Two components mutating the same resource (same path params at hook time) share a queue automatically; different resources do not block each other. The scope id is reactive: if hook-time path params are refs/getters and change, subsequent mutations use the updated scope.

**Deferred path params caveat:** when path parameters are supplied at `mutateAsync` time rather than hook time, the scope id falls back to the path template (e.g. `serialize:PATCH:/api/contract/{contract_id}`), serialising all mutations of that operation regardless of target resource. For per-resource granularity, supply path parameters at hook-creation time or use a string scope.

**Explicit `scope` always wins:** if both `scope` and `serialize` are set, `scope` takes precedence and a warning is logged.

### Global error policy

`createApiErrorCaches` builds the `queryCache` and `mutationCache` for your `QueryClient` with a single `onError` callback that observes every failure from hooks created by this library. It fires **once per logical failure, after retries**, and **never swallows the rejection** — the right place for a global error banner:

```typescript
import { createApiClient, createApiErrorCaches } from '@qualisero/openapi-endpoint'
import { QueryClient } from '@tanstack/vue-query'
import axios from 'axios'

const { queryCache, mutationCache } = createApiErrorCaches({
  onError: (error, ctx) => {
    // ctx: { operationId, path, method, kind: 'query' | 'mutation' }
    showErrorBanner(`Request to ${ctx.operationId} failed`)
  },
})

const queryClient = new QueryClient({ queryCache, mutationCache })
const api = createApiClient(axios.create({ baseURL: 'https://api.example.com' }), queryClient)
```

Notes:

- The callback is observe-only: the query or mutation still rejects.
- It fires for any rejection, including non-axios throws — narrow with `isAxiosError` (from `axios`) inside the callback.
- Queries and mutations you register yourself (outside the generated hooks) are untouched.

Opt out per call with `skipGlobalError` — `true` always suppresses the global policy for that call, or a predicate typed to the operation's declared error body suppresses it selectively:

```typescript
// Never trigger the global banner for this query
const { data } = api.getPet.useQuery({ petId: '123' }, { skipGlobalError: true })

// Skip only specific errors (e.g. you handle 409 inline)
const createPet = api.createPet.useMutation({
  skipGlobalError: (e) => e.response?.status === 409,
})
```

The promise rejects either way — `skipGlobalError` controls the global side-effect only.

### Typed errors

`error.value` is `AxiosError<TError> | null`, where `TError` is the operation's declared error body (the union of JSON bodies from its 4xx / 5xx / `default` responses). No more casting:

```typescript
const { error, mutateAsync } = api.createPet.useMutation()

// after a rejection, the declared error body is fully typed:
error.value?.response?.data?.errors // no cast, no hand-written interface
```

The generated `api-operations.ts` also exports helpers for use in plain functions:

```typescript
import type { ApiError, ApiErrorData } from './generated/api-operations'

type PetErrorBody = ApiErrorData<'createPet'>
function isConflict(e: ApiError<'createPet'>): boolean {
  return e.response?.status === 409
}
```

Operations that declare no JSON error body fall back to `unknown`.

### Axios Configuration

Pass custom Axios options through the `axiosOptions` parameter for advanced HTTP configuration:

```typescript
// Custom headers
const { data } = api.listPets.useQuery({
  axiosOptions: {
    headers: {
      'X-Custom-Header': 'custom-value',
      Authorization: 'Bearer token123',
    },
  },
})

// Timeout configuration
const { data } = api.getPet.useQuery(
  { petId: '123' },
  {
    axiosOptions: {
      timeout: 5000, // 5 second timeout
    },
  },
)

// Request/response transforms
const { data } = api.createPet.useMutation({
  axiosOptions: {
    transformRequest: [(data) => JSON.stringify(data)],
    transformResponse: [(data) => JSON.parse(data)],
  },
})

// Override baseURL for specific requests
const { data } = api.listPets.useQuery({
  axiosOptions: {
    baseURL: 'https://custom-api.example.com',
  },
})

// Custom properties (via AxiosRequestConfigExtended)
const { data } = api.listPets.useQuery({
  axiosOptions: {
    timeout: 5000,
    manualErrorHandling: true, // Custom property
    handledByAxios: false, // Custom property
    customRetryCount: 3, // Custom property
  },
})
```

**Common Axios options supported:**

- `headers` - Custom request headers
- `timeout` - Request timeout in milliseconds
- `baseURL` - Override base URL for this request
- `auth` - Basic authentication
- `withCredentials` - Include cookies in cross-origin requests
- `params` - URL parameters (merged with queryParams)
- `paramsSerializer` - Custom parameter serializer
- `transformRequest` / `transformResponse` - Request/response transformers
- `onUploadProgress` / `onDownloadProgress` - Progress callbacks
- `signal` - Request cancellation with AbortController
- `validateStatus` - Custom status code validation

**Note:** The `AxiosRequestConfigExtended` type also supports arbitrary custom properties beyond standard Axios options.

### Return Types

**Query Return:**

```typescript
{
  data: ComputedRef<T | undefined>
  isLoading: ComputedRef<boolean>
  error: Ref<AxiosError<TError> | null>
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
  error: Ref<AxiosError<TError> | null>
  mutate: (vars) => void
  mutateAsync: (vars) => Promise<AxiosResponse>
  extraPathParams: Ref<PathParams> // for dynamic path params
}
```

### Type Helpers

```typescript
import type {
  ApiResponse, // Response type (ALL fields required - default)
  ApiResponseStrict, // Response type (only readonly/required fields required - strict mode)
  ApiRequest, // Request body type
  ApiPathParams, // Path parameters type
  ApiQueryParams, // Query parameters type
} from './generated/api-operations'

// ApiResponse - default, ALL fields required
type PetResponse = ApiResponse<OpType.getPet>
// { readonly id: string, name: string, tag: string, status: 'available' | ... }

// ApiResponseStrict - strict mode, only readonly/required fields required
type PetResponseStrict = ApiResponseStrict<OpType.getPet>
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

#### ALL_CAPS enum labels

Pass `--enum-case const` to generate `SCREAMING_SNAKE_CASE` member labels instead of the default PascalCase:

```bash
npx openapi-endpoint --input openapi.json --output src/generated --enum-case const
```

```typescript
import { PetStatus } from './generated/api-enums'

// Labels are ALL_CAPS; values sent over the wire are unchanged
const { data } = api.listPets.useQuery({
  queryParams: { status: PetStatus.AVAILABLE }, // value is still 'available'
})
```

Only code-level labels change. The values sent over the wire, the emitted union types, and the runtime library behaviour are all unchanged.

## Documentation

For detailed guides, see [docs/manual/](docs/manual/):

- [Getting Started](docs/manual/01-getting-started.md)
- [Queries](docs/manual/02-queries.md)
- [Mutations](docs/manual/03-mutations.md)
- [Axios Configuration](docs/manual/08-axios-configuration.md)
- [Reactive Parameters](docs/manual/04-reactive-parameters.md)
- [File Uploads](docs/manual/05-file-uploads.md)
- [Cache Management](docs/manual/06-cache-management.md)
- [Lazy Queries](docs/manual/07-lazy-queries.md)
- [Global Error Policy](docs/manual/09-error-policy.md)

## License

MIT
