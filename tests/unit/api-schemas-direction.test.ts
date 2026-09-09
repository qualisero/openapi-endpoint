// @vitest-environment node
/**
 * Tests for the direction-typed api-schemas.ts surface (Responses namespace,
 * reachability filter, @deprecated bare aliases) and Source JSDoc traceability
 * on Types.<opId> members.
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

describe('api-schemas.ts — Responses namespace', { timeout: 60_000 }, () => {
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

describe('api-schemas.ts — Referenced-by JSDoc', { timeout: 60_000 }, () => {
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

describe('api-schemas.ts — @deprecated bare aliases', { timeout: 60_000 }, () => {
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
// api-types.ts: Source JSDoc on Types.<opId> members
// ─────────────────────────────────────────────────────────────────────────────

describe('api-types.ts — Source JSDoc traceability', { timeout: 60_000 }, () => {
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
    // The listPets response is an array with items.$ref, not a direct $ref.
    // The matched block (up to and including the first closing brace) contains the
    // Response and StrictResponse multi-line JSDoc comments.  Neither should carry a Source:
    // annotation because no direct-$ref resolution is possible for array schemas.
    expect(listPetsBlock![0]).toContain('Response type \u2014') // confirms new block-comment format
    expect(listPetsBlock![0]).not.toContain('Source:')
  })

  it('emits Source JSDoc on StrictResponse (same schema as Response)', () => {
    // For createPet (direct $ref → PetDetail), both Response and StrictResponse carry a
    // Source: annotation at the end of the multi-line JSDoc.
    const createPetBlock = typesContent.match(/export namespace createPet \{[\s\S]*?\}/)
    expect(createPetBlock).not.toBeNull()
    expect(createPetBlock![0]).toContain("Source: components['schemas']['PetDetail'] (POST /pets)")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// api-schemas.ts: no unused RequireAll import when no schema is response-reachable
// ─────────────────────────────────────────────────────────────────────────────

describe('api-schemas.ts — no response-reachable schemas', { timeout: 60_000 }, () => {
  const emptyOutDir = '/tmp/openapi-direction-test-output-empty'
  const emptySpecPath = '/tmp/openapi-direction-request-only-spec.json'

  beforeAll(() => {
    // Spec with a single request-only schema: nothing is response-reachable,
    // so the generated Responses namespace is empty and the RequireAll import
    // must be omitted (an unused import fails consumers with noUnusedLocals).
    fs.writeFileSync(
      emptySpecPath,
      JSON.stringify({
        openapi: '3.1.0',
        info: { title: 'Request-only', version: '1.0.0' },
        paths: {
          '/items': {
            post: {
              operationId: 'createItem',
              requestBody: {
                content: { 'application/json': { schema: { $ref: '#/components/schemas/ItemCreateArgs' } } },
              },
              responses: { '204': { description: 'No content' } },
            },
          },
        },
        components: {
          schemas: {
            ItemCreateArgs: { type: 'object', properties: { name: { type: 'string' } } },
          },
        },
      }),
    )
    if (fs.existsSync(emptyOutDir)) {
      fs.rmSync(emptyOutDir, { recursive: true, force: true })
    }
    const result = spawnSync('node', [CLI, emptySpecPath, emptyOutDir], { encoding: 'utf8', timeout: 60_000 })
    if (result.status !== 0) {
      throw new Error(`CLI failed:\n${(result.stdout ?? '') + (result.stderr ?? '')}`)
    }
  })

  afterAll(() => {
    if (fs.existsSync(emptyOutDir)) {
      fs.rmSync(emptyOutDir, { recursive: true, force: true })
    }
    if (fs.existsSync(emptySpecPath)) {
      fs.rmSync(emptySpecPath, { force: true })
    }
  })

  it('omits the RequireAll import and emits no Responses members', () => {
    const content = fs.readFileSync(path.join(emptyOutDir, 'api-schemas.ts'), 'utf8')
    // The header docstring may mention RequireAll in prose; only the import matters
    // for noUnusedLocals (TS6133).
    expect(content).not.toContain('import type { RequireAll }')
    expect(content).not.toContain('= RequireAll<')
    expect(content).toContain('// No response-reachable schemas found')
    // The request-only schema keeps its @deprecated bare alias
    expect(content).toContain('@deprecated Use Types.createItem.Request instead.')
  })
})
