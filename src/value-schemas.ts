/**
 * Runtime helpers for consuming emitted api-value-schemas.ts artifacts.
 *
 * The types here are also imported by generated api-value-schemas.ts files.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A standard JSON Schema value (draft-07/2019-09/2020-12 portable subset).
 * Emitted by the generator and consumed by AJV, JSONForms, etc.
 * No $schema keyword — consumers apply their own default dialect.
 *
 * Like standard JSON Schema, any schema position may also be a boolean
 * (`true` accepts everything, `false` rejects everything).
 */
export type ValueSchema = ValueSchemaObject | boolean

/**
 * The object form of a {@link ValueSchema}.
 */
export interface ValueSchemaObject {
  $ref?: string
  $defs?: Record<string, ValueSchema>
  type?: string | string[]
  enum?: (string | number | boolean | null)[]
  format?: string
  minLength?: number
  maxLength?: number
  minimum?: number
  maximum?: number
  exclusiveMinimum?: number
  exclusiveMaximum?: number
  pattern?: string
  required?: string[]
  properties?: Record<string, ValueSchema>
  items?: ValueSchema | ValueSchema[]
  additionalProperties?: boolean | ValueSchema
  allOf?: ValueSchema[]
  anyOf?: ValueSchema[]
  oneOf?: ValueSchema[]
  readOnly?: boolean
  writeOnly?: boolean
  description?: string
  default?: unknown
  const?: unknown
  [key: string]: unknown
}

/**
 * A map of component schema names to their converted JSON Schema definitions.
 * Keyed by schema name (e.g. "Vessel", "VesselAuto").
 */
export type SchemaDefs = Record<string, ValueSchema>

/**
 * A flat representation of a schema's properties, useful for hand-rolled
 * form rules or field tables.
 */
export interface SchemaField {
  name: string
  type?: string
  format?: string
  required?: boolean
  enum?: string[]
  minLength?: number
  maxLength?: number
  minimum?: number
  maximum?: number
  readOnly?: boolean
  nullable?: boolean
}

// ---------------------------------------------------------------------------
// Runtime helpers
// ---------------------------------------------------------------------------

/**
 * Compose a self-contained standard JSON Schema document for one operation.
 * Feed the result directly to AJV, JSONForms, vjsf, RJSF, etc.
 *
 * Accepts `undefined` so `requestSchemas[op]` / `responseSchemas[op]` lookups
 * (which are `Partial` records) can be passed directly; throws a clear error
 * when the operation has no emitted schema. Boolean schemas are returned
 * as-is (they are already self-contained).
 *
 * @example
 * const schema = resolveSchema(requestSchemas.createVessel, schemaDefs)
 * const validate = new Ajv().compile(schema)
 */
export function resolveSchema(entry: ValueSchemaObject | undefined, defs: SchemaDefs): ValueSchemaObject
export function resolveSchema(entry: ValueSchema | undefined, defs: SchemaDefs): ValueSchema
export function resolveSchema(entry: ValueSchema | undefined, defs: SchemaDefs): ValueSchema {
  if (entry === undefined) {
    throw new Error(
      'resolveSchema: no schema entry for this operation (not emitted — check the operation id and the --emit-value-schemas mode)',
    )
  }
  if (typeof entry === 'boolean') return entry
  // Merge entry-local $defs (e.g. OpenAPI 3.1 inline bodies) with the shared map
  // instead of letting one clobber the other. Entry-local names shadow shared
  // ones because refs inside the entry were authored against its own $defs.
  // Known residual: a name collision also rebinds refs inside shared defs to
  // the entry-local definition.
  const own = entry.$defs
  return own && typeof own === 'object' ? { ...entry, $defs: { ...defs, ...own } } : { ...entry, $defs: defs }
}

/**
 * Resolve a `#/$defs/X` reference in the context of `defs`.
 * Returns `undefined` if the ref is not found or not a simple `#/$defs/X` ref.
 */
function resolveRef(ref: string, defs: SchemaDefs): ValueSchemaObject | undefined {
  const m = /^#\/\$defs\/(.+)$/.exec(ref)
  if (!m) return undefined
  const resolved = defs[m[1]]
  return typeof resolved === 'object' && resolved !== null ? resolved : undefined
}

/**
 * Merge allOf schemas into a flat properties + required object.
 * Only merges simple object schemas (properties, required fields).
 */
function mergeAllOf(
  schemas: ValueSchema[],
  defs: SchemaDefs,
): { properties: Record<string, ValueSchema>; required: string[] } {
  const properties: Record<string, ValueSchema> = {}
  const required: string[] = []
  for (const s of schemas) {
    if (typeof s === 'boolean') continue
    const resolved = s.$ref ? (resolveRef(s.$ref, defs) ?? s) : s
    if (resolved.properties) {
      Object.assign(properties, resolved.properties)
    }
    if (resolved.required) {
      required.push(...resolved.required)
    }
  }
  return { properties, required }
}

/**
 * Optional convenience: flat field list for hand-rolled form rules or tables.
 *
 * Resolves the top-level `$ref`, one level of `allOf` merge, and
 * per-property `$ref`s. Ordering stays app-side (presentation policy).
 *
 * @example
 * const fields = fieldsOf(requestSchemas.createVessel, schemaDefs)
 * // → [{ name: 'name', type: 'string', required: true }, ...]
 */
export function fieldsOf(schema: ValueSchema | undefined, defs: SchemaDefs): SchemaField[] {
  if (schema === undefined || typeof schema === 'boolean') return []

  // Resolve top-level $ref
  let resolved: ValueSchemaObject = schema
  if (schema.$ref) {
    resolved = resolveRef(schema.$ref, defs) ?? schema
  }

  // Merge allOf if present
  let properties: Record<string, ValueSchema> = resolved.properties ?? {}
  let required: string[] = resolved.required ?? []
  if (resolved.allOf) {
    const merged = mergeAllOf(resolved.allOf, defs)
    // Inline sibling properties win over allOf branches: the local definition
    // is the narrower refinement (whole-property replacement, no deep merge)
    properties = { ...merged.properties, ...properties }
    required = [...required, ...merged.required]
  }

  const requiredSet = new Set(required)
  const fields: SchemaField[] = []

  for (const [name, propSchema] of Object.entries(properties)) {
    // Boolean property schemas carry no field constraints
    if (typeof propSchema === 'boolean') {
      const field: SchemaField = { name }
      if (requiredSet.has(name)) field.required = true
      fields.push(field)
      continue
    }

    // Resolve per-property $ref
    let prop: ValueSchemaObject = propSchema
    if (propSchema.$ref) {
      prop = resolveRef(propSchema.$ref, defs) ?? propSchema
    }

    const rawType = prop.type
    const type = Array.isArray(rawType) ? rawType.find((t) => t !== 'null') : rawType
    const nullable = Array.isArray(rawType) ? rawType.includes('null') : undefined

    const field: SchemaField = { name }
    if (type !== undefined) field.type = type
    if (prop.format !== undefined) field.format = prop.format
    if (requiredSet.has(name)) field.required = true
    if (prop.enum !== undefined) {
      field.enum = prop.enum.filter((v): v is string => typeof v === 'string')
    }
    if (prop.minLength !== undefined) field.minLength = prop.minLength
    if (prop.maxLength !== undefined) field.maxLength = prop.maxLength
    if (prop.minimum !== undefined) field.minimum = prop.minimum
    if (prop.maximum !== undefined) field.maximum = prop.maximum
    if (prop.readOnly !== undefined) field.readOnly = prop.readOnly
    if (nullable) field.nullable = true

    fields.push(field)
  }

  return fields
}
