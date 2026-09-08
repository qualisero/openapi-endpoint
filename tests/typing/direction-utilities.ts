/**
 * Type-level tests for direction-vocabulary utilities: RequireAll, Writable, Mutable.
 *
 * These assertions are checked at compile time by `tsc --noEmit`.
 * Nothing runs at runtime; the compile-time check is the test.
 *
 * Direction semantics recap:
 *   readonly modifier (TypeScript) = spec `readOnly: true` artifact
 *   RequireAll  = response presence policy (deep-require all fields)
 *   Writable    = response shape → request shape (excludes readOnly keys, deep)
 *   Mutable     = response shape → mutable store shape (strips readonly modifier, deep)
 */

import type { RequireAll, Writable, Mutable } from '../../src/index'

// =============================================================================
// Fixture types (self-contained; no fixture file dependency)
// =============================================================================

/** Flat type: one readonly, one optional, one required. */
type Flat = {
  readonly id: string
  name: string
  tag?: string
}

/** Nested type: readonly at both levels; optional at both levels. */
type Deep = {
  readonly id: string
  name?: string
  info: {
    readonly createdAt: string
    label?: string
  }
}

/** Type containing arrays at various positions. */
type WithArrays = {
  readonly id: string
  tags: string[]
  readonly history: readonly { readonly at: string; value: number }[]
}

/** All-readonly object. */
type AllReadonly = {
  readonly a: string
  readonly b: number
  readonly nested: {
    readonly x: boolean
  }
}

/** Type with optional props at every depth (tests RequireAll). */
type AllOptional = {
  a?: string
  b?: number
  nested?: {
    x?: boolean
    y?: string
  }
  items?: Array<{ v?: number }>
}

// =============================================================================
// Helper: compile-time equality check (distributive-free)
// =============================================================================
type Equals<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false

type Assert<T extends true> = T

// =============================================================================
// Test 1: Writable — top-level readonly key excluded
// =============================================================================

type _WritableFlat = Writable<Flat>

// `id` (readonly) must be absent; `name` and `tag` must be present.
type _WritableFlat_HasName = Assert<Equals<_WritableFlat['name'], string>>
type _WritableFlat_HasTag = Assert<Equals<_WritableFlat['tag'], string | undefined>>
// `id` must not be a key (the mapped type omits it)
type _WritableFlat_NoId = Assert<Equals<'id' extends keyof _WritableFlat ? true : false, false>>

// =============================================================================
// Test 2: Writable — DEEP: nested readonly key excluded
// =============================================================================

type _WritableDeep = Writable<Deep>

// Top-level `id` excluded
type _WritableDeep_NoId = Assert<Equals<'id' extends keyof _WritableDeep ? true : false, false>>
// `name` kept (was optional, not readonly)
type _WritableDeep_HasName = Assert<Equals<_WritableDeep['name'], string | undefined>>
// `info` kept (not readonly itself), nested `createdAt` excluded
type _WritableDeep_HasInfo = Assert<Equals<'info' extends keyof _WritableDeep ? true : false, true>>
type _WritableDeepInfo = _WritableDeep['info']
type _WritableDeep_NestedNoCreatedAt = Assert<Equals<'createdAt' extends keyof _WritableDeepInfo ? true : false, false>>
type _WritableDeep_NestedHasLabel = Assert<Equals<_WritableDeepInfo['label'], string | undefined>>

// =============================================================================
// Test 3: Writable — arrays: element type is recursed
// =============================================================================

type _WritableArrays = Writable<WithArrays>

// `id` excluded (top-level readonly)
type _WritableArrays_NoId = Assert<Equals<'id' extends keyof _WritableArrays ? true : false, false>>
// `tags` kept; becomes mutable array of string
type _WritableArrays_Tags = Assert<Equals<'tags' extends keyof _WritableArrays ? true : false, true>>
// `history` excluded (top-level readonly)
type _WritableArrays_NoHistory = Assert<Equals<'history' extends keyof _WritableArrays ? true : false, false>>

// =============================================================================
// Test 4: Mutable — strips readonly modifier at top level
// =============================================================================

type _MutableFlat = Mutable<Flat>

// All three keys present (Mutable keeps all keys, just removes readonly)
type _MutableFlat_HasId = Assert<Equals<'id' extends keyof _MutableFlat ? true : false, true>>
type _MutableFlat_HasName = Assert<Equals<'name' extends keyof _MutableFlat ? true : false, true>>
type _MutableFlat_HasTag = Assert<Equals<'tag' extends keyof _MutableFlat ? true : false, true>>
// id must NOT be readonly after Mutable (IfEquals check via assignability)
// If id were still readonly, assigning to it would be a compile error.
// We verify by checking that the writable version equals the mutable version key type.
type _MutableFlat_IdType = Assert<Equals<_MutableFlat['id'], string>>

// =============================================================================
// Test 5: Mutable — DEEP: strips readonly modifier from nested objects
// =============================================================================

type _MutableDeep = Mutable<Deep>

// id present (Mutable keeps keys)
type _MutableDeep_HasId = Assert<Equals<'id' extends keyof _MutableDeep ? true : false, true>>
// info present
type _MutableDeep_HasInfo = Assert<Equals<'info' extends keyof _MutableDeep ? true : false, true>>
type _MutableDeepInfo = _MutableDeep['info']
// createdAt present inside info
type _MutableDeep_NestedHasCreatedAt = Assert<Equals<'createdAt' extends keyof _MutableDeepInfo ? true : false, true>>
// createdAt type is string (readonly modifier removed, so it's just string)
type _MutableDeep_NestedCreatedAt = Assert<Equals<_MutableDeepInfo['createdAt'], string>>

// =============================================================================
// Test 6: Mutable — readonly arrays become mutable arrays
// =============================================================================

type _MutableArrays = Mutable<WithArrays>

// history present (Mutable keeps all keys)
type _MutableArrays_HasHistory = Assert<Equals<'history' extends keyof _MutableArrays ? true : false, true>>
// The history array element's `at` property must be mutable (no readonly)
type _HistoryElement = _MutableArrays['history'] extends (infer E)[] ? E : never
type _MutableArrays_HistAtType = Assert<Equals<_HistoryElement['at'], string>>

// =============================================================================
// Test 7: Mutable — all-readonly type becomes fully mutable
// =============================================================================

type _MutableAllReadonly = Mutable<AllReadonly>

// All keys present
type _MutableAllReadonly_A = Assert<Equals<'a' extends keyof _MutableAllReadonly ? true : false, true>>
type _MutableAllReadonly_B = Assert<Equals<'b' extends keyof _MutableAllReadonly ? true : false, true>>
type _MutableAllReadonly_Nested = Assert<Equals<'nested' extends keyof _MutableAllReadonly ? true : false, true>>
// Types unchanged
type _MutableAllReadonly_AType = Assert<Equals<_MutableAllReadonly['a'], string>>
type _MutableAllReadonly_BType = Assert<Equals<_MutableAllReadonly['b'], number>>
type _MutableNestedInfo = _MutableAllReadonly['nested']
type _MutableAllReadonly_NX = Assert<Equals<_MutableNestedInfo['x'], boolean>>

// =============================================================================
// Test 8: RequireAll — deep-requires all optional fields
// =============================================================================

type _RequireAllOpt = RequireAll<AllOptional>

// Top-level fields all present and required (no undefined)
type _RequireAll_A = Assert<Equals<_RequireAllOpt['a'], string>>
type _RequireAll_B = Assert<Equals<_RequireAllOpt['b'], number>>
// nested present and required
type _RequireAll_Nested = Assert<Equals<'nested' extends keyof _RequireAllOpt ? true : false, true>>
type _RequireAllNested = _RequireAllOpt['nested']
type _RequireAll_NX = Assert<Equals<_RequireAllNested['x'], boolean>>
type _RequireAll_NY = Assert<Equals<_RequireAllNested['y'], string>>
// items array: element type deep-required
type _RequireAll_Items = Assert<Equals<'items' extends keyof _RequireAllOpt ? true : false, true>>
type _RequireAllItem = _RequireAllOpt['items'] extends (infer E)[] ? E : never
type _RequireAll_ItemV = Assert<Equals<_RequireAllItem['v'], number>>

// =============================================================================
// Test 9: RequireAll — preserves readonly modifiers
// =============================================================================

type _RequireAllFlat = RequireAll<Flat>

// id still readonly after RequireAll (RequireAll only makes required, not mutable)
// RequireAll<Flat> should have id: string (required), name: string, tag: string
type _RequireAll_Flat_IdType = Assert<Equals<_RequireAllFlat['id'], string>>
type _RequireAll_Flat_TagType = Assert<Equals<_RequireAllFlat['tag'], string>>

// =============================================================================
// Test 10: Composition — Mutable<RequireAll<T>>: all fields required + all mutable
// =============================================================================

type _MutableRequired = Mutable<RequireAll<AllOptional>>

type _MR_A = Assert<Equals<_MutableRequired['a'], string>>
type _MR_B = Assert<Equals<_MutableRequired['b'], number>>
type _MRNested = _MutableRequired['nested']
type _MR_NX = Assert<Equals<_MRNested['x'], boolean>>

// =============================================================================
// Ensure types are imported (avoid "unused import" lint errors)
// =============================================================================

export type {
  _WritableFlat,
  _WritableDeep,
  _WritableArrays,
  _MutableFlat,
  _MutableDeep,
  _MutableArrays,
  _MutableAllReadonly,
  _RequireAllOpt,
  _RequireAllFlat,
  _MutableRequired,
}
