# OpenAPI Endpoint - Usage Guide

## Setup

```typescript
// api/init.ts
import { useOpenApi } from '@qualisero/openapi-endpoint'
import { openApiOperations, type OpenApiOperations, OperationId } from './generated/api-operations'

const api = useOpenApi<OpenApiOperations>({
  operations: openApiOperations,
  axios: axios.create({ baseURL: 'https://api.example.com' }),
})
```

## Queries (GET/HEAD/OPTIONS)

```typescript
// Simple query - no path params
const { data: pets, isLoading, isEnabled } = api.useQuery(OperationId.listPets)

// With path params
const { data: pet } = api.useQuery(OperationId.getPet, { petId: '123' })

// Reactive path params
const petId = ref('123')
const { data, refetch } = api.useQuery(
  OperationId.getPet,
  computed(() => ({ petId: petId.value })),
)

// With query params
const { data } = api.useQuery(OperationId.listPets, {
  queryParams: { limit: 10, status: 'available' },
})

// With options
const { data, onLoad } = api.useQuery(OperationId.listPets, {
  enabled: computed(() => isLoggedIn.value),
  staleTime: 5000,
  onLoad: (data) => console.log('Loaded:', data),
})

// onLoad as method
const query = api.useQuery(OperationId.getPet, { petId: '123' })
query.onLoad((pet) => console.log('Pet:', pet.name))
```

## Mutations (POST/PUT/PATCH/DELETE)

```typescript
// Simple mutation
const createPet = api.useMutation(OperationId.createPet)
await createPet.mutateAsync({ data: { name: 'Fluffy' } })

// With path params
const updatePet = api.useMutation(OperationId.updatePet, { petId: '123' })
await updatePet.mutateAsync({ data: { name: 'Updated' } })

// Override path params at call time
const deletePet = api.useMutation(OperationId.deletePet)
await deletePet.mutateAsync({ pathParams: { petId: '123' } })

// Cache control
const mutation = api.useMutation(OperationId.createPet, {
  dontInvalidate: true, // skip auto-invalidation
  invalidateOperations: [OperationId.listPets], // manual invalidation
  onSuccess: (response) => console.log('Created:', response.data),
})
```

## Return Types

### Query Return

```typescript
interface EndpointQueryReturn {
  data: ComputedRef<Pet | undefined>
  isLoading: ComputedRef<boolean>
  error: ComputedRef<Error | null>
  isEnabled: ComputedRef<boolean>
  queryKey: ComputedRef<unknown[]>
  onLoad: (cb: (data: Pet) => void) => void
  refetch: () => Promise<void>
}
```

### Mutation Return

```typescript
interface EndpointMutationReturn {
  data: ComputedRef<AxiosResponse<Pet> | undefined>
  isPending: ComputedRef<boolean>
  error: ComputedRef<Error | null>
  mutate: (vars) => void
  mutateAsync: (vars) => Promise<AxiosResponse>
  extraPathParams: Ref<PathParams> // for dynamic path params
}
```

## Type Helpers (from generated file)

```typescript
import type {
  ApiResponse, // Response data type (all fields required)
  ApiResponseSafe, // Response with optional fields (for unreliable backends)
  ApiRequest, // Request body type
  ApiPathParams, // Path parameters type
  ApiQueryParams, // Query parameters type
} from './generated/api-operations'

// ApiResponse - ALL fields required, no null checks needed
type PetResponse = ApiResponse<OpType.getPet>
// { readonly id: string, name: string, tag: string, status: 'available' | 'pending' | 'sold' }

// ApiResponseSafe - only readonly fields required, others optional
type PetResponseSafe = ApiResponseSafe<OpType.getPet>
// { readonly id: string, name: string, tag?: string, status?: 'available' | 'pending' | 'sold' }

// Other type helpers
type CreateBody = ApiRequest<OpType.createPet> // { name: string, tag?: string, status?: ... }
type GetParams = ApiPathParams<OpType.getPet> // { petId: string | undefined }
type ListParams = ApiQueryParams<OpType.listPets> // { limit?: number, status?: string }
```

### When to use ApiResponseSafe

Use `ApiResponseSafe` when your backend may omit optional fields in responses:

```typescript
// Default: ApiResponse (assumes reliable backend)
type Response = ApiResponse<OpType.getPet>
const pet: Response = { id: '1', name: 'Fluffy', tag: 'friendly', status: 'available' }
const tag: string = pet.tag // OK - guaranteed to exist

// Opt-out: ApiResponseSafe (for unreliable backends)
type Response = ApiResponseSafe<OpType.getPet>
const pet: Response = { id: '1', name: 'Fluffy' } // tag and status can be omitted
const tag: string | undefined = pet.tag // May be undefined
```

## Constants

```typescript
import { HttpMethod, QUERY_METHODS, MUTATION_METHODS } from '@qualisero/openapi-endpoint'

// HTTP methods enum
HttpMethod.GET
HttpMethod.POST
HttpMethod.PUT
// ...

// Method categorization arrays
QUERY_METHODS // [GET, HEAD, OPTIONS]
MUTATION_METHODS // [POST, PUT, PATCH, DELETE]
```
