/**
 * Codegen-time converter from OpenAPI 3.0 Schema Objects to portable standard JSON Schema.
 * Self-contained — no runtime dependencies, no external imports.
 *
 * Converts recursively through: properties, items (schema and tuple forms),
 * additionalProperties, additionalItems, not, if/then/else, contains,
 * propertyNames, patternProperties, dependentSchemas, $defs, definitions,
 * dependencies (schema-valued), allOf, anyOf, oneOf, prefixItems.
 *
 * OpenAPI 3.1 schemas (type arrays, numeric exclusiveMinimum/Maximum) pass through untouched.
 */

// Keys stripped from OpenAPI 3.0 schemas that have no JSON Schema equivalent
const STRIP_KEYS = new Set(['xml', 'discriminator', 'externalDocs', 'example'])

// Keys that contain a single nested schema value (toJsonSchema handles objects, arrays, and primitives)
const SINGLE_SCHEMA_KEYS = new Set([
  'items',
  'additionalProperties',
  'additionalItems',
  'not',
  'if',
  'then',
  'else',
  'contains',
  'propertyNames',
])

// Keys whose value is an object of named schemas
const OBJECT_OF_SCHEMAS_KEYS = new Set(['patternProperties', 'dependentSchemas', '$defs', 'definitions'])

// Keys that contain arrays of schemas
const ARRAY_SCHEMA_KEYS = new Set(['allOf', 'anyOf', 'oneOf', 'prefixItems'])

// Annotation keywords (JSON Schema 2020-12 §annotations) hoisted to the outer
// wrapper when the converter synthesizes an anyOf wrap for a typeless nullable
// node. They describe the field, not one union branch — form tools (JSONForms,
// RJSF, vjsf) read readOnly/description at the schema top level.
const HOIST_KEYS = new Set(['title', 'description', 'default', 'deprecated', 'readOnly', 'writeOnly', 'examples'])

// Keywords that constrain values independent of `type`. A typeless nullable
// node needs an anyOf null-union wrap only when one of these is present;
// everything else (properties, minLength, items, …) is type-scoped and
// vacuously accepts null, making the wrap a no-op. `enum` and a pre-existing
// `anyOf` are handled by dedicated branches before this set is consulted.
const TYPELESS_CONSTRAINT_KEYS = new Set(['$ref', 'allOf', 'oneOf', 'not', 'const', 'if', 'then', 'else'])

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Apply node-level conversions to an already-recursed schema object.
 * At this point all child schemas have already been converted.
 */
function convertNode(schema: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}

  // Copy all keys, applying strip and $ref rewrite
  for (const [key, val] of Object.entries(schema)) {
    if (STRIP_KEYS.has(key)) continue

    if (key === '$ref' && typeof val === 'string') {
      // Only rewrite internal component refs; leave external refs (e.g. common.yaml#/...) untouched
      out['$ref'] = val.startsWith('#/components/schemas/') ? val.replace('#/components/schemas/', '#/$defs/') : val
      continue
    }

    out[key] = val
  }

  // nullable handling — OpenAPI 3.0 only (3.1 schemas won't have nullable: true)
  if (out['nullable'] === true) {
    delete out['nullable']

    const type = out['type']

    if (typeof type === 'string') {
      // 3.0 style: convert type T → [T, "null"]
      out['type'] = [type, 'null']

      if (Array.isArray(out['enum'])) {
        const enumArr = out['enum'] as unknown[]
        if (!enumArr.includes(null)) {
          out['enum'] = [...enumArr, null]
        }
      }
    } else if (type === undefined) {
      // No type field — express nullability without producing an unsatisfiable sibling anyOf.
      if (Array.isArray(out['enum'])) {
        // enum-only typeless node: append null to the enum
        const enumArr = out['enum'] as unknown[]
        if (!enumArr.includes(null)) {
          out['enum'] = [...enumArr, null]
        }
      } else if (Array.isArray(out['anyOf'])) {
        // Pre-existing anyOf: append {type:"null"} if not already present
        const existing = out['anyOf'] as unknown[]
        if (!existing.some((s: unknown) => isObject(s) && (s as Record<string, unknown>)['type'] === 'null')) {
          out['anyOf'] = [...existing, { type: 'null' }]
        }
      } else if (Object.keys(out).some((k) => TYPELESS_CONSTRAINT_KEYS.has(k))) {
        // Bare typeless node with a type-independent constraint ($ref, allOf, …):
        // wrapping in anyOf avoids unsatisfiable AND semantics.
        // Hoist annotation keywords to the outer wrapper — they describe the
        // field, not one union branch.
        const inner: Record<string, unknown> = {}
        const hoisted: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(out)) {
          if (HOIST_KEYS.has(k)) {
            hoisted[k] = v
          } else {
            inner[k] = v
          }
        }
        for (const k of Object.keys(out)) delete out[k]
        Object.assign(out, hoisted)
        out['anyOf'] = [inner, { type: 'null' }]
      }
      // Constraint-free typeless node (annotation-only, properties-only, …):
      // it already accepts null — `nullable` is a no-op, drop it without wrapping.
    }
    // If type is already an array the schema is 3.1-style; nullable shouldn't appear, but leave type alone.
  } else if ('nullable' in out && out['nullable'] === false) {
    delete out['nullable']
  }

  // Boolean exclusiveMinimum (OpenAPI 3.0) → numeric (JSON Schema draft-07+)
  // 3.1 / JSON Schema uses numeric exclusiveMinimum directly — detect by typeof
  if (typeof out['exclusiveMinimum'] === 'boolean') {
    if (out['exclusiveMinimum'] === true && typeof out['minimum'] === 'number') {
      out['exclusiveMinimum'] = out['minimum']
      delete out['minimum']
    } else {
      // false: just remove it
      delete out['exclusiveMinimum']
    }
  }

  if (typeof out['exclusiveMaximum'] === 'boolean') {
    if (out['exclusiveMaximum'] === true && typeof out['maximum'] === 'number') {
      out['exclusiveMaximum'] = out['maximum']
      delete out['maximum']
    } else {
      delete out['exclusiveMaximum']
    }
  }

  return out
}

/**
 * Convert an OpenAPI 3.0 Schema Object (or any unknown value) to a portable
 * standard JSON Schema deep copy.
 *
 * - Removes `nullable: true` and rewrites `type` as `[T, "null"]`
 * - Converts boolean `exclusiveMinimum`/`exclusiveMaximum` to numeric form
 * - Strips `xml`, `discriminator`, `externalDocs`, `example`
 * - Rewrites `$ref: "#/components/schemas/X"` → `$ref: "#/$defs/X"`
 * - OpenAPI 3.1 schemas pass through untouched
 */
export function toJsonSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) {
    return schema.map(toJsonSchema)
  }
  if (!isObject(schema)) {
    return schema
  }

  // Build an intermediate object with all child schemas already converted
  const intermediate: Record<string, unknown> = {}

  for (const [key, val] of Object.entries(schema)) {
    if (key === 'properties' && isObject(val)) {
      const converted: Record<string, unknown> = {}
      for (const [propName, propSchema] of Object.entries(val)) {
        converted[propName] = toJsonSchema(propSchema)
      }
      intermediate[key] = converted
    } else if (OBJECT_OF_SCHEMAS_KEYS.has(key) && isObject(val)) {
      // Object whose values are schemas
      const converted: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(val)) {
        converted[k] = toJsonSchema(v)
      }
      intermediate[key] = converted
    } else if (key === 'dependencies' && isObject(val)) {
      // Values are either schemas (objects) or arrays of required-field strings — only recurse objects
      const converted: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(val)) {
        converted[k] = isObject(v) ? toJsonSchema(v) : v
      }
      intermediate[key] = converted
    } else if (SINGLE_SCHEMA_KEYS.has(key)) {
      // Recurse unconditionally — toJsonSchema handles objects, arrays, and primitives
      intermediate[key] = toJsonSchema(val)
    } else if (ARRAY_SCHEMA_KEYS.has(key) && Array.isArray(val)) {
      intermediate[key] = val.map(toJsonSchema)
    } else {
      intermediate[key] = val
    }
  }

  return convertNode(intermediate)
}

// ---------------------------------------------------------------------------
// Ref collection
// ---------------------------------------------------------------------------

const REF_NAME_RE = /^#\/(?:components\/schemas|\$defs)\/(.+)$/

function extractRefName(ref: string): string | null {
  const m = REF_NAME_RE.exec(ref)
  return m ? m[1] : null
}

/**
 * Collect the transitive closure of `$defs` / `components/schemas` names
 * reachable from `schema`. Handles cycles. Returns names in discovery order.
 *
 * @param schema - Root schema to start from (may itself be a `$ref`)
 * @param defs   - The definitions map (keyed by component name) to follow refs into
 */
export function collectRefNames(schema: unknown, defs: Record<string, unknown>): string[] {
  const visited = new Set<string>()
  const result: string[] = []

  function collect(node: unknown): void {
    if (Array.isArray(node)) {
      node.forEach(collect)
      return
    }
    if (!isObject(node)) return

    // Process $ref first
    const ref = node['$ref']
    if (typeof ref === 'string') {
      const name = extractRefName(ref)
      if (name !== null && !visited.has(name)) {
        visited.add(name)
        result.push(name)
        // Recurse transitively into the referenced definition
        if (Object.prototype.hasOwnProperty.call(defs, name)) {
          collect(defs[name])
        }
      }
    }

    // Recurse into all values (covers properties, items, allOf, anyOf, etc.)
    for (const val of Object.values(node)) {
      collect(val)
    }
  }

  collect(schema)
  return result
}
