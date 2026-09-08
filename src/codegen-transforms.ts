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
  //                       or `SomeType | Record<string, never> | null`
  let result = content.replace(/\s*\|\s*Record<string,\s*never>/g, '')

  // Remove leading member:   `Record<string, never> | SomeType`
  result = result.replace(/Record<string,\s*never>\s*\|\s*/g, '')

  return result
}
