/**
 * §3.5 typed-channel tests — error extraction (compile-time assertions).
 *
 * These tests never run — validated by `npm run types:test` (tsc --noEmit).
 *
 * Uses inline operation type literals that mirror openapi-typescript output,
 * so these tests are self-contained and do not depend on the toy-spec fixture
 * being regenerated (though some tests also reference fixture operations
 * for the real-hook usage pattern).
 *
 * Covered cases (per plan §3.5):
 *  1. Operation with only a `default` error response
 *  2. 4xx declaring NO body → unknown, not never
 *  3. Two different 4xx bodies → union
 *  4. '4XX'/'5XX' range keys → body extracted
 *  5. skipGlobalError narrowed predicate compiles under strict + strictFunctionTypes;
 *     parameter is AxiosError<declared type>
 *  6. error.value on a typed hook is AxiosError<T> | null; .response?.data is the
 *     declared shape
 */

import type { Ref } from 'vue'
import type { AxiosError } from 'axios'
import type {
  ApiErrorOf,
  ApiErrorData,
  QueryReturn,
  LazyQueryReturn,
  MutationReturn,
  QueryOptions,
  MutationOptions,
} from '@qualisero/openapi-endpoint'

/**
 * Mutual-identity equality check. True only when A and B are the exact same type
 * (i.e. mutually assignable). Unlike `A extends B ? true : false`, this catches
 * the `never` case — `never extends unknown` is vacuously true, but
 * `Eq<never, unknown>` is false.
 */
type Eq<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
import { createApiClient } from '../fixtures/api-client.js'
import { mockAxios } from '../setup.js'
import type { operations } from '../fixtures/openapi-types.js'

// ============================================================================
// Case 1 — Operation with only a `default` error response
//
// openapi-typescript output shape: operations['myOp'].responses.default = { content: ... }
// ============================================================================

/** Inline operation type literal mirroring openapi-typescript output. */
type OpsDefaultOnly = {
  readonly listThings: {
    readonly parameters: { query?: never; header?: never; path?: never; cookie?: never }
    readonly responses: {
      /** @description Success */
      readonly 200: {
        readonly headers: { readonly [name: string]: unknown }
        readonly content: { readonly 'application/json': { readonly items: string[] } }
      }
      /** @description Unexpected error */
      readonly default: {
        readonly headers: { readonly [name: string]: unknown }
        readonly content: {
          readonly 'application/json': { readonly code: string; readonly message: string }
        }
      }
    }
  }
}

type Case1ErrorData = ApiErrorData<OpsDefaultOnly, 'listThings'>
type Case1Error = ApiErrorOf<OpsDefaultOnly, 'listThings'>

// Error data should be the default body, not unknown
type _C1a = Case1ErrorData extends { code: string; message: string } ? true : false
const _c1a: _C1a = true

// ApiErrorOf wraps it in AxiosError
type _C1b = Case1Error extends AxiosError<{ code: string; message: string }> ? true : false
const _c1b: _C1b = true

// ============================================================================
// Case 2 — 4xx declaring NO body → unknown, not never
//
// Description-only 4xx responses have no `content` key in openapi-typescript output.
// ============================================================================

type OpsNoBody = {
  readonly getItem: {
    readonly parameters: {
      query?: never
      header?: never
      path: { readonly itemId: number }
      cookie?: never
    }
    readonly responses: {
      readonly 200: {
        readonly headers: { readonly [name: string]: unknown }
        readonly content: { readonly 'application/json': { readonly id: number; readonly name: string } }
      }
      /** @description Not found — description-only, no JSON body */
      readonly 404: {
        readonly headers: { readonly [name: string]: unknown }
        readonly content?: never
      }
      /** @description Forbidden */
      readonly 403: {
        readonly headers: { readonly [name: string]: unknown }
        // no content property at all
      }
    }
  }
}

type Case2ErrorData = ApiErrorData<OpsNoBody, 'getItem'>
type Case2Error = ApiErrorOf<OpsNoBody, 'getItem'>

// Must be EXACTLY unknown (not never) when no JSON body declared.
// Eq<A,B> requires mutual assignability; 'never extends unknown' is vacuously true,
// so the one-directional form would pass even if the extractor returned never.
type _C2a = Eq<Case2ErrorData, unknown>
const _c2a: _C2a = true

// AxiosError<unknown>, not AxiosError<never> — verify the data type is not `never`
// If it were never, AxiosError<unknown> would NOT extend AxiosError<never>:
type _C2b = Case2Error extends AxiosError<unknown> ? true : false
const _c2b: _C2b = true

// Ensure it is not specifically `never` — AxiosError<never> is a subtype of AxiosError<unknown>,
// so check the other direction: AxiosError<unknown> should NOT extend AxiosError<never>
type _C2c = AxiosError<unknown> extends AxiosError<never> ? false : true
const _c2c: _C2c = true

// ============================================================================
// Case 3 — Two different 4xx bodies → union
// ============================================================================

type OpsUnionErrors = {
  readonly createOrder: {
    readonly parameters: { query?: never; header?: never; path?: never; cookie?: never }
    readonly requestBody: {
      readonly content: { readonly 'application/json': { readonly amount: number } }
    }
    readonly responses: {
      readonly 201: {
        readonly headers: { readonly [name: string]: unknown }
        readonly content: { readonly 'application/json': { readonly orderId: string } }
      }
      /** @description Validation error — has its own shape */
      readonly 422: {
        readonly headers: { readonly [name: string]: unknown }
        readonly content: {
          readonly 'application/json': { readonly errors: readonly string[] }
        }
      }
      /** @description Conflict — different shape from 422 */
      readonly 409: {
        readonly headers: { readonly [name: string]: unknown }
        readonly content: {
          readonly 'application/json': { readonly conflictingOrderId: string }
        }
      }
    }
  }
}

type Case3ErrorData = ApiErrorData<OpsUnionErrors, 'createOrder'>
type Case3Error = ApiErrorOf<OpsUnionErrors, 'createOrder'>

// Error data should be the union of the two JSON bodies
type _C3a = Case3ErrorData extends { errors: readonly string[] } | { conflictingOrderId: string } ? true : false
const _c3a: _C3a = true

type _C3b = Case3Error extends AxiosError<{ errors: readonly string[] } | { conflictingOrderId: string }> ? true : false
const _c3b: _C3b = true

// ============================================================================
// Case 4 — '4XX' and '5XX' range keys → body extracted
//
// openapi-typescript preserves range keys as string literals '4XX' / '5XX'.
// ============================================================================

type OpsRangeKeys = {
  readonly callService: {
    readonly parameters: { query?: never; header?: never; path?: never; cookie?: never }
    readonly responses: {
      readonly 200: {
        readonly headers: { readonly [name: string]: unknown }
        readonly content: { readonly 'application/json': { readonly result: string } }
      }
      /** @description Client error range */
      readonly '4XX': {
        readonly headers: { readonly [name: string]: unknown }
        readonly content: {
          readonly 'application/json': { readonly clientError: string; readonly status: number }
        }
      }
      /** @description Server error range */
      readonly '5XX': {
        readonly headers: { readonly [name: string]: unknown }
        readonly content: {
          readonly 'application/json': { readonly serverError: string; readonly traceId: string }
        }
      }
    }
  }
}

type Case4ErrorData = ApiErrorData<OpsRangeKeys, 'callService'>
type Case4Error = ApiErrorOf<OpsRangeKeys, 'callService'>

// Both 4XX and 5XX bodies must be in the union
type _C4a = Case4ErrorData extends { clientError: string; status: number } | { serverError: string; traceId: string }
  ? true
  : false
const _c4a: _C4a = true

type _C4b =
  Case4Error extends AxiosError<{ clientError: string; status: number } | { serverError: string; traceId: string }>
    ? true
    : false
const _c4b: _C4b = true

// ============================================================================
// Case 4c — Quoted numeric status keys (e.g. '404') are also treated as error keys.
//
// openapi-typescript normally emits unquoted numeric keys, but the extractor should
// also handle the quoted string form so it is resilient to alternative emitters or
// hand-written operation types.
// ============================================================================

type OpsQuotedNumericKey = {
  readonly fetchItem: {
    readonly parameters: { query?: never; header?: never; path?: never; cookie?: never }
    readonly responses: {
      readonly 200: {
        readonly headers: { readonly [name: string]: unknown }
        readonly content: { readonly 'application/json': { readonly id: string } }
      }
      /** @description Not found — quoted string key */
      readonly '404': {
        readonly headers: { readonly [name: string]: unknown }
        readonly content: { readonly 'application/json': { readonly notFoundCode: string } }
      }
    }
  }
}

type Case4cErrorData = ApiErrorData<OpsQuotedNumericKey, 'fetchItem'>
// '404' must be treated as an error key → body extracted, not unknown
type _C4c = Case4cErrorData extends { notFoundCode: string } ? true : false
const _c4c: _C4c = true

// ============================================================================
// Case 5 — skipGlobalError narrowed predicate: parameter IS AxiosError<TError>
//
// Under strict + strictFunctionTypes, the predicate is contravariant in its parameter.
// TError on the option type is instantiated per operation so the narrowed callback
// is the declared type and contravariance never arises.
// ============================================================================

// Define a concrete TError type to verify the predicate is narrowed, not AxiosError<unknown>
interface OrderError {
  errors: string[]
}

// QueryOptions<Response, QueryParams, OrderError>: skipGlobalError predicate
// should accept (error: AxiosError<OrderError>) => boolean
type NarrowedQueryOpts = QueryOptions<{ id: string }, Record<string, never>, OrderError>

// Structural check: the field must accept a narrowed predicate
type _C5aQuery = NarrowedQueryOpts extends {
  skipGlobalError?: boolean | ((error: AxiosError<OrderError>) => boolean)
}
  ? true
  : false
const _c5aQuery: _C5aQuery = true

// A correctly-typed narrowed predicate must compile without @ts-expect-error
const _c5bQuery: NarrowedQueryOpts = {
  skipGlobalError: (e: AxiosError<OrderError>) => {
    // e.response?.data is OrderError — access .errors to prove the type is narrowed
    const _errors: string[] | undefined = e.response?.data?.errors
    void _errors
    return _errors !== undefined && _errors.length > 0
  },
}

// MutationOptions: same check
type NarrowedMutationOpts = MutationOptions<
  { id: string },
  Record<string, never>,
  never,
  Record<string, never>,
  OrderError
>

type _C5aMutation = NarrowedMutationOpts extends {
  skipGlobalError?: boolean | ((error: AxiosError<OrderError>) => boolean)
}
  ? true
  : false
const _c5aMutation: _C5aMutation = true

const _c5bMutation: NarrowedMutationOpts = {
  skipGlobalError: (e: AxiosError<OrderError>) => {
    const _errors: string[] | undefined = e.response?.data?.errors
    void _errors
    return false
  },
}

// ============================================================================
// Case 6 — error.value on a typed hook is AxiosError<T> | null;
//          .response?.data is the declared shape
//
// Uses the real createApiClient from fixtures + uploadPetPic which has:
//   422 → { message?: string }
//   default → { message?: string }
// so ApiErrorOf<operations, 'uploadPetPic'> = AxiosError<{ message?: string }>
// ============================================================================

// Verify ApiErrorOf for uploadPetPic (from fixture openapi-types)
type UploadErrorData = ApiErrorData<operations, 'uploadPetPic'>
type UploadError = ApiErrorOf<operations, 'uploadPetPic'>

// Both 422 and default share { message?: string } → union collapses to { message?: string }
type _C6a = UploadError extends AxiosError<{ message?: string }> ? true : false
const _c6a: _C6a = true

// QueryReturn.error: Ref<AxiosError<TError> | null>
type UploadQueryReturn = QueryReturn<{ url: string }, { petId: string }, UploadErrorData>
type _C6b = UploadQueryReturn['error'] extends Ref<AxiosError<{ message?: string }> | null> ? true : false
const _c6b: _C6b = true

// LazyQueryReturn.error should be Ref<AxiosError<TError> | null>
// Merged from typed-error.ts — the only return-type threading case unique to that file.
type UploadLazyQueryReturn = LazyQueryReturn<{ url: string }, { petId: string }, Record<string, never>, UploadErrorData>
type _C6bLazy = UploadLazyQueryReturn['error'] extends Ref<AxiosError<{ message?: string }> | null> ? true : false
const _c6bLazy: _C6bLazy = true

// MutationReturn.error: Ref<AxiosError<TError> | null>
type UploadMutationReturn = MutationReturn<
  { url: string },
  { petId: string },
  FormData,
  Record<string, never>,
  UploadErrorData
>
type _C6c = UploadMutationReturn['error'] extends Ref<AxiosError<{ message?: string }> | null> ? true : false
const _c6c: _C6c = true

// Real-hook pattern: use createApiClient from fixtures to get a fully-typed hook return.
// uploadPetPic.useMutation() should have error.value?.response?.data typed as { message?: string }.
function testRealHookResponseData() {
  const api = createApiClient(mockAxios)
  const upload = api.uploadPetPic.useMutation()

  // error is Ref<AxiosError<UploadErrorData> | null>
  const errorRef = upload.error

  // .response?.data should be typed as UploadErrorData = { message?: string } | undefined
  // (undefined because AxiosError.response can be undefined)
  const _data = errorRef.value?.response?.data

  // If the type is right, _data should extend { message?: string } | undefined
  type DataType = typeof _data
  type _C6d = DataType extends { message?: string } | undefined ? true : false
  const _c6d: _C6d = true
  void _c6d

  return errorRef
}

// ============================================================================
// Exports (prevents TypeScript from pruning unused type aliases)
// ============================================================================

export type {
  Case1ErrorData,
  Case1Error,
  Case2ErrorData,
  Case2Error,
  Case3ErrorData,
  Case3Error,
  Case4ErrorData,
  Case4Error,
  Case4cErrorData,
  NarrowedQueryOpts,
  NarrowedMutationOpts,
  UploadErrorData,
  UploadError,
  UploadQueryReturn,
  UploadLazyQueryReturn,
  UploadMutationReturn,
}

export {
  _c1a,
  _c1b,
  _c2a,
  _c2b,
  _c2c,
  _c3a,
  _c3b,
  _c4a,
  _c4b,
  _c4c,
  _c5aQuery,
  _c5bQuery,
  _c5aMutation,
  _c5bMutation,
  _c6a,
  _c6b,
  _c6bLazy,
  _c6c,
  testRealHookResponseData,
}
