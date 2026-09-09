/**
 * Regression tests for the empty-object sentinel in group unions.
 *
 * openapi-typescript renders `{ "properties": {} }` (empty-properties schema)
 * as `Record<string, never>`.  When such a schema appears inside an anyOf/oneOf
 * group union the generated TypeScript union gains a useless sentinel member
 * (`GroupA | Record<string, never> | null`).  The codegen pipeline strips it
 * via `stripRecordStringNeverFromUnions`.
 *
 * These tests verify:
 * 1. openapi-typescript DOES emit the sentinel (confirms the problem still
 *    exists in the pinned version and the strip step is needed).
 * 2. After the transform, union types contain no `Record<string, never>` member.
 * 3. Standalone `Record<string, never>` assignments (webhooks, $defs — standard
 *    openapi-typescript boilerplate for absent spec sections) are preserved.
 * 4. Unions whose only other member is `null`/`undefined` are preserved:
 *    stripping there would change the type to bare null/undefined.
 */

// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { stripRecordStringNeverFromUnions } from '../../src/codegen-transforms.js'

// ---------------------------------------------------------------------------
// 1. Verify the transform function behaviour in isolation
// ---------------------------------------------------------------------------

describe('stripRecordStringNeverFromUnions', () => {
  it('removes trailing | Record<string, never> from a union', () => {
    const input = `"application/json": components["schemas"]["GroupA"] | Record<string, never>;`
    const output = stripRecordStringNeverFromUnions(input)
    expect(output).toBe(`"application/json": components["schemas"]["GroupA"];`)
    expect(output).not.toContain('Record<string, never>')
  })

  it('removes middle | Record<string, never> from a three-member union', () => {
    const input = `"application/json": components["schemas"]["GroupA"] | Record<string, never> | null;`
    const output = stripRecordStringNeverFromUnions(input)
    expect(output).toBe(`"application/json": components["schemas"]["GroupA"] | null;`)
    expect(output).not.toContain('Record<string, never>')
  })

  it('removes leading Record<string, never> | from a union', () => {
    const input = `type Foo = Record<string, never> | components["schemas"]["GroupA"] | null;`
    const output = stripRecordStringNeverFromUnions(input)
    expect(output).toBe(`type Foo = components["schemas"]["GroupA"] | null;`)
    expect(output).not.toContain('Record<string, never>')
  })

  it('preserves the sentinel when the only other union member is null (index-signature value type)', () => {
    // additionalProperties: { anyOf: [emptyObject, null] } renders as an index
    // signature whose value type is `Record<string, never> | null`. Stripping the
    // sentinel would silently change the value type to `null`.
    const input = `data: {\n  [key: string]: Record<string, never> | null;\n};`
    expect(stripRecordStringNeverFromUnions(input)).toBe(input)
  })

  it('preserves the sentinel when it trails a null-only union', () => {
    const input = `type Foo = null | Record<string, never>;`
    expect(stripRecordStringNeverFromUnions(input)).toBe(input)
  })

  it('preserves the sentinel when the only other union member is undefined', () => {
    const input = `type Foo = Record<string, never> | undefined;`
    expect(stripRecordStringNeverFromUnions(input)).toBe(input)
  })

  it('preserves standalone Record<string, never> assignment (webhooks/defs boilerplate)', () => {
    const input = `export type webhooks = Record<string, never>;\nexport type $defs = Record<string, never>;`
    const output = stripRecordStringNeverFromUnions(input)
    // No | adjacent → unchanged
    expect(output).toBe(input)
  })

  it('removes all sentinel occurrences from a realistic openapi-types.ts excerpt', () => {
    // Simulates what openapi-typescript emits for the group-union-openapi.json fixture
    const input = `\
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        Assessment: {
            readonly id?: string;
            title?: string;
            score?: number | null;
        };
        AssessmentGroupA: {
            color?: string;
            notes?: string | null;
        };
        AssessmentGroupB: {
            rating?: number;
        };
    };
}
export type $defs = Record<string, never>;
export interface operations {
    updateAssessment: {
        requestBody?: {
            content: {
                "application/json": components["schemas"]["AssessmentGroupA"] | components["schemas"]["AssessmentGroupB"] | Record<string, never> | null;
            };
        };
    };
}
`
    const output = stripRecordStringNeverFromUnions(input)

    // Sentinel stripped from union
    expect(output).not.toMatch(/AssessmentGroupA.*\|\s*Record<string,\s*never>/)
    expect(output).not.toMatch(/AssessmentGroupB.*\|\s*Record<string,\s*never>/)

    // The union still contains the real members and null
    expect(output).toContain('components["schemas"]["AssessmentGroupA"]')
    expect(output).toContain('components["schemas"]["AssessmentGroupB"]')
    expect(output).toContain('| null')

    // Standalone boilerplate preserved
    expect(output).toContain('export type webhooks = Record<string, never>')
    expect(output).toContain('export type $defs = Record<string, never>')
  })

  it('handles whitespace variants in the sentinel pattern', () => {
    // openapi-typescript may emit varying whitespace
    const input = `type T = GroupA | Record<string,never> | null;`
    const output = stripRecordStringNeverFromUnions(input)
    expect(output).toBe(`type T = GroupA | null;`)
  })
})

// ---------------------------------------------------------------------------
// 2. Integration: verify openapi-typescript still emits the sentinel
//    (confirms the strip step remains necessary at the pinned version)
// ---------------------------------------------------------------------------

describe('openapi-typescript sentinel emission audit', () => {
  it('emits Record<string, never> for empty-properties schema in anyOf union', async () => {
    // Dynamic import to avoid ESM/CJS issues at module-load time
    const openapiTS = (await import('openapi-typescript')).default
    const { astToString } = await import('openapi-typescript')

    const spec = {
      openapi: '3.0.3',
      info: { title: 'Audit', version: '1.0.0' },
      paths: {
        '/items/{id}': {
          patch: {
            operationId: 'updateItem',
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    anyOf: [
                      { $ref: '#/components/schemas/GroupA' },
                      // Empty-properties object — the sentinel
                      { type: 'object', properties: {} },
                      { type: 'null' },
                    ],
                  },
                },
              },
            },
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Item' },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          Item: {
            type: 'object',
            properties: {
              id: { type: 'string', readOnly: true },
              name: { type: 'string' },
            },
          },
          GroupA: {
            type: 'object',
            properties: {
              color: { type: 'string' },
            },
          },
        },
      },
    }

    const ast = await openapiTS(spec as unknown as Parameters<typeof openapiTS>[0])
    const raw = astToString(ast)

    // Confirm the sentinel IS present in the raw output (audit finding: still present in 7.x)
    expect(raw).toContain('Record<string, never>')
    // Specifically inside a union (not just standalone)
    expect(raw).toMatch(/\|\s*Record<string,\s*never>/)

    // After the transform, it should be gone from union positions
    const cleaned = stripRecordStringNeverFromUnions(raw)
    expect(cleaned).not.toMatch(/\|\s*Record<string,\s*never>/)
    expect(cleaned).not.toMatch(/Record<string,\s*never>\s*\|/)

    // Standalone boilerplate (webhooks, $defs) must survive
    expect(cleaned).toContain('Record<string, never>')
    expect(cleaned).toMatch(/=\s*Record<string,\s*never>/)
  })
})
