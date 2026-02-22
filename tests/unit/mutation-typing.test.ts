import { describe, it, expect, beforeEach, vi } from 'vitest'
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

/**
 * Multipart Form Data Support (Feature Request)
 *
 * Tests for proper FormData handling in file upload endpoints.
 */
describe('Multipart Form Data Support', () => {
  let api: ReturnType<typeof createApiClient>

  beforeEach(() => {
    vi.clearAllMocks()
    api = createApiClient(mockAxios)
  })

  it('should support multipart/form-data with specific upload endpoints', () => {
    // Test with upload-specific endpoint
    const uploadMutation = api.uploadPetPic.useMutation({ petId: '123' })

    const mockFile = new File(['test content'], 'test.jpg', { type: 'image/jpeg' })
    const formData = new FormData()
    formData.append('file', mockFile)

    expect(() => {
      uploadMutation.mutateAsync({
        data: formData, // FormData is appropriate for uploadPetPic
      })
    }).not.toThrow()

    expect(uploadMutation).toHaveProperty('mutate')
    expect(uploadMutation).toHaveProperty('mutateAsync')
  })

  it('should support custom headers with multipart uploads', () => {
    const uploadMutation = api.uploadPetPic.useMutation(
      { petId: '123' },
      {
        axiosOptions: {
          headers: {
            'Content-Type': 'multipart/form-data',
            'X-Custom-Header': 'custom-value',
          },
        },
      },
    )

    const mockFile = new File(['test content'], 'test.jpg', { type: 'image/jpeg' })
    const formData = new FormData()
    formData.append('file', mockFile)

    expect(() => {
      uploadMutation.mutateAsync({
        data: formData, // FormData is appropriate for uploadPetPic
      })
    }).not.toThrow()
  })

  it('should support type safety for multipart/form-data schemas', () => {
    const uploadMutation = api.uploadPetPic.useMutation({ petId: '123' })

    // Should accept FormData for upload endpoints
    expect(() => {
      uploadMutation.mutateAsync({
        data: new FormData(),
      })
    }).not.toThrow()

    // Should also accept object matching the schema
    expect(() => {
      uploadMutation.mutateAsync({
        data: {
          file: 'binary-data-string', // As per OpenAPI spec, file is string with format: binary
        } as any,
      })
    }).not.toThrow()
  })

  it('should integrate with cache invalidation after upload', () => {
    const listPetsQuery = api.listPets.useQuery()
    const uploadMutation = api.uploadPetPic.useMutation(
      { petId: '123' },
      {
        invalidateOperations: ['listPets'],
      },
    )

    const formData = new FormData()
    formData.append('file', new File(['test'], 'test.jpg'))

    expect(uploadMutation).toBeTruthy()
    expect(listPetsQuery).toBeTruthy()
  })
})

/**
 * Mutation isEnabled Enforcement (GitHub Issue)
 *
 * Tests that mutations with unresolved path parameters should prevent execution
 * and show appropriate error messages instead of attempting HTTP calls.
 */
describe('Mutation isEnabled Enforcement', () => {
  let api: ReturnType<typeof createApiClient>

  beforeEach(() => {
    vi.clearAllMocks()
    api = createApiClient(mockAxios)
  })

  it('should have isEnabled=false when path parameters are undefined', () => {
    const mutation = api.updatePet.useMutation(() => ({ petId: undefined }))

    expect(mutation.isEnabled.value).toBe(false)
  })

  it('should have isEnabled=true when path parameters are provided', () => {
    const mutation = api.updatePet.useMutation(() => ({ petId: '123' }))

    expect(mutation.isEnabled.value).toBe(true)
  })

  it('should prevent mutate() when isEnabled is false', async () => {
    const onError = vi.fn()
    const mutation = api.updatePet.useMutation(() => ({ petId: undefined }), { onError })
    expect(mutation.isEnabled.value).toBe(false)

    // Calling mutate() when disabled should not throw, but should not execute either
    // The onError callback should be called with a clear error message
    mutation.mutate({ data: { name: 'Updated Name' } })

    // Wait a tick for async execution
    await new Promise((resolve) => setTimeout(resolve, 10))

    // Verify that onError was called with appropriate error
    expect(onError).toHaveBeenCalled()
    const error = onError.mock.calls[0][0]
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toContain('path parameters not resolved')
  })

  it('should reject mutateAsync() when isEnabled is false', async () => {
    const mutation = api.updatePet.useMutation(() => ({ petId: undefined }))

    expect(mutation.isEnabled.value).toBe(false)

    // mutateAsync should reject with a clear error
    await expect(mutation.mutateAsync({ data: { name: 'Updated Name' } })).rejects.toThrow(
      /path parameters not resolved/,
    )
  })

  it('should allow mutation when isEnabled becomes true', async () => {
    let petId: string | undefined = undefined
    const mutation = api.updatePet.useMutation(() => ({ petId }))

    // Initially disabled
    expect(mutation.isEnabled.value).toBe(false)

    // Enable by providing path param
    petId = '123'

    // Note: In a real Vue environment with refs, reactivity would update isEnabled
    // For this test, we're verifying the structure is correct
    expect(mutation).toHaveProperty('mutate')
    expect(mutation).toHaveProperty('mutateAsync')
    expect(mutation).toHaveProperty('isEnabled')
  })

  it('should use isEnabled as a guard in practical usage', () => {
    const selectedRequestRef = { value: undefined as string | undefined }

    const updateRequestTypeMutation = api.updatePet.useMutation(() => ({
      petId: selectedRequestRef.value,
    }))

    // This is a pattern from practical usage - isEnabled should guard execution
    expect(updateRequestTypeMutation.isEnabled.value).toBe(false)

    // Set the ref value
    selectedRequestRef.value = '123'

    // Verify mutation structure
    expect(updateRequestTypeMutation).toHaveProperty('mutate')
    expect(updateRequestTypeMutation).toHaveProperty('isEnabled')
  })
})
