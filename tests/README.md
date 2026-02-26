# Test Suite for OpenAPI Endpoint Library

This directory contains comprehensive unit tests for the `@qualisero/openapi-endpoint` library.

## Test Architecture

### Layered Mocking Strategy

The test suite uses a **layered mocking architecture** that mocks only at the HTTP boundary while running real application code:

```
✅ Vue (real) → ✅ TanStack Query (real) → ✅ Library Code (real) → ❌ Axios (mocked)
```

**Why this approach?**

- Tests verify actual reactive behavior (Vue `ref`, `computed`, `watch`)
- Tests verify actual cache behavior (TanStack Query deduplication, stale-time, observers)
- Tests verify actual error propagation through the real stack
- Only HTTP requests are mocked (the appropriate boundary for unit tests)

### Test Categories

Tests are organized into three categories:

#### Category A: Pure Logic Tests

Tests that don't require Vue/TanStack at all (pure TypeScript functions).

**Files:**

- `openapi-utils.test.ts` - Path resolution, query key generation
- `openapi-helpers.test.ts` - Operation info, query/mutation detection
- `list-query-invalidation-predicate.test.ts` - Predicate function logic
- `cli.test.ts` - Code generation (string output)
- `cli-integration.test.ts` - Code generation (file output)

#### Category C: Structural/Shape Tests

Tests that verify the API shape and TypeScript types with real Vue/TanStack, but don't assert on reactive behavior.

**Files:**

- `api-usage.test.ts` - Full API usage patterns and examples
- `axios-configuration.test.ts` - Axios options forwarding
- `query-mutation-options.test.ts` - TanStack option pass-through
- `reactive-query-params.test.ts` - Reactive parameter wiring
- `readonly-properties.test.ts` - Type utility correctness
- `mutation-typing.test.ts` - Mutation return type wiring
- `bugfix/queryclient-no-cast.test.ts` - QueryClient type compatibility
- `bugfix/queryclient-types.test.ts` - EndpointConfig type compatibility

#### Category D: Data-Flow Tests

Tests that assert on reactive state changes, cache behavior, error propagation, and call counts with real Vue/TanStack.

**Files:**

- `lazy-query.test.ts` - Full useLazyQuery runtime pipeline with reactivity
- `bugfix/lazy-query-no-double-fire.test.ts` - useLazyQuery doesn't auto-fetch

**Setup pattern:**

```typescript
import { effectScope } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { createTestScope } from '../helpers'

let scope: ReturnType<typeof effectScope>
let api: ReturnType<typeof createApiClient>

beforeEach(() => {
  vi.clearAllMocks()
  ;({ api, scope } = createTestScope())
})

afterEach(() => {
  scope.stop()
})

it('example test', async () => {
  mockAxios.mockResolvedValueOnce({ data: [...] })
  const query = scope.run(() => api.listPets.useLazyQuery())!
  await query.fetch()
  await flushPromises()
  expect(query.data.value).toEqual([...])
})
```

## Test Structure

### Core Files

```
tests/
├── setup.ts                    # Global setup (mocks axios only)
├── helpers/
│   └── index.ts               # Test utilities (createTestScope, createTestQueryClient)
├── fixtures/
│   ├── api-client.ts          # Generated API client (from toy-openapi.json)
│   ├── api-operations.ts      # Generated operation types
│   ├── api-types.ts           # Generated response/request types
│   └── ...                    # Other generated files
├── typing/                     # Compile-time only type tests
│   ├── lazy-query.ts
│   ├── mutation-typing.ts
│   └── ...
├── unit/                       # Main test suite
│   ├── api-usage.test.ts
│   ├── lazy-query.test.ts
│   └── ...
└── bugfix/                     # Regression tests
    ├── lazy-query-no-double-fire.test.ts
    └── ...
```

### Test Helpers

**`createTestQueryClient()`**
Creates a fresh QueryClient with test defaults:

- `retry: false` - errors surface immediately
- `gcTime: 0` - cache entries removed immediately on cleanup
- `staleTime: 0` - data always considered stale (override per-test when testing stale-time)

**`createTestScope(axiosMock?, queryClient?)`**
Creates a Vue effectScope with API client, ensuring proper reactivity and cleanup:

- Returns `{ api, scope, queryClient, mockAxios }`
- Must call `scope.stop()` in `afterEach` to clean up watchers
- Required for Category D tests that assert on reactive updates

### Mocking Setup

**`tests/setup.ts`** provides a minimal axios mock:

```typescript
export const mockAxios = vi.fn(() => Promise.resolve({ data: {} }))
```

Tests control responses with:

```typescript
mockAxios.mockResolvedValueOnce({ data: [...] })
mockAxios.mockRejectedValueOnce(new Error('Network error'))
```

Tests assert calls with:

```typescript
expect(mockAxios).toHaveBeenCalledWith(
  expect.objectContaining({
    method: 'get',
    url: '/pets',
    params: { limit: 10 },
  }),
)
```

## Running Tests

### Basic Commands

```bash
# Run all tests once
npm run test:run

# Run tests in watch mode
npm test

# Run tests with coverage
npm run test:coverage

# Run tests with UI (browser interface)
npm run test:ui

# Run specific test file
npm test -- tests/unit/lazy-query.test.ts

# Run tests matching a pattern
npm test -- -t "useLazyQuery"
```

### Test Configuration

Tests are configured using Vitest with:

- **Environment**: jsdom (for Vue reactivity)
- **Mocking**: Only axios is mocked at the HTTP boundary
- **Global**: `describe`, `it`, `expect`, `vi` are available globally
- **Real Dependencies**: Vue and TanStack Query run as real code

## Test Results

Current test status:

```
✅ Test Files: 15 passed (15)
✅ Tests: 343 passed (343)
```

### Test Files Summary

| Category       | Files | Tests | Description                 |
| -------------- | ----- | ----- | --------------------------- |
| A (Pure Logic) | 5     | ~74   | Pure TypeScript functions   |
| C (Structural) | 8     | ~256  | API shape and type checking |
| D (Data-Flow)  | 2     | ~13   | Reactive behavior and cache |

## Key Testing Patterns

### 1. Type Safety

Tests validate TypeScript type constraints at both compile-time and runtime:

```typescript
type ExpectedType = ApiResponse<'getPet'>
const _typeCheck: ActualType extends ExpectedType ? true : false = true
expect(_typeCheck).toBe(true)
```

### 2. Reactive Behavior

Category D tests verify Vue reactivity:

```typescript
const petId = ref('123')
const query = scope.run(() => api.getPet.useQuery({ petId }))!

petId.value = '456' // Change reactive value
await flushPromises() // Drain Vue scheduler

expect(query.queryKey.value).toEqual(['pets', '456'])
```

### 3. Cache Behavior

Tests verify TanStack Query cache deduplication:

```typescript
mockAxios.mockResolvedValueOnce({ data: [...] })

const query1 = api.listPets.useQuery({ queryParams: { limit: 10 } })
const query2 = api.listPets.useQuery({ queryParams: { limit: 10 } })

await flushPromises()

// Both queries share same cache key, so only 1 HTTP call
expect(mockAxios).toHaveBeenCalledTimes(1)
```

### 4. Error Propagation

Tests verify error handling through the real stack:

```typescript
mockAxios.mockRejectedValueOnce(new Error('Network error'))

const query = scope.run(() => api.listPets.useLazyQuery())!
await expect(query.fetch()).rejects.toThrow('Network error')
await flushPromises()

expect(query.isError.value).toBe(true)
expect(query.error.value).toBeTruthy()
```

### 5. Async Coordination

Use `flushPromises()` to drain Vue's scheduler after async operations:

```typescript
await query.fetch()
await flushPromises() // Wait for Vue to update reactive properties

expect(query.data.value).toEqual([...]) // Now reflects cache update
```

## Test Data

The toy OpenAPI specification (`fixtures/toy-openapi.json`) includes:

- **12+ operations**: GET, POST, PUT, DELETE, PATCH
- **Path parameters**: `{petId}`, `{userId}`, `{pet_id}` (snake_case)
- **Query parameters**: `limit`, `q`, `species`, `status`
- **Nested resources**: `/users/{userId}/pets`
- **Complete schemas**: Pet, NewPet, Owner with proper typing
- **Readonly fields**: `id` marked as readonly in schemas
- **Enums**: PetStatus enum values

## Adding New Tests

When adding new functionality:

1. **Determine test category** (A, C, or D)
2. **Follow the appropriate pattern** (pure function, structural, or data-flow)
3. **Use helpers appropriately**:
   - Category A: No helpers needed
   - Category C: Use `createTestQueryClient()`
   - Category D: Use `createTestScope()` + `flushPromises()`
4. **Mock axios responses** for the exact calls your test makes
5. **Clean up scopes** in `afterEach` for Category D tests

### Test File Template (Category D)

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { effectScope } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockAxios } from '../setup'
import { createTestScope } from '../helpers'
import { createApiClient } from '../fixtures/api-client'

describe('My Feature', () => {
  let scope: ReturnType<typeof effectScope>
  let api: ReturnType<typeof createApiClient>

  beforeEach(() => {
    vi.clearAllMocks()
    ;({ api, scope } = createTestScope())
  })

  afterEach(() => {
    scope.stop()
  })

  it('should do something reactive', async () => {
    mockAxios.mockResolvedValueOnce({ data: { id: '1', name: 'Test' } })

    const result = scope.run(() => api.myOperation.useQuery())!

    await flushPromises()

    expect(result.data.value).toEqual({ id: '1', name: 'Test' })
  })
})
```

## Continuous Integration

Tests are designed to run in CI environments with:

- No external dependencies (all peer deps are real, not installed separately)
- Deterministic results (controlled mocking at HTTP boundary)
- Fast execution (~1.5 seconds total)
- Clear error messages with stack traces

## Implementation Notes

### Header Deep-Merge

Both queries and mutations deep-merge headers from hook-level and call-level `axiosOptions`:

```typescript
headers: {
  ...(hookAxiosOptions?.headers || {}),
  ...(callAxiosOptions?.headers || {}),
}
```

This ensures headers from both sources are preserved (call-level takes precedence on conflicts).

### Vue Warnings

Some Category C tests may show warnings like:

```
[Vue warn] onScopeDispose() is called when there is no active effect scope
```

These are benign warnings from TanStack/Vue cleanup code running outside an effectScope. They don't affect test correctness (all tests pass). Category D tests use `effectScope` and don't produce these warnings.

## Coverage Goals

Current focus is on:

- ✅ 100% coverage of public API surface
- ✅ Complete reactive behavior verification
- ✅ Cache behavior validation
- ✅ Error propagation testing
- ⏳ Edge cases and error conditions (ongoing)

## Migration Notes

Previous versions of the test suite used global mocks for Vue, TanStack Query, and the library itself. This has been replaced with the layered mocking architecture for the following reasons:

1. **Realistic behavior**: Real Vue and TanStack provide actual reactive and cache behavior
2. **Accurate testing**: Mocking these layers required reimplementing their complex logic in tests
3. **Maintainability**: Real dependencies auto-update; mocks need manual maintenance
4. **Confidence**: Tests now verify the actual production code paths

The only remaining mock is axios at the HTTP boundary, which is the appropriate layer for unit testing HTTP clients.
