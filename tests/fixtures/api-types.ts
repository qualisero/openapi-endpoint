// Auto-generated from OpenAPI specification — do not edit manually

import type {
  ApiResponse as _ApiResponse,
  ApiResponseSafe as _ApiResponseSafe,
  ApiRequest as _ApiRequest,
  ApiPathParams as _ApiPathParams,
  ApiQueryParams as _ApiQueryParams,
} from '@/types'
import type { OpenApiOperations } from './api-operations'

/**
 * Type-only namespace for all API operations.
 *
 * @example
 * ```ts
 * import type { Types } from './generated/api-types'
 *
 * type Pet       = Types.getPet.Response
 * type NewPet    = Types.createPet.Request
 * type PetStatus = Types.createPet.Enums.Status   // 'available' | 'pending' | 'adopted'
 * type Params    = Types.getPet.PathParams         // { petId: string }
 * ```
 */
export namespace Types {
  export namespace createPet {
    /** Full response type - all fields required. */
    export type Response = _ApiResponse<OpenApiOperations, 'createPet'>
    /** Response type - only `readonly` fields required. */
    export type SafeResponse = _ApiResponseSafe<OpenApiOperations, 'createPet'>
    /** Request body type. */
    export type Request = _ApiRequest<OpenApiOperations, 'createPet'>
    /** Path parameters. */
    export type PathParams = _ApiPathParams<OpenApiOperations, 'createPet'>
    /** Query parameters. */
    export type QueryParams = _ApiQueryParams<OpenApiOperations, 'createPet'>
    export namespace Enums {}
  }

  export namespace deletePet {
    /** Full response type - all fields required. */
    export type Response = _ApiResponse<OpenApiOperations, 'deletePet'>
    /** Response type - only `readonly` fields required. */
    export type SafeResponse = _ApiResponseSafe<OpenApiOperations, 'deletePet'>
    /** Request body type. */
    export type Request = _ApiRequest<OpenApiOperations, 'deletePet'>
    /** Path parameters. */
    export type PathParams = _ApiPathParams<OpenApiOperations, 'deletePet'>
    /** Query parameters. */
    export type QueryParams = _ApiQueryParams<OpenApiOperations, 'deletePet'>
    export namespace Enums {}
  }

  export namespace getConfigJson {
    /** Full response type - all fields required. */
    export type Response = _ApiResponse<OpenApiOperations, 'getConfigJson'>
    /** Response type - only `readonly` fields required. */
    export type SafeResponse = _ApiResponseSafe<OpenApiOperations, 'getConfigJson'>
    /** Path parameters. */
    export type PathParams = _ApiPathParams<OpenApiOperations, 'getConfigJson'>
    /** Query parameters. */
    export type QueryParams = _ApiQueryParams<OpenApiOperations, 'getConfigJson'>
    export namespace Enums {}
  }

  export namespace getDataV1Json {
    /** Full response type - all fields required. */
    export type Response = _ApiResponse<OpenApiOperations, 'getDataV1Json'>
    /** Response type - only `readonly` fields required. */
    export type SafeResponse = _ApiResponseSafe<OpenApiOperations, 'getDataV1Json'>
    /** Path parameters. */
    export type PathParams = _ApiPathParams<OpenApiOperations, 'getDataV1Json'>
    /** Query parameters. */
    export type QueryParams = _ApiQueryParams<OpenApiOperations, 'getDataV1Json'>
    export namespace Enums {}
  }

  export namespace getOwners {
    /** Full response type - all fields required. */
    export type Response = _ApiResponse<OpenApiOperations, 'getOwners'>
    /** Response type - only `readonly` fields required. */
    export type SafeResponse = _ApiResponseSafe<OpenApiOperations, 'getOwners'>
    /** Path parameters. */
    export type PathParams = _ApiPathParams<OpenApiOperations, 'getOwners'>
    /** Query parameters. */
    export type QueryParams = _ApiQueryParams<OpenApiOperations, 'getOwners'>
    export namespace Enums {}
  }

  export namespace getPet {
    /** Full response type - all fields required. */
    export type Response = _ApiResponse<OpenApiOperations, 'getPet'>
    /** Response type - only `readonly` fields required. */
    export type SafeResponse = _ApiResponseSafe<OpenApiOperations, 'getPet'>
    /** Path parameters. */
    export type PathParams = _ApiPathParams<OpenApiOperations, 'getPet'>
    /** Query parameters. */
    export type QueryParams = _ApiQueryParams<OpenApiOperations, 'getPet'>
    export namespace Enums {}
  }

  export namespace getPetPetId {
    /** Full response type - all fields required. */
    export type Response = _ApiResponse<OpenApiOperations, 'getPetPetId'>
    /** Response type - only `readonly` fields required. */
    export type SafeResponse = _ApiResponseSafe<OpenApiOperations, 'getPetPetId'>
    /** Path parameters. */
    export type PathParams = _ApiPathParams<OpenApiOperations, 'getPetPetId'>
    /** Query parameters. */
    export type QueryParams = _ApiQueryParams<OpenApiOperations, 'getPetPetId'>
    export namespace Enums {}
  }

  export namespace listPets {
    /** Full response type - all fields required. */
    export type Response = _ApiResponse<OpenApiOperations, 'listPets'>
    /** Response type - only `readonly` fields required. */
    export type SafeResponse = _ApiResponseSafe<OpenApiOperations, 'listPets'>
    /** Path parameters. */
    export type PathParams = _ApiPathParams<OpenApiOperations, 'listPets'>
    /** Query parameters. */
    export type QueryParams = _ApiQueryParams<OpenApiOperations, 'listPets'>
    export namespace Enums {}
  }

  export namespace listUserPets {
    /** Full response type - all fields required. */
    export type Response = _ApiResponse<OpenApiOperations, 'listUserPets'>
    /** Response type - only `readonly` fields required. */
    export type SafeResponse = _ApiResponseSafe<OpenApiOperations, 'listUserPets'>
    /** Path parameters. */
    export type PathParams = _ApiPathParams<OpenApiOperations, 'listUserPets'>
    /** Query parameters. */
    export type QueryParams = _ApiQueryParams<OpenApiOperations, 'listUserPets'>
    export namespace Enums {}
  }

  export namespace postOwners {
    /** Full response type - all fields required. */
    export type Response = _ApiResponse<OpenApiOperations, 'postOwners'>
    /** Response type - only `readonly` fields required. */
    export type SafeResponse = _ApiResponseSafe<OpenApiOperations, 'postOwners'>
    /** Request body type. */
    export type Request = _ApiRequest<OpenApiOperations, 'postOwners'>
    /** Path parameters. */
    export type PathParams = _ApiPathParams<OpenApiOperations, 'postOwners'>
    /** Query parameters. */
    export type QueryParams = _ApiQueryParams<OpenApiOperations, 'postOwners'>
    export namespace Enums {}
  }

  export namespace postPetAdopt {
    /** Full response type - all fields required. */
    export type Response = _ApiResponse<OpenApiOperations, 'postPetAdopt'>
    /** Response type - only `readonly` fields required. */
    export type SafeResponse = _ApiResponseSafe<OpenApiOperations, 'postPetAdopt'>
    /** Request body type. */
    export type Request = _ApiRequest<OpenApiOperations, 'postPetAdopt'>
    /** Path parameters. */
    export type PathParams = _ApiPathParams<OpenApiOperations, 'postPetAdopt'>
    /** Query parameters. */
    export type QueryParams = _ApiQueryParams<OpenApiOperations, 'postPetAdopt'>
    export namespace Enums {}
  }

  export namespace postPetGiveTreats {
    /** Full response type - all fields required. */
    export type Response = _ApiResponse<OpenApiOperations, 'postPetGiveTreats'>
    /** Response type - only `readonly` fields required. */
    export type SafeResponse = _ApiResponseSafe<OpenApiOperations, 'postPetGiveTreats'>
    /** Request body type. */
    export type Request = _ApiRequest<OpenApiOperations, 'postPetGiveTreats'>
    /** Path parameters. */
    export type PathParams = _ApiPathParams<OpenApiOperations, 'postPetGiveTreats'>
    /** Query parameters. */
    export type QueryParams = _ApiQueryParams<OpenApiOperations, 'postPetGiveTreats'>
    export namespace Enums {}
  }

  export namespace updatePet {
    /** Full response type - all fields required. */
    export type Response = _ApiResponse<OpenApiOperations, 'updatePet'>
    /** Response type - only `readonly` fields required. */
    export type SafeResponse = _ApiResponseSafe<OpenApiOperations, 'updatePet'>
    /** Request body type. */
    export type Request = _ApiRequest<OpenApiOperations, 'updatePet'>
    /** Path parameters. */
    export type PathParams = _ApiPathParams<OpenApiOperations, 'updatePet'>
    /** Query parameters. */
    export type QueryParams = _ApiQueryParams<OpenApiOperations, 'updatePet'>
    export namespace Enums {}
  }

  export namespace updatePetPetId {
    /** Full response type - all fields required. */
    export type Response = _ApiResponse<OpenApiOperations, 'updatePetPetId'>
    /** Response type - only `readonly` fields required. */
    export type SafeResponse = _ApiResponseSafe<OpenApiOperations, 'updatePetPetId'>
    /** Request body type. */
    export type Request = _ApiRequest<OpenApiOperations, 'updatePetPetId'>
    /** Path parameters. */
    export type PathParams = _ApiPathParams<OpenApiOperations, 'updatePetPetId'>
    /** Query parameters. */
    export type QueryParams = _ApiQueryParams<OpenApiOperations, 'updatePetPetId'>
    export namespace Enums {}
  }

  export namespace uploadPetPic {
    /** Full response type - all fields required. */
    export type Response = _ApiResponse<OpenApiOperations, 'uploadPetPic'>
    /** Response type - only `readonly` fields required. */
    export type SafeResponse = _ApiResponseSafe<OpenApiOperations, 'uploadPetPic'>
    /** Request body type. */
    export type Request = _ApiRequest<OpenApiOperations, 'uploadPetPic'>
    /** Path parameters. */
    export type PathParams = _ApiPathParams<OpenApiOperations, 'uploadPetPic'>
    /** Query parameters. */
    export type QueryParams = _ApiQueryParams<OpenApiOperations, 'uploadPetPic'>
    export namespace Enums {}
  }
}
