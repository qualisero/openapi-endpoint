/**
 * Diagnostic: Check if generic helpers properly preserve type information
 *
 * This test checks whether ApiResponse<Op> where Op is a generic type variable
 * properly resolves to the correct response type.
 */

import { createApiClient } from '../fixtures/api-client'
import { mockAxios } from '../setup'

function diagnoseMutationTypes() {
  const api = createApiClient(mockAxios)

  // Get the mutation
  const createPetMutation = api.createPet.useMutation()

  // Check the type of the mutation return value
  // If types are working correctly, this should be:
  // MutationReturn<Pet, Record<string, never>, CreatePetRequest, Record<string, never>>
  // And specifically:
  // - data: ComputedRef<AxiosResponse<Pet> | undefined>
  // - mutateAsync: (vars) => Promise<AxiosResponse<Pet>>

  // Typeof the returned object
  type MutationReturnType = typeof createPetMutation

  // This is a helper to see what the actual inferred type is
  type ExtractDataType<T extends { data: any }> = T['data']
  type ExtractMutateAsyncType<T extends { mutateAsync: any }> = T['mutateAsync']

  // Extract what TypeScript thinks these types are
  type DataType = ExtractDataType<typeof createPetMutation>
  type MutateAsyncType = ExtractMutateAsyncType<typeof createPetMutation>

  // These type assignments verify that the types are correct
  // If you hover over these in your IDE, you'll see the resolved types
  const mutationReturnType = null as any as MutationReturnType
  const dataProperty = null as any as DataType
  const mutateAsyncProperty = null as any as MutateAsyncType

  return {
    mutationReturnType,
    dataProperty,
    mutateAsyncProperty,
  }
}

export { diagnoseMutationTypes }
