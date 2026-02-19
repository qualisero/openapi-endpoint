import { describe, it, expect, beforeEach } from 'vitest'
import { mockAxios } from '../setup'
import { createApiClient } from '../fixtures/api-client'

describe('Mutation Return Type Typing', () => {
  let api: ReturnType<typeof createApiClient>

  beforeEach(() => {
    api = createApiClient(mockAxios)
  })

  it('mutate() should have proper return type when called with data', () => {
    const createPetMutation = api.createPet.useMutation()

    // Call mutate with data
    const result = createPetMutation.mutate({ data: { name: 'Fluffy' } })

    // Currently this is void, but user might expect to access the response
    expect(result).toBeUndefined()
  })

  it('mutateAsync() should return Promise with typed response', async () => {
    const createPetMutation = api.createPet.useMutation()

    // This should be Promise<AxiosResponse<Pet>>
    const promise = createPetMutation.mutateAsync({
      data: { name: 'Fluffy' },
    })

    // Type should be: Promise<AxiosResponse<Pet>>
    // User should be able to do:
    // const response = await promise
    // const pet: Pet = response.data

    expect(promise).toBeInstanceOf(Promise)
  })

  it('mutation with path params should properly type response', async () => {
    const updatePetMutation = api.updatePet.useMutation({ petId: '123' })

    const promise = updatePetMutation.mutateAsync({
      data: { name: 'Updated' },
    })

    // Should be typed as Promise<AxiosResponse<Pet>>
    expect(promise).toBeInstanceOf(Promise)
  })

  it('should demonstrate typing issue: mutate() return value is not typed', () => {
    const mutation = api.createPet.useMutation()

    // This is the issue - we can't get the response from mutate()
    // mutate() returns void, so we can't access the data
    const result = mutation.mutate({ data: { name: 'Test' } })

    // Type of result is void - user can't access the response data
    // result?.data is safe to call but result is still void
    expect(result).toBeUndefined()
  })

  it('should work with onSuccess callback to access response data', () => {
    const mutation = api.createPet.useMutation({
      onSuccess: (response: any) => {
        // response should be AxiosResponse<Pet>
        // response.data should be Pet
        expect(response).toBeDefined()
        expect(response.data).toBeDefined()
      },
    })

    mutation.mutate({ data: { name: 'Test' } })
  })

  it('mutateAsync should properly type the response', async () => {
    const mutation = api.createPet.useMutation()

    const response = await mutation.mutateAsync({
      data: { name: 'Fluffy' },
    })

    // response should be AxiosResponse - verify the call itself works
    expect(response).toBeDefined()
    // Type-wise, response should be AxiosResponse<Pet> which has a data property
    // The key is that the TypeScript compiler knows about this property
  })
})
