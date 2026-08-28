import { describe, it, expect } from 'vitest'
import Ajv from 'ajv'
import { resolveSchema, fieldsOf } from '@/value-schemas'
import type { SchemaDefs, ValueSchema } from '@/value-schemas'

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const defs: SchemaDefs = {
  Tag: {
    type: 'string',
    enum: ['alpha', 'beta', 'gamma'],
  },
  Address: {
    type: 'object',
    required: ['street'],
    properties: {
      street: { type: 'string', maxLength: 200 },
      city: { type: 'string' },
    },
  },
  Base: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string' },
    },
  },
}

// ---------------------------------------------------------------------------
// resolveSchema
// ---------------------------------------------------------------------------

describe('resolveSchema', () => {
  it('merges $defs and entry into a self-contained schema document', () => {
    const entry: ValueSchema = { $ref: '#/$defs/Address' }
    const result = resolveSchema(entry, defs)
    expect(result).toEqual({ $defs: defs, $ref: '#/$defs/Address' })
  })

  it('entry own properties take precedence over nothing (no $defs clash)', () => {
    const entry: ValueSchema = { type: 'object', properties: { x: { type: 'string' } } }
    const result = resolveSchema(entry, defs)
    expect(result.$defs).toBe(defs)
    expect(result.type).toBe('object')
  })

  it('returns an object with $defs as the shared defs map', () => {
    const entry: ValueSchema = { $ref: '#/$defs/Tag' }
    const result = resolveSchema(entry, defs)
    expect(result.$defs).toBe(defs)
  })

  it('merges entry-local $defs with the shared defs map (both refs resolve under AJV)', () => {
    const entry: ValueSchema = {
      type: 'object',
      required: ['kind', 'addr'],
      properties: {
        kind: { $ref: '#/$defs/Kind' },
        addr: { $ref: '#/$defs/Address' },
      },
      $defs: {
        Kind: { type: 'string', enum: ['a', 'b'] },
      },
    }
    const result = resolveSchema(entry, defs)
    expect(result.$defs).toEqual({ ...defs, Kind: { type: 'string', enum: ['a', 'b'] } })

    const validate = new Ajv().compile(result)
    expect(validate({ kind: 'a', addr: { street: '1 Main St' } })).toBe(true)
    expect(validate({ kind: 'z', addr: { street: '1 Main St' } })).toBe(false)
    expect(validate({ kind: 'a', addr: {} })).toBe(false)
  })

  it('entry-local $defs shadow shared defs of the same name', () => {
    const entry: ValueSchema = { $ref: '#/$defs/Tag', $defs: { Tag: { type: 'number' } } }
    const result = resolveSchema(entry, defs)
    expect(result.$defs?.['Tag']).toEqual({ type: 'number' })
  })

  it('throws a clear error when the entry is undefined (missing operation)', () => {
    expect(() => resolveSchema(undefined, defs)).toThrow(/no schema entry for this operation/)
  })

  it('returns boolean schemas as-is (already self-contained)', () => {
    expect(resolveSchema(true, defs)).toBe(true)
    expect(resolveSchema(false, defs)).toBe(false)
  })

  // ── AJV 8 strict-mode round-trip ─────────────────────────────────────────

  describe('AJV 8 strict-mode round-trip', () => {
    it('compiles resolveSchema output under new Ajv() default strict mode', () => {
      const entry: ValueSchema = { $ref: '#/$defs/Address' }
      const schema = resolveSchema(entry, {
        Address: {
          type: 'object',
          required: ['street'],
          properties: {
            street: { type: 'string', maxLength: 200 },
            city: { type: 'string' },
          },
          additionalProperties: false,
        },
      })
      const ajv = new Ajv()
      // Should not throw
      const validate = ajv.compile(schema)
      expect(typeof validate).toBe('function')
    })

    it('validates a conforming object', () => {
      const schema = resolveSchema(
        { $ref: '#/$defs/Address' },
        {
          Address: {
            type: 'object',
            required: ['street'],
            properties: {
              street: { type: 'string', maxLength: 200 },
              city: { type: 'string' },
            },
            additionalProperties: false,
          },
        },
      )
      const validate = new Ajv().compile(schema)
      expect(validate({ street: '1 Main St', city: 'Anytown' })).toBe(true)
    })

    it('rejects a violating object (missing required field)', () => {
      const schema = resolveSchema(
        { $ref: '#/$defs/Address' },
        {
          Address: {
            type: 'object',
            required: ['street'],
            properties: {
              street: { type: 'string', maxLength: 200 },
            },
            additionalProperties: false,
          },
        },
      )
      const validate = new Ajv().compile(schema)
      expect(validate({ city: 'Anytown' })).toBe(false)
    })

    it('rejects maxLength violation', () => {
      const schema = resolveSchema(
        { $ref: '#/$defs/Address' },
        {
          Address: {
            type: 'object',
            required: ['street'],
            properties: {
              street: { type: 'string', maxLength: 5 },
            },
            additionalProperties: false,
          },
        },
      )
      const validate = new Ajv().compile(schema)
      expect(validate({ street: 'this is too long' })).toBe(false)
    })

    it('compiles inline entry (no $ref) under strict mode', () => {
      const schema = resolveSchema(
        {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
            score: { type: 'number' },
          },
          additionalProperties: false,
        },
        {},
      )
      const validate = new Ajv().compile(schema)
      expect(validate({ name: 'Alice', score: 42 })).toBe(true)
      expect(validate({ score: 42 })).toBe(false)
    })
  })
})

// ---------------------------------------------------------------------------
// fieldsOf
// ---------------------------------------------------------------------------

describe('fieldsOf boolean schema handling', () => {
  it('returns [] for a boolean schema', () => {
    expect(fieldsOf(true, defs)).toEqual([])
    expect(fieldsOf(false, defs)).toEqual([])
  })

  it('emits a bare field (name/required only) for boolean property schemas', () => {
    const schema: ValueSchema = {
      type: 'object',
      properties: { anything: true, nothing: false },
      required: ['anything'],
    }
    expect(fieldsOf(schema, defs)).toEqual([{ name: 'anything', required: true }, { name: 'nothing' }])
  })
})

describe('fieldsOf', () => {
  // ── undefined entry ────────────────────────────────────────────────────────

  it('returns [] for undefined schema', () => {
    expect(fieldsOf(undefined, defs)).toEqual([])
  })

  // ── schema with no properties ──────────────────────────────────────────────

  it('returns [] for schema without properties', () => {
    expect(fieldsOf({ type: 'string' }, defs)).toEqual([])
  })

  // ── unknown / unresolvable $ref ────────────────────────────────────────────

  it('returns [] when top-level $ref points to unknown name in defs', () => {
    expect(fieldsOf({ $ref: '#/$defs/NonExistent' }, defs)).toEqual([])
  })

  it('returns [] when top-level $ref is not a #/$defs/ pointer', () => {
    expect(fieldsOf({ $ref: '#/components/schemas/Widget' }, {})).toEqual([])
  })

  // ── required ───────────────────────────────────────────────────────────────

  it('marks fields in parent required array as required: true', () => {
    const schema: ValueSchema = {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
    }
    const fields = fieldsOf(schema, {})
    const name = fields.find((f) => f.name === 'name')
    const age = fields.find((f) => f.name === 'age')
    expect(name?.required).toBe(true)
    expect(age?.required).toBeUndefined()
  })

  // ── maxLength ──────────────────────────────────────────────────────────────

  it('includes maxLength from property schema', () => {
    const schema: ValueSchema = {
      type: 'object',
      properties: {
        username: { type: 'string', maxLength: 50 },
      },
    }
    const fields = fieldsOf(schema, {})
    expect(fields[0].maxLength).toBe(50)
  })

  it('includes minLength from property schema', () => {
    const schema: ValueSchema = {
      type: 'object',
      properties: {
        username: { type: 'string', minLength: 3 },
      },
    }
    const fields = fieldsOf(schema, {})
    expect(fields[0].minLength).toBe(3)
  })

  // ── enum ───────────────────────────────────────────────────────────────────

  it('maps string enum values from property schema', () => {
    const schema: ValueSchema = {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['active', 'inactive', 'draft'] },
      },
    }
    const fields = fieldsOf(schema, {})
    expect(fields[0].enum).toEqual(['active', 'inactive', 'draft'])
  })

  it('filters out non-string enum values (e.g. null from nullable)', () => {
    const schema: ValueSchema = {
      type: 'object',
      properties: {
        status: { type: ['string', 'null'], enum: ['active', 'inactive', null] },
      },
    }
    const fields = fieldsOf(schema, {})
    expect(fields[0].enum).toEqual(['active', 'inactive'])
  })

  // ── allOf merge ────────────────────────────────────────────────────────────

  it('merges properties from allOf schemas one level deep', () => {
    const schema: ValueSchema = {
      allOf: [
        {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        {
          type: 'object',
          required: ['name'],
          properties: { name: { type: 'string', maxLength: 100 } },
        },
      ],
    }
    const fields = fieldsOf(schema, {})
    const names = fields.map((f) => f.name)
    expect(names).toContain('id')
    expect(names).toContain('name')
  })

  it('collects required fields from allOf schemas', () => {
    const schema: ValueSchema = {
      allOf: [
        { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        { type: 'object', required: ['name'], properties: { name: { type: 'string' } } },
      ],
    }
    const fields = fieldsOf(schema, {})
    expect(fields.find((f) => f.name === 'id')?.required).toBe(true)
    expect(fields.find((f) => f.name === 'name')?.required).toBe(true)
  })

  it('inline sibling properties win over colliding allOf branch properties', () => {
    const localDefs: SchemaDefs = {
      CodeBase: {
        type: 'object',
        required: ['code'],
        properties: { code: { type: 'string', maxLength: 10 } },
      },
    }
    const schema: ValueSchema = {
      type: 'object',
      properties: {
        code: { type: 'string', maxLength: 3, enum: ['AAA', 'BBB'] },
      },
      allOf: [{ $ref: '#/$defs/CodeBase' }],
    }
    const fields = fieldsOf(schema, localDefs)
    const code = fields.find((f) => f.name === 'code')
    expect(code?.maxLength).toBe(3)
    expect(code?.enum).toEqual(['AAA', 'BBB'])
    expect(code?.required).toBe(true)
  })

  it('resolves $ref inside allOf when merging', () => {
    const localDefs: SchemaDefs = {
      Base: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    }
    const schema: ValueSchema = {
      allOf: [{ $ref: '#/$defs/Base' }, { type: 'object', properties: { label: { type: 'string' } } }],
    }
    const fields = fieldsOf(schema, localDefs)
    const names = fields.map((f) => f.name)
    expect(names).toContain('id')
    expect(names).toContain('label')
    expect(fields.find((f) => f.name === 'id')?.required).toBe(true)
  })

  // ── per-property $ref ──────────────────────────────────────────────────────

  it('resolves per-property $ref to extract type and enum', () => {
    const localDefs: SchemaDefs = {
      Tag: { type: 'string', enum: ['alpha', 'beta', 'gamma'] },
    }
    const schema: ValueSchema = {
      type: 'object',
      properties: {
        tag: { $ref: '#/$defs/Tag' },
      },
    }
    const fields = fieldsOf(schema, localDefs)
    const tag = fields.find((f) => f.name === 'tag')
    expect(tag?.type).toBe('string')
    expect(tag?.enum).toEqual(['alpha', 'beta', 'gamma'])
  })

  it('returns field with name but no type when per-property $ref is unresolvable', () => {
    const schema: ValueSchema = {
      type: 'object',
      properties: {
        thing: { $ref: '#/$defs/Missing' },
      },
    }
    const fields = fieldsOf(schema, {})
    // Falls back to the $ref schema itself — no type, no enum
    expect(fields).toHaveLength(1)
    expect(fields[0].name).toBe('thing')
    expect(fields[0].type).toBeUndefined()
  })

  // ── nullable union ─────────────────────────────────────────────────────────

  it('sets nullable: true and picks first non-null type from type array', () => {
    const schema: ValueSchema = {
      type: 'object',
      properties: {
        note: { type: ['string', 'null'] },
      },
    }
    const fields = fieldsOf(schema, {})
    const note = fields.find((f) => f.name === 'note')
    expect(note?.type).toBe('string')
    expect(note?.nullable).toBe(true)
  })

  it('does not set nullable when type is a plain string', () => {
    const schema: ValueSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
    }
    const fields = fieldsOf(schema, {})
    expect(fields[0].nullable).toBeUndefined()
  })

  it('handles type array with null first (null, string) — picks first non-null', () => {
    const schema: ValueSchema = {
      type: 'object',
      properties: {
        value: { type: ['null', 'integer'] },
      },
    }
    const fields = fieldsOf(schema, {})
    const value = fields[0]
    expect(value.type).toBe('integer')
    expect(value.nullable).toBe(true)
  })

  // ── null-union anyOf/oneOf fold ───────────────────────────────────────────

  it('folds null-union anyOf with $ref payload into type + nullable + ref constraints', () => {
    const localDefs: SchemaDefs = {
      Country: { type: 'string', minLength: 2, maxLength: 2, format: 'iso-3166' },
    }
    const schema: ValueSchema = {
      type: 'object',
      properties: {
        country: { anyOf: [{ $ref: '#/$defs/Country' }, { type: 'null' }] },
      },
    }
    const fields = fieldsOf(schema, localDefs)
    expect(fields).toEqual([
      { name: 'country', type: 'string', format: 'iso-3166', minLength: 2, maxLength: 2, nullable: true },
    ])
  })

  it('folds 3.1-style null-union regardless of branch order', () => {
    const localDefs: SchemaDefs = { Tag: { type: 'string', enum: ['alpha', 'beta'] } }
    const reversed: ValueSchema = {
      type: 'object',
      properties: {
        tag: { anyOf: [{ type: 'null' }, { $ref: '#/$defs/Tag' }] },
      },
    }
    const fields = fieldsOf(reversed, localDefs)
    expect(fields[0].type).toBe('string')
    expect(fields[0].nullable).toBe(true)
    expect(fields[0].enum).toEqual(['alpha', 'beta'])
  })

  it('folds marshmallow-style null-union with {type: [object, null]} branch', () => {
    const localDefs: SchemaDefs = {
      CountryNested: { type: 'object', properties: { code: { type: 'string' } } },
    }
    const schema: ValueSchema = {
      type: 'object',
      properties: {
        country: { anyOf: [{ $ref: '#/$defs/CountryNested' }, { type: ['object', 'null'] }] },
      },
    }
    const fields = fieldsOf(schema, localDefs)
    expect(fields[0].type).toBe('object')
    expect(fields[0].nullable).toBe(true)
  })

  it('folds oneOf null-unions identically to anyOf', () => {
    const localDefs: SchemaDefs = { Tag: { type: 'string' } }
    const schema: ValueSchema = {
      type: 'object',
      properties: {
        tag: { oneOf: [{ $ref: '#/$defs/Tag' }, { type: 'null' }] },
      },
    }
    const fields = fieldsOf(schema, localDefs)
    expect(fields[0].type).toBe('string')
    expect(fields[0].nullable).toBe(true)
  })

  it('surfaces branch-carried readOnly when folding a null-union', () => {
    const localDefs: SchemaDefs = { Flag: { type: 'string' } }
    const schema: ValueSchema = {
      type: 'object',
      properties: {
        flag: { anyOf: [{ $ref: '#/$defs/Flag', readOnly: true }, { type: 'null' }] },
      },
    }
    const fields = fieldsOf(schema, localDefs)
    expect(fields[0].readOnly).toBe(true)
    expect(fields[0].nullable).toBe(true)
  })

  it('surfaces parent-level readOnly on a null-union (converter-hoisted shape)', () => {
    const localDefs: SchemaDefs = { Flag: { type: 'string' } }
    const schema: ValueSchema = {
      type: 'object',
      properties: {
        flag: { readOnly: true, anyOf: [{ $ref: '#/$defs/Flag' }, { type: 'null' }] },
      },
    }
    const fields = fieldsOf(schema, localDefs)
    expect(fields[0].readOnly).toBe(true)
    expect(fields[0].nullable).toBe(true)
  })

  it('leaves a 3-branch sum type un-flattened (no type, no nullable)', () => {
    const schema: ValueSchema = {
      type: 'object',
      properties: {
        value: { anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'null' }] },
      },
    }
    const fields = fieldsOf(schema, {})
    expect(fields).toEqual([{ name: 'value' }])
  })

  it('leaves a payload-only anyOf (no null-ish branch) un-flattened', () => {
    const schema: ValueSchema = {
      type: 'object',
      properties: {
        value: { anyOf: [{ type: 'string' }, { type: 'number' }] },
      },
    }
    const fields = fieldsOf(schema, {})
    expect(fields).toEqual([{ name: 'value' }])
  })

  it('sets nullable: true when enum contains null', () => {
    const schema: ValueSchema = {
      type: 'object',
      properties: {
        status: { enum: ['active', 'inactive', null] },
      },
    }
    const fields = fieldsOf(schema, {})
    expect(fields[0].enum).toEqual(['active', 'inactive'])
    expect(fields[0].nullable).toBe(true)
  })

  // ── readOnly ───────────────────────────────────────────────────────────────

  it('includes readOnly: true when property has readOnly: true', () => {
    const schema: ValueSchema = {
      type: 'object',
      properties: {
        createdAt: { type: 'string', format: 'date-time', readOnly: true },
        name: { type: 'string' },
      },
    }
    const fields = fieldsOf(schema, {})
    const createdAt = fields.find((f) => f.name === 'createdAt')
    const name = fields.find((f) => f.name === 'name')
    expect(createdAt?.readOnly).toBe(true)
    expect(name?.readOnly).toBeUndefined()
  })

  it('includes format from property schema', () => {
    const schema: ValueSchema = {
      type: 'object',
      properties: {
        createdAt: { type: 'string', format: 'date-time' },
      },
    }
    const fields = fieldsOf(schema, {})
    expect(fields[0].format).toBe('date-time')
  })

  // ── resolves top-level $ref ────────────────────────────────────────────────

  it('resolves a top-level $ref into defs to get properties', () => {
    const fields = fieldsOf({ $ref: '#/$defs/Address' }, defs)
    const names = fields.map((f) => f.name)
    expect(names).toContain('street')
    expect(names).toContain('city')
  })

  it('marks fields as required when top-level $ref schema has required list', () => {
    const fields = fieldsOf({ $ref: '#/$defs/Address' }, defs)
    expect(fields.find((f) => f.name === 'street')?.required).toBe(true)
    expect(fields.find((f) => f.name === 'city')?.required).toBeUndefined()
  })

  // ── minimum / maximum ──────────────────────────────────────────────────────

  it('includes minimum and maximum from property schema', () => {
    const schema: ValueSchema = {
      type: 'object',
      properties: {
        score: { type: 'number', minimum: 0, maximum: 100 },
      },
    }
    const fields = fieldsOf(schema, {})
    expect(fields[0].minimum).toBe(0)
    expect(fields[0].maximum).toBe(100)
  })
})
