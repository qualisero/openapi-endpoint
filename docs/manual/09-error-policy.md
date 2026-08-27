# Global Error Policy

This guide covers `createApiErrorCaches` — the client-level hook for observing API errors once
per logical failure, after all retries, without swallowing the rejection.

## Why a client-level policy?

The deprecated `errorHandler` option fires per retry attempt and silently swallows the rejection
unless you rethrow. The `QueryCache` / `MutationCache` `onError` hooks fire **once**, after
retries are exhausted, and the promise always rejects regardless.

For a global error banner, toast, or logger that should trigger exactly once per failed call,
`createApiErrorCaches` is the right place.

## Setup

Pass `createApiErrorCaches` the `onError` callback, then supply the returned caches to your
`QueryClient`:

```typescript
import { QueryClient } from '@tanstack/vue-query'
import { createApiErrorCaches } from '@qualisero/openapi-endpoint'
import { isAxiosError } from 'axios'

const { queryCache, mutationCache } = createApiErrorCaches({
  onError(error, ctx) {
    // error is unknown — narrow it before accessing network-specific fields.
    if (isAxiosError(error) && error.response?.status === 401) {
      router.push('/login')
      return
    }

    // ctx carries operation identity
    console.error(`[${ctx.method} ${ctx.path}] ${ctx.operationId} failed`, error)

    // Show a global banner / toast
    showErrorBanner('Request failed. Please try again.')
  },
})

export const queryClient = new QueryClient({ queryCache, mutationCache })
```

The `ApiErrorContext` object passed to `onError`:

| Field         | Type                    | Example              |
| ------------- | ----------------------- | -------------------- |
| `operationId` | `string`                | `'createVessel'`     |
| `path`        | `string`                | `'/api/vessel/{id}'` |
| `method`      | `HttpMethod`            | `'POST'`             |
| `kind`        | `'query' \| 'mutation'` | `'mutation'`         |

## Suppressing the policy for specific calls

Use `skipGlobalError` on any hook call to opt out:

```typescript
// Always suppress — you handle this error inline
const { data } = api.getPet.useQuery({ petId: '123' }, { skipGlobalError: true })

// Suppress selectively — only 409 conflicts are handled inline, other errors go global
const createPet = api.createPet.useMutation({
  skipGlobalError: (e) => e.response?.status === 409,
})
```

The predicate receives an `AxiosError` typed to the operation's declared error body. The
promise always rejects regardless of whether the global policy is suppressed.

## Behaviour guarantees

- **Once per logical failure.** `onError` fires after all retries are exhausted, not per attempt.
- **Never swallows.** The rejection propagates normally; `onError` is observe-only.
- **No-op for unstamped queries.** Ad-hoc queries registered directly on the `QueryClient`
  (without the library hooks) do not trigger `onError`, so your pre-existing raw queries are
  untouched.
- **Mutations included.** `createApiErrorCaches` wires both the `QueryCache` and `MutationCache`,
  so `useMutation` failures are covered with `ctx.kind === 'mutation'`.

## What's Next?

- [Lazy Queries](./07-lazy-queries.md) — Manual fetch control with `useLazyQuery`
- [Cache Management](./06-cache-management.md) — Advanced cache strategies
- [Axios Configuration](./08-axios-configuration.md) — Custom Axios options
