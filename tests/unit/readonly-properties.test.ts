/**
 * Tests for readonly property handling in OpenAPI endpoints.
 *
 * This test file verifies that readonly properties (marked with "readOnly": true in OpenAPI spec)
 * are handled correctly by our library types:
 * 1. ApiResponse makes readonly properties REQUIRED (no null checks needed)
 * 2. ApiRequest EXCLUDES readonly properties (can't send server-generated fields)
 */

import { describe, it, expect } from 'vitest'
import {
  OpType,
  type ApiResponse,
  type ApiRequest,
  type ApiPathParams,
  type ApiQueryParams,
} from '../fixtures/openapi-typed-operations'

/**
 * Test that readonly properties are correctly handled in our library types.
 */
describe('Readonly Property Handling', () => {
  describe('ApiResponse - Response Types', () => {
    it('should make readonly id REQUIRED in ApiResponse', () => {
      // ApiResponse uses RequireReadonly which makes readonly properties REQUIRED
      type PetResponse = ApiResponse<OpType.getPet>

      // id is REQUIRED - must include it
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

      // No null check or optional chaining needed - id is required
      const idLength: number = response.id.length
      const idUpper: string = response.id.toUpperCase()

      expect(idLength).toBe(8)
      expect(idUpper).toBe('UUID-123')
    })

    it('should handle optional non-readonly properties', () => {
      type PetResponse = ApiResponse<OpType.getPet>

      // tag and status are optional (not readonly), so they stay optional
      const minimalPet: PetResponse = {
        id: 'uuid',
        name: 'Fluffy',
      }

      expect(minimalPet.tag).toBeUndefined()
      expect(minimalPet.status).toBeUndefined()

      // With optional properties
      const fullPet: PetResponse = {
        id: 'uuid',
        name: 'Fluffy',
        tag: 'friendly',
        status: 'available',
      }

      expect(fullPet.tag).toBe('friendly')
      expect(fullPet.status).toBe('available')
    })

    it('should work with list operations returning arrays', () => {
      type ListResponse = ApiResponse<OpType.listPets>

      // listPets returns an array of Pets
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
      // ApiRequest uses Writable which EXCLUDES readonly properties
      type CreateRequestBody = ApiRequest<OpType.createPet>

      // Should NOT have id in the request body type
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

      // Should accept all non-readonly properties
      const fullPet: CreateRequestBody = {
        name: 'Fluffy',
        tag: 'friendly',
        status: 'available',
      }

      expect(fullPet.name).toBe('Fluffy')
      expect(fullPet.tag).toBe('friendly')
      expect(fullPet.status).toBe('available')

      // Should also accept just the required property
      const minimalPet: CreateRequestBody = {
        name: 'Minimal',
      }

      expect(minimalPet.name).toBe('Minimal')
    })

    it('should work the same for PUT operations', () => {
      type UpdateRequestBody = ApiRequest<OpType.updatePet>

      // PUT should also exclude readonly id
      const updateBody: UpdateRequestBody = {
        name: 'Updated Fluffy',
        status: 'sold',
      }

      expect(updateBody.name).toBe('Updated Fluffy')

      // @ts-expect-error - 'id' does not exist in type
      const _invalid: UpdateRequestBody = { id: 'some-id', name: 'Updated' }
    })
  })

  describe('Type Helpers with OpType namespace', () => {
    it('should use ApiResponse<OpType.getPet> for response types', () => {
      // Clean syntax with intellisense: OpType.get shows all operations
      type Response = ApiResponse<OpType.getPet>

      const pet: Response = {
        id: 'uuid-123',
        name: 'Fluffy',
      }

      // id is guaranteed to exist (required by RequireReadonly)
      const id: string = pet.id
      expect(id).toBe('uuid-123')

      // @ts-expect-error - Cannot assign to 'id' because it is read-only
      pet.id = 'modified'
    })

    it('should use ApiRequest<OpType.createPet> for request body types', () => {
      type Request = ApiRequest<OpType.createPet>

      const body: Request = {
        name: 'Fluffy',
        tag: 'friendly',
      }

      expect(body.name).toBe('Fluffy')

      // @ts-expect-error - 'id' does not exist (readonly property excluded)
      const _invalid: Request = { id: 'should-fail', name: 'Fluffy' }
    })

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

    it('should prevent typos in operation IDs', () => {
      // @ts-expect-error - Property 'getPetzzz' does not exist
      type _TypoResponse = ApiResponse<OpType.getPetzzz>

      // Correct usage:
      type CorrectResponse = ApiResponse<OpType.getPet>

      const pet: CorrectResponse = {
        id: 'uuid',
        name: 'Fluffy',
      }

      expect(pet.id).toBe('uuid')
    })

    it('should work with both query and mutation operations', () => {
      // Query operation (GET)
      type GetResponse = ApiResponse<OpType.getPet>
      const getPet: GetResponse = { id: 'uuid', name: 'Pet' }
      expect(getPet.id).toBe('uuid')

      // Mutation operation (POST)
      type CreateRequest = ApiRequest<OpType.createPet>
      type CreateResponse = ApiResponse<OpType.createPet>

      const createBody: CreateRequest = { name: 'New Pet' }
      const createResponse: CreateResponse = { id: 'new-uuid', name: 'New Pet' }

      expect(createBody.name).toBe('New Pet')
      expect(createResponse.id).toBe('new-uuid')

      // Mutation operation (PUT)
      type UpdateRequest = ApiRequest<OpType.updatePet>
      type UpdateResponse = ApiResponse<OpType.updatePet>

      const updateBody: UpdateRequest = { name: 'Updated Pet' }
      const updateResponse: UpdateResponse = { id: 'updated-uuid', name: 'Updated Pet' }

      expect(updateBody.name).toBe('Updated Pet')
      expect(updateResponse.id).toBe('updated-uuid')
    })

    it('should handle operations without request body', () => {
      // DELETE has no request body
      type DeleteRequest = ApiRequest<OpType.deletePet>

      // Should be never (no request body)
      const checkNever: DeleteRequest = undefined as never
      expect(checkNever).toBeUndefined()
    })

    it('should handle operations without path parameters', () => {
      // createPet has no path parameters
      type Params = ApiPathParams<OpType.createPet>

      // Should be empty object
      const params: Params = {}
      expect(Object.keys(params)).toHaveLength(0)
    })
  })

  describe('Runtime Behavior with Readonly Properties', () => {
    it('should allow reading readonly properties at runtime', () => {
      type PetResponse = ApiResponse<OpType.getPet>

      const pet: PetResponse = {
        id: 'test-uuid',
        name: 'Fluffy',
        tag: 'friendly',
        status: 'available',
      }

      // We can read the id
      expect(pet.id).toBe('test-uuid')
      expect(pet.name).toBe('Fluffy')

      // @ts-expect-error - Cannot assign to 'id' because it is read-only
      pet.id = 'modified'
    })

    it('should allow reading readonly properties', () => {
      type PetResponse = ApiResponse<OpType.getPet>

      const pet: PetResponse = {
        id: 'test-uuid',
        name: 'Fluffy',
        tag: 'friendly',
        status: 'available',
      }

      // Readonly properties can be read
      expect(pet.id).toBe('test-uuid')
      expect(pet.name).toBe('Fluffy')

      // Note: TypeScript's readonly is compile-time only
      // The type system prevents assignment, but runtime doesn't enforce it
    })
  })
})
