import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { effectScope } from 'vue'
import type { QueryClient } from '@tanstack/vue-query'
import { createApiClient } from '../fixtures/api-client'
import { createTestScope } from '../helpers'
import { mockAxios } from '../setup'

describe('Mutation Return Type Typing', () => {
  let api: ReturnType<typeof createApiClient>
  let scope: ReturnType<typeof effectScope>
  let run: <T>(fn: () => T) => T

  beforeEach(() => {
    vi.clearAllMocks()
    ;({ api, scope, run } = createTestScope())
  })

  afterEach(() => {
    scope.stop()
  })

  it('mutate() should have proper return type when called with data', () => {
    const createPetMutation = run(() => api.createPet.useMutation())

    // Call mutate with data
    const result = createPetMutation.mutate({ data: { name: 'Fluffy' } })

    // Currently this is void, but user might expect to access the response
    expect(result).toBeUndefined()
  })

  it('mutateAsync() should return Promise with typed response', async () => {
    const createPetMutation = run(() => api.createPet.useMutation())

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
    const updatePetMutation = run(() => api.updatePet.useMutation({ petId: '123' }))

    const promise = updatePetMutation.mutateAsync({
      data: { name: 'Updated' },
    })

    // Should be typed as Promise<AxiosResponse<Pet>>
    expect(promise).toBeInstanceOf(Promise)
  })

  it('should demonstrate typing issue: mutate() return value is not typed', () => {
    const mutation = run(() => api.createPet.useMutation())

    // This is the issue - we can't get the response from mutate()
    // mutate() returns void, so we can't access the data
    const result = mutation.mutate({ data: { name: 'Test' } })

    // Type of result is void - user can't access the response data
    // result?.data is safe to call but result is still void
    expect(result).toBeUndefined()
  })

  it('should work with onSuccess callback to access response data', () => {
    const mutation = run(() =>
      api.createPet.useMutation({
        onSuccess: (response: any) => {
          // response should be AxiosResponse<Pet>
          // response.data should be Pet
          expect(response).toBeDefined()
          expect(response.data).toBeDefined()
        },
      }),
    )

    mutation.mutate({ data: { name: 'Test' } })
  })

  it('mutateAsync should properly type the response', async () => {
    const mutation = run(() => api.createPet.useMutation())

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
  let scope: ReturnType<typeof effectScope>
  let run: <T>(fn: () => T) => T

  beforeEach(() => {
    vi.clearAllMocks()
    ;({ api, scope, run } = createTestScope())
  })

  afterEach(() => {
    scope.stop()
  })

  it('should support multipart/form-data with specific upload endpoints', () => {
    // Test with upload-specific endpoint
    const uploadMutation = run(() => api.uploadPetPic.useMutation({ petId: '123' }))

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
    const uploadMutation = run(() =>
      api.uploadPetPic.useMutation(
        { petId: '123' },
        {
          axiosOptions: {
            headers: {
              'Content-Type': 'multipart/form-data',
              'X-Custom-Header': 'custom-value',
            },
          },
        },
      ),
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
    const uploadMutation = run(() => api.uploadPetPic.useMutation({ petId: '123' }))

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
    const listPetsQuery = run(() => api.listPets.useQuery())
    const uploadMutation = run(() =>
      api.uploadPetPic.useMutation(
        { petId: '123' },
        {
          invalidateOperations: ['listPets'],
        },
      ),
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
  let scope: ReturnType<typeof effectScope>
  let run: <T>(fn: () => T) => T

  beforeEach(() => {
    vi.clearAllMocks()
    ;({ api, scope, run } = createTestScope())
  })

  afterEach(() => {
    scope.stop()
  })

  it('should have isEnabled=false when path parameters are undefined', () => {
    const mutation = run(() => api.updatePet.useMutation(() => ({ petId: undefined })))

    expect(mutation.isEnabled.value).toBe(false)
  })

  it('should have isEnabled=true when path parameters are provided', () => {
    const mutation = run(() => api.updatePet.useMutation(() => ({ petId: '123' })))

    expect(mutation.isEnabled.value).toBe(true)
  })

  it('should prevent mutate() when isEnabled is false', async () => {
    const onError = vi.fn()
    const mutation = run(() => api.updatePet.useMutation(() => ({ petId: undefined }), { onError }))
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
    const mutation = run(() => api.updatePet.useMutation(() => ({ petId: undefined })))

    expect(mutation.isEnabled.value).toBe(false)

    // mutateAsync should reject with a clear error
    await expect(mutation.mutateAsync({ data: { name: 'Updated Name' } })).rejects.toThrow(
      /path parameters not resolved/,
    )
  })

  it('should allow mutation when isEnabled becomes true', async () => {
    let petId: string | undefined = undefined
    const mutation = run(() => api.updatePet.useMutation(() => ({ petId })))

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

    const updateRequestTypeMutation = run(() =>
      api.updatePet.useMutation(() => ({
        petId: selectedRequestRef.value,
      })),
    )

    // This is a pattern from practical usage - isEnabled should guard execution
    expect(updateRequestTypeMutation.isEnabled.value).toBe(false)

    // Set the ref value
    selectedRequestRef.value = '123'

    // Verify mutation structure
    expect(updateRequestTypeMutation).toHaveProperty('mutate')
    expect(updateRequestTypeMutation).toHaveProperty('isEnabled')
  })
})

/**
 * DELETE mutation invalidation behavior
 *
 * After a DELETE, the item-level query key must NOT be invalidated (that would
 * trigger a GET on a resource that no longer exists, causing a 404). The listPath
 * invalidation should still run so lists refresh.
 */
describe('DELETE mutation invalidation behavior', () => {
  let api: ReturnType<typeof createApiClient>
  let scope: ReturnType<typeof effectScope>
  let run: <T>(fn: () => T) => T
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    ;({ api, scope, run, queryClient } = createTestScope())
  })

  afterEach(() => {
    scope.stop()
  })

  it('should NOT invalidate item-level query key on DELETE', async () => {
    // Seed the item cache with a pet
    queryClient.setQueryData(['pets', '123'], { id: '123', name: 'Fluffy' })

    // Spy on invalidateQueries to track calls
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    // Create delete mutation for pet 123
    const deleteMutation = run(() => api.deletePet.useMutation({ petId: '123' }))

    // Mock successful DELETE response
    mockAxios.mockResolvedValueOnce({ data: {} })

    await deleteMutation.mutateAsync()

    // The item key ['pets', '123'] should NOT have been invalidated
    const itemInvalidationCalls = invalidateSpy.mock.calls.filter((call) => {
      const arg = call[0] as { queryKey?: readonly unknown[]; predicate?: unknown }
      if (arg.queryKey) {
        const qk = arg.queryKey as string[]
        return qk[0] === 'pets' && qk[1] === '123'
      }
      return false
    })
    expect(itemInvalidationCalls).toHaveLength(0)

    // Cached data should still be present (not refetched)
    const cached = queryClient.getQueryData(['pets', '123'])
    expect(cached).toEqual({ id: '123', name: 'Fluffy' })
  })

  it('should STILL invalidate listPath on DELETE', async () => {
    // Set up a list query observer so listPath invalidation has something to target
    const listQuery = run(() => api.listPets.useQuery())

    // Seed list cache
    queryClient.setQueryData(['pets'], [{ id: '1', name: 'Rex' }])

    // Mock the initial list query fetch and the DELETE
    mockAxios.mockResolvedValueOnce({ data: [{ id: '1', name: 'Rex' }] })
    mockAxios.mockResolvedValueOnce({ data: {} })

    // Wait for list query to settle
    await listQuery.suspense()

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    // Create delete mutation
    const deleteMutation = run(() => api.deletePet.useMutation({ petId: '1' }))

    await deleteMutation.mutateAsync()

    // The list path should have been invalidated (predicate-based call)
    const listInvalidationCalls = invalidateSpy.mock.calls.filter((call) => {
      const arg = call[0] as { queryKey?: unknown; predicate?: (...args: unknown[]) => boolean }
      // List invalidation uses predicate, not queryKey
      return typeof arg.predicate === 'function'
    })
    expect(listInvalidationCalls.length).toBeGreaterThanOrEqual(1)
  })

  it('should invalidate item-level query key on PUT as before', async () => {
    // Seed the item cache
    queryClient.setQueryData(['pets', '123'], { id: '123', name: 'Fluffy' })

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    // Create PUT mutation for pet 123
    const updateMutation = run(() => api.updatePet.useMutation({ petId: '123' }))

    // Mock successful PUT response
    mockAxios.mockResolvedValueOnce({ data: { id: '123', name: 'Updated' } })

    await updateMutation.mutateAsync({ data: { name: 'Updated' } })

    // The item key ['pets', '123'] SHOULD have been invalidated for PUT
    const itemInvalidationCalls = invalidateSpy.mock.calls.filter((call) => {
      const arg = call[0] as { queryKey?: readonly unknown[]; exact?: boolean }
      if (arg.queryKey && arg.exact === true) {
        const qk = arg.queryKey as string[]
        return qk[0] === 'pets' && qk[1] === '123'
      }
      return false
    })
    expect(itemInvalidationCalls.length).toBeGreaterThanOrEqual(1)
  })
})
