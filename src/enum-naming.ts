/**
 * Shared enum-naming helpers for codegen.
 * Internal module – not part of the public API; do not re-export from src/index.ts.
 */

export type EnumCase = 'pascal' | 'const'

/**
 * Converts a string to camelCase or PascalCase.
 * Handles snake_case, kebab-case, space-separated strings, and mixed cases.
 * Single source of truth for case conversion logic.
 *
 * @param str - Input string to convert
 * @param capitalize - If true, returns PascalCase; if false, returns camelCase
 * @returns Converted string in the requested case
 */
export function toCase(str: string, capitalize: boolean): string {
  // If already camelCase or PascalCase, just adjust first letter
  if (/[a-z]/.test(str) && /[A-Z]/.test(str)) {
    return capitalize ? str.charAt(0).toUpperCase() + str.slice(1) : str.charAt(0).toLowerCase() + str.slice(1)
  }

  // Handle snake_case, kebab-case, spaces, etc.
  const parts = str
    .split(/[-_\s]+/)
    .filter((part) => part.length > 0)
    .map((part) => {
      // If this part is already in camelCase, just capitalize the first letter
      if (/[a-z]/.test(part) && /[A-Z]/.test(part)) {
        return part.charAt(0).toUpperCase() + part.slice(1)
      }
      // Otherwise, capitalize and lowercase to normalize
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    })

  if (parts.length === 0) return str

  // Apply capitalization rule to first part
  if (!capitalize) {
    parts[0] = parts[0].charAt(0).toLowerCase() + parts[0].slice(1)
  }

  return parts.join('')
}

/**
 * Converts a string to PascalCase.
 * Handles snake_case, kebab-case, space-separated strings, and preserves existing camelCase.
 */
export function toPascalCase(str: string): string {
  return toCase(str, true)
}

/**
 * Converts a string to camelCase.
 * Handles snake_case, kebab-case, space-separated strings, and preserves existing camelCase.
 */
export function toCamelCase(str: string): string {
  return toCase(str, false)
}

/**
 * Converts a string value to a valid TypeScript property name.
 * - Strings that are valid identifiers are used as-is (capitalized)
 * - Numbers are prefixed with underscore
 * - null becomes 'Null'
 */
export function toEnumMemberName(value: string | number | null): string {
  if (value === null) {
    return 'Null' // Handle null enum values
  }

  if (typeof value === 'number') {
    return `_${value}` // Numbers can't be property names, prefix with underscore
  }

  // Map common operator symbols to readable names
  const operatorMap: Record<string, string> = {
    '=': 'Equals',
    '!=': 'NotEquals',
    '<': 'LessThan',
    '>': 'GreaterThan',
    '<=': 'LessThanOrEqual',
    '>=': 'GreaterThanOrEqual',
    '!': 'Not',
    '&&': 'And',
    '||': 'Or',
    '+': 'Plus',
    '-': 'Minus',
    '*': 'Multiply',
    '/': 'Divide',
    '%': 'Modulo',
    '^': 'Caret',
    '&': 'Ampersand',
    '|': 'Pipe',
    '~': 'Tilde',
    '<<': 'LeftShift',
    '>>': 'RightShift',
  }

  if (operatorMap[value]) {
    return operatorMap[value]
  }

  // Check if it's a valid TypeScript identifier
  const isValidIdentifier = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(value)

  if (isValidIdentifier) {
    // Capitalize first letter for convention
    return value.charAt(0).toUpperCase() + value.slice(1)
  }

  // For non-identifier strings, replace special characters with underscores
  const cleaned = toPascalCase(value.replace(/[^a-zA-Z0-9_$]/g, '_'))

  // If the result is empty or still invalid, prefix with underscore to make it valid
  // Sanitize the full value to ensure unique identifiers for enum members
  if (cleaned.length === 0 || !/^[a-zA-Z_$]/.test(cleaned)) {
    const sanitized = String(value).replace(/[^a-zA-Z0-9_$]/g, '_')
    return sanitized.length > 0 ? `_${sanitized}` : '_Empty'
  }

  return cleaned
}

/**
 * Converts a pascal-case label to SCREAMING_SNAKE_CASE.
 * Preserves any leading underscore (e.g. '_1' stays '_1', '_Empty' → '_EMPTY').
 *
 * Split rules (applied in order to the body after stripping a leading _):
 *  1. Existing separators ([-_\s]+) → '_'
 *  2. lower→upper boundary  (InProgress  → IN_PROGRESS)
 *  3. acronym→word boundary  (PDFReport   → PDF_REPORT)
 *  4. digit→letter boundary  (V2Beta      → V2_BETA)
 */
export function toScreamingSnake(label: string): string {
  const prefix = label.startsWith('_') ? '_' : ''
  const body = prefix ? label.slice(1) : label

  const result = body
    .replace(/[-_\s]+/g, '_') // 1. normalise separators
    .replace(/([a-z])([A-Z])/g, '$1_$2') // 2. lower→upper
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2') // 3. acronym→word
    .replace(/(\d)([a-zA-Z])/g, '$1_$2') // 4. digit→letter
    .toUpperCase()

  return prefix + result
}

/**
 * Builds a label → value map for the given enum values using the requested style.
 * Throws when two *distinct* values map to the same label (collision).
 * Duplicate occurrences of the same value are deduped silently.
 *
 * @param values     - Raw enum values from the spec (may include null)
 * @param style      - Casing style to apply
 * @param context    - Human-readable location for error messages (e.g. 'components.schemas.Status')
 * @param options    - includeNull: reproduce the api-enums/enumArrayToObject asymmetry
 */
export function buildMemberLabelMap(
  values: (string | number | null)[],
  style: EnumCase,
  context: string,
  options: { includeNull: boolean },
): Map<string, string | number | null> {
  const { includeNull } = options
  const labelToValue = new Map<string, string | number | null>()

  for (const value of values) {
    if (value === null && !includeNull) continue

    const pascalLabel = toEnumMemberName(value)
    const label = style === 'const' ? toScreamingSnake(pascalLabel) : pascalLabel

    if (labelToValue.has(label)) {
      const existing = labelToValue.get(label)
      if (existing !== value) {
        const remediation =
          style === 'const'
            ? 'Re-run without --enum-case const or de-duplicate the values in the spec.'
            : 'De-duplicate the values in the spec.'
        throw new Error(
          `Enum label collision in ${context}: values ${JSON.stringify(existing)} and ${JSON.stringify(value)} ` +
            `both map to label "${label}". ` +
            remediation,
        )
      }
      // Same value – dedupe silently
      continue
    }

    labelToValue.set(label, value)
  }

  return labelToValue
}
