import { describe, it, expect } from 'vitest'
import Ajv from 'ajv'
import { toJsonSchema, collectRefNames } from '@/json-schema-convert'

// ---------------------------------------------------------------------------
// toJsonSchema
// ---------------------------------------------------------------------------

describe('toJsonSchema', () => {
  // -------------------------------------------------------------------------
  // nullable → type union
  // -------------------------------------------------------------------------

  describe('nullable union', () => {
    it('converts nullable:true + string type to type array', () => {
      const result = toJsonSchema({ type: 'string', nullable: true })
      expect(result).toEqual({ type: ['string', 'null'] })
    })

    it('converts nullable:true + integer type to type array', () => {
      const result = toJsonSchema({ type: 'integer', nullable: true, minimum: 0 })
      expect(result).toEqual({ type: ['integer', 'null'], minimum: 0 })
    })

    it('removes nullable:false without altering type', () => {
      const result = toJsonSchema({ type: 'string', nullable: false })
      expect(result).toEqual({ type: 'string' })
    })

    it('hoists all annotation keywords out of a synthesized $ref-null wrap', () => {
      const converted = toJsonSchema({
        $ref: '#/components/schemas/Addr',
        nullable: true,
        readOnly: true,
        deprecated: true,
        examples: [{ street: 'Main St' }],
        description: 'maybe an address',
      }) as Record<string, unknown>
      expect(converted).not.toHaveProperty('nullable')
      // Annotations at parent level, branches clean
      expect(converted['readOnly']).toBe(true)
      expect(converted['deprecated']).toBe(true)
      expect(converted['examples']).toEqual([{ street: 'Main St' }])
      expect(converted['description']).toBe('maybe an address')
      expect(converted['anyOf']).toEqual([{ $ref: '#/$defs/Addr' }, { type: 'null' }])
    })

    it('AJV equivalence: annotation-hoisted $ref-null wrap validates like the branch-buried shape', () => {
      const converted = toJsonSchema({
        $ref: '#/components/schemas/Addr',
        nullable: true,
        readOnly: true,
      }) as Record<string, unknown>
      const oldShape = { anyOf: [{ $ref: '#/$defs/Addr', readOnly: true }, { type: 'null' }] }
      const defs = { $defs: { Addr: { type: 'object', properties: { street: { type: 'string' } } } } }

      const ajv = new Ajv()
      const validateNew = ajv.compile({ ...defs, ...converted })
      const validateOld = ajv.compile({ ...defs, ...oldShape })
      for (const value of [null, { street: 'Main St' }, 42, 'str']) {
        expect(validateNew(value)).toBe(validateOld(value))
      }
    })

    it('drops nullable without wrapping on a constraint-free typeless node (annotation-only)', () => {
      // {readOnly, nullable} → {readOnly}: a typeless schema already accepts null
      expect(toJsonSchema({ nullable: true, readOnly: true })).toEqual({ readOnly: true })
      expect(toJsonSchema({ nullable: true, description: 'maybe null' })).toEqual({ description: 'maybe null' })
    })

    it('drops nullable without wrapping on a typeless properties-only node (type-scoped keywords)', () => {
      const result = toJsonSchema({
        nullable: true,
        properties: { street: { type: 'string' } },
      })
      expect(result).toEqual({ properties: { street: { type: 'string' } } })
    })

    it('AJV equivalence: unwrapped annotation-only nullable accepts the same values as the old wrap', () => {
      const converted = toJsonSchema({ nullable: true, readOnly: true }) as Record<string, unknown>
      const oldShape = { anyOf: [{ readOnly: true }, { type: 'null' }] }

      const ajv = new Ajv()
      const validateNew = ajv.compile(converted)
      const validateOld = ajv.compile(oldShape)
      for (const value of [null, 'str', 42, { a: 1 }, [1], true]) {
        expect(validateNew(value)).toBe(validateOld(value))
        expect(validateNew(value)).toBe(true) // both accept everything, including null
      }
    })

    it('wraps {$ref, nullable:true} in anyOf so the ref value AND null are both accepted (AJV verified)', () => {
      const converted = toJsonSchema({
        $ref: '#/components/schemas/Addr',
        nullable: true,
      }) as Record<string, unknown>
      expect(converted).not.toHaveProperty('nullable')
      expect(converted['anyOf']).toEqual([{ $ref: '#/$defs/Addr' }, { type: 'null' }])

      const ajv = new Ajv()
      const validate = ajv.compile({
        $defs: { Addr: { type: 'object', properties: { street: { type: 'string' } } } },
        ...converted,
      })
      expect(validate({ street: 'Main St' })).toBe(true) // valid ref value
      expect(validate(null)).toBe(true) // null is also valid
      expect(validate(42)).toBe(false) // neither
    })

    it('wraps {allOf, nullable:true} in anyOf so allOf value AND null are both accepted (AJV verified)', () => {
      const converted = toJsonSchema({
        allOf: [{ $ref: '#/components/schemas/Addr' }],
        nullable: true,
      }) as Record<string, unknown>
      expect(converted).not.toHaveProperty('nullable')
      expect(converted['anyOf']).toEqual([{ allOf: [{ $ref: '#/$defs/Addr' }] }, { type: 'null' }])

      const ajv = new Ajv()
      const validate = ajv.compile({
        $defs: { Addr: { type: 'object', properties: { street: { type: 'string' } } } },
        ...converted,
      })
      expect(validate({ street: 'Main St' })).toBe(true)
      expect(validate(null)).toBe(true)
      expect(validate(42)).toBe(false)
    })

    it('keeps the enum-null conversion for typeless enum-only nullable node (boundary guard)', () => {
      // enum is a constraint keyword — nullable must still be expressed (via enum append)
      const result = toJsonSchema({ enum: ['x'], nullable: true })
      expect(result).toEqual({ enum: ['x', null] })
    })

    it('appends null to enum for typeless enum-only nullable node (AJV verified)', () => {
      const converted = toJsonSchema({ enum: ['a', 'b'], nullable: true }) as Record<string, unknown>
      expect(converted).not.toHaveProperty('nullable')
      expect(converted['enum']).toEqual(['a', 'b', null])

      const ajv = new Ajv()
      const validate = ajv.compile(converted)
      expect(validate('a')).toBe(true)
      expect(validate(null)).toBe(true)
      expect(validate('c')).toBe(false)
    })

    it('appends {type:"null"} to pre-existing anyOf when nullable:true and no type', () => {
      const result = toJsonSchema({
        anyOf: [{ type: 'string' }, { type: 'number' }],
        nullable: true,
      }) as Record<string, unknown>
      expect(result).not.toHaveProperty('nullable')
      expect(result['anyOf']).toEqual([{ type: 'string' }, { type: 'number' }, { type: 'null' }])
    })
  })

  // -------------------------------------------------------------------------
  // nullable enum
  // -------------------------------------------------------------------------

  describe('nullable enum', () => {
    it('adds null to enum when nullable:true and type is present', () => {
      const result = toJsonSchema({
        type: 'string',
        nullable: true,
        enum: ['a', 'b'],
      })
      expect(result).toEqual({ type: ['string', 'null'], enum: ['a', 'b', null] })
    })

    it('does not duplicate null in enum', () => {
      const result = toJsonSchema({
        type: 'string',
        nullable: true,
        enum: ['a', null, 'b'],
      })
      const schema = result as Record<string, unknown>
      const enumArr = schema['enum'] as unknown[]
      expect(enumArr.filter((v) => v === null)).toHaveLength(1)
    })
  })

  // -------------------------------------------------------------------------
  // boolean exclusiveMinimum / exclusiveMaximum → numeric
  // -------------------------------------------------------------------------

  describe('boolean exclusiveMinimum → numeric', () => {
    it('converts exclusiveMinimum:true to numeric using minimum', () => {
      const result = toJsonSchema({ type: 'number', minimum: 5, exclusiveMinimum: true })
      expect(result).toEqual({ type: 'number', exclusiveMinimum: 5 })
    })

    it('removes exclusiveMinimum:false', () => {
      const result = toJsonSchema({ type: 'number', minimum: 5, exclusiveMinimum: false })
      expect(result).toEqual({ type: 'number', minimum: 5 })
    })

    it('converts exclusiveMaximum:true to numeric using maximum', () => {
      const result = toJsonSchema({ type: 'number', maximum: 100, exclusiveMaximum: true })
      expect(result).toEqual({ type: 'number', exclusiveMaximum: 100 })
    })

    it('removes exclusiveMaximum:false', () => {
      const result = toJsonSchema({ type: 'number', maximum: 100, exclusiveMaximum: false })
      expect(result).toEqual({ type: 'number', maximum: 100 })
    })

    it('converts both exclusiveMinimum and exclusiveMaximum in one schema', () => {
      const result = toJsonSchema({
        type: 'number',
        minimum: 0,
        exclusiveMinimum: true,
        maximum: 10,
        exclusiveMaximum: true,
      })
      expect(result).toEqual({ type: 'number', exclusiveMinimum: 0, exclusiveMaximum: 10 })
    })
  })

  // -------------------------------------------------------------------------
  // Stripped keys
  // -------------------------------------------------------------------------

  describe('stripped keys', () => {
    it('removes xml, discriminator, externalDocs, example', () => {
      const result = toJsonSchema({
        type: 'object',
        xml: { name: 'Pet' },
        discriminator: { propertyName: 'type' },
        externalDocs: { url: 'https://example.com' },
        example: { id: 1 },
        description: 'A pet',
        title: 'Pet',
      })
      expect(result).toEqual({ type: 'object', description: 'A pet', title: 'Pet' })
    })

    it('keeps description, title, default, deprecated, readOnly, format', () => {
      const result = toJsonSchema({
        type: 'string',
        description: 'Name',
        title: 'Name',
        default: 'unnamed',
        deprecated: true,
        readOnly: true,
        format: 'uuid',
        example: 'should-be-stripped',
      })
      expect(result).toEqual({
        type: 'string',
        description: 'Name',
        title: 'Name',
        default: 'unnamed',
        deprecated: true,
        readOnly: true,
        format: 'uuid',
      })
    })
  })

  // -------------------------------------------------------------------------
  // $ref rewrite
  // -------------------------------------------------------------------------

  describe('$ref rewrite', () => {
    it('rewrites #/components/schemas/X to #/$defs/X', () => {
      const result = toJsonSchema({ $ref: '#/components/schemas/Pet' })
      expect(result).toEqual({ $ref: '#/$defs/Pet' })
    })

    it('does not rewrite $ref values that are not component schemas', () => {
      const result = toJsonSchema({ $ref: '#/$defs/Pet' })
      expect(result).toEqual({ $ref: '#/$defs/Pet' })
    })

    it('does not rewrite external refs — N2 anchor (startsWith guard)', () => {
      const result = toJsonSchema({ $ref: 'common.yaml#/components/schemas/Addr' })
      expect(result).toEqual({ $ref: 'common.yaml#/components/schemas/Addr' })
    })

    it('rewrites $ref inside allOf', () => {
      const result = toJsonSchema({
        allOf: [{ $ref: '#/components/schemas/Base' }, { type: 'object', properties: { extra: { type: 'string' } } }],
      })
      expect(result).toEqual({
        allOf: [{ $ref: '#/$defs/Base' }, { type: 'object', properties: { extra: { type: 'string' } } }],
      })
    })

    it('rewrites $ref inside nested properties', () => {
      const result = toJsonSchema({
        type: 'object',
        properties: {
          owner: { $ref: '#/components/schemas/Owner' },
        },
      })
      expect(result).toEqual({
        type: 'object',
        properties: {
          owner: { $ref: '#/$defs/Owner' },
        },
      })
    })
  })

  // -------------------------------------------------------------------------
  // OpenAPI 3.1 passthrough
  // -------------------------------------------------------------------------

  describe('OpenAPI 3.1 passthrough', () => {
    it('passes through type arrays untouched', () => {
      const schema = { type: ['string', 'null'], minLength: 1 }
      expect(toJsonSchema(schema)).toEqual(schema)
    })

    it('passes through numeric exclusiveMinimum untouched', () => {
      const schema = { type: 'number', exclusiveMinimum: 5 }
      expect(toJsonSchema(schema)).toEqual(schema)
    })

    it('passes through numeric exclusiveMaximum untouched', () => {
      const schema = { type: 'number', exclusiveMaximum: 100 }
      expect(toJsonSchema(schema)).toEqual(schema)
    })

    it('passes through $ref in #/$defs/ form untouched', () => {
      const schema = { $ref: '#/$defs/MyType' }
      expect(toJsonSchema(schema)).toEqual(schema)
    })
  })

  // -------------------------------------------------------------------------
  // Recursive traversal
  // -------------------------------------------------------------------------

  describe('recursive conversion', () => {
    it('converts nullable inside nested properties', () => {
      const result = toJsonSchema({
        type: 'object',
        properties: {
          name: { type: 'string', nullable: true },
        },
      })
      expect(result).toEqual({
        type: 'object',
        properties: {
          name: { type: ['string', 'null'] },
        },
      })
    })

    it('converts nullable inside items', () => {
      const result = toJsonSchema({
        type: 'array',
        items: { type: 'string', nullable: true },
      })
      expect(result).toEqual({
        type: 'array',
        items: { type: ['string', 'null'] },
      })
    })

    it('converts inside anyOf / oneOf', () => {
      const result = toJsonSchema({
        anyOf: [{ type: 'string', nullable: true }, { type: 'integer' }],
      })
      expect(result).toEqual({
        anyOf: [{ type: ['string', 'null'] }, { type: 'integer' }],
      })
    })

    it('converts inside not', () => {
      const result = toJsonSchema({
        not: { type: 'string', example: 'should strip' },
      })
      expect(result).toEqual({ not: { type: 'string' } })
    })

    it('converts inside if/then/else — N1', () => {
      const result = toJsonSchema({
        if: { $ref: '#/components/schemas/A' },
        then: { $ref: '#/components/schemas/B' },
        else: { $ref: '#/components/schemas/C' },
      })
      expect(result).toEqual({
        if: { $ref: '#/$defs/A' },
        then: { $ref: '#/$defs/B' },
        else: { $ref: '#/$defs/C' },
      })
    })

    it('converts inside patternProperties — N1', () => {
      const result = toJsonSchema({
        type: 'object',
        patternProperties: {
          '^x-': { $ref: '#/components/schemas/Extension', nullable: false },
        },
      })
      expect(result).toEqual({
        type: 'object',
        patternProperties: {
          '^x-': { $ref: '#/$defs/Extension' },
        },
      })
    })

    it('converts tuple-form items (array of schemas) — N1', () => {
      const result = toJsonSchema({
        type: 'array',
        items: [{ $ref: '#/components/schemas/A' }, { type: 'string', nullable: true }],
      })
      expect(result).toEqual({
        type: 'array',
        items: [{ $ref: '#/$defs/A' }, { type: ['string', 'null'] }],
      })
    })

    it('converts inside prefixItems', () => {
      const result = toJsonSchema({
        prefixItems: [{ type: 'string', nullable: true }, { type: 'number' }],
      })
      expect(result).toEqual({
        prefixItems: [{ type: ['string', 'null'] }, { type: 'number' }],
      })
    })

    it('converts inside additionalProperties (schema form)', () => {
      const result = toJsonSchema({
        type: 'object',
        additionalProperties: { type: 'string', nullable: true },
      })
      expect(result).toEqual({
        type: 'object',
        additionalProperties: { type: ['string', 'null'] },
      })
    })

    it('preserves boolean additionalProperties', () => {
      const result = toJsonSchema({ type: 'object', additionalProperties: false })
      expect(result).toEqual({ type: 'object', additionalProperties: false })
    })

    it('converts schemas inside $defs (ref rewrite + nullable)', () => {
      const result = toJsonSchema({
        type: 'object',
        properties: { kind: { $ref: '#/$defs/Kind' } },
        $defs: {
          Kind: { type: 'string', nullable: true, enum: ['a', 'b'] },
          Linked: { $ref: '#/components/schemas/Shared' },
        },
      }) as Record<string, Record<string, unknown>>
      expect(result['$defs']['Kind']).toEqual({ type: ['string', 'null'], enum: ['a', 'b', null] })
      expect(result['$defs']['Linked']).toEqual({ $ref: '#/$defs/Shared' })
    })

    it('converts schemas inside definitions (draft-07 style)', () => {
      const result = toJsonSchema({
        type: 'object',
        definitions: { Note: { type: 'string', nullable: true } },
      }) as Record<string, Record<string, unknown>>
      expect(result['definitions']['Note']).toEqual({ type: ['string', 'null'] })
    })
  })

  // -------------------------------------------------------------------------
  // Non-object passthrough
  // -------------------------------------------------------------------------

  describe('non-object passthrough', () => {
    it('returns primitives unchanged', () => {
      expect(toJsonSchema('hello')).toBe('hello')
      expect(toJsonSchema(42)).toBe(42)
      expect(toJsonSchema(null)).toBe(null)
      expect(toJsonSchema(true)).toBe(true)
    })

    it('maps over arrays', () => {
      expect(toJsonSchema([{ type: 'string', example: 'strip' }, { type: 'number' }])).toEqual([
        { type: 'string' },
        { type: 'number' },
      ])
    })
  })
})

// ---------------------------------------------------------------------------
// collectRefNames
// ---------------------------------------------------------------------------

describe('collectRefNames', () => {
  const defs: Record<string, unknown> = {
    Pet: {
      type: 'object',
      properties: {
        owner: { $ref: '#/$defs/Owner' },
        tag: { $ref: '#/components/schemas/Tag' },
      },
    },
    Owner: {
      type: 'object',
      properties: {
        address: { $ref: '#/$defs/Address' },
      },
    },
    Address: { type: 'object', properties: { street: { type: 'string' } } },
    Tag: { type: 'object', properties: { name: { type: 'string' } } },
    // Cyclic: A → B → A
    CycleA: { type: 'object', properties: { b: { $ref: '#/$defs/CycleB' } } },
    CycleB: { type: 'object', properties: { a: { $ref: '#/$defs/CycleA' } } },
  }

  it('collects directly referenced name', () => {
    const result = collectRefNames({ $ref: '#/$defs/Tag' }, defs)
    expect(result).toContain('Tag')
  })

  it('handles #/components/schemas/ form', () => {
    const result = collectRefNames({ $ref: '#/components/schemas/Tag' }, defs)
    expect(result).toContain('Tag')
  })

  it('collects transitive refs (Pet → Owner → Address, Pet → Tag)', () => {
    const result = collectRefNames({ $ref: '#/$defs/Pet' }, defs)
    expect(result).toContain('Pet')
    expect(result).toContain('Owner')
    expect(result).toContain('Address')
    expect(result).toContain('Tag')
  })

  it('does not duplicate names', () => {
    const result = collectRefNames(
      {
        allOf: [{ $ref: '#/$defs/Tag' }, { $ref: '#/$defs/Tag' }],
      },
      defs,
    )
    expect(result.filter((n) => n === 'Tag')).toHaveLength(1)
  })

  it('handles cyclic refs without infinite loop', () => {
    const result = collectRefNames({ $ref: '#/$defs/CycleA' }, defs)
    expect(result).toContain('CycleA')
    expect(result).toContain('CycleB')
    // Result should be finite (no stack overflow)
    expect(result.length).toBeLessThanOrEqual(Object.keys(defs).length)
  })

  it('returns empty array for schema with no refs', () => {
    const result = collectRefNames({ type: 'string', minLength: 1 }, defs)
    expect(result).toEqual([])
  })

  it('returns empty array for non-object input', () => {
    expect(collectRefNames(null, defs)).toEqual([])
    expect(collectRefNames('string', defs)).toEqual([])
  })

  it('collects refs nested inside properties', () => {
    const schema = {
      type: 'object',
      properties: {
        pet: { $ref: '#/$defs/Pet' },
      },
    }
    const result = collectRefNames(schema, defs)
    expect(result).toContain('Pet')
    expect(result).toContain('Owner')
    expect(result).toContain('Address')
  })

  it('collects refs from allOf / anyOf / oneOf', () => {
    const schema = {
      oneOf: [{ $ref: '#/$defs/Tag' }, { $ref: '#/$defs/Address' }],
    }
    const result = collectRefNames(schema, defs)
    expect(result).toContain('Tag')
    expect(result).toContain('Address')
  })

  it('returns names in discovery order', () => {
    const result = collectRefNames({ $ref: '#/$defs/Pet' }, defs)
    // Pet must appear before its dependents
    expect(result.indexOf('Pet')).toBeLessThan(result.indexOf('Owner'))
  })
})
