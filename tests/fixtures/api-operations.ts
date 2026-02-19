// Auto-generated from OpenAPI specification - do not edit manually

import type { operations } from './openapi-types'
import type { OperationConfig } from '@/types'
import { HttpMethod } from '@/types'
import type {
  ApiResponse as _ApiResponse,
  ApiResponseSafe as _ApiResponseSafe,
  ApiRequest as _ApiRequest,
  ApiPathParams as _ApiPathParams,
  ApiQueryParams as _ApiQueryParams,
} from '@/types'

export { PetStatus } from './api-enums'
export type { PetStatus } from './api-enums'

// ============================================================================
// Per-operation enum values
// ============================================================================

export const createPet_enums = {} as const

export const deletePet_enums = {} as const

export const getConfigJson_enums = {} as const

export const getDataV1Json_enums = {} as const

export const getOwners_enums = {} as const

export const getPet_enums = {} as const

export const getPetPetId_enums = {} as const

export const listPets_enums = {} as const

export const listUserPets_enums = {} as const

export const postOwners_enums = {} as const

export const postPetAdopt_enums = {} as const

export const postPetGiveTreats_enums = {} as const

export const updatePet_enums = {} as const

export const updatePetPetId_enums = {} as const

export const uploadPetPic_enums = {} as const

// ============================================================================
// Operations map
// ============================================================================

const operationsBase = {
  createPet: { path: '/pets', method: HttpMethod.POST },
  deletePet: { path: '/pets/{petId}', method: HttpMethod.DELETE },
  getConfigJson: { path: '/api/config.json', method: HttpMethod.GET },
  getDataV1Json: { path: '/api/data.v1.json', method: HttpMethod.GET },
  getOwners: { path: '/owners', method: HttpMethod.GET },
  getPet: { path: '/pets/{petId}', method: HttpMethod.GET },
  getPetPetId: { path: '/api/pet/{pet_id}', method: HttpMethod.GET },
  listPets: { path: '/pets', method: HttpMethod.GET },
  listUserPets: { path: '/users/{userId}/pets', method: HttpMethod.GET },
  postOwners: { path: '/owners', method: HttpMethod.POST },
  postPetAdopt: { path: '/api/pet/{pet_id}/adopt', method: HttpMethod.POST },
  postPetGiveTreats: { path: '/api/pet/give_treats', method: HttpMethod.POST },
  updatePet: { path: '/pets/{petId}', method: HttpMethod.PUT },
  updatePetPetId: { path: '/api/pet/{pet_id}', method: HttpMethod.PATCH },
  uploadPetPic: { path: '/pets/{petId}/upload', method: HttpMethod.POST },
} as const

/** Operations map - pass as `config.operations` to `useOpenApi`. */
export const openApiOperations = operationsBase as typeof operationsBase & Pick<operations, keyof typeof operationsBase>
export type OpenApiOperations = typeof openApiOperations

// ============================================================================
// Operation config
// ============================================================================

/**
 * Pass as second argument to `useOpenApi`.
 * Contains enum values for each operation's fields.
 */
export const operationConfig = {
  createPet: { enums: createPet_enums },
  deletePet: { enums: deletePet_enums },
  getConfigJson: { enums: getConfigJson_enums },
  getDataV1Json: { enums: getDataV1Json_enums },
  getOwners: { enums: getOwners_enums },
  getPet: { enums: getPet_enums },
  getPetPetId: { enums: getPetPetId_enums },
  listPets: { enums: listPets_enums },
  listUserPets: { enums: listUserPets_enums },
  postOwners: { enums: postOwners_enums },
  postPetAdopt: { enums: postPetAdopt_enums },
  postPetGiveTreats: { enums: postPetGiveTreats_enums },
  updatePet: { enums: updatePet_enums },
  updatePetPetId: { enums: updatePetPetId_enums },
  uploadPetPic: { enums: uploadPetPic_enums },
} as const satisfies OperationConfig<OpenApiOperations>

// ============================================================================
// Convenience type aliases
// ============================================================================

type AllOps = keyof OpenApiOperations

/** Response data type for an operation (all fields required). */
export type ApiResponse<K extends AllOps> = _ApiResponse<OpenApiOperations, K>
/** Response data type - only `readonly` fields required. */
export type ApiResponseSafe<K extends AllOps> = _ApiResponseSafe<OpenApiOperations, K>
/** Request body type. */
export type ApiRequest<K extends AllOps> = _ApiRequest<OpenApiOperations, K>
/** Path parameters type. */
export type ApiPathParams<K extends AllOps> = _ApiPathParams<OpenApiOperations, K>
/** Query parameters type. */
export type ApiQueryParams<K extends AllOps> = _ApiQueryParams<OpenApiOperations, K>
