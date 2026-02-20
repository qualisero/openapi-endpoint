# OpenAPI Endpoint - Usage Guide

## Setup

```typescript
// api/init.ts
import { createApiClient } from '@qualisero/openapi-endpoint'

const api = createApiClient(axios.create({ baseURL: 'https://api.example.com' }))
```

## Queries (GET/HEAD/OPTIONS)

```typescript
// Simple query - no path params
const { data: pets, isLoading, isEnabled } = api.listPets.useQuery()

// With path params
const { data: pet } = api.getPet.useQuery({ petId: '123' })

// Reactive path params
const petId = ref('123')
const { data, refetch } = api.getPet.useQuery(computed(() => ({ petId: petId.value })))

// With query params - use enum for type safety
import { PetStatus } from './generated/api-enums'

const { data } = api.listPets.useQuery({
  queryParams: { limit: 10, status: PetStatus.Available },
})

// With options
const { data, onLoad } = api.listPets.useQuery({
  enabled: computed(() => isLoggedIn.value),
  staleTime: 5000,
  onLoad: (data) => console.log('Loaded:', data),
})

// onLoad as method
const query = api.getPet.useQuery({ petId: '123' })
query.onLoad((pet) => console.log('Pet:', pet.name))
```

## Mutations (POST/PUT/PATCH/DELETE)

```typescript
// Simple mutation
const createPet = api.createPet.useMutation()
await createPet.mutateAsync({ data: { name: 'Fluffy' } })

// With path params
const updatePet = api.updatePet.useMutation({ petId: '123' })
await updatePet.mutateAsync({ data: { name: 'Updated' } })

// Override path params at call time
const deletePet = api.deletePet.useMutation()
await deletePet.mutateAsync({ pathParams: { petId: '123' } })

// Cache control
const mutation = api.createPet.useMutation({
  dontInvalidate: true, // skip auto-invalidation
  invalidateOperations: ['listPets'], // manual invalidation
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

## Enums (from generated file)

The CLI extracts enum values from your OpenAPI spec and generates type-safe constants:

```typescript
import { PetStatus } from './generated/api-enums'

// Use enum constant for query params - intellisense + typo safety
const { data: pets } = api.listPets.useQuery({
  queryParams: { status: PetStatus.Available },
})

// Use in mutation body
await createPet.mutateAsync({
  data: { name: 'Fluffy', status: PetStatus.Pending },
})

// Type is inferred correctly
const status: PetStatus = PetStatus.Available // type: 'available'

// Still works with string literals
const { data } = api.listPets.useQuery({
  queryParams: { status: 'available' }, // also valid
})
```

### Enum Naming

Enums are named as `{SchemaName}{PropertyName}` in PascalCase:

```typescript
// components.schemas.Pet.properties.status → PetStatus
export const PetStatus = {
  Available: 'available' as const,
  Pending: 'pending' as const,
  Adopted: 'adopted' as const,
} as const

export type PetStatus = (typeof PetStatus)[keyof typeof PetStatus]
```

Duplicate enums (same values) are automatically deduplicated.

### When to use ApiResponseSafe

Use `ApiResponseSafe` when your backend may omit optional fields in responses:

```typescript
// Default: ApiResponse (assumes reliable backend)
type Response = ApiResponse<OpType.getPet>
const pet: Response = { id: '1', name: 'Fluffy', tag: 'friendly', status: PetStatus.Available }
const tag: string = pet.tag // OK - guaranteed to exist

// Opt-out: ApiResponseSafe (for unreliable backends)
type Response = ApiResponseSafe<OpType.getPet>
const pet: Response = { id: '1', name: 'Fluffy' } // tag and status can be omitted
const tag: string | undefined = pet.tag // May be undefined
```
