// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { spawnSync } from 'child_process'
import { buildSync } from 'esbuild'

describe('CLI Integration Tests', () => {
  const testOutputDir = '/tmp/openapi-test-output'
  const toySpecPath = path.join(process.cwd(), 'tests/fixtures/toy-openapi.json')

  beforeEach(() => {
    // Clean up any existing test output
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true })
    }
  })

  afterEach(() => {
    // Clean up test output
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true })
    }
  })

  describe('File generation from toy OpenAPI spec', () => {
    it('should validate toy OpenAPI spec structure', () => {
      expect(fs.existsSync(toySpecPath)).toBe(true)

      const specContent = fs.readFileSync(toySpecPath, 'utf8')
      const spec = JSON.parse(specContent)

      expect(spec).toHaveProperty('openapi')
      expect(spec).toHaveProperty('info')
      expect(spec).toHaveProperty('paths')
      expect(spec.openapi).toBe('3.0.3')
      expect(spec.info.title).toBe('Pet Store API')
    })

    it('should have correct operations in toy spec', () => {
      const specContent = fs.readFileSync(toySpecPath, 'utf8')
      const spec = JSON.parse(specContent)

      const operations = []

      // Extract all operation IDs
      for (const [_pathUrl, pathItem] of Object.entries(spec.paths)) {
        for (const [_method, operation] of Object.entries(pathItem as any)) {
          if (operation && typeof operation === 'object' && 'operationId' in operation) {
            operations.push(operation.operationId)
          }
        }
      }

      expect(operations.sort()).toEqual([
        'createPet',
        'deletePet',
        'getPet',
        'listPets',
        'listUserPets',
        'searchPets',
        'updatePet',
        'uploadPetPic',
      ])
    })

    it('should validate operation methods and paths', () => {
      const specContent = fs.readFileSync(toySpecPath, 'utf8')
      const spec = JSON.parse(specContent)

      // Validate specific operations
      expect(spec.paths['/pets']).toHaveProperty('get')
      expect(spec.paths['/pets']).toHaveProperty('post')
      expect(spec.paths['/pets'].get.operationId).toBe('listPets')
      expect(spec.paths['/pets'].post.operationId).toBe('createPet')

      expect(spec.paths['/pets/{petId}']).toHaveProperty('get')
      expect(spec.paths['/pets/{petId}']).toHaveProperty('put')
      expect(spec.paths['/pets/{petId}']).toHaveProperty('delete')
      expect(spec.paths['/pets/{petId}'].get.operationId).toBe('getPet')
      expect(spec.paths['/pets/{petId}'].put.operationId).toBe('updatePet')
      expect(spec.paths['/pets/{petId}'].delete.operationId).toBe('deletePet')

      expect(spec.paths['/users/{userId}/pets']).toHaveProperty('get')
      expect(spec.paths['/users/{userId}/pets'].get.operationId).toBe('listUserPets')
    })

    it('should validate parameter definitions', () => {
      const specContent = fs.readFileSync(toySpecPath, 'utf8')
      const spec = JSON.parse(specContent)

      // Check petId parameter in GET /pets/{petId}
      const getPetOp = spec.paths['/pets/{petId}'].get
      expect(getPetOp.parameters).toHaveLength(1)
      expect(getPetOp.parameters[0].name).toBe('petId')
      expect(getPetOp.parameters[0].in).toBe('path')
      expect(getPetOp.parameters[0].required).toBe(true)

      // Check userId parameter in GET /users/{userId}/pets
      const listUserPetsOp = spec.paths['/users/{userId}/pets'].get
      expect(listUserPetsOp.parameters).toHaveLength(1)
      expect(listUserPetsOp.parameters[0].name).toBe('userId')
      expect(listUserPetsOp.parameters[0].in).toBe('path')
      expect(listUserPetsOp.parameters[0].required).toBe(true)
    })

    it('should validate response schemas', () => {
      const specContent = fs.readFileSync(toySpecPath, 'utf8')
      const spec = JSON.parse(specContent)

      // Check that all operations have 200 responses
      const operationPaths = [
        ['paths', '/pets', 'get'],
        ['paths', '/pets', 'post'],
        ['paths', '/pets/{petId}', 'get'],
        ['paths', '/pets/{petId}', 'put'],
        ['paths', '/pets/{petId}', 'delete'],
        ['paths', '/users/{userId}/pets', 'get'],
      ]

      operationPaths.forEach((pathArray) => {
        let obj = spec
        for (const key of pathArray) {
          obj = obj[key]
        }
        expect(obj.responses).toHaveProperty('200')
        expect(obj.responses['200']).toHaveProperty('content')
        expect(obj.responses['200'].content).toHaveProperty('application/json')
      })
    })

    it('should validate component schemas', () => {
      const specContent = fs.readFileSync(toySpecPath, 'utf8')
      const spec = JSON.parse(specContent)

      expect(spec).toHaveProperty('components')
      expect(spec.components).toHaveProperty('schemas')
      expect(spec.components.schemas).toHaveProperty('Pet')
      expect(spec.components.schemas).toHaveProperty('NewPet')

      // Validate Pet schema
      const petSchema = spec.components.schemas.Pet
      expect(petSchema.type).toBe('object')
      expect(petSchema.required).toEqual(['name'])
      expect(petSchema.properties).toHaveProperty('id')
      expect(petSchema.properties).toHaveProperty('name')
      expect(petSchema.properties).toHaveProperty('tag')
      expect(petSchema.properties).toHaveProperty('status')

      // Validate NewPet schema
      const newPetSchema = spec.components.schemas.NewPet
      expect(newPetSchema.type).toBe('object')
      expect(newPetSchema.required).toEqual(['name'])
      expect(newPetSchema.properties).toHaveProperty('name')
      expect(newPetSchema.properties).toHaveProperty('tag')
      expect(newPetSchema.properties).toHaveProperty('status')
    })
  })

  describe('Generated code validation', () => {
    it('should have consistent operation naming patterns', () => {
      const specContent = fs.readFileSync(toySpecPath, 'utf8')
      const spec = JSON.parse(specContent)

      const operations: { id: string; method: string; path: string }[] = []

      for (const [pathUrl, pathItem] of Object.entries(spec.paths)) {
        for (const [method, operation] of Object.entries(pathItem as any)) {
          if (operation && typeof operation === 'object' && 'operationId' in operation) {
            operations.push({
              id: operation.operationId as string,
              method: method.toUpperCase(),
              path: pathUrl,
            })
          }
        }
      }

      // Validate naming patterns
      const listOperations = operations.filter((op) => op.id.startsWith('list'))
      const getOperations = operations.filter((op) => op.id.startsWith('get'))
      const createOperations = operations.filter((op) => op.id.startsWith('create'))
      const updateOperations = operations.filter((op) => op.id.startsWith('update'))
      const deleteOperations = operations.filter((op) => op.id.startsWith('delete'))

      expect(listOperations.every((op) => op.method === 'GET')).toBe(true)
      expect(getOperations.every((op) => op.method === 'GET')).toBe(true)
      expect(createOperations.every((op) => op.method === 'POST')).toBe(true)
      expect(updateOperations.every((op) => op.method === 'PUT')).toBe(true)
      expect(deleteOperations.every((op) => op.method === 'DELETE')).toBe(true)
    })

    it('should support various REST patterns', () => {
      const specContent = fs.readFileSync(toySpecPath, 'utf8')
      const spec = JSON.parse(specContent)

      // Collection endpoint
      expect(spec.paths).toHaveProperty('/pets')
      expect(spec.paths['/pets']).toHaveProperty('get') // list
      expect(spec.paths['/pets']).toHaveProperty('post') // create

      // Resource endpoint
      expect(spec.paths).toHaveProperty('/pets/{petId}')
      expect(spec.paths['/pets/{petId}']).toHaveProperty('get') // get by id
      expect(spec.paths['/pets/{petId}']).toHaveProperty('put') // update
      expect(spec.paths['/pets/{petId}']).toHaveProperty('delete') // delete

      // Nested resource endpoint
      expect(spec.paths).toHaveProperty('/users/{userId}/pets')
      expect(spec.paths['/users/{userId}/pets']).toHaveProperty('get') // nested list
    })
  })

  describe('Mock usage patterns', () => {
    it('should demonstrate typical API usage patterns', () => {
      // This test demonstrates how the generated types would be used
      // with the actual library (conceptually)

      const mockOperations = {
        listPets: { method: 'GET', path: '/pets' },
        getPet: { method: 'GET', path: '/pets/{petId}' },
        createPet: { method: 'POST', path: '/pets' },
        updatePet: { method: 'PUT', path: '/pets/{petId}' },
        deletePet: { method: 'DELETE', path: '/pets/{petId}' },
        listUserPets: { method: 'GET', path: '/users/{userId}/pets' },
      }

      // Verify that our mock operations match the toy spec
      expect(Object.keys(mockOperations).sort()).toEqual([
        'createPet',
        'deletePet',
        'getPet',
        'listPets',
        'listUserPets',
        'updatePet',
      ])
    })

    it('should validate expected TypeScript generation patterns', () => {
      // Mock what the generated api-operations.ts content should look like
      const expectedOperationIds = ['createPet', 'deletePet', 'getPet', 'listPets', 'listUserPets', 'updatePet']

      const expectedOperationInfo = {
        listPets: { path: '/pets', method: 'GET' },
        createPet: { path: '/pets', method: 'POST' },
        getPet: { path: '/pets/{petId}', method: 'GET' },
        updatePet: { path: '/pets/{petId}', method: 'PUT' },
        deletePet: { path: '/pets/{petId}', method: 'DELETE' },
        listUserPets: { path: '/users/{userId}/pets', method: 'GET' },
      }

      // These should match what our codegen would produce
      expect(expectedOperationIds.length).toBe(6)
      expect(Object.keys(expectedOperationInfo).length).toBe(6)

      // Verify each operation has correct structure
      Object.entries(expectedOperationInfo).forEach(([_opId, info]) => {
        expect(info).toHaveProperty('path')
        expect(info).toHaveProperty('method')
        expect(typeof info.path).toBe('string')
        expect(['GET', 'POST', 'PUT', 'DELETE'].includes(info.method)).toBe(true)
      })
    })
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Real CLI invocation tests (spawn node <bundled cli>)
// The bundle is built once in beforeAll using esbuild so these tests do not
// depend on a pre-existing dist/ directory (which is gitignored and absent in CI).
// ────────────────────────────────────────────────────────────────────────────

describe('CLI --enum-case flag (real subprocess)', { timeout: 30_000 }, () => {
  const CLI = path.join(os.tmpdir(), 'openapi-cli-test-bundle.js')
  const TOY_SPEC = path.join(process.cwd(), 'tests/fixtures/toy-openapi.json')
  const COLLISION_SPEC = path.join(process.cwd(), 'tests/fixtures/collision-openapi.json')
  const COLLISION_PASCAL_SPEC = path.join(process.cwd(), 'tests/fixtures/collision-pascal-openapi.json')
  const outDir = '/tmp/openapi-enum-case-test'

  beforeAll(() => {
    buildSync({
      entryPoints: [path.join(process.cwd(), 'src/cli.ts')],
      bundle: true,
      platform: 'node',
      outfile: CLI,
    })
  })

  beforeEach(() => {
    if (fs.existsSync(outDir)) {
      fs.rmSync(outDir, { recursive: true, force: true })
    }
  })

  afterEach(() => {
    if (fs.existsSync(outDir)) {
      fs.rmSync(outDir, { recursive: true, force: true })
    }
  })

  it('--enum-case const generates ALL_CAPS keys with unchanged values in api-enums.ts', () => {
    const result = spawnSync('node', [CLI, TOY_SPEC, outDir, '--enum-case', 'const'], {
      encoding: 'utf8',
      timeout: 30_000,
    })

    expect(result.status).toBe(0)

    const enumsContent = fs.readFileSync(path.join(outDir, 'api-enums.ts'), 'utf8')

    // Keys must be ALL_CAPS
    expect(enumsContent).toContain("ADOPTED: 'adopted' as const")
    expect(enumsContent).toContain("AVAILABLE: 'available' as const")
    expect(enumsContent).toContain("PENDING: 'pending' as const")

    // No pascal-case member keys (object property assignment lines)
    expect(enumsContent).not.toMatch(/^\s+Adopted:/m)
    expect(enumsContent).not.toMatch(/^\s+Available:/m)
    expect(enumsContent).not.toMatch(/^\s+Pending:/m)
  })

  it('--enum-case const generates ALL_CAPS keys in api-operations.ts enum consts', () => {
    const result = spawnSync('node', [CLI, TOY_SPEC, outDir, '--enum-case', 'const'], {
      encoding: 'utf8',
      timeout: 30_000,
    })

    expect(result.status).toBe(0)

    const opsContent = fs.readFileSync(path.join(outDir, 'api-operations.ts'), 'utf8')

    // Per-operation enum consts use CAPS keys
    expect(opsContent).toContain('AVAILABLE:')
    expect(opsContent).toContain('PENDING:')
    expect(opsContent).toContain('ADOPTED:')

    // Values are unchanged
    expect(opsContent).toContain('"available"')
    expect(opsContent).toContain('"pending"')
    expect(opsContent).toContain('"adopted"')
  })

  it('collision spec exits non-zero under --enum-case const and writes no generated files', () => {
    const result = spawnSync('node', [CLI, COLLISION_SPEC, outDir, '--enum-case', 'const'], {
      encoding: 'utf8',
      timeout: 30_000,
    })

    // Must fail
    expect(result.status).not.toBe(0)

    // Error output must name the collision
    const combined = (result.stderr ?? '') + (result.stdout ?? '')
    expect(combined).toMatch(/Enum label collision/)
    expect(combined).toMatch(/IN_PROGRESS/)

    // Output directory may be created but must contain no generated files
    const generatedFiles = ['api-enums.ts', 'api-operations.ts', 'api-types.ts', 'api-schemas.ts', 'api-client.ts']
    for (const file of generatedFiles) {
      expect(fs.existsSync(path.join(outDir, file))).toBe(false)
    }
  })

  it('explicit --enum-case pascal produces same pascal keys as omitting the flag', () => {
    const result = spawnSync('node', [CLI, TOY_SPEC, outDir, '--enum-case', 'pascal'], {
      encoding: 'utf8',
      timeout: 30_000,
    })

    expect(result.status).toBe(0)

    const enumsContent = fs.readFileSync(path.join(outDir, 'api-enums.ts'), 'utf8')

    // Pascal keys present
    expect(enumsContent).toContain("Adopted: 'adopted' as const")
    expect(enumsContent).toContain("Available: 'available' as const")
    expect(enumsContent).toContain("Pending: 'pending' as const")

    // No screaming-snake keys for these values
    expect(enumsContent).not.toMatch(/^\s+ADOPTED:/m)
    expect(enumsContent).not.toMatch(/^\s+AVAILABLE:/m)
    expect(enumsContent).not.toMatch(/^\s+PENDING:/m)
  })

  it('pascal collision spec exits non-zero without the flag and writes no generated files', () => {
    // "available" and "Available" both map to the pascal label "Available" → collision in default mode
    const result = spawnSync('node', [CLI, COLLISION_PASCAL_SPEC, outDir], {
      encoding: 'utf8',
      timeout: 30_000,
    })

    // Must fail
    expect(result.status).not.toBe(0)

    // Error output must name the collision and the colliding label
    const combined = (result.stderr ?? '') + (result.stdout ?? '')
    expect(combined).toMatch(/Enum label collision/)
    expect(combined).toMatch(/Available/)

    // Output directory may be created but must contain no generated files
    const generatedFiles = ['api-enums.ts', 'api-operations.ts', 'api-types.ts', 'api-schemas.ts', 'api-client.ts']
    for (const file of generatedFiles) {
      expect(fs.existsSync(path.join(outDir, file))).toBe(false)
    }
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Error-policy and typed-error generator tests (real CLI subprocess)
// These tests verify the §3 generator changes that are unrelated to --enum-case.
// ────────────────────────────────────────────────────────────────────────────

describe('CLI error-policy and typed-error output (real subprocess)', { timeout: 30_000 }, () => {
  const CLI = path.join(os.tmpdir(), 'openapi-cli-test-bundle.js')
  const TOY_SPEC = path.join(process.cwd(), 'tests/fixtures/toy-openapi.json')
  const outDir = '/tmp/openapi-error-policy-out'

  beforeAll(() => {
    buildSync({
      entryPoints: [path.join(process.cwd(), 'src/cli.ts')],
      bundle: true,
      platform: 'node',
      outfile: CLI,
    })
  })

  beforeEach(() => {
    if (fs.existsSync(outDir)) {
      fs.rmSync(outDir, { recursive: true, force: true })
    }
  })

  afterEach(() => {
    if (fs.existsSync(outDir)) {
      fs.rmSync(outDir, { recursive: true, force: true })
    }
  })

  it('generated api-operations.ts includes ApiErrorData and ApiError type helpers', () => {
    const result = spawnSync('node', [CLI, TOY_SPEC, outDir], {
      encoding: 'utf8',
      timeout: 30_000,
    })

    expect(result.status).toBe(0)

    const opsContent = fs.readFileSync(path.join(outDir, 'api-operations.ts'), 'utf8')

    // Import aliases
    expect(opsContent).toContain('ApiErrorData as _ApiErrorData')
    expect(opsContent).toContain('ApiErrorOf as _ApiErrorOf')

    // Type helpers
    expect(opsContent).toContain('export type ApiErrorData<K extends AllOps> = _ApiErrorData<operations, K>')
    expect(opsContent).toContain('export type ApiError<K extends AllOps> = _ApiErrorOf<operations, K>')
  })

  it('generated api-client.ts helpers include ApiErrorData import and ErrorData threading', () => {
    const result = spawnSync('node', [CLI, TOY_SPEC, outDir], {
      encoding: 'utf8',
      timeout: 30_000,
    })

    expect(result.status).toBe(0)

    const clientContent = fs.readFileSync(path.join(outDir, 'api-client.ts'), 'utf8')

    // ApiErrorData imported from api-operations
    expect(clientContent).toContain('ApiErrorData')

    // ErrorData type alias in each helper
    // There are 4 helpers so ErrorData must appear multiple times
    const errorDataCount = (clientContent.match(/type ErrorData = ApiErrorData<Op>/g) ?? []).length
    expect(errorDataCount).toBe(4)

    // Verify threading into return types (both query and mutation flavours)
    expect(clientContent).toContain('QueryReturn<Response, Record<string, never>, ErrorData>')
    expect(clientContent).toContain(
      'MutationReturn<Response, Record<string, never>, RequestBody, QueryParams, ErrorData>',
    )
  })

  it('reserved-name Error schema is emitted as ErrorSchema in api-schemas.ts', () => {
    const ERROR_SPEC = path.join(process.cwd(), 'tests/fixtures/error-schema-openapi.json')
    const result = spawnSync('node', [CLI, ERROR_SPEC, outDir], {
      encoding: 'utf8',
      timeout: 30_000,
    })

    expect(result.status).toBe(0)

    const schemasContent = fs.readFileSync(path.join(outDir, 'api-schemas.ts'), 'utf8')

    // Must emit ErrorSchema alias, not plain Error (which would shadow the global)
    expect(schemasContent).toContain("export type ErrorSchema = components['schemas']['Error']")
    expect(schemasContent).not.toContain('export type Error = ')

    // The comment pointing to the original schema name must be present
    expect(schemasContent).toContain('// Schema: Error')

    // Non-reserved names should be unaffected
    expect(schemasContent).toContain("export type Item = components['schemas']['Item']")
    expect(schemasContent).toContain("export type NewItem = components['schemas']['NewItem']")
  })

  it('aborts with exit 1 and an explicit error when two schemas collide on the same exported alias', () => {
    const SCHEMA_COLLISION_SPEC = path.join(process.cwd(), 'tests/fixtures/schema-alias-collision-openapi.json')
    const result = spawnSync('node', [CLI, SCHEMA_COLLISION_SPEC, outDir], {
      encoding: 'utf8',
      timeout: 30_000,
    })

    // Must exit non-zero
    expect(result.status).toBe(1)

    // Error message must name both colliding schema names and the resulting alias
    expect(result.stderr).toContain('Schema alias collision')
    expect(result.stderr).toContain('"Error"')
    expect(result.stderr).toContain('"ErrorSchema"')

    // No generated files must be written (fail-fast, zero output).
    // Assert the output dir is empty (or absent) rather than enumerating
    // files, so anything the CLI might write before failing — including
    // openapi-types.ts — is caught.
    const leftovers = fs.existsSync(outDir) ? fs.readdirSync(outDir) : []
    expect(leftovers).toEqual([])
  })

  it('generated api-client.ts cfg literals include operationId for every operation', () => {
    const result = spawnSync('node', [CLI, TOY_SPEC, outDir], {
      encoding: 'utf8',
      timeout: 30_000,
    })

    expect(result.status).toBe(0)

    const clientContent = fs.readFileSync(path.join(outDir, 'api-client.ts'), 'utf8')

    // Every operation in toy-openapi.json must appear as operationId: '<id>' in a cfg literal.
    const expectedOps = [
      'listPets',
      'createPet',
      'getPet',
      'updatePet',
      'deletePet',
      'listUserPets',
      'searchPets',
      'uploadPetPic',
    ]
    for (const opId of expectedOps) {
      expect(clientContent).toContain(`operationId: '${opId}'`)
    }

    // Sanity-check that the cfg field appears on the same line as path and method.
    // Example: { path: '/pets', method: HttpMethod.GET, listPath: null, operationId: 'listPets' }
    expect(clientContent).toMatch(/path: '\/pets', method: HttpMethod\.GET, listPath: null, operationId: 'listPets'/)
    expect(clientContent).toMatch(
      /path: '\/pets', method: HttpMethod\.POST, listPath: '\/pets', operationId: 'createPet'/,
    )
  })

  it('generated output type-checks cleanly under tsc --strict (no TS errors in generated files)', () => {
    // Generate from the toy spec.
    const genResult = spawnSync('node', [CLI, TOY_SPEC, outDir], {
      encoding: 'utf8',
      timeout: 30_000,
    })
    expect(genResult.status).toBe(0)

    // Pin the enum self-alias fix independently of the type-check below:
    // api-enums.ts must never emit `export const X = X` redeclarations.
    const enumsContent = fs.readFileSync(path.join(outDir, 'api-enums.ts'), 'utf8')
    expect(enumsContent).not.toMatch(/export const (\w+) = \1$/m)

    // Write a temporary tsconfig in the project root so baseUrl-relative paths
    // and node_modules are accessible. External packages need explicit paths because
    // tsc walks up from the source file location (/tmp/...) to find node_modules,
    // not from the tsconfig directory (project root).
    const projRoot = process.cwd()
    const tmpConfig = path.join(projRoot, `tsconfig-gencheck-${Date.now()}.json`)
    const tsconfig = {
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'bundler',
        strict: true,
        noEmit: true,
        // skipLibCheck mirrors the project's own tsconfig so external lib
        // declaration errors don't mask real generated-file errors.
        skipLibCheck: true,
        baseUrl: '.',
        paths: {
          // Resolve the package to the TypeScript sources so the check works
          // on a clean checkout (CI runs tests without a prior build) and
          // validates against current src/, not a possibly stale dist/.
          '@qualisero/openapi-endpoint': ['src/index'],
          // External deps: listed explicitly because TypeScript resolves
          // node_modules by walking up from the source file directory
          // (/tmp/...), not from the tsconfig directory (project root).
          axios: ['node_modules/axios/index'],
          vue: ['node_modules/vue/dist/vue'],
          '@tanstack/vue-query': ['node_modules/@tanstack/vue-query/build/legacy/index'],
        },
      },
      include: [`${outDir}/**/*.ts`],
    }
    fs.writeFileSync(tmpConfig, JSON.stringify(tsconfig, null, 2))

    let tscResult
    try {
      tscResult = spawnSync('npx', ['tsc', '--project', tmpConfig], {
        cwd: projRoot,
        encoding: 'utf8',
        timeout: 60_000,
      })
    } finally {
      fs.unlinkSync(tmpConfig)
    }

    const output = (tscResult.stdout ?? '') + (tscResult.stderr ?? '')
    if (tscResult.status !== 0) {
      // Surface errors in the failure message for easier debugging.
      throw new Error(`tsc type-check of generated files failed:\n${output}`)
    }
    expect(tscResult.status).toBe(0)
  })

  it('generated files (after prettier) are byte-equal to tests/fixtures/ so hand-patched drift is detected', () => {
    // Generate from toy-openapi.json with default flags — same invocation that produced the fixtures.
    const genResult = spawnSync('node', [CLI, TOY_SPEC, outDir], {
      encoding: 'utf8',
      timeout: 30_000,
    })
    expect(genResult.status).toBe(0)

    // Format with the repo's own prettier config so the comparison is apples-to-apples.
    // Fixtures are covered by `prettier --check .` and are always in project-formatted form;
    // raw CLI output must be formatted the same way before diffing.
    const projRoot = process.cwd()
    const prettierResult = spawnSync(
      'npx',
      ['prettier', '--config', path.join(projRoot, 'package.json'), '--write', `${outDir}/`],
      { cwd: projRoot, encoding: 'utf8', timeout: 30_000 },
    )
    expect(prettierResult.status).toBe(0)

    // All six generated files must be byte-equal to the checked-in fixtures.
    // None of these files are intentionally divergent: they are all produced from
    // toy-openapi.json with default flags. If any file differs, the fixture was
    // hand-patched and must be resynchronised (re-run CLI, run prettier, copy).
    const fixturesDir = path.join(projRoot, 'tests/fixtures')
    const generatedFiles = [
      'api-client.ts',
      'api-enums.ts',
      'api-operations.ts',
      'api-schemas.ts',
      'api-types.ts',
      'openapi-types.ts',
    ]
    for (const file of generatedFiles) {
      const generated = fs.readFileSync(path.join(outDir, file), 'utf8')
      const fixture = fs.readFileSync(path.join(fixturesDir, file), 'utf8')
      expect(generated, `fixture ${file} diverges from CLI output — re-run CLI and copy`).toBe(fixture)
    }
  })
})
