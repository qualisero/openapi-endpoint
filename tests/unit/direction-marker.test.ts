// @vitest-environment node
/**
 * Tests for x-direction-finalized root marker detection (plan §3).
 *
 * When the spec carries `x-direction-finalized: true`, the CLI must log an advisory
 * notice that presence policy is spec-side (RequireAll is a no-op) and that
 * --use-strict-response is redundant. No behaviour change is applied.
 *
 * When the marker is absent, no notice is logged.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { spawnSync } from 'child_process'
import { buildSync } from 'esbuild'

// Shared esbuild define — matches what cli-integration.test.ts uses.
const ESBUILD_DEFINE = {
  'import.meta.url': JSON.stringify('file:///tmp/openapi-codegen-bundle.js'),
}

const FINALIZED_SPEC = path.join(process.cwd(), 'tests/fixtures/finalized-openapi.json')
const TOY_SPEC = path.join(process.cwd(), 'tests/fixtures/toy-openapi.json')
const OUT_DIR = path.join(os.tmpdir(), 'openapi-marker-test-output')

describe('x-direction-finalized marker detection', { timeout: 60_000 }, () => {
  const CLI = path.join(os.tmpdir(), 'openapi-cli-marker-test-bundle.js')

  beforeAll(() => {
    buildSync({
      entryPoints: [path.join(process.cwd(), 'src/cli.ts')],
      bundle: true,
      platform: 'node',
      outfile: CLI,
      define: ESBUILD_DEFINE,
    })
  })

  beforeEach(() => {
    if (fs.existsSync(OUT_DIR)) {
      fs.rmSync(OUT_DIR, { recursive: true, force: true })
    }
    fs.mkdirSync(OUT_DIR, { recursive: true })
  })

  afterEach(() => {
    if (fs.existsSync(OUT_DIR)) {
      fs.rmSync(OUT_DIR, { recursive: true, force: true })
    }
  })

  it('logs the direction-finalized notice when x-direction-finalized: true is present in the spec', () => {
    const result = spawnSync('node', [CLI, FINALIZED_SPEC, OUT_DIR], {
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test' },
    })

    const stdout = result.stdout ?? ''
    const stderr = result.stderr ?? ''
    const output = stdout + stderr

    expect(result.status).toBe(0)
    // Must log that the marker was detected
    expect(output).toContain('x-direction-finalized')
    // Must log that presence policy is spec-side
    expect(output).toContain('presence policy is spec-side')
    // Must log that RequireAll is a no-op
    expect(output).toContain('no-op')
    // Must log that --use-strict-response is redundant (default mode: no flag)
    expect(output).toContain('--use-strict-response is redundant')
  })

  it('does not log the direction-finalized notice when the marker is absent', () => {
    const result = spawnSync('node', [CLI, TOY_SPEC, OUT_DIR], {
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test' },
    })

    const stdout = result.stdout ?? ''
    const stderr = result.stderr ?? ''
    const output = stdout + stderr

    expect(result.status).toBe(0)
    // Must NOT log the marker notice
    expect(output).not.toContain('x-direction-finalized')
    expect(output).not.toContain('presence policy is spec-side')
  })

  it('logs the notice but omits the --use-strict-response advisory when that flag is already active', () => {
    const result = spawnSync('node', [CLI, FINALIZED_SPEC, OUT_DIR, '--use-strict-response'], {
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test' },
    })

    const stdout = result.stdout ?? ''
    const stderr = result.stderr ?? ''
    const output = stdout + stderr

    expect(result.status).toBe(0)
    // Marker is present — must log the detection notice
    expect(output).toContain('x-direction-finalized')
    expect(output).toContain('presence policy is spec-side')
    // --use-strict-response advisory must be suppressed (the flag is already set)
    expect(output).not.toContain('--use-strict-response is redundant')
  })
})
