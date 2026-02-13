/**
 * Tests for readonly property handling with library type utilities.
 *
 * Verifies that readonly properties (marked with "readOnly": true in OpenAPI spec)
 * are handled correctly:
 * 1. ApiResponse makes readonly properties REQUIRED (no null checks needed)
 * 2. ApiRequest EXCLUDES readonly properties (can't send server-generated fields)
 */

import { describe, it, expect } from 'vitest'
import { useOpenApi } from '@/index'
import { type OpenApiConfig } from '@/types'
import { mockAxios } from '../setup'
import {
  OperationId,
  OpType,
  openApiOperations,
  type OpenApiOperations,
  type ApiResponse,
  type ApiRequest,
  type ApiPathParams,
  type ApiQueryParams,
} from '../fixtures/openapi-typed-operations'

describe('ApiResponse - Response Types', () => {
  it('should make readonly id REQUIRED in ApiResponse', () => {
    type PetResponse = ApiResponse<OpType.getPet>

    const response: PetResponse = {
      id: 'readonly-uuid',
      name: 'Fluffy',
    }

    // No null check needed - id is guaranteed to exist
    const id: string = response.id
    expect(id).toBe('readonly-uuid')

    // @ts-expect-error - Cannot assign to 'id' because it is read-only
    response.id = 'modified'
  })

  it('should error when readonly id is missing from ApiResponse', () => {
    type PetResponse = ApiResponse<OpType.getPet>

    // @ts-expect-error - Property 'id' is missing (RequireReadonly makes it required)
    const _invalid: PetResponse = {
      name: 'Fluffy',
    }
  })

  it('should allow direct access to readonly id without null check', () => {
    type PetResponse = ApiResponse<OpType.getPet>

    const response: PetResponse = {
      id: 'uuid-123',
      name: 'Fluffy',
    }

    const idLength: number = response.id.length
    const idUpper: string = response.id.toUpperCase()

    expect(idLength).toBe(8)
    expect(idUpper).toBe('UUID-123')
  })

  it('should handle optional non-readonly properties', () => {
    type PetResponse = ApiResponse<OpType.getPet>

    const minimalPet: PetResponse = {
      id: 'uuid',
      name: 'Fluffy',
    }

    expect(minimalPet.tag).toBeUndefined()
    expect(minimalPet.status).toBeUndefined()

    const fullPet: PetResponse = {
      id: 'uuid',
      name: 'Fluffy',
      tag: 'friendly',
      status: 'available',
    }

    expect(fullPet.tag).toBe('friendly')
    expect(fullPet.status).toBe('available')
  })

  it('should keep status optional and accept enum values', () => {
    type PetResponse = ApiResponse<OpType.getPet>

    // status is optional - can be omitted
    const withoutStatus: PetResponse = {
      id: 'uuid',
      name: 'Fluffy',
    }
    expect(withoutStatus.status).toBeUndefined()

    // status accepts enum values when provided
    const available: PetResponse = { id: '1', name: 'Pet', status: 'available' }
    const pending: PetResponse = { id: '2', name: 'Pet', status: 'pending' }
    const sold: PetResponse = { id: '3', name: 'Pet', status: 'sold' }

    expect(available.status).toBe('available')
    expect(pending.status).toBe('pending')
    expect(sold.status).toBe('sold')

    // @ts-expect-error - status only accepts enum values
    const _invalid: PetResponse = { id: '4', name: 'Pet', status: 'invalid-status' }

    // Accessing optional status requires null check or optional chaining
    const pet: PetResponse = { id: '5', name: 'Pet' }

    // @ts-expect-error - 'status' is possibly 'undefined'
    const _statusValue: 'available' | 'pending' | 'sold' = pet.status

    // Correct usage with optional chaining
    const statusLength = pet.status?.length
    expect(statusLength).toBeUndefined()
  })

  it('should work with list operations returning arrays', () => {
    type ListResponse = ApiResponse<OpType.listPets>

    const pets: ListResponse = [
      { id: 'uuid-1', name: 'Fluffy' },
      { id: 'uuid-2', name: 'Spot' },
    ]

    expect(pets[0].id).toBe('uuid-1')
    expect(pets[1].name).toBe('Spot')
  })
})

describe('ApiRequest - Mutation Request Bodies', () => {
  it('should EXCLUDE readonly id from ApiRequest', () => {
    type CreateRequestBody = ApiRequest<OpType.createPet>

    const body: CreateRequestBody = {
      name: 'Fluffy',
      tag: 'friendly',
    }

    expect(body.name).toBe('Fluffy')

    // @ts-expect-error - 'id' does not exist in type (readonly property excluded)
    const _invalid: CreateRequestBody = { id: 'should-not-be-here', name: 'Fluffy' }
  })

  it('should allow all writable properties in request body', () => {
    type CreateRequestBody = ApiRequest<OpType.createPet>

    const fullPet: CreateRequestBody = {
      name: 'Fluffy',
      tag: 'friendly',
      status: 'available',
    }

    expect(fullPet.name).toBe('Fluffy')

    const minimalPet: CreateRequestBody = {
      name: 'Minimal',
    }

    expect(minimalPet.name).toBe('Minimal')
  })

  it('should work the same for PUT operations', () => {
    type UpdateRequestBody = ApiRequest<OpType.updatePet>

    const updateBody: UpdateRequestBody = {
      name: 'Updated Fluffy',
      status: 'sold',
    }

    expect(updateBody.name).toBe('Updated Fluffy')

    // @ts-expect-error - 'id' does not exist in type
    const _invalid: UpdateRequestBody = { id: 'some-id', name: 'Updated' }
  })

  it('should handle operations without request body', () => {
    type DeleteRequest = ApiRequest<OpType.deletePet>

    // Should be never (no request body)
    const checkNever: DeleteRequest = undefined as never
    expect(checkNever).toBeUndefined()
  })
})

describe('ApiPathParams and ApiQueryParams', () => {
  it('should use ApiPathParams<OpType.getPet> for path parameters', () => {
    type Params = ApiPathParams<OpType.getPet>

    const params: Params = {
      petId: '123',
    }

    expect(params.petId).toBe('123')

    // @ts-expect-error - 'wrongParam' does not exist
    const _invalid: Params = { wrongParam: '123' }
  })

  it('should use ApiQueryParams<OpType.listPets> for query parameters', () => {
    type Params = ApiQueryParams<OpType.listPets>

    const params: Params = {
      limit: 100,
    }

    expect(params.limit).toBe(100)
  })

  it('should handle operations without path parameters', () => {
    type Params = ApiPathParams<OpType.createPet>

    const params: Params = {}
    expect(Object.keys(params)).toHaveLength(0)
  })
})

describe('OpType Namespace', () => {
  it('should prevent typos in operation IDs', () => {
    // @ts-expect-error - Property 'getPetzzz' does not exist
    type _TypoResponse = ApiResponse<OpType.getPetzzz>

    type CorrectResponse = ApiResponse<OpType.getPet>

    const pet: CorrectResponse = {
      id: 'uuid',
      name: 'Fluffy',
    }

    expect(pet.id).toBe('uuid')
  })

  it('should work with both query and mutation operations', () => {
    type GetResponse = ApiResponse<OpType.getPet>
    const getPet: GetResponse = { id: 'uuid', name: 'Pet' }
    expect(getPet.id).toBe('uuid')

    type CreateRequest = ApiRequest<OpType.createPet>
    type CreateResponse = ApiResponse<OpType.createPet>

    const createBody: CreateRequest = { name: 'New Pet' }
    const createResponse: CreateResponse = { id: 'new-uuid', name: 'New Pet' }

    expect(createBody.name).toBe('New Pet')
    expect(createResponse.id).toBe('new-uuid')
  })
})

describe('Integration with useOpenApi', () => {
  const mockConfig: OpenApiConfig<OpenApiOperations> = {
    operations: openApiOperations,
    axios: mockAxios,
  }

  it('should enforce type safety with useMutation', () => {
    const api = useOpenApi(mockConfig)
    const createPet = api.useMutation(OperationId.createPet)

    expect(createPet).toHaveProperty('mutate')
    expect(createPet).toHaveProperty('mutateAsync')

    // @ts-expect-error - 'id' does not exist in type (readonly property excluded)
    createPet.mutate({ data: { id: 'should-not-work', name: 'Fluffy' } })
  })

  it('should enforce type safety with useMutation for updatePet', () => {
    const api = useOpenApi(mockConfig)
    const updatePet = api.useMutation(OperationId.updatePet, { petId: '123' })

    expect(updatePet).toBeTruthy()

    // @ts-expect-error - 'id' does not exist in type
    updatePet.mutate({ data: { id: 'should-not-work', name: 'Updated' } })
  })

  it('should work with useQuery for listPets', () => {
    const api = useOpenApi(mockConfig)
    const listPets = api.useQuery(OperationId.listPets)

    expect(listPets).toHaveProperty('data')
  })

  it('should work with useQuery for getPet', () => {
    const api = useOpenApi(mockConfig)
    const getPet = api.useQuery(OperationId.getPet, { petId: '123' })

    expect(getPet).toBeTruthy()
  })

  it('should return data with required readonly id from useQuery', () => {
    const api = useOpenApi(mockConfig)
    const result = api.useQuery(OperationId.getPet, { petId: '123' })

    // ApiResponse uses RequireReadonly which makes readonly properties REQUIRED
    if (result.data.value) {
      // No null check needed - id is required
      const id: string = result.data.value.id
      const name: string = result.data.value.name

      // Optional properties stay optional
      const _tag: string | undefined = result.data.value.tag

      // @ts-expect-error - Cannot assign to 'id' because it is read-only
      result.data.value.id = 'modified'

      expect(typeof id).toBe('string')
      expect(typeof name).toBe('string')
    }
  })

  it('should allow direct property access without null checks', () => {
    const api = useOpenApi(mockConfig)
    const result = api.useQuery(OperationId.getPet, { petId: '123' })

    if (result.data.value) {
      // Direct access - no optional chaining for readonly id
      const idLength = result.data.value.id.length
      const idUpper = result.data.value.id.toUpperCase()

      // Optional properties need checks
      const tagLength = result.data.value.tag?.length

      expect(typeof idLength).toBe('number')
      expect(typeof idUpper).toBe('string')
      expect(tagLength).toBeUndefined()
    }
  })
})
