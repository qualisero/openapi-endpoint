// @vitest-environment node
/**
 * Tests for plan 1b (Responses namespace, reachability filter, @deprecated bare aliases)
 * and plan 1c (Source JSDoc traceability on Types.<opId> members).
 *
 * Uses the direction-openapi.json fixture which contains:
 *   - PetDetail  — response-only component (appears in responses only)
 *   - PetCreateArgs — request-only component (appears in request bodies only)
 *   - Category   — dual-use component (appears in both request and response)
 *   - Species    — enum (direction-neutral)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { spawnSync } from 'child_process'
import { buildSync } from 'esbuild'

const ESBUILD_DEFINE = {
  'import.meta.url': JSON.stringify('file:///tmp/openapi-codegen-bundle.js'),
}

const CLI = path.join(os.tmpdir(), 'openapi-cli-direction-test-bundle.js')
const DIRECTION_SPEC = path.join(process.cwd(), 'tests/fixtures/direction-openapi.json')
const outDir = '/tmp/openapi-direction-test-output'

beforeAll(() => {
  buildSync({
    entryPoints: [path.join(process.cwd(), 'src/cli.ts')],
    bundle: true,
    platform: 'node',
    outfile: CLI,
    define: ESBUILD_DEFINE,
  })

  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true })
  }

  const result = spawnSync('node', [CLI, DIRECTION_SPEC, outDir], {
    encoding: 'utf8',
    timeout: 60_000,
  })

  if (result.status !== 0) {
    throw new Error(`CLI failed:\n${(result.stdout ?? '') + (result.stderr ?? '')}`)
  }
})

afterAll(() => {
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// api-schemas.ts: Responses namespace reachability
// ─────────────────────────────────────────────────────────────────────────────

describe('api-schemas.ts — Responses namespace (plan 1b)', { timeout: 60_000 }, () => {
  let schemasContent: string

  beforeAll(() => {
    schemasContent = fs.readFileSync(path.join(outDir, 'api-schemas.ts'), 'utf8')
  })

  it('emits a Responses namespace', () => {
    expect(schemasContent).toContain('export namespace Responses {')
  })

  it('includes response-reachable PetDetail in Responses', () => {
    expect(schemasContent).toContain("export type PetDetail = RequireAll<components['schemas']['PetDetail']>")
  })

  it('includes dual-use Category in Responses', () => {
    expect(schemasContent).toContain("export type Category = RequireAll<components['schemas']['Category']>")
  })

  it('does NOT include request-only PetCreateArgs in Responses', () => {
    // PetCreateArgs appears only in request bodies → must not be in Responses namespace
    const responsesBlock = schemasContent.match(/export namespace Responses \{[\s\S]*?\}/)
    expect(responsesBlock).not.toBeNull()
    expect(responsesBlock![0]).not.toContain('PetCreateArgs')
  })

  it('does NOT include Species enum in Responses (enums are direction-free, exported in api-enums.ts)', () => {
    const responsesBlock = schemasContent.match(/export namespace Responses \{[\s\S]*?\}/)
    expect(responsesBlock).not.toBeNull()
    expect(responsesBlock![0]).not.toContain('Species')
  })

  it('imports RequireAll from the package', () => {
    expect(schemasContent).toContain("import type { RequireAll } from '@qualisero/openapi-endpoint'")
  })

  it('wraps each Responses member in RequireAll', () => {
    expect(schemasContent).toMatch(/RequireAll<components\['schemas'\]\['\w+'\]>/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// api-schemas.ts: Referenced-by JSDoc on Responses members
// ─────────────────────────────────────────────────────────────────────────────

describe('api-schemas.ts — Referenced-by JSDoc (plan 1b)', { timeout: 60_000 }, () => {
  let schemasContent: string

  beforeAll(() => {
    schemasContent = fs.readFileSync(path.join(outDir, 'api-schemas.ts'), 'utf8')
  })

  it('emits Referenced-by comment for PetDetail listing createPet (response)', () => {
    expect(schemasContent).toContain('Referenced by:')
    expect(schemasContent).toContain('createPet (response)')
  })

  it('emits Referenced-by comment for PetDetail listing listPets (items)', () => {
    expect(schemasContent).toContain('listPets (items)')
  })

  it('emits Referenced-by comment for Category listing getCategory (response)', () => {
    expect(schemasContent).toContain('getCategory (response)')
  })

  it('emits Referenced-by comment for Category listing updateCategory (response)', () => {
    expect(schemasContent).toContain('updateCategory (response)')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// api-schemas.ts: @deprecated bare aliases
// ─────────────────────────────────────────────────────────────────────────────

describe('api-schemas.ts — @deprecated bare aliases (plan 1b)', { timeout: 60_000 }, () => {
  let schemasContent: string

  beforeAll(() => {
    schemasContent = fs.readFileSync(path.join(outDir, 'api-schemas.ts'), 'utf8')
  })

  it('emits @deprecated on the bare PetDetail alias pointing to Responses.PetDetail', () => {
    expect(schemasContent).toContain('@deprecated Use Responses.PetDetail instead.')
    expect(schemasContent).toContain("export type PetDetail = components['schemas']['PetDetail']")
  })

  it('emits @deprecated on the bare Category alias pointing to Responses.Category', () => {
    expect(schemasContent).toContain('@deprecated Use Responses.Category instead.')
    expect(schemasContent).toContain("export type Category = components['schemas']['Category']")
  })

  it('emits @deprecated on the bare PetCreateArgs alias pointing to a Types.<opId>.Request', () => {
    expect(schemasContent).toContain('@deprecated Use Types.createPet.Request instead.')
    expect(schemasContent).toContain("export type PetCreateArgs = components['schemas']['PetCreateArgs']")
  })

  it('does not emit a bare alias for the Species enum (enums stay in api-enums.ts)', () => {
    // Species is an enum — it should NOT appear as a bare alias in api-schemas.ts
    expect(schemasContent).not.toContain("export type Species = components['schemas']['Species']")
  })

  it('has no Requests namespace', () => {
    expect(schemasContent).not.toContain('export namespace Requests')
  })

  it('rewrites the file docstring to describe direction-typed surface', () => {
    expect(schemasContent).toContain('Direction-typed schema aliases')
    expect(schemasContent).toContain('Responses namespace')
    expect(schemasContent).toContain('Request direction')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// api-types.ts: Source JSDoc on Types.<opId> members (plan 1c)
// ─────────────────────────────────────────────────────────────────────────────

describe('api-types.ts — Source JSDoc traceability (plan 1c)', { timeout: 60_000 }, () => {
  let typesContent: string

  beforeAll(() => {
    typesContent = fs.readFileSync(path.join(outDir, 'api-types.ts'), 'utf8')
  })

  it('emits Source JSDoc on Response for createPet pointing to PetDetail', () => {
    expect(typesContent).toContain("Source: components['schemas']['PetDetail'] (POST /pets)")
  })

  it('emits Source JSDoc on Request for createPet pointing to PetCreateArgs', () => {
    expect(typesContent).toContain("Source: components['schemas']['PetCreateArgs'] (POST /pets)")
  })

  it('emits Source JSDoc on Response for getCategory pointing to Category', () => {
    expect(typesContent).toContain("Source: components['schemas']['Category'] (GET /categories/{categoryId})")
  })

  it('emits Source JSDoc on Request for updateCategory pointing to Category', () => {
    // updateCategory uses Category as both request and response → source on both
    expect(typesContent).toContain("Source: components['schemas']['Category'] (PUT /categories/{categoryId})")
  })

  it('emits Source JSDoc on Response for listPets does NOT appear (array items, not direct $ref)', () => {
    // listPets response is an array schema, not a direct $ref → no Source on listPets.Response
    const listPetsBlock = typesContent.match(/export namespace listPets \{[\s\S]*?\}/)
    expect(listPetsBlock).not.toBeNull()
    // The listPets response is an array with items.$ref, not a direct $ref
    // → no Source line should appear in the listPets namespace for Response
    const responseComment = listPetsBlock![0].match(/Response type - ALL fields required[^\n]*/)
    expect(responseComment).not.toBeNull()
    expect(responseComment![0]).not.toContain('Source:')
  })

  it('emits Source JSDoc on StrictResponse (same schema as Response)', () => {
    // StrictResponse inherits the same source as Response
    // For createPet, StrictResponse should also have a Source comment for PetDetail
    const createPetBlock = typesContent.match(/export namespace createPet \{[\s\S]*?\}/)
    expect(createPetBlock).not.toBeNull()
    // The strict mode comment should contain the Source reference
    expect(createPetBlock![0]).toContain("(strict mode). Source: components['schemas']['PetDetail']")
  })
})
