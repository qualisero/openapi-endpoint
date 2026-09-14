/**
 * Bugfix test: common-suffix enum promotion must not merge enums with
 * different value sets.
 *
 * Reported against generated output where three operation schemas shared the
 * property name `external_assessment_status`, producing enum names with the
 * common suffix `ExternalAssessmentStatus`:
 *
 *   - AssessmentUpdateArgs.external_assessment_status:        'needs_review'
 *   - ExpertAssessmentUpdateArgs.external_assessment_status:  'accepted' | 'refused'
 *   - HotlinerAssessmentUpdateArgs.external_assessment_status:'accepted' | 'refused'
 *
 * Suffix promotion collapsed all of them into a single promoted
 * `ExternalAssessmentStatus` enum carrying only the FIRST variant's values
 * ('needs_review'), then aliased every operation-specific name to it. Consumers
 * importing the aliases got types that could not represent valid request
 * values ('accepted' / 'refused').
 *
 * After the fix, promotion only happens when every enum sharing the suffix has
 * an identical value set; otherwise the operation-specific names are kept with
 * their truthful values.
 */

// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawnSync } from 'child_process'
import { buildSync } from 'esbuild'
import fs from 'fs'
import os from 'os'
import path from 'path'

const ESBUILD_DEFINE = {
  // See cli-integration.test.ts: prettier's CJS wrapper needs a defined import.meta.url.
  'import.meta.url': JSON.stringify('file:///tmp/openapi-codegen-bundle.js'),
}

const CLI = path.join(os.tmpdir(), 'openapi-cli-suffix-promotion-bundle.js')
const SPEC = path.join(process.cwd(), 'tests/fixtures/suffix-conflict-openapi.json')
const outDir = '/tmp/openapi-suffix-promotion-test'

/** Extracts the body of a generated `export const <name> = { ... } as const` block. */
function enumBlock(enumsContent: string, enumName: string): string | null {
  const escapedName = enumName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`export const ${escapedName} = \\{\\n([\\s\\S]*?)\\n\\} as const`).exec(enumsContent)
  return match ? match[1] : null
}

describe('Bugfix: suffix promotion must not merge different value sets', { timeout: 30_000 }, () => {
  let enumsContent: string

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
    const result = spawnSync('node', [CLI, SPEC, outDir], { encoding: 'utf8' })
    expect(result.status).toBe(0)
    enumsContent = fs.readFileSync(path.join(outDir, 'api-enums.ts'), 'utf8')
  })

  afterAll(() => {
    if (fs.existsSync(outDir)) {
      fs.rmSync(outDir, { recursive: true, force: true })
    }
  })

  it('does not promote a suffix shared by enums with different value sets', () => {
    expect(enumBlock(enumsContent, 'ExternalAssessmentStatus')).toBeNull()
    expect(enumsContent).not.toContain('export const ExternalAssessmentStatus ')
    expect(enumsContent).not.toContain('export type ExternalAssessmentStatus ')
  })

  it('keeps each conflicting enum with its truthful values', () => {
    const assessment = enumBlock(enumsContent, 'AssessmentUpdateArgsExternalAssessmentStatus')
    expect(assessment).not.toBeNull()
    expect(assessment).toContain("'needs_review'")
    expect(assessment).not.toContain("'accepted'")

    const expert = enumBlock(enumsContent, 'ExpertAssessmentUpdateArgsExternalAssessmentStatus')
    expect(expert).not.toBeNull()
    expect(expert).toContain("'accepted'")
    expect(expert).toContain("'refused'")
    expect(expert).not.toContain("'needs_review'")

    // Hotliner shares Expert's exact values, so value-level dedup makes it an alias of Expert.
    expect(enumsContent).toContain(
      'export const HotlinerAssessmentUpdateArgsExternalAssessmentStatus = ExpertAssessmentUpdateArgsExternalAssessmentStatus',
    )
  })

  it('still promotes a suffix when all value sets are identical (control group)', () => {
    const promoted = enumBlock(enumsContent, 'PaymentMethodType')
    expect(promoted).not.toBeNull()
    expect(promoted).toContain("'card'")
    expect(promoted).toContain("'transfer'")

    expect(enumsContent).toContain('export const CardCheckoutPaymentMethodType = PaymentMethodType')
    expect(enumsContent).toContain('export const InvoiceCheckoutPaymentMethodType = PaymentMethodType')
    expect(enumsContent).toContain('export const RefundCheckoutPaymentMethodType = PaymentMethodType')
  })
})
