import { describe, it, expect } from 'vitest'
import {
  toCase,
  toPascalCase,
  toCamelCase,
  toEnumMemberName,
  toScreamingSnake,
  buildMemberLabelMap,
} from '@/enum-naming'

// ─── toCase ──────────────────────────────────────────────────────────────────

describe('toCase', () => {
  it('converts snake_case to PascalCase when capitalize=true', () => {
    expect(toCase('foo_bar', true)).toBe('FooBar')
    expect(toCase('in_progress', true)).toBe('InProgress')
    expect(toCase('some_long_name', true)).toBe('SomeLongName')
  })

  it('converts snake_case to camelCase when capitalize=false', () => {
    expect(toCase('foo_bar', false)).toBe('fooBar')
    expect(toCase('in_progress', false)).toBe('inProgress')
  })

  it('converts kebab-case', () => {
    expect(toCase('foo-bar', true)).toBe('FooBar')
    expect(toCase('foo-bar', false)).toBe('fooBar')
  })

  it('converts space-separated', () => {
    expect(toCase('foo bar', true)).toBe('FooBar')
    expect(toCase('foo bar', false)).toBe('fooBar')
  })

  it('adjusts first letter of already-mixed strings', () => {
    expect(toCase('fooBar', true)).toBe('FooBar')
    expect(toCase('FooBar', false)).toBe('fooBar')
  })

  it('returns string unchanged when no parts after split', () => {
    // empty string: split produces no parts, returns str as-is
    expect(toCase('', true)).toBe('')
  })
})

// ─── toPascalCase ─────────────────────────────────────────────────────────────

describe('toPascalCase', () => {
  it('converts snake_case', () => {
    expect(toPascalCase('hello_world')).toBe('HelloWorld')
    expect(toPascalCase('pet_status')).toBe('PetStatus')
  })

  it('converts kebab-case', () => {
    expect(toPascalCase('hello-world')).toBe('HelloWorld')
  })

  it('capitalises already-camelCase string', () => {
    expect(toPascalCase('helloWorld')).toBe('HelloWorld')
  })

  it('leaves already-PascalCase unchanged', () => {
    expect(toPascalCase('PetStatus')).toBe('PetStatus')
  })
})

// ─── toCamelCase ─────────────────────────────────────────────────────────────

describe('toCamelCase', () => {
  it('converts snake_case', () => {
    expect(toCamelCase('hello_world')).toBe('helloWorld')
    expect(toCamelCase('pet_status')).toBe('petStatus')
  })

  it('converts kebab-case', () => {
    expect(toCamelCase('hello-world')).toBe('helloWorld')
  })

  it('lowercases already-PascalCase string', () => {
    expect(toCamelCase('HelloWorld')).toBe('helloWorld')
  })

  it('leaves already-camelCase unchanged', () => {
    expect(toCamelCase('helloWorld')).toBe('helloWorld')
  })
})

// ─── toEnumMemberName ─────────────────────────────────────────────────────────
// Regression lock: these assert the existing pascal-label behaviour exactly.

describe('toEnumMemberName', () => {
  describe('null and numeric inputs', () => {
    it('maps null to Null', () => {
      expect(toEnumMemberName(null)).toBe('Null')
    })

    it('prefixes numbers with underscore', () => {
      expect(toEnumMemberName(1)).toBe('_1')
      expect(toEnumMemberName(0)).toBe('_0')
      expect(toEnumMemberName(42)).toBe('_42')
    })
  })

  describe('operator symbol map', () => {
    it('maps = to Equals', () => expect(toEnumMemberName('=')).toBe('Equals'))
    it('maps != to NotEquals', () => expect(toEnumMemberName('!=')).toBe('NotEquals'))
    it('maps < to LessThan', () => expect(toEnumMemberName('<')).toBe('LessThan'))
    it('maps > to GreaterThan', () => expect(toEnumMemberName('>')).toBe('GreaterThan'))
    it('maps <= to LessThanOrEqual', () => expect(toEnumMemberName('<=')).toBe('LessThanOrEqual'))
    it('maps >= to GreaterThanOrEqual', () => expect(toEnumMemberName('>=')).toBe('GreaterThanOrEqual'))
    it('maps + to Plus', () => expect(toEnumMemberName('+')).toBe('Plus'))
    it('maps - to Minus', () => expect(toEnumMemberName('-')).toBe('Minus'))
    it('maps * to Multiply', () => expect(toEnumMemberName('*')).toBe('Multiply'))
    it('maps / to Divide', () => expect(toEnumMemberName('/')).toBe('Divide'))
    it('maps % to Modulo', () => expect(toEnumMemberName('%')).toBe('Modulo'))
    it('maps << to LeftShift', () => expect(toEnumMemberName('<<')).toBe('LeftShift'))
    it('maps >> to RightShift', () => expect(toEnumMemberName('>>')).toBe('RightShift'))
  })

  describe('valid identifier strings', () => {
    it('capitalises lowercase identifier (quirk: only first letter)', () => {
      expect(toEnumMemberName('inProgress')).toBe('InProgress')
    })

    it('preserves underscores in valid identifiers (in_progress quirk)', () => {
      // in_progress is a valid identifier so only first letter is capped
      expect(toEnumMemberName('in_progress')).toBe('In_progress')
    })

    it('maps available to Available', () => {
      expect(toEnumMemberName('available')).toBe('Available')
    })

    it('maps adopted to Adopted', () => {
      expect(toEnumMemberName('adopted')).toBe('Adopted')
    })

    it('maps pending to Pending', () => {
      expect(toEnumMemberName('pending')).toBe('Pending')
    })
  })

  describe('non-identifier strings (contain specials)', () => {
    it('converts strings with dots via toPascalCase after replacing specials', () => {
      // 'a.b' → replace '.' with '_' → 'a_b' → toPascalCase → 'AB'
      expect(toEnumMemberName('a.b')).toBe('AB')
    })

    it('prefixes numeric strings with underscore', () => {
      // '0.1' (a string, not a number) → sanitized to _0_1
      expect(toEnumMemberName('0.1')).toBe('_0_1')
      expect(toEnumMemberName('0')).toBe('_0')
    })

    it('produces _Empty for empty string input', () => {
      expect(toEnumMemberName('')).toBe('_Empty')
    })

    it('produces leading underscore for symbols not in operator map', () => {
      // '@' → replace with '_' → toPascalCase('_') = '_' → starts with '_' so valid → returns '_'
      expect(toEnumMemberName('@')).toBe('_')
    })
  })
})

// ─── toScreamingSnake ────────────────────────────────────────────────────────

describe('toScreamingSnake', () => {
  describe('post-transform of pascal enum labels', () => {
    it('converts In_progress (from in_progress) to IN_PROGRESS', () => {
      expect(toScreamingSnake('In_progress')).toBe('IN_PROGRESS')
    })

    it('converts InProgress (from inProgress) to IN_PROGRESS', () => {
      expect(toScreamingSnake('InProgress')).toBe('IN_PROGRESS')
    })

    it('converts operator map results', () => {
      expect(toScreamingSnake('NotEquals')).toBe('NOT_EQUALS')
      expect(toScreamingSnake('LessThan')).toBe('LESS_THAN')
      expect(toScreamingSnake('LessThanOrEqual')).toBe('LESS_THAN_OR_EQUAL')
      expect(toScreamingSnake('GreaterThanOrEqual')).toBe('GREATER_THAN_OR_EQUAL')
      expect(toScreamingSnake('LeftShift')).toBe('LEFT_SHIFT')
      expect(toScreamingSnake('RightShift')).toBe('RIGHT_SHIFT')
    })

    it('converts null label', () => {
      expect(toScreamingSnake('Null')).toBe('NULL')
    })

    it('converts simple pascal labels', () => {
      expect(toScreamingSnake('Available')).toBe('AVAILABLE')
      expect(toScreamingSnake('Pending')).toBe('PENDING')
      expect(toScreamingSnake('Adopted')).toBe('ADOPTED')
    })

    it('preserves leading underscore for numeric labels', () => {
      // _1 → prefix='_', body='1' → '1' → no splits → '1'.toUpperCase() = '1' → '_1'
      expect(toScreamingSnake('_1')).toBe('_1')
      expect(toScreamingSnake('_42')).toBe('_42')
    })

    it('converts _Empty', () => {
      expect(toScreamingSnake('_Empty')).toBe('_EMPTY')
    })
  })

  describe('acronym and digit boundary splitting', () => {
    it('splits acronym→word boundary: PDFReport → PDF_REPORT', () => {
      expect(toScreamingSnake('PDFReport')).toBe('PDF_REPORT')
    })

    it('splits digit→letter boundary: V2Beta → V2_BETA', () => {
      expect(toScreamingSnake('V2Beta')).toBe('V2_BETA')
    })
  })
})

// ─── buildMemberLabelMap ─────────────────────────────────────────────────────

describe('buildMemberLabelMap', () => {
  describe('includeNull behaviour', () => {
    it('includes null in the map when includeNull=true', () => {
      const map = buildMemberLabelMap([null, 'foo'], 'pascal', 'test', { includeNull: true })
      expect(map.has('Null')).toBe(true)
      expect(map.get('Null')).toBe(null)
    })

    it('skips null when includeNull=false', () => {
      const map = buildMemberLabelMap([null, 'foo'], 'pascal', 'test', { includeNull: false })
      expect(map.has('Null')).toBe(false)
      expect(map.has('Foo')).toBe(true)
    })
  })

  describe('deduplication', () => {
    it('silently dedupes repeated identical values', () => {
      const map = buildMemberLabelMap(['foo', 'foo', 'foo'], 'pascal', 'test', { includeNull: false })
      expect(map.size).toBe(1)
      expect(map.get('Foo')).toBe('foo')
    })

    it('silently dedupes repeated identical numeric values', () => {
      const map = buildMemberLabelMap([1, 1, 2], 'pascal', 'test', { includeNull: false })
      expect(map.size).toBe(2)
    })
  })

  describe('pascal mode – keys are capitalised first letter only for valid identifiers', () => {
    it('maps basic values correctly', () => {
      const map = buildMemberLabelMap(['available', 'pending', 'adopted'], 'pascal', 'ctx', { includeNull: false })
      expect([...map.keys()]).toEqual(['Available', 'Pending', 'Adopted'])
      expect(map.get('Available')).toBe('available')
    })
  })

  describe('const mode – keys are SCREAMING_SNAKE', () => {
    it('maps basic values to ALL_CAPS', () => {
      const map = buildMemberLabelMap(['available', 'pending', 'adopted'], 'const', 'ctx', { includeNull: false })
      expect([...map.keys()]).toEqual(['AVAILABLE', 'PENDING', 'ADOPTED'])
      expect(map.get('AVAILABLE')).toBe('available')
    })

    it('values are unchanged by casing style', () => {
      const pascalMap = buildMemberLabelMap(['in_progress'], 'pascal', 'ctx', { includeNull: false })
      const constMap = buildMemberLabelMap(['in_progress'], 'const', 'ctx', { includeNull: false })
      // Values stay the same
      expect([...pascalMap.values()]).toEqual(['in_progress'])
      expect([...constMap.values()]).toEqual(['in_progress'])
      // Only labels differ
      expect([...pascalMap.keys()]).toEqual(['In_progress'])
      expect([...constMap.keys()]).toEqual(['IN_PROGRESS'])
    })

    it('maps null to NULL when includeNull=true', () => {
      const map = buildMemberLabelMap([null], 'const', 'ctx', { includeNull: true })
      expect(map.has('NULL')).toBe(true)
      expect(map.get('NULL')).toBe(null)
    })
  })

  describe('collision detection', () => {
    it('throws on const-mode collision with both raw values and label in message', () => {
      // in_progress → In_progress → IN_PROGRESS
      // InProgress  → InProgress  → IN_PROGRESS
      // Different in pascal mode, same in const mode → collision
      expect(() =>
        buildMemberLabelMap(['InProgress', 'in_progress'], 'const', 'components.schemas.Status', {
          includeNull: false,
        }),
      ).toThrow(/Enum label collision in components\.schemas\.Status/)

      expect(() =>
        buildMemberLabelMap(['InProgress', 'in_progress'], 'const', 'components.schemas.Status', {
          includeNull: false,
        }),
      ).toThrow(/"InProgress"/)

      expect(() =>
        buildMemberLabelMap(['InProgress', 'in_progress'], 'const', 'components.schemas.Status', {
          includeNull: false,
        }),
      ).toThrow(/"in_progress"/)

      expect(() =>
        buildMemberLabelMap(['InProgress', 'in_progress'], 'const', 'components.schemas.Status', {
          includeNull: false,
        }),
      ).toThrow(/"IN_PROGRESS"/)

      // Remediation text for const mode
      expect(() =>
        buildMemberLabelMap(['InProgress', 'in_progress'], 'const', 'components.schemas.Status', {
          includeNull: false,
        }),
      ).toThrow(/Re-run without --enum-case const/)
    })

    it('throws on pascal-mode collision (available vs Available)', () => {
      // Both map to 'Available' in pascal mode
      expect(() =>
        buildMemberLabelMap(['available', 'Available'], 'pascal', 'components.schemas.PetStatus', {
          includeNull: false,
        }),
      ).toThrow(/Enum label collision in components\.schemas\.PetStatus/)

      expect(() =>
        buildMemberLabelMap(['available', 'Available'], 'pascal', 'components.schemas.PetStatus', {
          includeNull: false,
        }),
      ).toThrow(/"Available"/)

      // Remediation text for pascal mode (no mention of --enum-case const)
      expect(() =>
        buildMemberLabelMap(['available', 'Available'], 'pascal', 'components.schemas.PetStatus', {
          includeNull: false,
        }),
      ).toThrow(/De-duplicate the values in the spec/)
    })

    it('does not throw when same value appears more than once (dedup)', () => {
      expect(() =>
        buildMemberLabelMap(['active', 'active', 'active'], 'const', 'ctx', { includeNull: false }),
      ).not.toThrow()
    })
  })
})
