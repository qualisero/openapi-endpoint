import { toValue } from 'vue'
import { QueryCache, MutationCache } from '@tanstack/query-core'
import { isAxiosError, type AxiosError } from 'axios'

import type { EndpointConfig, ApiErrorContext, ApiErrorPolicy, ApiErrorPolicyOptions } from './types'

/**
 * Meta key written by `stampErrorPolicyMeta` and read by the caches created
 * via `createApiErrorCaches`. One file owns the wire format so hooks and caches
 * cannot drift independently.
 */
export const ERROR_POLICY_META_KEY = '__openapiEndpoint'

/**
 * Wire format stored under `ERROR_POLICY_META_KEY` in TanStack query/mutation
 * meta. Internal — do not depend on the shape outside this file.
 */
interface ErrorPolicyStamp {
  ctx: ApiErrorContext
  skipGlobalError?: boolean | ((error: AxiosError<unknown>) => boolean)
}

/**
 * Strip `skipGlobalError` from caller options and merge an identity stamp into
 * `meta`. Returns `rest` (options without `skipGlobalError`) and the merged
 * `meta` object to spread into the TanStack hook call.
 *
 * Merges rather than clobbers a caller-supplied `meta`: existing keys survive.
 * The `meta` field may be reactive inside `QueryOptions`/`MutationOptions`
 * (wrapped by `MaybeRefDeep`); it is typed as `unknown` here so that both
 * reactive and plain forms are accepted. The merged output is always a plain
 * `Record<string, unknown>` — TanStack reads it synchronously in cache hooks.
 *
 * @internal Called by hooks only — not part of the public API surface.
 */
export function stampErrorPolicyMeta<
  T extends {
    // meta is `unknown` here because QueryOptions/MutationOptions wrap it in
    // MaybeRefDeep, producing reactive variants that are not assignable to
    // `Record<string, unknown>`. We cast to plain Record in the body.
    meta?: unknown
    // skipGlobalError is `unknown` here (not the specific predicate type) because
    // when TError is narrower than `unknown`, the predicate parameter is narrowed
    // too (e.g. AxiosError<string>), and under strictFunctionTypes that narrowed
    // function type is not assignable to (error: AxiosError<unknown>) => boolean.
    // We cast to the concrete type in the body before storing in ErrorPolicyStamp.
    skipGlobalError?: unknown
  },
>(
  options: T | undefined,
  config: EndpointConfig,
  kind: 'query' | 'mutation',
): { rest: Omit<T, 'skipGlobalError'>; meta: Record<string, unknown> } {
  const { skipGlobalError, ...rest } = (options ?? {}) as T & {
    skipGlobalError?: boolean | ((error: AxiosError<unknown>) => boolean)
  }

  const ctx: ApiErrorContext = {
    operationId: config.operationId ?? `${config.method} ${config.path}`,
    path: config.path,
    method: config.method,
    kind,
  }

  const stamp: ErrorPolicyStamp = { ctx }
  if (skipGlobalError !== undefined) {
    stamp.skipGlobalError = skipGlobalError
  }

  // toValue() unwraps any Ref-valued meta before spreading; without it a
  // caller passing meta: ref({…}) would have the ref's internals ({__v_isRef,
  // _value, …}) spread into the merged object instead of the resolved value.
  const callerMeta = toValue(options?.meta) as Record<string, unknown> | undefined
  const meta: Record<string, unknown> = {
    ...callerMeta,
    [ERROR_POLICY_META_KEY]: stamp,
  }

  return { rest: rest as Omit<T, 'skipGlobalError'>, meta }
}

/**
 * Create a `QueryCache` and `MutationCache` pre-wired with the library's error
 * policy. Pass them to your `QueryClient` constructor:
 *
 * ```ts
 * const { queryCache, mutationCache } = createApiErrorCaches({
 *   onError(error, ctx) {
 *     // observe-only: the promise always rejects afterwards.
 *     showErrorBanner(ctx.operationId)
 *   }
 * })
 * const queryClient = new QueryClient({ queryCache, mutationCache })
 * ```
 *
 * **Observe-only.** `opts.onError` is a side-effect hook — the promise always
 * rejects regardless of what the callback does or returns.
 *
 * **`error` is `unknown`, not `AxiosError`**, because cache-level `onError`
 * fires for ANY rejection, including non-axios throws (e.g. errors synthesised
 * by request interceptors). Narrow with `isAxiosError` inside the policy.
 *
 * **The returned caches own `config.onError`.** A consumer that needs an
 * additional cache-level `onError` must compose it inside `opts.onError`, not
 * replace the caches.
 *
 * @param opts - Policy options including the `onError` callback.
 */
export function createApiErrorCaches(opts: ApiErrorPolicyOptions): {
  queryCache: QueryCache
  mutationCache: MutationCache
} {
  const onError: ApiErrorPolicy | undefined = opts.onError

  function handleError(error: unknown, stamp: ErrorPolicyStamp | undefined): void {
    if (!stamp) return

    const { skipGlobalError, ctx } = stamp

    if (skipGlobalError === true) return

    if (typeof skipGlobalError === 'function') {
      if (isAxiosError(error) && skipGlobalError(error as AxiosError<unknown>)) return
    }

    onError?.(error, ctx)
  }

  const queryCache = new QueryCache({
    onError(error: unknown, query: { meta?: Record<string, unknown> }) {
      const stamp = query.meta?.[ERROR_POLICY_META_KEY] as ErrorPolicyStamp | undefined
      handleError(error, stamp)
    },
  })

  const mutationCache = new MutationCache({
    onError(error: unknown, _variables: unknown, _context: unknown, mutation: { meta?: Record<string, unknown> }) {
      const stamp = mutation.meta?.[ERROR_POLICY_META_KEY] as ErrorPolicyStamp | undefined
      handleError(error, stamp)
    },
  })

  return { queryCache, mutationCache }
}
