// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { spawnSync } from 'child_process'
import { buildSync } from 'esbuild'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import { resolveSchema } from '@/value-schemas'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the JSON value of a generated `export const NAME: TYPE = <value>`
 * from the generated file text, returning the raw JSON string.
 *
 * Matches from the first `= ` after the marker to the next `\n\nexport const`
 * or to end-of-file (whichever comes first).
 */
function extractConstJson(fileText: string, constName: string): string {
  // Match up to the '= ' that starts the value
  const markerRe = new RegExp(`export const ${constName}[^=]+=\\s`)
  const m = markerRe.exec(fileText)
  if (!m) throw new Error(`Could not find export const ${constName} in generated file`)
  const valueStart = m.index + m[0].length
  const nextExport = fileText.indexOf('\nexport const ', valueStart)
  const raw = nextExport === -1 ? fileText.slice(valueStart) : fileText.slice(valueStart, nextExport)
  return raw.trim()
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('--emit-value-schemas CLI flag (real subprocess)', { timeout: 30_000 }, () => {
  const CLI = path.join(os.tmpdir(), 'openapi-cli-value-schemas-bundle.js')
  const VALUE_SPEC = path.join(process.cwd(), 'tests/fixtures/value-schemas-openapi.json')
  const VALUE_31_SPEC = path.join(process.cwd(), 'tests/fixtures/value-schemas-31-openapi.json')
  const SKIP_SPEC = path.join(process.cwd(), 'tests/fixtures/value-schemas-skip-openapi.json')
  let outDir: string

  beforeAll(() => {
    buildSync({
      entryPoints: [path.join(process.cwd(), 'src/cli.ts')],
      bundle: true,
      platform: 'node',
      outfile: CLI,
    })
  })

  beforeEach(() => {
    outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openapi-value-schemas-test-'))
  })

  afterEach(() => {
    if (outDir && fs.existsSync(outDir)) {
      fs.rmSync(outDir, { recursive: true, force: true })
    }
  })

  // ─── absence without flag ──────────────────────────────────────────────────

  it('does NOT emit api-value-schemas.ts when flag is absent', () => {
    const result = spawnSync('node', [CLI, VALUE_SPEC, outDir], {
      encoding: 'utf8',
      timeout: 30_000,
    })
    expect(result.status).toBe(0)
    expect(fs.existsSync(path.join(outDir, 'api-value-schemas.ts'))).toBe(false)
  })

  // ─── presence with flag ────────────────────────────────────────────────────

  it('emits api-value-schemas.ts when --emit-value-schemas flag is present (default mode request)', () => {
    const result = spawnSync('node', [CLI, VALUE_SPEC, outDir, '--emit-value-schemas'], {
      encoding: 'utf8',
      timeout: 30_000,
    })
    expect(result.status).toBe(0)
    expect(fs.existsSync(path.join(outDir, 'api-value-schemas.ts'))).toBe(true)
  })

  it('emits api-value-schemas.ts when --emit-value-schemas request is passed', () => {
    const result = spawnSync('node', [CLI, VALUE_SPEC, outDir, '--emit-value-schemas', 'request'], {
      encoding: 'utf8',
      timeout: 30_000,
    })
    expect(result.status).toBe(0)
    expect(fs.existsSync(path.join(outDir, 'api-value-schemas.ts'))).toBe(true)
  })

  it('emits api-value-schemas.ts when --emit-value-schemas all is passed', () => {
    const result = spawnSync('node', [CLI, VALUE_SPEC, outDir, '--emit-value-schemas', 'all'], {
      encoding: 'utf8',
      timeout: 30_000,
    })
    expect(result.status).toBe(0)
    expect(fs.existsSync(path.join(outDir, 'api-value-schemas.ts'))).toBe(true)
  })

  // ─── schemaDefs pruning ────────────────────────────────────────────────────

  it('prunes Unreferenced from schemaDefs and includes transitive Tag', () => {
    const result = spawnSync('node', [CLI, VALUE_SPEC, outDir, '--emit-value-schemas'], {
      encoding: 'utf8',
      timeout: 30_000,
    })
    expect(result.status).toBe(0)

    const content = fs.readFileSync(path.join(outDir, 'api-value-schemas.ts'), 'utf8')
    const schemaDefs = JSON.parse(extractConstJson(content, 'schemaDefs'))

    // Unreferenced must be pruned
    expect(schemaDefs).not.toHaveProperty('Unreferenced')

    // Transitive ref chain: Widget -> WidgetBase -> Tag — all must be present
    expect(schemaDefs).toHaveProperty('Widget')
    expect(schemaDefs).toHaveProperty('WidgetBase')
    expect(schemaDefs).toHaveProperty('Tag')

    // request mode: no response-only schemas needed if not referenced by request
    // WidgetOutput is referenced by createWidget response (201) — but we're in request mode
    // so only requestSchemas refs are followed. createWidget has requestBody → Widget.
    // getWidget has no requestBody, so only Widget, WidgetBase, Tag appear.
    expect(schemaDefs).not.toHaveProperty('WidgetOutput')
  })

  it('includes WidgetOutput in schemaDefs when mode is all (response schema refs are followed)', () => {
    const result = spawnSync('node', [CLI, VALUE_SPEC, outDir, '--emit-value-schemas', 'all'], {
      encoding: 'utf8',
      timeout: 30_000,
    })
    expect(result.status).toBe(0)

    const content = fs.readFileSync(path.join(outDir, 'api-value-schemas.ts'), 'utf8')
    const schemaDefs = JSON.parse(extractConstJson(content, 'schemaDefs'))

    expect(schemaDefs).toHaveProperty('WidgetOutput')
    expect(schemaDefs).not.toHaveProperty('Unreferenced')
  })

  it('schemaDefs keys are sorted alphabetically', () => {
    const result = spawnSync('node', [CLI, VALUE_SPEC, outDir, '--emit-value-schemas', 'all'], {
      encoding: 'utf8',
      timeout: 30_000,
    })
    expect(result.status).toBe(0)

    const content = fs.readFileSync(path.join(outDir, 'api-value-schemas.ts'), 'utf8')
    const schemaDefs = JSON.parse(extractConstJson(content, 'schemaDefs'))

    const keys = Object.keys(schemaDefs)
    expect(keys).toEqual([...keys].sort())
  })

  // ─── nullable conversion ───────────────────────────────────────────────────

  it('converts nullable: true to type array ["string", "null"], removes nullable key', () => {
    const result = spawnSync('node', [CLI, VALUE_SPEC, outDir, '--emit-value-schemas'], {
      encoding: 'utf8',
      timeout: 30_000,
    })
    expect(result.status).toBe(0)

    const content = fs.readFileSync(path.join(outDir, 'api-value-schemas.ts'), 'utf8')
    const schemaDefs = JSON.parse(extractConstJson(content, 'schemaDefs'))

    // Widget allOf[1].properties.note was {type:"string", nullable:true}
    // After conversion it should be in one of the allOf members
    const widgetSchema = schemaDefs['Widget']
    expect(widgetSchema).toBeDefined()

    // Find the allOf member with 'note' property
    const allOfMember = widgetSchema.allOf?.find(
      (s: Record<string, unknown>) => 'note' in ((s?.properties as Record<string, unknown> | undefined) ?? {}),
    )
    expect(allOfMember).toBeDefined()
    const noteProp = allOfMember.properties.note
    expect(noteProp.type).toEqual(['string', 'null'])
    expect(noteProp).not.toHaveProperty('nullable')
  })

  // ─── stripped keys ─────────────────────────────────────────────────────────

  it('strips xml, example, and other OpenAPI-only keys from emitted schemas', () => {
    const result = spawnSync('node', [CLI, VALUE_SPEC, outDir, '--emit-value-schemas'], {
      encoding: 'utf8',
      timeout: 30_000,
    })
    expect(result.status).toBe(0)

    const content = fs.readFileSync(path.join(outDir, 'api-value-schemas.ts'), 'utf8')

    // These keys must not appear anywhere in the file (not even in schemaDefs)
    expect(content).not.toContain('"xml"')
    expect(content).not.toContain('"example"')
    expect(content).not.toContain('"discriminator"')
    // nullable must not appear anywhere (converted away)
    expect(content).not.toContain('"nullable"')
  })

  // ─── boolean exclusiveMinimum conversion ──────────────────────────────────

  it('converts boolean exclusiveMinimum to numeric form', () => {
    const result = spawnSync('node', [CLI, VALUE_SPEC, outDir, '--emit-value-schemas'], {
      encoding: 'utf8',
      timeout: 30_000,
    })
    expect(result.status).toBe(0)

    const content = fs.readFileSync(path.join(outDir, 'api-value-schemas.ts'), 'utf8')
    const schemaDefs = JSON.parse(extractConstJson(content, 'schemaDefs'))

    // Widget allOf[1].properties.score: { minimum: 0, exclusiveMinimum: true }
    // After conversion: { exclusiveMinimum: 0 } — no 'minimum' key, no boolean exMin
    const widgetSchema = schemaDefs['Widget']
    const allOfMember = widgetSchema.allOf?.find(
      (s: Record<string, unknown>) => 'score' in ((s?.properties as Record<string, unknown> | undefined) ?? {}),
    )
    expect(allOfMember).toBeDefined()
    const scoreProp = allOfMember.properties.score
    expect(scoreProp.exclusiveMinimum).toBe(0)
    expect(scoreProp).not.toHaveProperty('minimum')
    // Must not be a boolean
    expect(typeof scoreProp.exclusiveMinimum).toBe('number')
  })

  // ─── $ref rewriting ────────────────────────────────────────────────────────

  it('rewrites all $refs to #/$defs/ form (no #/components/schemas/ refs)', () => {
    const result = spawnSync('node', [CLI, VALUE_SPEC, outDir, '--emit-value-schemas'], {
      encoding: 'utf8',
      timeout: 30_000,
    })
    expect(result.status).toBe(0)

    const content = fs.readFileSync(path.join(outDir, 'api-value-schemas.ts'), 'utf8')

    expect(content).not.toContain('#/components/schemas/')
    expect(content).toContain('#/$defs/')
  })

  // ─── request vs all mode for responseSchemas ──────────────────────────────

  it('request mode: responseSchemas is an empty object', () => {
    const result = spawnSync('node', [CLI, VALUE_SPEC, outDir, '--emit-value-schemas', 'request'], {
      encoding: 'utf8',
      timeout: 30_000,
    })
    expect(result.status).toBe(0)

    const content = fs.readFileSync(path.join(outDir, 'api-value-schemas.ts'), 'utf8')
    const responseSchemas = JSON.parse(extractConstJson(content, 'responseSchemas'))

    expect(responseSchemas).toEqual({})
  })

  it('all mode: responseSchemas contains first 2xx schema for operations with responses', () => {
    const result = spawnSync('node', [CLI, VALUE_SPEC, outDir, '--emit-value-schemas', 'all'], {
      encoding: 'utf8',
      timeout: 30_000,
    })
    expect(result.status).toBe(0)

    const content = fs.readFileSync(path.join(outDir, 'api-value-schemas.ts'), 'utf8')
    const responseSchemas = JSON.parse(extractConstJson(content, 'responseSchemas'))

    // Both createWidget (201) and getWidget (200) have 2xx JSON responses
    expect(responseSchemas).toHaveProperty('createWidget')
    expect(responseSchemas).toHaveProperty('getWidget')

    // Both should reference WidgetOutput
    expect(responseSchemas.createWidget.$ref).toBe('#/$defs/WidgetOutput')
    expect(responseSchemas.getWidget.$ref).toBe('#/$defs/WidgetOutput')
  })

  it('both consts (requestSchemas and responseSchemas) are always exported regardless of mode', () => {
    for (const mode of ['request', 'all'] as const) {
      const result = spawnSync('node', [CLI, VALUE_SPEC, outDir, '--emit-value-schemas', mode], {
        encoding: 'utf8',
        timeout: 30_000,
      })
      expect(result.status).toBe(0)

      const content = fs.readFileSync(path.join(outDir, 'api-value-schemas.ts'), 'utf8')
      expect(content).toContain('export const requestSchemas')
      expect(content).toContain('export const responseSchemas')
      expect(content).toContain('export const schemaDefs')

      if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true, force: true })
    }
  })

  // ─── requestSchemas content ────────────────────────────────────────────────

  it('requestSchemas has createWidget entry (createWidget has requestBody) but not getWidget (no requestBody)', () => {
    const result = spawnSync('node', [CLI, VALUE_SPEC, outDir, '--emit-value-schemas'], {
      encoding: 'utf8',
      timeout: 30_000,
    })
    expect(result.status).toBe(0)

    const content = fs.readFileSync(path.join(outDir, 'api-value-schemas.ts'), 'utf8')
    const requestSchemas = JSON.parse(extractConstJson(content, 'requestSchemas'))

    expect(requestSchemas).toHaveProperty('createWidget')
    expect(requestSchemas).not.toHaveProperty('getWidget')

    // The entry is a $ref to Widget
    expect(requestSchemas.createWidget.$ref).toBe('#/$defs/Widget')
  })

  // ─── generated file structure ──────────────────────────────────────────────

  it('generated file has correct header comment and imports', () => {
    const result = spawnSync('node', [CLI, VALUE_SPEC, outDir, '--emit-value-schemas'], {
      encoding: 'utf8',
      timeout: 30_000,
    })
    expect(result.status).toBe(0)

    const content = fs.readFileSync(path.join(outDir, 'api-value-schemas.ts'), 'utf8')

    expect(content).toContain('// Auto-generated from OpenAPI specification - do not edit manually')
    expect(content).toContain("import type { operations } from './openapi-types'")
    expect(content).toContain("import type { ValueSchema, SchemaDefs } from '@qualisero/openapi-endpoint'")
  })

  // ─── AJV 8 round-trip ─────────────────────────────────────────────────────

  it('AJV 8 strict round-trip: compiles, validates conforming payload, rejects violating one', () => {
    const result = spawnSync('node', [CLI, VALUE_SPEC, outDir, '--emit-value-schemas', 'all'], {
      encoding: 'utf8',
      timeout: 30_000,
    })
    expect(result.status).toBe(0)

    const content = fs.readFileSync(path.join(outDir, 'api-value-schemas.ts'), 'utf8')
    const schemaDefs = JSON.parse(extractConstJson(content, 'schemaDefs'))
    const requestSchemas = JSON.parse(extractConstJson(content, 'requestSchemas'))

    // Compose the full schema document for the createWidget request using the shipped resolveSchema helper
    const entry = requestSchemas['createWidget'] as Parameters<typeof resolveSchema>[0]
    const defs = schemaDefs as Parameters<typeof resolveSchema>[1]
    const schema = resolveSchema(entry, defs)

    // AJV 8 with ajv-formats registered — format keywords are emitted by design;
    // consumers should register ajv-formats (or set validateFormats:false).
    const ajv = addFormats(new Ajv())
    let validate: ReturnType<typeof ajv.compile>

    expect(() => {
      validate = ajv.compile(schema)
    }).not.toThrow()

    // Conforming payload: required fields name and status present with valid values
    const conforming = { name: 'My Widget', status: 'active' }
    expect(validate!(conforming)).toBe(true)

    // Violating payload: missing required 'name', status not in enum
    const violating = { status: 'bad_value' }
    expect(validate!(violating)).toBe(false)
  })

  // ─── OpenAPI 3.1 inline request body with entry-local $defs ─────────────

  it('emits an entry-local $defs request body (3.1) that resolves against shared defs under AJV', () => {
    const result = spawnSync('node', [CLI, VALUE_31_SPEC, outDir, '--emit-value-schemas'], {
      encoding: 'utf8',
      timeout: 30_000,
    })
    expect(result.status).toBe(0)

    // Entry-local $defs names must not trigger the dangling-$ref warning
    expect(result.stdout + result.stderr).not.toContain('dangling $ref')

    const content = fs.readFileSync(path.join(outDir, 'api-value-schemas.ts'), 'utf8')
    const schemaDefs = JSON.parse(extractConstJson(content, 'schemaDefs'))
    const requestSchemas = JSON.parse(extractConstJson(content, 'requestSchemas'))

    // Entry-local def stays on the entry, converted (component ref rewritten to #/$defs/);
    // the shared component lands in schemaDefs
    expect(requestSchemas.createGadget.$defs.Meta).toEqual({ $ref: '#/$defs/SharedThing' })
    expect(schemaDefs).toHaveProperty('SharedThing')
    expect(schemaDefs).not.toHaveProperty('Meta')

    // resolveSchema merges both def sources instead of letting the entry-local
    // $defs clobber the shared map — AJV compiles and #/$defs/SharedThing resolves
    const schema = resolveSchema(requestSchemas.createGadget, schemaDefs)
    const validate = new Ajv().compile(schema)
    expect(validate({ kind: 'basic', shared: { id: 'x' } })).toBe(true)
    expect(validate({ kind: 'bogus' })).toBe(false)
    expect(validate({ kind: 'basic', shared: {} })).toBe(false)
  })

  // ─── $ref deref + JSON media-type widening ───────────────────────────

  it('derefs $ref-valued requestBody one level and widens JSON media types (exact application/json wins)', () => {
    const result = spawnSync('node', [CLI, SKIP_SPEC, outDir, '--emit-value-schemas', 'all'], {
      encoding: 'utf8',
      timeout: 30_000,
    })
    expect(result.status).toBe(0)

    const output = result.stdout + result.stderr
    // These operations are all extractable now — no warnings for them
    expect(output).not.toContain('createWithRefBody')
    expect(output).not.toContain('createWithCharset')
    expect(output).not.toContain('createWithBothMedia')

    const content = fs.readFileSync(path.join(outDir, 'api-value-schemas.ts'), 'utf8')
    const schemaDefs = JSON.parse(extractConstJson(content, 'schemaDefs'))
    const requestSchemas = JSON.parse(extractConstJson(content, 'requestSchemas'))
    const responseSchemas = JSON.parse(extractConstJson(content, 'responseSchemas'))

    // #/components/requestBodies/CreateBody deref'd one level to its JSON schema
    expect(requestSchemas.createWithRefBody).toEqual({ $ref: '#/$defs/Thing' })
    // 'application/json; charset=utf-8' widened (request and response)
    expect(requestSchemas.createWithCharset).toEqual({ $ref: '#/$defs/Thing' })
    expect(responseSchemas.createWithCharset).toEqual({ $ref: '#/$defs/Thing' })
    // Exact 'application/json' wins over 'application/vnd.api+json' in the same map
    expect(requestSchemas.createWithBothMedia).toEqual({ $ref: '#/$defs/Thing' })
    // Response only has the +json variant — selected in document order
    expect(responseSchemas.createWithBothMedia).toEqual({ $ref: '#/$defs/Alt' })

    expect(schemaDefs).toHaveProperty('Thing')
    expect(schemaDefs).toHaveProperty('Alt')
  })

  // ─── skipped operations warn instead of silently emitting nothing ───────

  it('warns for operations with no JSON media type at all, exits 0, ops absent from maps', () => {
    const result = spawnSync('node', [CLI, SKIP_SPEC, outDir, '--emit-value-schemas', 'all'], {
      encoding: 'utf8',
      timeout: 30_000,
    })
    expect(result.status).toBe(0)

    const output = result.stdout + result.stderr
    // text/plain-only request and response — both warn
    expect(output).toContain("operation 'createWithTextBody' has a requestBody without an extractable JSON schema")
    expect(output).toContain("operation 'createWithTextBody' has a 2xx response without an extractable JSON schema")
    // createWithRefBody's 201 has no content — nothing skipped, no response warning
    expect(output).not.toContain("operation 'createWithRefBody' has a 2xx response")

    const content = fs.readFileSync(path.join(outDir, 'api-value-schemas.ts'), 'utf8')
    expect(JSON.parse(extractConstJson(content, 'requestSchemas'))).not.toHaveProperty('createWithTextBody')
    expect(JSON.parse(extractConstJson(content, 'responseSchemas'))).not.toHaveProperty('createWithTextBody')
  })

  // ─── option parsing ────────────────────────────────────────────────

  it('rejects an invalid --emit-value-schemas mode with exit 1', () => {
    const result = spawnSync('node', [CLI, VALUE_SPEC, outDir, '--emit-value-schemas', 'al'], {
      encoding: 'utf8',
      timeout: 30_000,
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain("--emit-value-schemas must be 'request' or 'all'")
    expect(fs.existsSync(path.join(outDir, 'api-value-schemas.ts'))).toBe(false)
  })

  it('honors both flags in --use-strict-response --emit-value-schemas all (no greedy token consumption)', () => {
    const result = spawnSync(
      'node',
      [CLI, VALUE_SPEC, outDir, '--use-strict-response', '--emit-value-schemas', 'all'],
      {
        encoding: 'utf8',
        timeout: 30_000,
      },
    )
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('ApiResponseStrict')
    expect(fs.existsSync(path.join(outDir, 'api-value-schemas.ts'))).toBe(true)

    const content = fs.readFileSync(path.join(outDir, 'api-value-schemas.ts'), 'utf8')
    const responseSchemas = JSON.parse(extractConstJson(content, 'responseSchemas'))
    expect(responseSchemas).toHaveProperty('createWidget')
  })

  it('rejects unknown options (e.g. --emit-value-schema typo) with exit 1', () => {
    const result = spawnSync('node', [CLI, VALUE_SPEC, outDir, '--emit-value-schema', 'all'], {
      encoding: 'utf8',
      timeout: 30_000,
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Unknown option')
  })

  // ─── excludePrefix filtering ───────────────────────────────────────────────

  it('excludePrefix filtering carries through to value schemas (excluded ops not in requestSchemas)', () => {
    // The value-schemas fixture has no _deprecated- prefixed ops, so excluding '_deprecated'
    // (the default) leaves both ops intact. Exclude 'create' to force createWidget out.
    const result = spawnSync('node', [CLI, VALUE_SPEC, outDir, '--emit-value-schemas', '--exclude-prefix', 'create'], {
      encoding: 'utf8',
      timeout: 30_000,
    })
    expect(result.status).toBe(0)

    const content = fs.readFileSync(path.join(outDir, 'api-value-schemas.ts'), 'utf8')
    const requestSchemas = JSON.parse(extractConstJson(content, 'requestSchemas'))

    // createWidget excluded — must not appear
    expect(requestSchemas).not.toHaveProperty('createWidget')
  })
})
