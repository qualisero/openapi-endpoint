/**
 * Post-processing transforms applied to the openapi-typescript output
 * (openapi-types.ts) after generation.
 *
 * These are surgical text-level patches for well-known rendering artifacts
 * that cannot be suppressed via openapi-typescript options.
 */

/**
 * Strips `Record<string, never>` sentinel members from union types in the
 * generated openapi-types.ts content.
 *
 * **Why it appears**: openapi-typescript renders every schema object whose
 * `properties` key is present but empty (`"properties": {}`) as
 * `Record<string, never>`.  When such a schema is part of an `anyOf`/`oneOf`
 * union (the "group-union" pattern, e.g. `GroupA | {} | null`) the generated
 * TypeScript becomes `GroupA | Record<string, never> | null`.  The sentinel
 * member adds no information — it is structurally a subtype of every object
 * type — and confuses consumers who end up writing `CleanGroup`/`Clean`
 * utilities to strip it app-side.
 *
 * **What is preserved**: standalone `Record<string, never>` assignments that
 * openapi-typescript emits for absent top-level sections (e.g.
 * `export type webhooks = Record<string, never>`) are left untouched because
 * they have no `|` adjacent to the token.
 *
 * @param content - Raw string content of the generated openapi-types.ts file.
 * @returns Content with `Record<string, never>` removed from every union type.
 */
export function stripRecordStringNeverFromUnions(content: string): string {
  // Remove trailing member:  `SomeType | Record<string, never>`
  // Skipped when the preceding member is `null`/`undefined` (`null | Record<string, never>`):
  // stripping there could collapse the union to a bare null type.
  let result = content.replace(
    /(\bnull\b|\bundefined\b)?\s*\|\s*Record<string,\s*never>/g,
    (match, nullish: string | undefined) => (nullish ? match : ''),
  )

  // Remove leading member:   `Record<string, never> | SomeType`
  // Skipped when the rest of the union is only `null`/`undefined`
  // (e.g. an index-signature value type `Record<string, never> | null` from
  // `additionalProperties: { anyOf: [emptyObject, null] }`): stripping would silently
  // change the value type to `null`.
  // The lookahead sits directly after `|` and consumes whitespace itself,
  // so the outer `\s*` cannot backtrack around it.
  result = result.replace(/Record<string,\s*never>\s*\|(?!\s*(?:null|undefined)\s*[;,)\]}>\n])\s*/g, '')

  return result
}
