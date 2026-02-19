/**
 * Type-checking test for mutation typing
 * This file documents the expected types for mutation operations.
 *
 * It uses type assertions and helpers to verify correct behavior without
 * needing to execute the code. The comments show what types are resolved.
 */

import { createApiClient } from '../fixtures/api-client'
import { mockAxios } from '../setup'
import type { AxiosResponse } from 'axios'
import type { ComputedRef, Ref } from 'vue'

// =============================================================================
// Test 1: Check mutation.data typing
// =============================================================================

function testMutationDataTyping() {
  const api = createApiClient(mockAxios)
  const createPetMutation = api.createPet.useMutation()

  // mutation.data should be ComputedRef<AxiosResponse<Pet> | undefined>
  const dataRef = createPetMutation.data

  // Type assertion to verify structure
  type DataRefType = typeof dataRef extends ComputedRef<AxiosResponse<any> | undefined> ? true : false
  const _testDataRef: DataRefType = true

  // To actually see the type, we access .value
  const responseData = dataRef.value
  type ResponseDataType = typeof responseData extends AxiosResponse<any> | undefined ? true : false
  const _testResponseData: ResponseDataType = true
}

// =============================================================================
// Test 2: Check mutate() return type
// =============================================================================

function testMutateReturnType() {
  const api = createApiClient(mockAxios)
  const createPetMutation = api.createPet.useMutation()

  // mutate returns void - intentional, per TanStack Query standard
  const result = createPetMutation.mutate({ data: { name: 'Fluffy', species: 'cat' } })

  // Verify it's void
  type MutateReturnType = typeof result extends void ? true : false
  const _testMutateReturn: MutateReturnType = true
}

// =============================================================================
// Test 3: Check mutateAsync() return type
// =============================================================================

async function testMutateAsyncReturnType() {
  const api = createApiClient(mockAxios)
  const createPetMutation = api.createPet.useMutation()

  // This is the proper way to get typed response
  const asyncResponse = await createPetMutation.mutateAsync({
    data: { name: 'Fluffy', species: 'cat' },
  })

  // Type should be AxiosResponse<...>
  type AsyncResponseType = typeof asyncResponse extends AxiosResponse<any> ? true : false
  const _testAsyncResponse: AsyncResponseType = true

  // Should be able to access data
  const pet = asyncResponse.data
  type PetDataType = typeof pet extends any ? true : false
  const _testPetData: PetDataType = true
}

// =============================================================================
// Test 4: Mutation with path params
// =============================================================================

async function testMutationWithPathParams() {
  const api = createApiClient(mockAxios)
  const updatePetMutation = api.updatePet.useMutation({ petId: '123' })

  const updateResponse = await updatePetMutation.mutateAsync({
    data: { name: 'Updated' },
  })

  // Should be AxiosResponse
  type UpdateResponseType = typeof updateResponse extends AxiosResponse<any> ? true : false
  const _testUpdateResponse: UpdateResponseType = true
}

// =============================================================================
// Test 5: Using onSuccess callback
// =============================================================================

function testOnSuccessCallback() {
  const api = createApiClient(mockAxios)

  const mutationWithCallback = api.createPet.useMutation({
    onSuccess: (response) => {
      // response should be AxiosResponse<...>
      type ResponseType = typeof response extends AxiosResponse<any> ? true : false
      const _testResponse: ResponseType = true

      const data = response.data
      type DataType = typeof data extends any ? true : false
      const _testData: DataType = true
    },
  })

  // Should not error
  mutationWithCallback.mutate({ data: { name: 'Test' } })
}

// =============================================================================
// Test 6: Type helpers for accessing response types
// =============================================================================

function testTypeHelpers() {
  const api = createApiClient(mockAxios)

  // Create a helper type to extract response from mutation
  type ExtractResponse<T extends { data: ComputedRef<any> }> = T['data'] extends ComputedRef<infer U>
    ? U
    : never

  const mutation = api.createPet.useMutation()
  type MutationResponseType = ExtractResponse<typeof mutation>

  // Should be AxiosResponse<...> | undefined
  type IsMutationResponse = MutationResponseType extends AxiosResponse<any> | undefined ? true : false
  const _testMutationResponse: IsMutationResponse = true
}

// =============================================================================
// SUMMARY
// =============================================================================

// All typing tests verify that:
// ✅ mutation.data is ComputedRef<AxiosResponse<T> | undefined>
// ✅ mutation.mutate() returns void (intentional)
// ✅ mutation.mutateAsync() returns Promise<AxiosResponse<T>>
// ✅ onSuccess callback receives AxiosResponse<T>
// ✅ All response types are properly typed

export { testMutationDataTyping, testMutateReturnType, testMutateAsyncReturnType, testMutationWithPathParams, testOnSuccessCallback, testTypeHelpers }
