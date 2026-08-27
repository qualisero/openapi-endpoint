/**
 * Compile-time type tests for the error policy API.
 *
 * These tests never run — validated by `npm run types:test` (tsc --noEmit).
 *
 * Covers:
 *  - skipGlobalError accepts boolean on useQuery and useMutation hooks (strict)
 *  - skipGlobalError accepts predicate on useQuery and useMutation hooks (strict)
 *  - ApiErrorPolicy callback receives unknown error (not AxiosError)
 *  - ApiErrorContext shape
 *  - createApiErrorCaches returns { queryCache, mutationCache }
 */

import { QueryCache, MutationCache } from '@tanstack/query-core'
import type { AxiosError } from 'axios'
import { createApiClient } from '../fixtures/api-client'
import { mockAxios } from '../setup'
import {
  createApiErrorCaches,
  type ApiErrorPolicy,
  type ApiErrorContext,
  type ApiErrorPolicyOptions,
} from '@qualisero/openapi-endpoint'

const api = createApiClient(mockAxios)

// =============================================================================
// Test 1: skipGlobalError boolean accepted on useQuery
// =============================================================================
function testSkipGlobalErrorBooleanOnQuery() {
  const _q = api.listPets.useQuery({ skipGlobalError: true })
  const _q2 = api.listPets.useQuery({ skipGlobalError: false })
  return { _q, _q2 }
}

// =============================================================================
// Test 2: skipGlobalError predicate accepted on useQuery (under strict)
// =============================================================================
function testSkipGlobalErrorPredicateOnQuery() {
  const _q = api.listPets.useQuery({
    skipGlobalError: (e: AxiosError<unknown>) => e.response?.status === 409,
  })
  return _q
}

// =============================================================================
// Test 3: skipGlobalError boolean accepted on useMutation
// =============================================================================
function testSkipGlobalErrorBooleanOnMutation() {
  const _m = api.createPet.useMutation({ skipGlobalError: true })
  const _m2 = api.createPet.useMutation({ skipGlobalError: false })
  return { _m, _m2 }
}

// =============================================================================
// Test 4: skipGlobalError predicate accepted on useMutation (under strict)
// =============================================================================
function testSkipGlobalErrorPredicateOnMutation() {
  const _m = api.createPet.useMutation({
    skipGlobalError: (e: AxiosError<unknown>) => e.response?.status === 422,
  })
  return _m
}

// =============================================================================
// Test 5: ApiErrorPolicy receives unknown (not AxiosError)
// Demonstrates that the global callback is intentionally typed as unknown:
// callers must narrow with isAxiosError inside the policy.
// =============================================================================
function testApiErrorPolicyReceivesUnknown() {
  // error parameter is `unknown` — no .response access without narrowing
  const policy: ApiErrorPolicy = (error: unknown, ctx: ApiErrorContext) => {
    // ctx fields are well-typed
    const _op: string = ctx.operationId
    const _path: string = ctx.path
    const _method = ctx.method
    const _kind: 'query' | 'mutation' = ctx.kind
    // error is unknown — cannot access properties directly without cast
    const _err: unknown = error
    void _op
    void _path
    void _method
    void _kind
    void _err
  }
  return policy
}

// =============================================================================
// Test 6: ApiErrorPolicyOptions.onError is optional
// =============================================================================
function testApiErrorPolicyOptionsOptional() {
  const opts1: ApiErrorPolicyOptions = {}
  const opts2: ApiErrorPolicyOptions = {
    onError: (error: unknown, ctx: ApiErrorContext) => {
      void error
      void ctx
    },
  }
  return { opts1, opts2 }
}

// =============================================================================
// Test 7: createApiErrorCaches returns { queryCache: QueryCache; mutationCache: MutationCache }
// =============================================================================
function testCreateApiErrorCachesReturnType() {
  const { queryCache, mutationCache } = createApiErrorCaches({
    onError: (error: unknown) => void error,
  })

  // Validate return types
  const _qc: QueryCache = queryCache
  const _mc: MutationCache = mutationCache
  return { _qc, _mc }
}

// =============================================================================
// Test 8: skipGlobalError wrong type is rejected on useQuery
// =============================================================================
function testSkipGlobalErrorWrongTypeRejected() {
  // @ts-expect-error - skipGlobalError must be boolean or (AxiosError<unknown>) => boolean, not number
  const _q = api.listPets.useQuery({ skipGlobalError: 42 })
  return _q
}

// =============================================================================
// Test 9: skipGlobalError wrong type is rejected on useMutation
// =============================================================================
function testSkipGlobalErrorWrongTypeRejectedOnMutation() {
  // @ts-expect-error - skipGlobalError must be boolean or (AxiosError<unknown>) => boolean, not string
  const _m = api.createPet.useMutation({ skipGlobalError: 'always' })
  return _m
}

export {
  testSkipGlobalErrorBooleanOnQuery,
  testSkipGlobalErrorPredicateOnQuery,
  testSkipGlobalErrorBooleanOnMutation,
  testSkipGlobalErrorPredicateOnMutation,
  testApiErrorPolicyReceivesUnknown,
  testApiErrorPolicyOptionsOptional,
  testCreateApiErrorCachesReturnType,
  testSkipGlobalErrorWrongTypeRejected,
  testSkipGlobalErrorWrongTypeRejectedOnMutation,
}
