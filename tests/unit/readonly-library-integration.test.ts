/**
 * Integration tests for readonly property handling with library type utilities.
 *
 * This test file verifies that the library's type utilities (ApiRequest, ApiResponse, etc.)
 * correctly handle readonly properties from the OpenAPI specification.
 *
 * Note: ApiResponse uses RequireReadonly which makes readonly properties REQUIRED in responses,
 * even if they're optional in the OpenAPI schema. This ensures server always provides readonly fields.
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

/**
 * Test library type utilities with readonly properties.
 */
describe('Library Type Utilities with Readonly Properties', () => {
  describe('Type Helpers with OpType namespace', () => {
    it('should work with ApiResponse<OpType.getPet>', () => {
      type Response = ApiResponse<OpType.getPet>

      const pet: Response = {
        id: 'uuid-123',
        name: 'Fluffy',
      }

      expect(pet.id).toBe('uuid-123')
      expect(pet.name).toBe('Fluffy')

      // @ts-expect-error - Cannot assign to 'id' because it is read-only
      pet.id = 'modified'
    })

    it('should work with ApiRequest<OpType.createPet>', () => {
      type Request = ApiRequest<OpType.createPet>

      const body: Request = {
        name: 'Fluffy',
        tag: 'friendly',
      }

      expect(body.name).toBe('Fluffy')

      // @ts-expect-error - 'id' does not exist (readonly property excluded)
      const _invalid: Request = { id: 'should-fail', name: 'Fluffy' }
    })

    it('should work with ApiPathParams<OpType.getPet>', () => {
      type Params = ApiPathParams<OpType.getPet>

      const params: Params = {
        petId: '123',
      }

      expect(params.petId).toBe('123')

      // @ts-expect-error - 'wrongParam' does not exist
      const _invalid: Params = { wrongParam: '123' }
    })

    it('should work with ApiQueryParams<OpType.listPets>', () => {
      type Params = ApiQueryParams<OpType.listPets>

      const params: Params = {
        limit: 100,
      }

      expect(params.limit).toBe(100)
    })

    it('should prevent typos in operation IDs', () => {
      // This would be a TypeScript error if we used a non-existent operation:
      // @ts-expect-error - Property 'getPetTypo' does not exist
      type _TypoResponse = ApiResponse<OpType.getPetTypo>

      // Correct usage:
      type CorrectResponse = ApiResponse<OpType.getPet>

      const pet: CorrectResponse = {
        id: 'uuid',
        name: 'Fluffy',
      }

      expect(pet.id).toBe('uuid')
    })

    it('should work with mutation operations', () => {
      type CreateRequest = ApiRequest<OpType.createPet>
      type CreateResponse = ApiResponse<OpType.createPet>

      const requestBody: CreateRequest = {
        name: 'New Pet',
        status: 'available',
      }

      // Response includes readonly id
      const response: CreateResponse = {
        id: 'server-generated-uuid',
        name: 'New Pet',
        status: 'available',
      }

      expect(requestBody.name).toBe('New Pet')
      expect(response.id).toBe('server-generated-uuid')
    })
  })

  describe('Integration with useOpenApi', () => {
    it('should work correctly with useMutation for createPet', () => {
      const mockConfig: OpenApiConfig<OpenApiOperations> = {
        operations: openApiOperations,
        axios: mockAxios,
      }

      const api = useOpenApi(mockConfig)
      const createPet = api.useMutation(OperationId.createPet)

      expect(createPet).toBeTruthy()
      expect(createPet).toHaveProperty('mutate')
      expect(createPet).toHaveProperty('mutateAsync')

      // @ts-expect-error - 'id' does not exist in type (readonly property excluded from mutation data, single line for directive to work)
      createPet.mutate({ data: { id: 'should-not-work', name: 'Fluffy' } })
    })

    it('should work correctly with useMutation for updatePet', () => {
      const mockConfig: OpenApiConfig<OpenApiOperations> = {
        operations: openApiOperations,
        axios: mockAxios,
      }

      const api = useOpenApi(mockConfig)
      const updatePet = api.useMutation(OperationId.updatePet, { petId: '123' })

      expect(updatePet).toBeTruthy()

      // @ts-expect-error - 'id' does not exist in type (readonly property excluded from mutation data, single line for directive to work)
      updatePet.mutate({ data: { id: 'should-not-work', name: 'Updated' } })
    })

    it('should work correctly with useQuery for listPets', () => {
      const mockConfig: OpenApiConfig<OpenApiOperations> = {
        operations: openApiOperations,
        axios: mockAxios,
      }

      const api = useOpenApi(mockConfig)
      const listPets = api.useQuery(OperationId.listPets)

      expect(listPets).toBeTruthy()
      expect(listPets).toHaveProperty('data')
    })

    it('should work correctly with useQuery for getPet', () => {
      const mockConfig: OpenApiConfig<OpenApiOperations> = {
        operations: openApiOperations,
        axios: mockAxios,
      }

      const api = useOpenApi(mockConfig)
      const getPet = api.useQuery(OperationId.getPet, { petId: '123' })

      expect(getPet).toBeTruthy()
    })
  })

  describe('useQuery Return Type - RequireReadonly Behavior', () => {
    it('should return data with required readonly id (not optional)', () => {
      const mockConfig: OpenApiConfig<OpenApiOperations> = {
        operations: openApiOperations,
        axios: mockAxios,
      }

      const api = useOpenApi(mockConfig)
      const result = api.useQuery(OperationId.getPet, { petId: '123' })

      // The data type is ComputedRef<ApiResponse<Ops, Op> | undefined>
      // ApiResponse uses RequireReadonly which makes readonly properties REQUIRED

      // Type test: if data exists, id is guaranteed to be present (not optional)
      if (result.data.value) {
        // No null check needed - id is required by RequireReadonly
        const id: string = result.data.value.id
        const name: string = result.data.value.name

        // These are optional (non-readonly properties stay optional)
        const _tag: string | undefined = result.data.value.tag
        const _status: string | undefined = result.data.value.status

        // TypeScript prevents modification of readonly id
        // @ts-expect-error - Cannot assign to 'id' because it is read-only
        result.data.value.id = 'modified'

        expect(typeof id).toBe('string')
        expect(typeof name).toBe('string')
      }
    })

    it('should allow direct property access on useQuery data without null checks', () => {
      const mockConfig: OpenApiConfig<OpenApiOperations> = {
        operations: openApiOperations,
        axios: mockAxios,
      }

      const api = useOpenApi(mockConfig)
      const result = api.useQuery(OperationId.getPet, { petId: '123' })

      // Demonstrate: when data exists, id is always present (no ? needed)
      if (result.data.value) {
        // Direct access - no optional chaining or null check needed for id
        const idLength = result.data.value.id.length
        const idUpper = result.data.value.id.toUpperCase()

        // But optional properties still need checks
        const tagLength = result.data.value.tag?.length // Optional chaining for tag

        expect(typeof idLength).toBe('number')
        expect(typeof idUpper).toBe('string')
        expect(tagLength).toBeUndefined()
      }
    })
  })

  describe('Runtime Behavior with Readonly Properties', () => {
    it('should not restrict runtime access to readonly properties in responses', () => {
      type PetResponse = ApiResponse<OpType.getPet>

      // At runtime, readonly properties are still accessible (just not assignable)
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

      // However, TypeScript's readonly is a compile-time only constraint
      // At runtime, the object is still mutable (this is expected TS behavior)
    })

    it('should correctly handle optional non-readonly properties', () => {
      type Pet = ApiResponse<OpType.getPet>

      // Tag and status are optional (non-readonly), id is readonly and REQUIRED by RequireReadonly
      const pet1: Pet = {
        id: 'test-uuid',
        name: 'Fluffy',
        // tag and status are optional (not readonly, so they stay optional)
      }

      expect(pet1.id).toBe('test-uuid')
      expect(pet1.tag).toBeUndefined()
      expect(pet1.status).toBeUndefined()

      const pet2: Pet = {
        id: 'test-uuid-2',
        name: 'Rex',
        tag: 'energetic',
        status: 'available',
      }

      expect(pet2.id).toBe('test-uuid-2')
      expect(pet2.tag).toBe('energetic')
      expect(pet2.status).toBe('available')
    })
  })

  describe('RequireReadonly Behavior', () => {
    it('should make readonly properties required even when optional in schema', () => {
      type Pet = ApiResponse<OpType.getPet>

      // This demonstrates the RequireReadonly utility:
      // - OpenAPI schema: id is optional (id?: string)
      // - ApiResponse: id is required (id: string) because it's readonly

      // ✅ Valid: all readonly properties provided
      const validPet: Pet = {
        id: 'required',
        name: 'Fluffy',
      }

      // ❌ Invalid: missing readonly property
      // @ts-expect-error - Property 'id' is missing (RequireReadonly makes it required)
      const _invalidPet: Pet = {
        name: 'Fluffy',
      }

      expect(validPet.id).toBe('required')
    })
  })
})
