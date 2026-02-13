/**
 * Tests for readonly property handling with library type utilities.
 *
 * Verifies that readonly properties (marked with "readOnly": true in OpenAPI spec)
 * are handled correctly:
 * 1. ApiResponse makes ALL fields REQUIRED (no null checks needed)
 * 2. ApiResponseSafe makes only readonly fields required (opt-out for unreliable backends)
 * 3. ApiRequest EXCLUDES readonly properties (can't send server-generated fields)
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
  type ApiResponseSafe,
  type ApiRequest,
  type ApiPathParams,
  type ApiQueryParams,
} from '../fixtures/openapi-typed-operations'

describe('ApiResponse - Response Types (All Fields Required)', () => {
  it('should make readonly id REQUIRED in ApiResponse', () => {
    type PetResponse = ApiResponse<OpType.getPet>

    const response: PetResponse = {
      id: 'readonly-uuid',
      name: 'Fluffy',
      tag: 'friendly',
      status: 'available',
    }

    // No null check needed - all fields are required
    const id: string = response.id
    expect(id).toBe('readonly-uuid')

    // @ts-expect-error - Cannot assign to 'id' because it is read-only
    response.id = 'modified'
  })

  it('should make ALL fields required, including optional ones', () => {
    type PetResponse = ApiResponse<OpType.getPet>

    // @ts-expect-error - Property 'tag' is missing
    const _missingTag: PetResponse = {
      id: 'uuid',
      name: 'Fluffy',
      status: 'available',
    }

    // @ts-expect-error - Property 'status' is missing
    const _missingStatus: PetResponse = {
      id: 'uuid',
      name: 'Fluffy',
      tag: 'friendly',
    }

    // Valid: all fields present
    const valid: PetResponse = {
      id: 'uuid',
      name: 'Fluffy',
      tag: 'friendly',
      status: 'available',
    }

    expect(valid.tag).toBe('friendly')
    expect(valid.status).toBe('available')
  })

  it('should allow direct access to all fields without null check', () => {
    type PetResponse = ApiResponse<OpType.getPet>

    const response: PetResponse = {
      id: 'uuid-123',
      name: 'Fluffy',
      tag: 'friendly',
      status: 'available',
    }

    // All fields accessible without null checks
    const idLength: number = response.id.length
    const nameLength: number = response.name.length
    const tagLength: number = response.tag.length
    const statusValue: 'available' | 'pending' | 'sold' = response.status

    expect(idLength).toBe(8)
    expect(nameLength).toBe(6)
    expect(tagLength).toBe(8)
    expect(statusValue).toBe('available')
  })

  it('should work with list operations returning arrays', () => {
    type ListResponse = ApiResponse<OpType.listPets>

    const pets: ListResponse = [
      { id: 'uuid-1', name: 'Fluffy', tag: 'friendly', status: 'available' },
      { id: 'uuid-2', name: 'Spot', tag: 'playful', status: 'pending' },
    ]

    expect(pets[0].id).toBe('uuid-1')
    expect(pets[1].tag).toBe('playful')
  })
})

describe('ApiResponseSafe - Response Types (Only Readonly Required)', () => {
  it('should make only readonly id REQUIRED, others optional', () => {
    type PetResponse = ApiResponseSafe<OpType.getPet>

    // Valid: only readonly id and required name
    const minimal: PetResponse = {
      id: 'uuid',
      name: 'Fluffy',
    }

    expect(minimal.id).toBe('uuid')
    expect(minimal.tag).toBeUndefined()
    expect(minimal.status).toBeUndefined()

    // Valid: all fields
    const full: PetResponse = {
      id: 'uuid',
      name: 'Fluffy',
      tag: 'friendly',
      status: 'available',
    }

    expect(full.tag).toBe('friendly')
    expect(full.status).toBe('available')
  })

  it('should still require readonly id', () => {
    type PetResponse = ApiResponseSafe<OpType.getPet>

    // @ts-expect-error - Property 'id' is missing (readonly is required)
    const _noId: PetResponse = {
      name: 'Fluffy',
    }
  })

  it('should require null checks for optional fields', () => {
    type PetResponse = ApiResponseSafe<OpType.getPet>

    const pet: PetResponse = {
      id: 'uuid',
      name: 'Fluffy',
    }

    // id is always present
    const id: string = pet.id

    // tag and status may be undefined
    // @ts-expect-error - 'tag' is possibly 'undefined'
    const _tag: string = pet.tag

    // @ts-expect-error - 'status' is possibly 'undefined'
    const _status: 'available' | 'pending' | 'sold' = pet.status

    // Correct: use optional chaining
    const tagLength = pet.tag?.length
    const statusValue = pet.status

    expect(id).toBe('uuid')
    expect(tagLength).toBeUndefined()
    expect(statusValue).toBeUndefined()
  })

  it('should accept enum values for status when provided', () => {
    type PetResponse = ApiResponseSafe<OpType.getPet>

    const available: PetResponse = { id: '1', name: 'Pet', status: 'available' }
    const pending: PetResponse = { id: '2', name: 'Pet', status: 'pending' }
    const sold: PetResponse = { id: '3', name: 'Pet', status: 'sold' }

    expect(available.status).toBe('available')
    expect(pending.status).toBe('pending')
    expect(sold.status).toBe('sold')

    // @ts-expect-error - status only accepts enum values
    const _invalid: PetResponse = { id: '4', name: 'Pet', status: 'invalid-status' }
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
      tag: 'friendly',
      status: 'available',
    }

    expect(pet.id).toBe('uuid')
  })

  it('should work with both query and mutation operations', () => {
    type GetResponse = ApiResponse<OpType.getPet>
    const getPet: GetResponse = { id: 'uuid', name: 'Pet', tag: 't', status: 'available' }
    expect(getPet.id).toBe('uuid')

    type CreateRequest = ApiRequest<OpType.createPet>
    type CreateResponse = ApiResponse<OpType.createPet>

    const createBody: CreateRequest = { name: 'New Pet' }
    const createResponse: CreateResponse = { id: 'new-uuid', name: 'New Pet', tag: 't', status: 'available' }

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

  it('should return data with all fields required from useQuery', () => {
    const api = useOpenApi(mockConfig)
    const result = api.useQuery(OperationId.getPet, { petId: '123' })

    // ApiResponse makes ALL fields required
    if (result.data.value) {
      // No null check needed - all fields required
      const id: string = result.data.value.id
      const name: string = result.data.value.name
      const tag: string = result.data.value.tag
      const status: 'available' | 'pending' | 'sold' = result.data.value.status

      // @ts-expect-error - Cannot assign to 'id' because it is read-only
      result.data.value.id = 'modified'

      expect(typeof id).toBe('string')
      expect(typeof name).toBe('string')
      expect(typeof tag).toBe('string')
      expect(typeof status).toBe('string')
    }
  })
})
