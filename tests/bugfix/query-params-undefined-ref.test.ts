/**
 * Bugfix runtime tests: ref<RequiredQueryParams>() without initial value
 *
 * Regression test for: queryParams should accept ReactiveOr<TQueryParams | undefined>
 *
 * Before the fix, passing a `ref<T>()` (which produces `Ref<T | undefined>`) as
 * `queryParams` caused a TS2769 compile error when T had required fields.
 * At runtime the library must also handle `undefined` gracefully (no request sent,
 * no crash) and correctly pass params once the ref is populated.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed } from 'vue'
import { mockAxios } from '../setup'
import { createApiClient } from '../fixtures/api-client'

describe('Bugfix: ref<RequiredQueryParams>() as queryParams', () => {
  let api: ReturnType<typeof createApiClient>

  beforeEach(() => {
    vi.clearAllMocks()
    api = createApiClient(mockAxios)
  })

  it('should mount without error when ref starts as undefined', () => {
    const queryParams = ref<{ q: string; species: string; limit?: number }>()

    expect(() => {
      api.searchPets.useQuery({ queryParams })
    }).not.toThrow()
  })

  it('should mount without error when computed may return undefined', () => {
    const isActive = ref(false)
    const queryParams = computed(() => (isActive.value ? { q: 'cat', species: 'feline' } : undefined))

    expect(() => {
      api.searchPets.useQuery({ queryParams })
    }).not.toThrow()
  })

  it('should reflect query params in the query key once the ref is populated', () => {
    const queryParams = ref<{ q: string; species: string; limit?: number }>()
    const query = api.searchPets.useQuery({ queryParams })

    // Before: no params set — key should not contain search terms
    const keyBefore = JSON.stringify(query.queryKey.value)
    expect(keyBefore).not.toContain('cat')

    // Populate the ref
    queryParams.value = { q: 'cat', species: 'feline' }

    // queryKey is a computed ref — re-evaluate after mutation
    const keyAfter = JSON.stringify(query.queryKey.value)
    expect(keyAfter).toContain('cat')
    expect(keyAfter).toContain('feline')
  })

  it('should produce the same query key as a plain-object queryParams', async () => {
    const queryParams = ref<{ q: string; species: string; limit?: number }>({
      q: 'dog',
      species: 'canine',
    })

    const queryViaRef = api.searchPets.useQuery({ queryParams })
    const queryViaObject = api.searchPets.useQuery({
      queryParams: { q: 'dog', species: 'canine' },
    })

    expect(queryViaRef.queryKey.value).toEqual(queryViaObject.queryKey.value)
  })
})
