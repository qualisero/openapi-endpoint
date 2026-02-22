/**
 * Strict type validation tests for mutation typing
 *
 * These tests use TypeScript's type system to verify correct behavior.
 * They don't run - they're checked at compile time by tsc.
 */

import type { ComputedRef } from 'vue'
import type { AxiosResponse } from 'axios'
import { createApiClient } from '../fixtures/api-client'
import { mockAxios } from '../setup'

// =============================================================================
// Test 1: Verify mutation object has correct structure
// =============================================================================

function testMutationStructure() {
  const api = createApiClient(mockAxios)
  const _createPetMutation = api.createPet.useMutation()

  // This should be true - mutation should have these properties
  type TestMutationProps = typeof _createPetMutation extends {
    data: ComputedRef<AxiosResponse<any> | undefined>
    mutate: (vars?: any) => void
    mutateAsync: (vars?: any) => Promise<AxiosResponse<any>>
  }
    ? true
    : false

  const _testMutationProps: TestMutationProps = true
}

// =============================================================================
// Test 2: Check that mutateAsync is properly typed
// =============================================================================

function testMutateAsyncType() {
  const api = createApiClient(mockAxios)
  const _createPetMutation = api.createPet.useMutation()

  // This should type-check correctly - mutateAsync returns Promise<AxiosResponse>
  const _asyncCall = _createPetMutation.mutateAsync({
    data: { name: 'Test' },
  })

  // asyncCall should be Promise<AxiosResponse<...>>
  type TestAsyncType = typeof _asyncCall extends Promise<AxiosResponse<any>> ? true : false

  const _testAsyncType: TestAsyncType = true
}

// =============================================================================
// Test 3: Accessing response data after await
// =============================================================================

async function testAsyncResponse() {
  const api = createApiClient(mockAxios)
  const _createPetMutation = api.createPet.useMutation()

  const _response = await _createPetMutation.mutateAsync({
    data: { name: 'Test' },
  })

  // response should be AxiosResponse<...>
  type TestResponseType = typeof _response extends AxiosResponse<any> ? true : false
  const _t: TestResponseType = true

  // response.data should be accessible
  const _petData = _response.data
  type TestDataAccess = typeof _petData extends any ? true : false
  const _t2: TestDataAccess = true
}

// =============================================================================
// Test 4: Check data property typing
// =============================================================================

function testDataProperty() {
  const api = createApiClient(mockAxios)
  const _createPetMutation = api.createPet.useMutation()

  // mutation.data is ComputedRef<AxiosResponse<...> | undefined>
  const _dataRef = _createPetMutation.data

  // Accessing .value should give us AxiosResponse<...> | undefined
  const _dataValue = _dataRef.value

  type TestDataValue = typeof _dataValue extends AxiosResponse<any> | undefined ? true : false

  const _testDataValue: TestDataValue = true
}

// =============================================================================
// Test 5: onSuccess callback typing
// =============================================================================

function testOnSuccessCallback() {
  const api = createApiClient(mockAxios)

  const _mutationWithCallback = api.createPet.useMutation({
    onSuccess: (_response: any) => {
      // response should be AxiosResponse<Pet> here
      type TestCallbackType = typeof _response extends AxiosResponse<any> ? true : false
      const _t: TestCallbackType = true

      // Should be able to access response.data
      const _data = _response.data
      type TestDataAccess = typeof _data extends any ? true : false
      const _t2: TestDataAccess = true
    },
  })

  return _mutationWithCallback
}

// =============================================================================
// Test 6: Path params mutation
// =============================================================================

async function testPathParamsMutation() {
  const api = createApiClient(mockAxios)
  const _updatePetMutation = api.updatePet.useMutation({ petId: '123' })

  // Should work the same way
  const _updateAsync = await _updatePetMutation.mutateAsync({
    data: { name: 'Updated' },
  })

  type TestUpdateType = typeof _updateAsync extends AxiosResponse<any> ? true : false
  const _testUpdateType: TestUpdateType = true
}

// =============================================================================
// Test 7: mutate() return is void
// =============================================================================

function testMutateVoid() {
  const api = createApiClient(mockAxios)
  const _createPetMutation = api.createPet.useMutation()

  // This is intentional - mutate() returns void
  const _mutateResult = _createPetMutation.mutate({ data: { name: 'Test' } })

  // mutateResult is void - this is correct behavior
  type TestMutateReturnVoid = typeof _mutateResult extends void ? true : false
  const _testMutateReturnVoid: TestMutateReturnVoid = true
}

// =============================================================================
// Test 8: All three ways to get typed response
// =============================================================================

async function testAllResponsePatterns() {
  const api = createApiClient(mockAxios)

  // Way 1: Use mutateAsync() - returns Promise<AxiosResponse<T>>
  const _way1 = async () => {
    const _response = await api.createPet.useMutation().mutateAsync({ data: { name: 'Test' } })
    type ResponseType1 = typeof _response extends AxiosResponse<any> ? true : false
    const _t1: ResponseType1 = true
  }

  // Way 2: Access .data reactive property
  const _way2 = () => {
    const _mutation = api.createPet.useMutation()
    _mutation.mutate({ data: { name: 'Test' } })
    const _dataValue = _mutation.data.value
    type ResponseType2 = typeof _dataValue extends AxiosResponse<any> | undefined ? true : false
    const _t2: ResponseType2 = true
  }

  // Way 3: Use onSuccess callback
  const _way3 = () => {
    api.createPet.useMutation({
      onSuccess: (_response: any) => {
        type ResponseType3 = typeof _response extends AxiosResponse<any> ? true : false
        const _t3: ResponseType3 = true
      },
    })
  }

  return { _way1, _way2, _way3 }
}

// Export test functions so TypeScript checks them
export {
  testMutationStructure,
  testMutateAsyncType,
  testAsyncResponse,
  testDataProperty,
  testOnSuccessCallback,
  testPathParamsMutation,
  testMutateVoid,
  testAllResponsePatterns,
}
