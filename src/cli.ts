import * as fs from 'fs'
import * as path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { HttpMethod } from './types.js'

const execAsync = promisify(exec)

/**
 * Standard HTTP methods used in OpenAPI specifications.
 */
const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace'] as const

interface OpenAPIOperation {
  operationId?: string
  [key: string]: unknown
}

interface OpenAPIPath {
  [method: string]: OpenAPIOperation
}

interface OpenAPISpec {
  paths: {
    [path: string]: OpenAPIPath
  }
  components?: {
    schemas?: Record<string, OpenAPISchema>
  }
}

interface OpenAPISchema {
  type?: string
  enum?: (string | number)[]
  properties?: Record<string, OpenAPISchema>
  items?: OpenAPISchema
  [key: string]: unknown
}

interface OperationInfo {
  path: string
  method: HttpMethod
}

interface EnumInfo {
  name: string // e.g., "PetStatus"
  values: (string | number)[]
  sourcePath: string // e.g., "components.schemas.Pet.properties.status"
  aliases?: string[] // Alternative names for this enum (for duplicates)
}

async function fetchOpenAPISpec(input: string): Promise<string> {
  // Check if input is a URL
  if (input.startsWith('http://') || input.startsWith('https://')) {
    console.log(`📡 Fetching OpenAPI spec from URL: ${input}`)

    // Use node's built-in fetch (available in Node 18+)
    try {
      const response = await fetch(input)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const content = await response.text()
      return content
    } catch (error) {
      throw new Error(`Failed to fetch OpenAPI spec from URL: ${error}`)
    }
  } else {
    // Local file
    console.log(`📂 Reading OpenAPI spec from file: ${input}`)

    if (!fs.existsSync(input)) {
      throw new Error(`File not found: ${input}`)
    }

    return fs.readFileSync(input, 'utf8')
  }
}

async function generateTypes(openapiContent: string, outputDir: string): Promise<void> {
  console.log('🔨 Generating TypeScript types using openapi-typescript...')

  // Write the OpenAPI spec to a temporary file
  const tempSpecPath = path.join(outputDir, 'temp-openapi.json')
  fs.writeFileSync(tempSpecPath, openapiContent)

  try {
    // Run openapi-typescript
    const typesOutputPath = path.join(outputDir, 'openapi-types.ts')
    const command = `npx openapi-typescript "${tempSpecPath}" --output "${typesOutputPath}"`

    await execAsync(command)
    console.log(`✅ Generated types file: ${typesOutputPath}`)
    // Format the generated file using eslint --fix
    console.log('🎨 Formatting generated types file with ESLint...')
    const eslintCommand = `npx eslint --fix "${typesOutputPath}"`
    await execAsync(eslintCommand)
    console.log(`✅ Formatted types file: ${typesOutputPath}`)
  } finally {
    // Clean up temp file
    if (fs.existsSync(tempSpecPath)) {
      fs.unlinkSync(tempSpecPath)
    }
  }
}

/**
 * Converts a snake_case string to PascalCase.
 * Works with strings that have no underscores (just capitalizes them).
 *
 * @param str - The snake_case string (e.g., 'give_treats' or 'pets')
 * @returns PascalCase string (e.g., 'GiveTreats' or 'Pets')
 */
function snakeToPascalCase(str: string): string {
  return str
    .split('_')
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('')
}

/**
 * Generates an operationId based on the HTTP method and path.
 * Uses heuristics to create meaningful operation names.
 *
 * @param pathUrl - The OpenAPI path (e.g., '/pets/{petId}')
 * @param method - The HTTP method (e.g., 'get', 'post')
 * @param prefixToStrip - Optional prefix to strip from path (e.g., '/api')
 * @returns A generated operationId (e.g., 'getPet', 'listPets', 'createPet')
 */
function generateOperationId(
  pathUrl: string,
  method: string,
  prefixToStrip: string = '',
  existingIds: Set<string>,
): string {
  const methodLower = method.toLowerCase()

  // Strip prefix if provided and path starts with it
  let effectivePath = pathUrl
  if (prefixToStrip && pathUrl.startsWith(prefixToStrip)) {
    effectivePath = pathUrl.substring(prefixToStrip.length)
  }

  // Remove leading/trailing slashes, replace slashes and periods with underscores
  // Filter out path parameters (e.g., {petId})
  // split by '/' or '.'
  const pathSegments = effectivePath.split(/[/.]/)

  const isParam = (segment: string) => segment.startsWith('{') && segment.endsWith('}')

  const entityName = snakeToPascalCase(
    pathSegments
      .filter((s) => !isParam(s))
      .join('_')
      .replace(/[^a-zA-Z0-9]/g, '_'), // Replace non-alphanumeric characters with underscores
  )

  // A collection is when there is a trailing slash
  const isCollection = pathUrl.endsWith('/')

  // Determine prefix based on method and whether it's a collection or single resource
  let prefix = ''
  switch (methodLower) {
    case 'get':
      // GET on file extension -> get, GET on collection -> list, GET on resource -> get
      prefix = isCollection ? 'list' : 'get'
      break
    case 'post':
      prefix = isCollection ? 'create' : 'post'
      break
    case 'put':
    case 'patch':
      prefix = 'update'
      break
    case 'delete':
      prefix = 'delete'
      break
    case 'head':
      prefix = 'head'
      break
    case 'options':
      prefix = 'options'
      break
    case 'trace':
      prefix = 'trace'
      break
    default:
      prefix = methodLower
  }

  // Combine prefix and entity name
  let generatedId = prefix + entityName

  // Handle collisions by appending path segments
  if (existingIds.has(generatedId)) {
    console.log(`⚠️  Collision detected: '${generatedId}' already used`)

    // add parameters from the last to the first until not colliding
    const params = pathSegments
      .filter(isParam)
      .map((s) => snakeToPascalCase(s.replace(/[{}]/g, '').replace(/[.:-]/g, '_')))

    while (params.length > 0) {
      generatedId += params.pop()
      if (!existingIds.has(generatedId)) {
        console.log(`   ➜ Resolved collision with: '${generatedId}'`)
        break
      }
    }

    if (existingIds.has(generatedId)) {
      // If still colliding, append a counter
      let counter = 2
      let uniqueId = `${generatedId}${counter}`
      while (existingIds.has(uniqueId)) {
        counter++
        uniqueId = `${generatedId}${counter}`
      }
      generatedId = uniqueId
      console.log(`   ➜ Resolved collision with counter: '${generatedId}'`)
    }
  }

  return generatedId
}

/**
 * Adds operationId to operations that don't have one.
 * Modifies the OpenAPI spec in place.
 * Handles collisions by appending disambiguating segments.
 *
 * @param openApiSpec - The OpenAPI specification object
 * @param prefixToStrip - Optional prefix to strip from paths (defaults to '/api')
 */
function addMissingOperationIds(openApiSpec: OpenAPISpec, prefixToStrip: string = '/api'): void {
  if (!openApiSpec.paths) {
    return
  }

  // Log the prefix that will be stripped
  if (prefixToStrip) {
    console.log(`🔍 Path prefix '${prefixToStrip}' will be stripped from operation IDs`)
  }

  // Track used operationIds to detect collisions
  const usedOperationIds = new Set<string>()

  // First pass: collect existing operationIds
  Object.entries(openApiSpec.paths).forEach(([_, pathItem]) => {
    Object.entries(pathItem).forEach(([method, op]) => {
      if (!HTTP_METHODS.includes(method.toLowerCase() as (typeof HTTP_METHODS)[number])) {
        return
      }
      if (op.operationId) {
        usedOperationIds.add(op.operationId)
      }
    })
  })

  // Second pass: generate operationIds for missing ones
  Object.entries(openApiSpec.paths).forEach(([pathUrl, pathItem]) => {
    Object.entries(pathItem).forEach(([method, op]) => {
      if (!HTTP_METHODS.includes(method.toLowerCase() as (typeof HTTP_METHODS)[number])) {
        return
      }

      if (!op.operationId) {
        // Generate operationId with prefix stripped
        let generatedId = generateOperationId(pathUrl, method, prefixToStrip, usedOperationIds)
        op.operationId = generatedId
        usedOperationIds.add(generatedId)
        console.log(`🏷️  Generated operationId '${generatedId}' for ${method.toUpperCase()} ${pathUrl}`)
      }
    })
  })
}

function parseOperationsFromSpec(
  openapiContent: string,
  excludePrefix: string | null = '_deprecated',
): {
  operationIds: string[]
  operationInfoMap: Record<string, OperationInfo>
} {
  const openApiSpec: OpenAPISpec = JSON.parse(openapiContent)

  if (!openApiSpec.paths) {
    throw new Error('Invalid OpenAPI spec: missing paths')
  }

  const operationIds: string[] = []
  const operationInfoMap: Record<string, OperationInfo> = {}

  // Iterate through all paths and methods to extract operationIds
  Object.entries(openApiSpec.paths).forEach(([pathUrl, pathItem]) => {
    Object.entries(pathItem).forEach(([method, operation]) => {
      // Skip non-HTTP methods (like parameters)
      if (!HTTP_METHODS.includes(method.toLowerCase() as (typeof HTTP_METHODS)[number])) {
        return
      }

      const op = operation as OpenAPIOperation
      if (op.operationId) {
        // Skip operations with excluded prefix
        if (excludePrefix && op.operationId.startsWith(excludePrefix)) {
          console.log(`⏭️  Excluding operation: ${op.operationId} (matches prefix '${excludePrefix}')`)
          return
        }

        operationIds.push(op.operationId)
        operationInfoMap[op.operationId] = {
          path: pathUrl,
          method: method.toUpperCase() as HttpMethod,
        }
      }
    })
  })

  operationIds.sort()

  return { operationIds, operationInfoMap }
}

/**
 * Converts a string to camelCase or PascalCase.
 * Handles snake_case, kebab-case, space-separated strings, and mixed cases.
 * Single source of truth for case conversion logic.
 *
 * @param str - Input string to convert
 * @param capitalize - If true, returns PascalCase; if false, returns camelCase
 * @returns Converted string in the requested case
 */
function toCase(str: string, capitalize: boolean): string {
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
function toPascalCase(str: string): string {
  return toCase(str, true)
}

/**
 * Converts a string value to a valid TypeScript property name.
 * - Strings that are valid identifiers are used as-is (capitalized)
 * - Invalid identifiers are wrapped in quotes
 * - Numbers are prefixed with underscore
 */
function toEnumMemberName(value: string | number | null): string {
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
  if (cleaned.length === 0 || !/^[a-zA-Z_$]/.test(cleaned)) {
    return `_Char${value.charCodeAt(0)}`
  }

  return cleaned
}

/**
 * Helper function to add enum values to the enums list with deduplication.
 * If a duplicate is found, it adds the new name as an alias instead of creating a separate enum.
 */
function addEnumIfUnique(
  enumName: string,
  enumValues: (string | number)[],
  sourcePath: string,
  enums: EnumInfo[],
  seenEnumValues: Map<string, string>,
): void {
  const valuesKey = JSON.stringify(enumValues.sort())

  // Check if we've seen this exact set of values before
  const existingName = seenEnumValues.get(valuesKey)
  if (existingName) {
    // Find the existing enum and add this as an alias
    const existingEnum = enums.find((e) => e.name === existingName)
    if (existingEnum) {
      if (!existingEnum.aliases) {
        existingEnum.aliases = []
      }
      existingEnum.aliases.push(enumName)
      console.log(`  ↳ Adding alias ${enumName} → ${existingName}`)
    }
    return
  }

  seenEnumValues.set(valuesKey, enumName)

  enums.push({
    name: enumName,
    values: enumValues,
    sourcePath,
  })
}

/**
 * Extracts all enums from an OpenAPI spec.
 * Walks through:
 * 1. components.schemas and their properties
 * 2. Operation parameters (query, header, path, cookie)
 * Deduplicates by comparing enum value sets.
 */
function extractEnumsFromSpec(openApiSpec: OpenAPISpec): EnumInfo[] {
  const enums: EnumInfo[] = []
  const seenEnumValues = new Map<string, string>() // Maps JSON stringified values -> enum name (for deduplication)

  // Extract from components.schemas
  if (openApiSpec.components?.schemas) {
    for (const [schemaName, schema] of Object.entries(openApiSpec.components.schemas)) {
      if (!schema.properties) continue

      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        if (!propSchema.enum || !Array.isArray(propSchema.enum)) continue

        // Filter out null values from enum array
        const enumValues = (propSchema.enum as (string | number | null)[]).filter((v) => v !== null) as (
          | string
          | number
        )[]

        // Skip if all values were null
        if (enumValues.length === 0) continue

        // Use schema name as-is (already PascalCase), convert property name from snake_case
        const enumName = schemaName + toPascalCase(propName)
        addEnumIfUnique(
          enumName,
          enumValues,
          `components.schemas.${schemaName}.properties.${propName}`,
          enums,
          seenEnumValues,
        )
      }
    }
  }

  // Extract from operation parameters
  if (openApiSpec.paths) {
    for (const [pathUrl, pathItem] of Object.entries(openApiSpec.paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        // Skip non-HTTP methods
        if (!HTTP_METHODS.includes(method.toLowerCase() as (typeof HTTP_METHODS)[number])) {
          continue
        }

        const op = operation as OpenAPIOperation

        // Check parameters (query, header, path, cookie)
        if (op.parameters && Array.isArray(op.parameters)) {
          for (const param of op.parameters) {
            const paramObj = param as Record<string, unknown>
            const paramName = paramObj.name as string | undefined
            const paramIn = paramObj.in as string | undefined
            const paramSchema = paramObj.schema as OpenAPISchema | undefined

            if (!paramName || !paramIn || !paramSchema?.enum) continue

            const enumValues = (paramSchema.enum as (string | number | null)[]).filter((v) => v !== null) as (
              | string
              | number
            )[]

            if (enumValues.length === 0) continue

            // Create a descriptive name: OperationName + ParamName
            const operationName = op.operationId
              ? toPascalCase(op.operationId)
              : toPascalCase(pathUrl.split('/').pop() || 'param')
            const paramNamePascal = toPascalCase(paramName)

            // Rule 1: Don't duplicate suffix if operation name already ends with param name
            let enumName: string
            if (operationName.endsWith(paramNamePascal)) {
              enumName = operationName
            } else {
              enumName = operationName + paramNamePascal
            }

            const sourcePath = `paths.${pathUrl}.${method}.parameters[${paramName}]`

            addEnumIfUnique(enumName, enumValues, sourcePath, enums, seenEnumValues)
          }
        }
      }
    }
  }

  // Sort by name for consistent output
  enums.sort((a, b) => a.name.localeCompare(b.name))

  // Rule 2: Create short aliases for common suffixes (>2 words, appears >2 times)
  addCommonSuffixAliases(enums)

  return enums
}

/**
 * Rule 2: Analyzes enum names and creates short aliases for common suffixes.
 * Algorithm:
 * 1. Find all suffixes > 2 words that appear 3+ times
 * 2. Sort by number of occurrences (descending)
 * 3. Remove any suffix that is a suffix of a MORE common one
 * 4. Create aliases for remaining suffixes
 */
function addCommonSuffixAliases(enums: EnumInfo[]): void {
  // Split enum names into words (by capital letters)
  const splitIntoWords = (name: string): string[] => {
    return name.split(/(?=[A-Z])/).filter((w) => w.length > 0)
  }

  // Collect ALL enum names (primary + aliases)
  const allEnumNames: string[] = []
  for (const enumInfo of enums) {
    allEnumNames.push(enumInfo.name)
    if (enumInfo.aliases) {
      allEnumNames.push(...enumInfo.aliases)
    }
  }

  // Extract all possible multi-word suffixes from ALL names
  const suffixCounts = new Map<string, Set<string>>() // suffix -> set of full enum names

  for (const name of allEnumNames) {
    const words = splitIntoWords(name)

    // Try all suffixes with 3+ words
    for (let wordCount = 3; wordCount <= words.length - 1; wordCount++) {
      // -1 to exclude the full name
      const suffix = words.slice(-wordCount).join('')

      if (!suffixCounts.has(suffix)) {
        suffixCounts.set(suffix, new Set())
      }
      suffixCounts.get(suffix)!.add(name)
    }
  }

  // Step 1: Find suffixes appearing 3+ times
  const commonSuffixes: Array<{ suffix: string; count: number; names: string[] }> = []

  for (const [suffix, enumNames] of suffixCounts.entries()) {
    if (enumNames.size > 2) {
      // Skip if this suffix is already present as a primary enum name or alias
      if (allEnumNames.includes(suffix)) {
        continue
      }

      commonSuffixes.push({
        suffix,
        count: enumNames.size,
        names: Array.from(enumNames),
      })
    }
  }

  // Step 2: Sort by occurrence count (descending - most common first)
  commonSuffixes.sort((a, b) => b.count - a.count)

  // Step 3: Remove suffixes that are suffixes of MORE common ones
  const filteredSuffixes: typeof commonSuffixes = []

  for (const current of commonSuffixes) {
    let shouldKeep = true

    // Check if this suffix is a suffix of any MORE common suffix already in the filtered list
    for (const existing of filteredSuffixes) {
      if (existing.suffix.endsWith(current.suffix)) {
        // current is a suffix of existing (which is more common)
        shouldKeep = false
        break
      }
    }

    if (shouldKeep) {
      filteredSuffixes.push(current)
    }
  }

  // Step 4: PROMOTE common suffixes to be PRIMARY enum names
  // Process promotions from most common to least common
  const promotions = new Map<EnumInfo, { newName: string; allAliases: string[] }>()

  for (const { suffix, names } of filteredSuffixes) {
    // Find all primary enums that have this suffix (either as primary name or alias)
    const affectedEnums: EnumInfo[] = []

    for (const name of names) {
      const enumInfo = enums.find((e) => e.name === name || (e.aliases && e.aliases.includes(name)))
      if (enumInfo && !affectedEnums.includes(enumInfo) && !promotions.has(enumInfo)) {
        affectedEnums.push(enumInfo)
      }
    }

    if (affectedEnums.length === 0) continue

    // Use the first affected enum as the base (it has the values we need)
    const primaryEnum = affectedEnums[0]

    // Collect all names that should become aliases
    const allAliases = new Set<string>()

    for (const enumInfo of affectedEnums) {
      // Add the primary name as an alias
      allAliases.add(enumInfo.name)

      // Add all existing aliases
      if (enumInfo.aliases) {
        enumInfo.aliases.forEach((alias) => allAliases.add(alias))
      }
    }

    // Remove the suffix itself from aliases (it will be the primary name)
    allAliases.delete(suffix)

    // Record this promotion to apply later
    promotions.set(primaryEnum, {
      newName: suffix,
      allAliases: Array.from(allAliases),
    })

    console.log(`  ↳ Promoting ${suffix} to PRIMARY (was ${primaryEnum.name}, ${names.length} occurrences)`)

    // Mark other affected enums for removal
    for (let i = 1; i < affectedEnums.length; i++) {
      promotions.set(affectedEnums[i], { newName: '', allAliases: [] }) // Mark for deletion
    }
  }

  // Apply all promotions
  for (const [enumInfo, promotion] of promotions.entries()) {
    if (promotion.newName === '') {
      // Remove this enum (it was consolidated)
      const index = enums.indexOf(enumInfo)
      if (index > -1) {
        enums.splice(index, 1)
      }
    } else {
      // Update the enum name and aliases
      enumInfo.name = promotion.newName
      enumInfo.aliases = promotion.allAliases
      enumInfo.sourcePath = `common suffix (promoted)`
    }
  }
}

/**
 * Generates the content for api-enums.ts file.
 */
function generateApiEnumsContent(enums: EnumInfo[]): string {
  if (enums.length === 0) {
    return `// Auto-generated from OpenAPI specification
// Do not edit this file manually

// No enums found in the OpenAPI specification
`
  }

  // Generate the generic enum helper utility
  const helperUtility = `/**
 * Generic utility for working with enums
 * 
 * @example
 * import { EnumHelper, RequestedValuationType } from './api-enums'
 * 
 * // Get all values
 * const allTypes = EnumHelper.values(RequestedValuationType)
 * 
 * // Validate a value
 * if (EnumHelper.isValid(RequestedValuationType, userInput)) {
 *   // TypeScript knows userInput is RequestedValuationType
 * }
 * 
 * // Reverse lookup
 * const key = EnumHelper.getKey(RequestedValuationType, 'cat') // 'Cat'
 */
export const EnumHelper = {
  /**
   * Get all enum values as an array
   */
  values<T extends Record<string, string | number>>(enumObj: T): Array<T[keyof T]> {
    return Object.values(enumObj) as Array<T[keyof T]>
  },

  /**
   * Get all enum keys as an array
   */
  keys<T extends Record<string, string | number>>(enumObj: T): Array<keyof T> {
    return Object.keys(enumObj) as Array<keyof T>
  },

  /**
   * Check if a value is valid for the given enum
   */
  isValid<T extends Record<string, string | number>>(
    enumObj: T,
    value: unknown,
  ): value is T[keyof T] {
    return typeof value === 'string' && (Object.values(enumObj) as string[]).includes(value)
  },

  /**
   * Get the enum key from a value (reverse lookup)
   */
  getKey<T extends Record<string, string | number>>(enumObj: T, value: T[keyof T]): keyof T | undefined {
    const entry = Object.entries(enumObj).find(([_, v]) => v === value)
    return entry?.[0] as keyof T | undefined
  },
} as const
`

  const enumExports = enums
    .map((enumInfo) => {
      const members = enumInfo.values
        .map((value) => {
          const memberName = toEnumMemberName(value)
          const valueStr = typeof value === 'string' ? `'${value}'` : value
          return `  ${memberName}: ${valueStr} as const,`
        })
        .join('\n')

      let output = `/**
 * Enum values from ${enumInfo.sourcePath}
 */
export const ${enumInfo.name} = {
${members}
} as const

export type ${enumInfo.name} = typeof ${enumInfo.name}[keyof typeof ${enumInfo.name}]
`

      // Generate type aliases for duplicates
      if (enumInfo.aliases && enumInfo.aliases.length > 0) {
        output += '\n// Type aliases for duplicate enum values\n'
        for (const alias of enumInfo.aliases) {
          output += `export const ${alias} = ${enumInfo.name}\n`
          output += `export type ${alias} = ${enumInfo.name}\n`
        }
      }

      return output
    })
    .join('\n')

  return `// Auto-generated from OpenAPI specification
// Do not edit this file manually

${helperUtility}

${enumExports}
`
}

/**
 * Generates the api-enums.ts file from the OpenAPI spec.
 */
async function generateApiEnums(
  openapiContent: string,
  outputDir: string,
  _excludePrefix: string | null = '_deprecated',
): Promise<void> {
  console.log('🔨 Generating api-enums.ts file...')

  const openApiSpec: OpenAPISpec = JSON.parse(openapiContent)
  const enums = extractEnumsFromSpec(openApiSpec)

  const tsContent = generateApiEnumsContent(enums)
  const outputPath = path.join(outputDir, 'api-enums.ts')
  fs.writeFileSync(outputPath, tsContent)

  console.log(`✅ Generated api-enums file: ${outputPath}`)
  console.log(`📊 Found ${enums.length} unique enums`)
}

/**
 * Removes trailing `_schema` or `Schema` suffix from a string (case-insensitive).
 * Examples: `nuts_schema` → `nuts`, `addressSchema` → `address`, `Pet` → `Pet`
 */
function removeSchemaSuffix(name: string): string {
  return name.replace(/(_schema|Schema)$/i, '')
}

/**
 * Generates the content for api-schemas.ts file.
 * Creates type aliases for all schema objects with cleaned names.
 */
function generateApiSchemasContent(openApiSpec: OpenAPISpec): string {
  if (!openApiSpec.components?.schemas || Object.keys(openApiSpec.components.schemas).length === 0) {
    return `// Auto-generated from OpenAPI specification
// Do not edit this file manually

import type { components } from './openapi-types'

// No schemas found in the OpenAPI specification
`
  }

  const header = `// Auto-generated from OpenAPI specification
// Do not edit this file manually

import type { components } from './openapi-types'

/**
 * Type aliases for schema objects from the API spec.
 * These are references to components['schemas'] for convenient importing.
 * 
 * @example
 * import type { Nuts, Address, BorrowerInfo } from './api-schemas'
 * 
 * const nutsData: Nuts = { NUTS_ID: 'BE241', ... }
 */
`

  const schemaExports = Object.keys(openApiSpec.components.schemas)
    .sort()
    .map((schemaName) => {
      // Remove schema suffix and convert to PascalCase
      const cleanedName = removeSchemaSuffix(schemaName)
      const exportedName = toPascalCase(cleanedName)

      // Only add comment if the name changed
      const comment = exportedName !== schemaName ? `// Schema: ${schemaName}\n` : ''

      return `${comment}export type ${exportedName} = components['schemas']['${schemaName}']`
    })
    .join('\n\n')

  return header + '\n' + schemaExports + '\n'
}

/**
 * Generates the api-schemas.ts file from the OpenAPI spec.
 */
async function generateApiSchemas(
  openapiContent: string,
  outputDir: string,
  _excludePrefix: string | null = '_deprecated',
): Promise<void> {
  console.log('🔨 Generating api-schemas.ts file...')

  const openApiSpec: OpenAPISpec = JSON.parse(openapiContent)
  const schemaCount = Object.keys(openApiSpec.components?.schemas ?? {}).length

  const tsContent = generateApiSchemasContent(openApiSpec)
  const outputPath = path.join(outputDir, 'api-schemas.ts')
  fs.writeFileSync(outputPath, tsContent)

  console.log(`✅ Generated api-schemas file: ${outputPath}`)
  console.log(`📊 Found ${schemaCount} schemas`)
}

function generateApiOperationsContent(operationIds: string[], operationInfoMap: Record<string, OperationInfo>): string {
  // Generate operationsBase dictionary
  const operationsBaseContent = operationIds
    .map((id) => {
      const info = operationInfoMap[id]
      return `  ${id}: {\n    path: '${info.path}',\n    method: HttpMethod.${info.method},\n  },`
    })
    .join('\n')

  const queryOperationIds = operationIds.filter((id) => {
    const method = operationInfoMap[id]?.method
    return method === HttpMethod.GET || method === HttpMethod.HEAD || method === HttpMethod.OPTIONS
  })

  const mutationOperationIds = operationIds.filter((id) => {
    const method = operationInfoMap[id]?.method
    return (
      method === HttpMethod.POST ||
      method === HttpMethod.PUT ||
      method === HttpMethod.PATCH ||
      method === HttpMethod.DELETE
    )
  })

  // Generate filtered OperationId enums (source of truth)
  const queryOperationIdContent = queryOperationIds.map((id) => `  ${id}: '${id}' as const,`).join('\n')
  const mutationOperationIdContent = mutationOperationIds.map((id) => `  ${id}: '${id}' as const,`).join('\n')

  // Generate OpType namespace from BOTH lists
  const opTypeContent = [
    ...queryOperationIds.map((id) => `  export type ${id} = typeof QueryOperationId.${id}`),
    ...mutationOperationIds.map((id) => `  export type ${id} = typeof MutationOperationId.${id}`),
  ].join('\n')

  // Generate pre-computed type alias content for Phase 3B
  const queryParamsContent = queryOperationIds.map((id) => `  ${id}: ApiQueryParams<OpType.${id}>`).join('\n')
  const mutationParamsContent = mutationOperationIds.map((id) => `  ${id}: ApiPathParams<OpType.${id}>`).join('\n')
  const mutationBodyContent = mutationOperationIds.map((id) => `  ${id}: ApiRequest<OpType.${id}>`).join('\n')

  return `// Auto-generated from OpenAPI specification
// Do not edit this file manually

import type { operations } from './openapi-types'
import type {
  ApiResponse as ApiResponseBase,
  ApiResponseSafe as ApiResponseSafeBase,
  ApiRequest as ApiRequestBase,
  ApiPathParams as ApiPathParamsBase,
  ApiQueryParams as ApiQueryParamsBase,
} from '@qualisero/openapi-endpoint'

export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
  HEAD = 'HEAD',
  OPTIONS = 'OPTIONS',
  TRACE = 'TRACE',
}

// Create the typed structure that combines operations with operation metadata
// This ensures the debug method returns correct values and all operations are properly typed
const operationsBase = {
${operationsBaseContent}
} as const

// Merge with operations type to maintain OpenAPI type information
export const openApiOperations = operationsBase as typeof operationsBase & Pick<operations, keyof typeof operationsBase>

export type OpenApiOperations = typeof openApiOperations

// Query operations only - use with useQuery() for better autocomplete
export const QueryOperationId = {
${queryOperationIdContent}
} satisfies Partial<Record<keyof typeof operationsBase, keyof typeof operationsBase>>

export type QueryOperationId = keyof typeof QueryOperationId

// Mutation operations only - use with useMutation() for better autocomplete
export const MutationOperationId = {
${mutationOperationIdContent}
} satisfies Partial<Record<keyof typeof operationsBase, keyof typeof operationsBase>>

export type MutationOperationId = keyof typeof MutationOperationId

/**
 * Union type of all operation IDs (queries and mutations).
 * Used for generic type constraints in helper types.
 * @internal
 */
export type AllOperationIds = QueryOperationId | MutationOperationId

// ============================================================================
// Type-safe API Helpers - Use OpType.XXX for type-safe access with intellisense
// ============================================================================

/**
 * Response data type for an API operation.
 * All fields are REQUIRED - no null checks needed.
 * @example
 *   type Response = ApiResponse<OpType.getPet>
 */
export type ApiResponse<K extends AllOperationIds> = ApiResponseBase<OpenApiOperations, K>

/**
 * Response data type with safe typing for unreliable backends.
 * Only readonly properties are required; others may be undefined.
 * @example
 *   type Response = ApiResponseSafe<OpType.getPet>
 */
export type ApiResponseSafe<K extends AllOperationIds> = ApiResponseSafeBase<OpenApiOperations, K>

/**
 * Request body type for a mutation operation.
 * @example
 *   type Request = ApiRequest<OpType.createPet>
 */
export type ApiRequest<K extends AllOperationIds> = ApiRequestBase<OpenApiOperations, K>

/**
 * Path parameters type for an operation.
 * @example
 *   type Params = ApiPathParams<OpType.getPet>
 */
export type ApiPathParams<K extends AllOperationIds> = ApiPathParamsBase<OpenApiOperations, K>

/**
 * Query parameters type for an operation.
 * @example
 *   type Params = ApiQueryParams<OpType.listPets>
 */
export type ApiQueryParams<K extends AllOperationIds> = ApiQueryParamsBase<OpenApiOperations, K>

// ============================================================================
// OpType namespace - enables dot notation: ApiResponse<OpType.getPet>
// ============================================================================

/**
 * Namespace that mirrors operation IDs as types.
 * Enables dot notation syntax: ApiResponse<OpType.getPet>
 *
 * This is the idiomatic TypeScript pattern for enabling dot notation
 * on type-level properties. The namespace is preferred over type aliases
 * because it allows \`OpType.getPet\` instead of \`OpType['getPet']\`.
 *
 * @example
 *   type Response = ApiResponse<OpType.getPet>
 *   type Request = ApiRequest<OpType.createPet>
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace OpType {
${opTypeContent}
}

// ============================================================================
// Pre-Computed Type Aliases - For easier DX and clearer intent
// ============================================================================

/**
 * Query parameters for each query operation.
 * 
 * Use this to get autocomplete on query parameter names and types.
 * 
 * @example
 * \`\`\`typescript
 * const params: QueryParams['listPets'] = { limit: 10, status: 'available' }
 * const query = api.useQuery(QueryOperationId.listPets, { queryParams: params })
 * \`\`\`
 */
export type QueryParams = {
${queryParamsContent}
}

/**
 * Path parameters for each mutation operation.
 * 
 * Use this to get autocomplete on path parameter names and types.
 * 
 * @example
 * \`\`\`typescript
 * const params: MutationParams['updatePet'] = { petId: '123' }
 * const mutation = api.useMutation(MutationOperationId.updatePet, params)
 * \`\`\`
 */
export type MutationParams = {
${mutationParamsContent}
}

/**
 * Request body for each mutation operation.
 * 
 * Use this to get autocomplete on request body properties and types.
 * 
 * @example
 * \`\`\`typescript
 * const body: MutationBody['createPet'] = { name: 'Fluffy', species: 'cat' }
 * await createPet.mutateAsync({ data: body })
 * \`\`\`
 */
export type MutationBody = {
${mutationBodyContent}
}

// ============================================================================
// LEGACY: OperationId (auto-derived from union for backward compatibility)
// ============================================================================
// Use QueryOperationId or MutationOperationId directly for better type safety

/**
 * @deprecated Use QueryOperationId or MutationOperationId instead.
 * Auto-derived from their union for backward compatibility.
 */
export type OperationId = AllOperationIds

/**
 * @deprecated Use QueryOperationId or MutationOperationId instead.
 * Auto-derived from their union for backward compatibility.
 */
export const OperationId = {
  ...QueryOperationId,
  ...MutationOperationId,
} satisfies Record<AllOperationIds, AllOperationIds>
`
}

async function generateApiOperations(
  openapiContent: string,
  outputDir: string,
  excludePrefix: string | null = '_deprecated',
): Promise<void> {
  console.log('🔨 Generating openapi-typed-operations.ts file...')

  const { operationIds, operationInfoMap } = parseOperationsFromSpec(openapiContent, excludePrefix)

  // Generate TypeScript content
  const tsContent = generateApiOperationsContent(operationIds, operationInfoMap)

  // Write to output file
  const outputPath = path.join(outputDir, 'openapi-typed-operations.ts')
  fs.writeFileSync(outputPath, tsContent)

  console.log(`✅ Generated openapi-typed-operations file: ${outputPath}`)
  console.log(`📊 Found ${operationIds.length} operations`)
}

function printUsage(): void {
  console.log(`
Usage: npx @qualisero/openapi-endpoint <openapi-input> <output-directory> [options]

Arguments:
  openapi-input      Path to OpenAPI JSON file or URL to fetch it from
  output-directory   Directory where generated files will be saved

Options:
  --exclude-prefix PREFIX   Exclude operations with operationId starting with PREFIX
                            (default: '_deprecated')
  --no-exclude              Disable operation exclusion (include all operations)
  --help, -h                Show this help message

Examples:
  npx @qualisero/openapi-endpoint ./api/openapi.json ./src/generated
  npx @qualisero/openapi-endpoint https://api.example.com/openapi.json ./src/api
  npx @qualisero/openapi-endpoint ./api.json ./src/gen --exclude-prefix _internal
  npx @qualisero/openapi-endpoint ./api.json ./src/gen --no-exclude

This command will generate:
  - openapi-types.ts              (TypeScript types from OpenAPI spec)
  - openapi-typed-operations.ts   (Operation IDs and info for use with this library)
  - api-enums.ts                  (Type-safe enum objects from OpenAPI spec)
  - api-schemas.ts                (Type aliases for schema objects from OpenAPI spec)
`)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage()
    process.exit(0)
  }

  if (args.length < 2) {
    console.error('❌ Error: At least 2 arguments are required')
    printUsage()
    process.exit(1)
  }

  const [openapiInput, outputDir, ...optionArgs] = args

  // Parse options
  let excludePrefix: string | null = '_deprecated' // default

  for (let i = 0; i < optionArgs.length; i++) {
    if (optionArgs[i] === '--no-exclude') {
      excludePrefix = null
    } else if (optionArgs[i] === '--exclude-prefix') {
      if (i + 1 < optionArgs.length) {
        excludePrefix = optionArgs[i + 1]
        i++ // Skip next arg since we consumed it
      } else {
        console.error('❌ Error: --exclude-prefix requires a value')
        printUsage()
        process.exit(1)
      }
    }
  }

  try {
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
      console.log(`📁 Created output directory: ${outputDir}`)
    }

    // Log exclusion settings
    if (excludePrefix) {
      console.log(`🚫 Excluding operations with operationId prefix: '${excludePrefix}'`)
    } else {
      console.log(`✅ Including all operations (no exclusion filter)`)
    }

    // Fetch OpenAPI spec content
    let openapiContent = await fetchOpenAPISpec(openapiInput)

    // Parse spec and add missing operationIds
    const openApiSpec: OpenAPISpec = JSON.parse(openapiContent)
    addMissingOperationIds(openApiSpec)
    openapiContent = JSON.stringify(openApiSpec, null, 2)

    // Generate all files
    await Promise.all([
      generateTypes(openapiContent, outputDir),
      generateApiOperations(openapiContent, outputDir, excludePrefix),
      generateApiEnums(openapiContent, outputDir, excludePrefix),
      generateApiSchemas(openapiContent, outputDir, excludePrefix),
    ])

    console.log('🎉 Code generation completed successfully!')
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

// Auto-execute main function
main().catch((error) => {
  console.error('❌ Unexpected error:', error)
  process.exit(1)
})
