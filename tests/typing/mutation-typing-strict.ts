/**
 * Strict type validation tests for mutation typing
 *
 * These tests use TypeScript's type system to verify correct behavior.
 * They don't run - they're checked at compile time by tsc.
 */

import type { ComputedRef, Ref } from 'vue'
import type { AxiosResponse } from 'axios'
import { createApiClient } from '../fixtures/api-client'
import { mockAxios } from '../setup'

// =============================================================================
// Test 1: Verify mutation object has correct structure
// =============================================================================

function testMutationStructure() {
  const api = createApiClient(mockAxios)
  const createPetMutation = api.createPet.useMutation()

  // This should be true - mutation should have these properties
  type TestMutationProps = typeof createPetMutation extends {
    data: ComputedRef<AxiosResponse<any> | undefined>
    mutate: (vars?: any) => void
    mutateAsync: (vars?: any) => Promise<AxiosResponse<any>>
  }
    ? true
    : false

  const testMutationProps: TestMutationProps = true
}

// =============================================================================
// Test 2: Check that mutateAsync is properly typed
// =============================================================================

function testMutateAsyncType() {
  const api = createApiClient(mockAxios)
  const createPetMutation = api.createPet.useMutation()

  // This should type-check correctly - mutateAsync returns Promise<AxiosResponse>
  const asyncCall = createPetMutation.mutateAsync({
    data: { name: 'Test', species: 'cat' },
  })

  // asyncCall should be Promise<AxiosResponse<...>>
  type TestAsyncType = typeof asyncCall extends Promise<AxiosResponse<any>>
    ? true
    : false

  const testAsyncType: TestAsyncType = true
}

// =============================================================================
// Test 3: Accessing response data after await
// =============================================================================

async function testAsyncResponse() {
  const api = createApiClient(mockAxios)
  const createPetMutation = api.createPet.useMutation()

  const response = await createPetMutation.mutateAsync({
    data: { name: 'Test' },
  })

  // response should be AxiosResponse<...>
  type TestResponseType = typeof response extends AxiosResponse<any> ? true : false
  const t: TestResponseType = true

  // response.data should be accessible
  const petData = response.data
  type TestDataAccess = typeof petData extends any ? true : false
  const t2: TestDataAccess = true
}

// =============================================================================
// Test 4: Check data property typing
// =============================================================================

function testDataProperty() {
  const api = createApiClient(mockAxios)
  const createPetMutation = api.createPet.useMutation()

  // mutation.data is ComputedRef<AxiosResponse<...> | undefined>
  const dataRef = createPetMutation.data

  // Accessing .value should give us AxiosResponse<...> | undefined
  const dataValue = dataRef.value

  type TestDataValue = typeof dataValue extends AxiosResponse<any> | undefined
    ? true
    : false

  const testDataValue: TestDataValue = true
}

// =============================================================================
// Test 5: onSuccess callback typing
// =============================================================================

function testOnSuccessCallback() {
  const api = createApiClient(mockAxios)

  const mutationWithCallback = api.createPet.useMutation({
    onSuccess: (response) => {
      // response should be AxiosResponse<Pet> here
      type TestCallbackType = typeof response extends AxiosResponse<any>
        ? true
        : false
      const t: TestCallbackType = true

      // Should be able to access response.data
      const data = response.data
      type TestDataAccess = typeof data extends any ? true : false
      const t2: TestDataAccess = true
    },
  })

  return mutationWithCallback
}

// =============================================================================
// Test 6: Path params mutation
// =============================================================================

async function testPathParamsMutation() {
  const api = createApiClient(mockAxios)
  const updatePetMutation = api.updatePet.useMutation({ petId: '123' })

  // Should work the same way
  const updateAsync = await updatePetMutation.mutateAsync({
    data: { name: 'Updated' },
  })

  type TestUpdateType = typeof updateAsync extends AxiosResponse<any> ? true : false
  const testUpdateType: TestUpdateType = true
}

// =============================================================================
// Test 7: mutate() return is void
// =============================================================================

function testMutateVoid() {
  const api = createApiClient(mockAxios)
  const createPetMutation = api.createPet.useMutation()

  // This is intentional - mutate() returns void
  const mutateResult = createPetMutation.mutate({ data: { name: 'Test' } })

  // mutateResult is void - this is correct behavior
  type TestMutateVoid = typeof mutateResult extends void ? true : false
  const testMutateVoid: TestMutateVoid = true
}

// =============================================================================
// Test 8: All three ways to get typed response
// =============================================================================

async function testAllResponsePatterns() {
  const api = createApiClient(mockAxios)

  // Way 1: Use mutateAsync() - returns Promise<AxiosResponse<T>>
  const way1 = async () => {
    const response = await api.createPet.mutateAsync({ data: { name: 'Test' } })
    type ResponseType1 = typeof response extends AxiosResponse<any> ? true : false
    const _t1: ResponseType1 = true
  }

  // Way 2: Access .data reactive property
  const way2 = () => {
    const mutation = api.createPet.useMutation()
    mutation.mutate({ data: { name: 'Test' } })
    const dataValue = mutation.data.value
    type ResponseType2 = typeof dataValue extends AxiosResponse<any> | undefined ? true : false
    const _t2: ResponseType2 = true
  }

  // Way 3: Use onSuccess callback
  const way3 = () => {
    api.createPet.useMutation({
      onSuccess: (response) => {
        type ResponseType3 = typeof response extends AxiosResponse<any> ? true : false
        const _t3: ResponseType3 = true
      },
    })
  }

  return { way1, way2, way3 }
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
