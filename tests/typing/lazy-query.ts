/**
 * Compile-time type tests for useLazyQuery
 *
 * These tests check that the lazy query API is correctly typed. They never run —
 * validated by `tsc --noEmit` only.
 */

import { ref, computed } from 'vue'
import { createApiClient } from '../fixtures/api-client'
import { mockAxios } from '../setup'

const api = createApiClient(mockAxios)

// =============================================================================
// Test 1: fetch({ queryParams }) accepts correct params
// =============================================================================
function testFetchWithCorrectParams() {
  const query = api.listPets.useLazyQuery()

  const _result = query.fetch({
    queryParams: { limit: 10 },
  })

  return _result
}

// =============================================================================
// Test 2: fetch({ queryParams: wrong type }) is a TS error
// =============================================================================
function testFetchWithWrongParamType() {
  const query = api.listPets.useLazyQuery()

  const _result = query.fetch({
    // @ts-expect-error - limit must be number, not string
    queryParams: { limit: 'wrong-type' },
  })

  return _result
}

// =============================================================================
// Test 3: fetch({ queryParams: unknown property }) is a TS error
// =============================================================================
function testFetchWithExcessProperty() {
  const query = api.listPets.useLazyQuery()

  const _result = query.fetch({
    queryParams: {
      limit: 10,
      // @ts-expect-error intentional test for unknown property
      unknownProp: 'should-error',
    },
  })

  return _result
}

// =============================================================================
// Test 4: fetch() with no args is valid for no-params operations
// =============================================================================
function testFetchNoArgs() {
  const query = api.listPets.useLazyQuery()

  const _result = query.fetch()

  return _result
}

// =============================================================================
// Test 5: query.data is typed as ComputedRef<TResponse | undefined>
// =============================================================================
function testDataType() {
  const query = api.listPets.useLazyQuery()

  const _data: import('@qualisero/openapi-endpoint').ComputedRef<
    import('../fixtures/api-operations').ApiResponse<'listPets'> | undefined
  > = query.data

  return _data
}

// =============================================================================
// Test 6: useLazyQuery does not accept queryParams in hook options
// =============================================================================
function testNoQueryParamsInHookOptions() {
  const _result = api.listPets.useLazyQuery({
    // @ts-expect-error - queryParams not allowed at hook level, use fetch({ queryParams })
    queryParams: { limit: 10 },
  })

  return _result
}

// =============================================================================
// Test 7: useLazyQuery does not accept onLoad in hook options
// =============================================================================
function testNoOnLoadInHookOptions() {
  const _result = api.listPets.useLazyQuery({
    // @ts-expect-error - onLoad not allowed at hook level
    onLoad: () => {},
  })

  return _result
}

// =============================================================================
// Test 8: useLazyQuery does not accept enabled in hook options
// =============================================================================
function testNoEnabledInHookOptions() {
  const _result = api.listPets.useLazyQuery({
    // @ts-expect-error - enabled not allowed at hook level
    enabled: true,
  })

  return _result
}

// =============================================================================
// Test 9: useLazyQuery works with path params
// =============================================================================
function testWithPathParams() {
  const query = api.getPet.useLazyQuery({ petId: '123' })

  const _result = query.fetch()

  return _result
}

// =============================================================================
// Test 10: useLazyQuery works with reactive path params
// =============================================================================
function testWithReactivePathParams() {
  const petId = ref('123')
  const query = api.getPet.useLazyQuery(computed(() => ({ petId: petId.value })))

  const _result = query.fetch()

  return _result
}

// =============================================================================
// Test 11: fetch() accepts queryParams for operations with query params
// =============================================================================
function testFetchWithQueryParams() {
  const query = api.searchPets.useLazyQuery()

  const _result = query.fetch({
    queryParams: { q: 'cat', species: 'feline', limit: 10 },
  })

  return _result
}

// =============================================================================
// Test 12: useLazyQuery return type is correct
// =============================================================================
function testLazyQueryReturnType() {
  const query = api.listPets.useLazyQuery()

  const _return: import('@qualisero/openapi-endpoint').LazyQueryReturn<
    import('../fixtures/api-operations').ApiResponse<'listPets'>,
    Record<string, never>,
    import('../fixtures/api-operations').ApiQueryParams<'listPets'>
  > = query

  // These should all exist with correct types
  const _data = _return.data
  const _isPending = _return.isPending
  const _isSuccess = _return.isSuccess
  const _isError = _return.isError
  const _error = _return.error
  const _isEnabled = _return.isEnabled
  const _pathParams = _return.pathParams
  const _queryKey = _return.queryKey
  const _fetch = _return.fetch

  return {
    _return,
    _data,
    _isPending,
    _isSuccess,
    _isError,
    _error,
    _isEnabled,
    _pathParams,
    _queryKey,
    _fetch,
  }
}

export {
  testFetchWithCorrectParams,
  testFetchWithWrongParamType,
  testFetchWithExcessProperty,
  testFetchNoArgs,
  testDataType,
  testNoQueryParamsInHookOptions,
  testNoOnLoadInHookOptions,
  testNoEnabledInHookOptions,
  testWithPathParams,
  testWithReactivePathParams,
  testFetchWithQueryParams,
  testLazyQueryReturnType,
}
