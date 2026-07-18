/**
 * Compile-time typing assertions for the `serialize` mutation option.
 *
 * This file is never executed — it is checked by `npm run types:test`
 * (`npx tsc --noEmit --project tests/tsconfig.json`) to ensure the type
 * of `serialize` is exactly `boolean | string | undefined`.
 */
import { createApiClient } from '../fixtures/api-client'
import { mockAxios } from '../setup'

// =============================================================================
// Test 1: serialize: true (boolean) is accepted
// =============================================================================

function testSerializeBoolean() {
  const api = createApiClient(mockAxios)

  // boolean literal true — must not produce a type error
  const _mutation = api.createPet.useMutation({ serialize: true })

  // boolean literal false — must not produce a type error
  const _mutationFalse = api.createPet.useMutation({ serialize: false })

  // boolean variable — must not produce a type error
  const flag: boolean = Math.random() > 0.5
  const _mutationBoolVar = api.createPet.useMutation({ serialize: flag })

  return { _mutation, _mutationFalse, _mutationBoolVar }
}

// =============================================================================
// Test 2: serialize: 'group' (string) is accepted
// =============================================================================

function testSerializeString() {
  const api = createApiClient(mockAxios)

  // string literal — must not produce a type error
  const _mutation = api.createPet.useMutation({ serialize: 'group' })

  // general string variable — must not produce a type error
  const scope: string = 'contract-editor'
  const _mutationStrVar = api.createPet.useMutation({ serialize: scope })

  return { _mutation, _mutationStrVar }
}

// =============================================================================
// Test 3: serialize: 123 (number) is rejected
// =============================================================================

function testSerializeNumberRejected() {
  const api = createApiClient(mockAxios)

  // @ts-expect-error — number is not assignable to boolean | string
  const _mutation = api.createPet.useMutation({ serialize: 123 })

  return { _mutation }
}

// =============================================================================
// Test 4: serialize works on mutations with path params too
// =============================================================================

function testSerializeWithPathParams() {
  const api = createApiClient(mockAxios)

  // serialize: true with eager path params
  const _m1 = api.updatePet.useMutation({ petId: '123' }, { serialize: true })

  // serialize: 'group' cross-operation
  const _m2 = api.updatePet.useMutation({ petId: '123' }, { serialize: 'resource-editor' })

  return { _m1, _m2 }
}

// =============================================================================
// Test 5: serialize omitted (undefined) — no type error
// =============================================================================

function testSerializeOmitted() {
  const api = createApiClient(mockAxios)

  // option entirely absent — must not produce a type error
  const _mutation = api.createPet.useMutation({})

  // option explicitly undefined — must not produce a type error
  const _mutationUndef = api.createPet.useMutation({ serialize: undefined })

  return { _mutation, _mutationUndef }
}

export {
  testSerializeBoolean,
  testSerializeString,
  testSerializeNumberRejected,
  testSerializeWithPathParams,
  testSerializeOmitted,
}
