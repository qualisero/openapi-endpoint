/**
 * Compile-time type tests: ref<RequiredQueryParams>() without initial value
 *
 * Regression test for: queryParams should accept ReactiveOr<TQueryParams | undefined>
 *
 * Root cause: `ref<T>()` (no initial value) produces `Ref<T | undefined>`.
 * When T has required fields (from raw OpenAPI types), the ref's type is
 * `Ref<{ q: string; species: string; limit?: number } | undefined>`.
 * Previously QueryOptions.queryParams only accepted `ReactiveOr<TQueryParams>`
 * (no undefined), so passing such a ref caused a TS2769 "no overload matches" error.
 *
 * Fix: QueryOptions.queryParams is now typed as `ReactiveOr<TQueryParams | undefined>`.
 *
 * These tests check that the fix holds at compile time — they never run.
 */

import { ref, computed } from 'vue'
import { createApiClient } from '../fixtures/api-client'
import { mockAxios } from '../setup'

// `searchPets` has required query params: q, species (and optional limit).
// This mirrors real-world operations like getAvailabilityQuery.
const api = createApiClient(mockAxios)

type SearchQueryParams = {
  q: string
  species: string
  limit?: number
}

// =============================================================================
// Test 1: ref<T>() with no initial value — the original failing pattern
// =============================================================================
function testRefWithoutInitialValue() {
  // This is the exact pattern that was failing pre-fix.
  // ref<T>() produces Ref<T | undefined>. Without the fix, TypeScript would
  // reject this with TS2769 because undefined was not in ReactiveOr<TQueryParams>.
  const queryParams = ref<SearchQueryParams>()

  const _query = api.searchPets.useQuery({
    queryParams,
  })

  return _query
}

// =============================================================================
// Test 2: computed that may return undefined — the related pattern
// =============================================================================
function testComputedMaybeUndefined() {
  const isActive = ref(false)
  // Returns SearchQueryParams when active, undefined otherwise.
  const queryParams = computed<SearchQueryParams | undefined>(() =>
    isActive.value ? { q: 'cat', species: 'feline' } : undefined,
  )

  // Must compile without cast.
  const _query = api.searchPets.useQuery({
    queryParams,
  })

  return _query
}

// =============================================================================
// Test 3: ref<T>(initialValue) — must still work (no regression)
// =============================================================================
function testRefWithInitialValue() {
  const queryParams = ref<SearchQueryParams>({ q: 'cat', species: 'feline' })

  const _query = api.searchPets.useQuery({
    queryParams,
  })

  return _query
}

// =============================================================================
// Test 4: plain object — must still work (no regression)
// =============================================================================
function testPlainObject() {
  const _query = api.searchPets.useQuery({
    queryParams: { q: 'dog', species: 'canine' },
  })

  return _query
}

// =============================================================================
// Test 5: getter function returning undefined — must still work
// =============================================================================
function testGetterReturningUndefined() {
  let active = false

  const _query = api.searchPets.useQuery({
    queryParams: () => (active ? { q: 'cat', species: 'feline' } : undefined),
  })

  return _query
}

export {
  testRefWithoutInitialValue,
  testComputedMaybeUndefined,
  testRefWithInitialValue,
  testPlainObject,
  testGetterReturningUndefined,
}
