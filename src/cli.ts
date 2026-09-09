import * as fs from 'fs'
import * as path from 'path'
import * as prettier from 'prettier'
import typescriptPlugin from 'prettier/plugins/typescript'
import estreePlugin from 'prettier/plugins/estree'
import openapiTS, { astToString, COMMENT_HEADER } from 'openapi-typescript'
import { HttpMethod } from './types.js'
import { toPascalCase, buildMemberLabelMap, type EnumCase } from './enum-naming.js'
import { toJsonSchema, collectRefNames } from './json-schema-convert.js'
import { stripRecordStringNeverFromUnions } from './codegen-transforms.js'

/**
 * Prettier options matching the repo's own config (package.json "prettier" field).
 * Applied to every generated TypeScript file so output is lint-clean by construction.
 */
const PRETTIER_TS_OPTIONS: prettier.Options = {
  parser: 'typescript',
  semi: false,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'all',
  printWidth: 120,
  endOfLine: 'lf',
}

/** Format a TypeScript source string with prettier (plugins bundled to avoid dynamic loading). */
async function formatTs(content: string): Promise<string> {
  return prettier.format(content, { ...PRETTIER_TS_OPTIONS, plugins: [estreePlugin, typescriptPlugin] })
}

/**
 * Resolved options for a single codegen run (one spec → one output directory).
 * Shared between the positional-arg CLI path and the config-file path.
 */
interface ResolvedOptions {
  excludePrefix: string | null
  useStrictResponse: boolean
  enumCase: EnumCase
  emitValueSchemasMode: 'request' | 'all' | null
  defaultNonNullable: boolean
}

const DEFAULT_OPTIONS: ResolvedOptions = {
  excludePrefix: '_deprecated',
  useStrictResponse: false,
  enumCase: 'pascal',
  emitValueSchemasMode: null,
  defaultNonNullable: true,
}

/**
 * Shape of openapi-codegen.config.json discovered in the working directory.
 *
 * @example
 * {
 *   "options": { "enumCase": "const", "defaultNonNullable": false },
 *   "specs": [
 *     { "input": "../specs/api.json", "output": "src/api/openapi_generated/api" },
 *     { "input": "../specs/other.json", "output": "src/api/openapi_generated/other", "enumCase": "pascal" }
 *   ]
 * }
 */
interface CodegenConfigOptions {
  enumCase?: EnumCase
  defaultNonNullable?: boolean
  useStrictResponse?: boolean
  /** Prefix of operationIds to exclude. Use JSON `false` to disable prefix exclusion; omit for the default ('_deprecated'). */
  excludePrefix?: string | false
  emitValueSchemas?: 'request' | 'all' | false
}

interface CodegenConfigSpec extends CodegenConfigOptions {
  input: string
  output: string
}

interface CodegenConfig {
  options?: CodegenConfigOptions
  specs: CodegenConfigSpec[]
}

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
  /** OAS extension: set to `true` by the BE finalize pass when dump-direction `required` is fully encoded in the spec (plan §3). */
  'x-direction-finalized'?: boolean
  paths: {
    [path: string]: OpenAPIPath
  }
  components?: {
    schemas?: Record<string, OpenAPISchema>
    requestBodies?: Record<string, OpenAPIBodyObject>
    responses?: Record<string, OpenAPIBodyObject>
  }
}

/**
 * A requestBody or response object: either a one-level `$ref` into
 * `components.requestBodies` / `components.responses`, or an inline object
 * with a media-type content map.
 */
interface OpenAPIBodyObject {
  $ref?: string
  content?: Record<string, { schema?: OpenAPISchema } | undefined>
}

interface OpenAPISchema {
  type?: string
  enum?: (string | number)[]
  $ref?: string
  properties?: Record<string, OpenAPISchema>
  items?: OpenAPISchema
  [key: string]: unknown
}

// Matches any JSON-compatible media type: application/json and application/*+json
// structured-syntax suffixes, with optional parameters (e.g. '; charset=utf-8')
const JSON_MEDIA_TYPE_RE = /^application\/(.+\+)?json\s*(;.*)?$/i

/**
 * Select the JSON media-type object from a content map with deterministic
 * priority: exact `application/json` first, else the first JSON-compatible
 * media type in document order (e.g. 'application/json; charset=utf-8',
 * 'application/vnd.api+json').
 */
function selectJsonMedia(
  content: Record<string, { schema?: OpenAPISchema } | undefined> | undefined,
): { schema?: OpenAPISchema } | undefined {
  if (!content) return undefined
  if (content['application/json']) return content['application/json']
  for (const [mediaType, media] of Object.entries(content)) {
    if (JSON_MEDIA_TYPE_RE.test(mediaType)) return media
  }
  return undefined
}

/**
 * Resolve a requestBody/response object one `$ref` level deep against
 * `components.requestBodies` / `components.responses`. Returns `undefined`
 * for unresolvable refs (external, dangling, or nested `$ref` targets).
 */
function derefBodyObject(
  body: OpenAPIBodyObject | undefined,
  components: OpenAPISpec['components'],
): OpenAPIBodyObject | undefined {
  if (!body || typeof body.$ref !== 'string') return body
  const m = /^#\/components\/(requestBodies|responses)\/(.+)$/.exec(body.$ref)
  const resolved = m ? components?.[m[1] as 'requestBodies' | 'responses']?.[m[2]] : undefined
  // One level only: a resolved object that is itself a $ref is not followed
  return resolved && typeof resolved.$ref !== 'string' ? resolved : undefined
}

/**
 * Shared JSON-schema extraction for requestBody/response objects across all
 * generators: one-level `$ref` deref, then JSON media-type selection.
 */
function getJsonBodySchema(openApiSpec: OpenAPISpec, body: OpenAPIBodyObject | undefined): OpenAPISchema | undefined {
  return selectJsonMedia(derefBodyObject(body, openApiSpec.components)?.content)?.schema
}

interface OperationInfo {
  path: string
  method: HttpMethod
  summary?: string
  description?: string
  pathParams?: Array<{ name: string; type: string }>
  queryParams?: Array<{ name: string; type: string }>
  requestBodySchema?: string // Schema name like "NewPet"
  responseSchema?: string // Schema name like "Pet"
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

async function generateTypes(openApiSpec: OpenAPISpec, outputDir: string, defaultNonNullable: boolean): Promise<void> {
  console.log('🔨 Generating TypeScript types using openapi-typescript...')

  const typesOutputPath = path.join(outputDir, 'openapi-types.ts')
  const ast = await openapiTS(openApiSpec as unknown as Parameters<typeof openapiTS>[0], { defaultNonNullable })
  const raw = COMMENT_HEADER + astToString(ast)
  // Strip Record<string, never> sentinel from union types (openapi-typescript
  // rendering artifact for empty-properties schemas in anyOf/oneOf groups).
  const stripped = stripRecordStringNeverFromUnions(raw)
  if (stripped !== raw) {
    console.log('✅ Stripped Record<string, never> sentinel from union types')
  }
  const content = await formatTs(stripped)
  fs.writeFileSync(typesOutputPath, content)
  console.log(`✅ Generated types file: ${typesOutputPath}`)
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

function _parseOperationsFromSpec(
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
 * Helper function to add enum values to the enums list with deduplication.
 * If a duplicate is found, it adds the new name as an alias instead of creating a separate enum.
 *
 * The dedup key is order-sensitive: enums are only merged when they declare the same values in
 * the same order. `enumValues` is never mutated here, so generated members keep the exact order
 * declared in the OpenAPI spec (e.g. `low`, `medium`, `high` stays semantically ordered).
 */
function addEnumIfUnique(
  enumName: string,
  enumValues: (string | number)[],
  sourcePath: string,
  enums: EnumInfo[],
  seenEnumValues: Map<string, string>,
): void {
  const valuesKey = JSON.stringify(enumValues)

  // Check if we've seen this exact list of values before
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
 * 1. components.schemas and their properties (inline enum or $ref to enum schema)
 * 2. Operation parameters (query, header, path, cookie)
 * Deduplicates by comparing enum value sets.
 */
function extractEnumsFromSpec(openApiSpec: OpenAPISpec): EnumInfo[] {
  const enums: EnumInfo[] = []
  const seenEnumValues = new Map<string, string>() // Maps JSON stringified values -> enum name (for deduplication)

  // Build lookup of schemas that ARE enums (have enum property on the schema itself)
  const schemaEnumLookup: Map<string, (string | number)[]> = new Map()
  if (openApiSpec.components?.schemas) {
    for (const [schemaName, schema] of Object.entries(openApiSpec.components.schemas)) {
      if (schema.enum && Array.isArray(schema.enum)) {
        const enumValues = (schema.enum as (string | number | null)[]).filter((v) => v !== null) as (string | number)[]
        if (enumValues.length > 0) {
          schemaEnumLookup.set(schemaName, enumValues)
        }
      }
    }
  }

  // Export enum schemas directly from components.schemas
  // This MUST come before property/parameter extraction so the schema name becomes primary
  // and operation-specific generated names become aliases
  for (const [schemaName, enumValues] of schemaEnumLookup) {
    addEnumIfUnique(schemaName, enumValues, `components.schemas.${schemaName}`, enums, seenEnumValues)
  }

  // Helper to resolve enum values from a schema (inline or $ref)
  function resolveEnumValues(schema: OpenAPISchema): (string | number)[] | null {
    // Inline enum
    if (schema.enum && Array.isArray(schema.enum)) {
      const enumValues = (schema.enum as (string | number | null)[]).filter((v) => v !== null) as (string | number)[]
      return enumValues.length > 0 ? enumValues : null
    }
    // $ref to an enum schema
    if (typeof schema.$ref === 'string') {
      const refName = schema.$ref.split('/').pop()!
      return schemaEnumLookup.get(refName) ?? null
    }
    return null
  }

  // Extract from components.schemas
  if (openApiSpec.components?.schemas) {
    for (const [schemaName, schema] of Object.entries(openApiSpec.components.schemas)) {
      if (!schema.properties) continue

      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const enumValues = resolveEnumValues(propSchema)
        if (!enumValues) continue

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

            if (!paramName || !paramIn || !paramSchema) continue

            const enumValues = resolveEnumValues(paramSchema)
            if (!enumValues) continue

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
function generateApiEnumsContent(enums: EnumInfo[], style: EnumCase): string {
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
 * const key = EnumHelper.getKey(RequestedValuationType, 'cat') // '${style === 'const' ? 'CAT' : 'Cat'}'
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
      // Use buildMemberLabelMap so duplicate values are deduped (same path as the collision check).
      // includeNull: true mirrors what generateApiEnumsContent would emit; null values are
      // already absent here because extractEnumsFromSpec strips them upstream.
      const isRealPath = /^(components|paths)\./.test(enumInfo.sourcePath ?? '')
      const ctx = isRealPath ? `${enumInfo.name} (${enumInfo.sourcePath})` : enumInfo.name
      const labelMap = buildMemberLabelMap(enumInfo.values, style, ctx, { includeNull: true })
      const members = [...labelMap.entries()]
        .map(([label, value]) => {
          const valueStr = typeof value === 'string' ? `'${value}'` : value === null ? 'null' : value
          return `  ${label}: ${valueStr} as const,`
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

      // Generate type aliases for duplicates (skip self-aliases where alias === primary name)
      if (enumInfo.aliases && enumInfo.aliases.length > 0) {
        const nonSelfAliases = enumInfo.aliases.filter((alias) => alias !== enumInfo.name)
        if (nonSelfAliases.length > 0) {
          output += '\n// Type aliases for duplicate enum values\n'
          for (const alias of nonSelfAliases) {
            output += `export const ${alias} = ${enumInfo.name}\n`
            output += `export type ${alias} = ${enumInfo.name}\n`
          }
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
  style: EnumCase,
): Promise<void> {
  console.log('🔨 Generating api-enums.ts file...')

  const openApiSpec: OpenAPISpec = JSON.parse(openapiContent)
  const enums = extractEnumsFromSpec(openApiSpec)

  const tsContent = await formatTs(generateApiEnumsContent(enums, style))
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
 * Computes the set of component schema names reachable from any 2xx response body
 * (transitive $ref closure). Used to filter the Responses namespace and to tag
 * request-only schemas with appropriate @deprecated guidance.
 */
function computeResponseReachableSchemas(openApiSpec: OpenAPISpec, excludePrefix: string | null): Set<string> {
  const rawSchemas = openApiSpec.components?.schemas ?? {}
  const reachable = new Set<string>()
  for (const [_pathUrl, pathItem] of Object.entries(openApiSpec.paths)) {
    for (const [method, rawOp] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.includes(method as (typeof HTTP_METHODS)[number])) continue
      const op = rawOp as OpenAPIOperation & { responses?: Record<string, OpenAPIBodyObject> }
      if (!op.operationId) continue
      if (excludePrefix && op.operationId.startsWith(excludePrefix)) continue
      const responses = op.responses
      if (!responses) continue
      for (const [statusCode, response] of Object.entries(responses)) {
        const code = parseInt(statusCode, 10)
        if (!isNaN(code) && code >= 200 && code < 300) {
          const schema = getJsonBodySchema(openApiSpec, response)
          if (schema) {
            for (const name of collectRefNames(schema, rawSchemas)) {
              reachable.add(name)
            }
          }
        }
      }
    }
  }
  return reachable
}

/**
 * Builds a map of schema name → list of "opId (response|items)" labels for all
 * direct-$ref and array-items-$ref 2xx response bodies.
 */
function buildSchemaResponseRefs(
  openApiSpec: OpenAPISpec,
  operationMap: Record<string, OperationInfo>,
): Map<string, string[]> {
  const refs = new Map<string, string[]>()
  const addRef = (name: string, label: string) => {
    if (!refs.has(name)) refs.set(name, [])
    refs.get(name)!.push(label)
  }
  for (const [_pathUrl, pathItem] of Object.entries(openApiSpec.paths)) {
    for (const [method, rawOp] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.includes(method as (typeof HTTP_METHODS)[number])) continue
      const op = rawOp as OpenAPIOperation & { responses?: Record<string, OpenAPIBodyObject> }
      if (!op.operationId || !(op.operationId in operationMap)) continue
      const responses = op.responses
      if (!responses) continue
      for (const statusCode of ['200', '201', '202', '203', '204', '206']) {
        const bodySchema = getJsonBodySchema(openApiSpec, responses[statusCode])
        if (!bodySchema) continue
        if (bodySchema.$ref) {
          const name = bodySchema.$ref.split('/').pop()!
          addRef(name, `${op.operationId} (response)`)
        } else if (bodySchema.type === 'array' && bodySchema.items?.$ref) {
          const name = bodySchema.items.$ref.split('/').pop()!
          addRef(name, `${op.operationId} (items)`)
        }
        break
      }
    }
  }
  return refs
}

/**
 * Builds a map of schema name → list of operationIds that reference the schema
 * as a request body (across all media types including multipart).
 */
function buildSchemaRequestBodyRefs(
  openApiSpec: OpenAPISpec,
  operationMap: Record<string, OperationInfo>,
): Map<string, string[]> {
  const refs = new Map<string, string[]>()
  for (const [_pathUrl, pathItem] of Object.entries(openApiSpec.paths)) {
    for (const [method, rawOp] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.includes(method as (typeof HTTP_METHODS)[number])) continue
      const op = rawOp as OpenAPIOperation & { requestBody?: OpenAPIBodyObject }
      if (!op.operationId || !(op.operationId in operationMap)) continue
      const requestBody = op.requestBody
      if (!requestBody) continue
      const resolved = derefBodyObject(requestBody, openApiSpec.components)
      if (!resolved?.content) continue
      const seen = new Set<string>()
      for (const mediaObj of Object.values(resolved.content)) {
        const schemaRef = mediaObj?.schema?.$ref
        if (typeof schemaRef !== 'string') continue
        const name = schemaRef.split('/').pop()!
        if (seen.has(name)) continue
        seen.add(name)
        if (!refs.has(name)) refs.set(name, [])
        refs.get(name)!.push(op.operationId)
      }
    }
  }
  return refs
}

/**
 * Generates the content for api-schemas.ts file.
 * Emits a direction-typed Responses namespace (response-reachable schemas only,
 * wrapped in RequireAll) and bare aliases with @deprecated tags (plan 1b).
 */
function generateApiSchemasContent(openApiSpec: OpenAPISpec, excludePrefix: string | null): string {
  if (!openApiSpec.components?.schemas || Object.keys(openApiSpec.components.schemas).length === 0) {
    return `// Auto-generated from OpenAPI specification
// Do not edit this file manually

// No schemas found in the OpenAPI specification
`
  }

  const RESERVED_EXPORT_NAMES = new Set(['Error'])
  const rawSchemas = openApiSpec.components.schemas
  const operationMap = buildOperationMap(openApiSpec, excludePrefix)

  const enumSchemaNames = new Set<string>()
  for (const [schemaName, schema] of Object.entries(rawSchemas)) {
    if (schema.enum && Array.isArray(schema.enum)) {
      enumSchemaNames.add(schemaName)
    }
  }

  const nonEnumSchemas = Object.keys(rawSchemas)
    .sort()
    .filter((name) => !enumSchemaNames.has(name))

  const responseReachable = computeResponseReachableSchemas(openApiSpec, excludePrefix)
  const responseRefs = buildSchemaResponseRefs(openApiSpec, operationMap)
  const requestBodyRefs = buildSchemaRequestBodyRefs(openApiSpec, operationMap)

  // Responses namespace — response-reachable non-enum schemas only
  const responseSchemas = nonEnumSchemas.filter((name) => responseReachable.has(name))
  const responsesNsEntries = responseSchemas
    .map((schemaName) => {
      const cleanedName = removeSchemaSuffix(schemaName)
      const exportedName = toPascalCase(cleanedName)
      const safeExportedName = RESERVED_EXPORT_NAMES.has(exportedName) ? `${exportedName}Schema` : exportedName
      const directRefs = responseRefs.get(schemaName) ?? []
      const jsdoc =
        directRefs.length > 0
          ? `  /** Referenced by: ${directRefs.join(', ')} */
  export type ${safeExportedName} = RequireAll<components['schemas']['${schemaName}']>`
          : `  export type ${safeExportedName} = RequireAll<components['schemas']['${schemaName}']>`
      return jsdoc
    })
    .join('\n\n')

  const responsesNamespace =
    responseSchemas.length > 0
      ? `export namespace Responses {
${responsesNsEntries}
}`
      : `// No response-reachable schemas found`

  // Bare aliases with @deprecated tags
  const bareAliases = nonEnumSchemas
    .map((schemaName) => {
      const cleanedName = removeSchemaSuffix(schemaName)
      const exportedName = toPascalCase(cleanedName)
      const safeExportedName = RESERVED_EXPORT_NAMES.has(exportedName) ? `${exportedName}Schema` : exportedName
      const schemaComment = safeExportedName !== schemaName ? `// Schema: ${schemaName}\n` : ''

      let deprecatedTag: string
      if (responseReachable.has(schemaName)) {
        deprecatedTag = `/** @deprecated Use Responses.${safeExportedName} instead. */\n`
      } else {
        const reqOps = requestBodyRefs.get(schemaName) ?? []
        if (reqOps.length > 0) {
          const typeRefs = reqOps.map((op) => `Types.${op}.Request`).join(', ')
          deprecatedTag = `/** @deprecated Use ${typeRefs} instead. */\n`
        } else {
          deprecatedTag = `/** @deprecated This schema has no direction-typed replacement. */\n`
        }
      }

      return `${schemaComment}${deprecatedTag}export type ${safeExportedName} = components['schemas']['${schemaName}']`
    })
    .join('\n\n')

  const header = `/* eslint-disable */
// Auto-generated from OpenAPI specification
// Do not edit this file manually

import type { components } from './openapi-types'
import type { RequireAll } from '@qualisero/openapi-endpoint'

/**
 * Direction-typed schema aliases generated from the OpenAPI spec.
 *
 * ## Responses namespace
 * Contains only the **response-reachable** component set \u2014 the transitive $ref
 * closure seeded from all operation response bodies. Each member is wrapped in
 * \`RequireAll<T>\`, asserting that the API serialises every documented field
 * (same policy as \`ApiResponse\` / \`Types.<opId>.Response\`).
 * For spec-fidelity without the serialise-everything assumption, use
 * \`Types.<opId>.StrictResponse\` instead.
 *
 * ## Bare aliases (below)
 * Direction-blind: they expose \`components['schemas']\` without a presence policy.
 * Kept for one minor cycle with \`@deprecated\` tags indicating the direction-typed
 * replacement. They will be removed in the next major release.
 *
 * ## Request direction
 * Request bodies are operation-shaped. Use \`Types.<opId>.Request\` \u2014 there is
 * intentionally no \`Requests\` namespace.
 *
 * @example
 * import type { Responses } from './api-schemas'
 * const pet: Responses.Pet = response.data
 */
`

  return header + '\n' + responsesNamespace + '\n\n' + bareAliases + '\n'
}

/**
 * Generates the api-schemas.ts file from the OpenAPI spec.
 */
async function generateApiSchemas(
  openapiContent: string,
  outputDir: string,
  excludePrefix: string | null = '_deprecated',
): Promise<void> {
  console.log('🔨 Generating api-schemas.ts file...')

  const openApiSpec: OpenAPISpec = JSON.parse(openapiContent)
  const schemaCount = Object.keys(openApiSpec.components?.schemas ?? {}).length

  const tsContent = await formatTs(generateApiSchemasContent(openApiSpec, excludePrefix))
  const outputPath = path.join(outputDir, 'api-schemas.ts')
  fs.writeFileSync(outputPath, tsContent)

  console.log(`✅ Generated api-schemas file: ${outputPath}`)
  console.log(`📊 Found ${schemaCount} schemas`)
}

// ============================================================================
// List path computation (ported from openapi-helpers.ts for code-gen time use)
// ============================================================================

const PLURAL_ES_SUFFIXES_CLI = ['s', 'x', 'z', 'ch', 'sh', 'o'] as const

function pluralizeResourceCli(name: string): string {
  if (name.endsWith('y')) return name.slice(0, -1) + 'ies'
  if (PLURAL_ES_SUFFIXES_CLI.some((s) => name.endsWith(s))) return name + 'es'
  return name + 's'
}

/**
 * Computes the list path for a mutation operation (used for cache invalidation).
 * Returns null if no matching list operation is found.
 */
function computeListPath(
  operationId: string,
  opInfo: OperationInfo,
  operationMap: Record<string, OperationInfo>,
): string | null {
  const method = opInfo.method
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return null

  const prefixes: Partial<Record<HttpMethod, string>> = {
    [HttpMethod.POST]: 'create',
    [HttpMethod.PUT]: 'update',
    [HttpMethod.PATCH]: 'update',
    [HttpMethod.DELETE]: 'delete',
  }
  const prefix = prefixes[method]
  if (!prefix) return null

  let resourceName: string | null = null
  if (operationId.startsWith(prefix)) {
    const remaining = operationId.slice(prefix.length)
    if (remaining.length > 0 && /^[A-Z]/.test(remaining)) resourceName = remaining
  }

  if (resourceName) {
    const tryList = (name: string): string | null => {
      const listId = `list${name}`
      if (listId in operationMap && operationMap[listId].method === HttpMethod.GET) return operationMap[listId].path
      return null
    }
    const found = tryList(resourceName) || tryList(pluralizeResourceCli(resourceName))
    if (found) return found
  }

  // Fallback: strip last path param segment
  const segments = opInfo.path.split('/').filter((s) => s.length > 0)
  if (segments.length >= 2 && /^\{[^}]+\}$/.test(segments[segments.length - 1])) {
    return '/' + segments.slice(0, -1).join('/') + '/'
  }
  return null
}

// ============================================================================
// New generator: api-client.ts
// ============================================================================

/**
 * Generate JSDoc comment for an operation function.
 */
function _generateOperationJSDoc(operationId: string, method: string, apiPath: string): string {
  const methodUpper = method.toUpperCase()
  const isQuery = ['GET', 'HEAD', 'OPTIONS'].includes(methodUpper)

  const lines = ['/**', ` * ${operationId}`, ' * ', ` * ${methodUpper} ${apiPath}`]

  if (isQuery) {
    lines.push(' * ')
    lines.push(' * @param pathParams - Path parameters (reactive)')
    lines.push(' * @param options - Query options (enabled, staleTime, onLoad, etc.)')
    lines.push(' * @returns Query result with data, isLoading, refetch(), etc.')
  } else {
    lines.push(' * ')
    lines.push(' * @param pathParams - Path parameters (reactive)')
    lines.push(' * @param options - Mutation options (onSuccess, onError, invalidateOperations, etc.)')
    lines.push(' * @returns Mutation helper with mutate() and mutateAsync() methods')
  }

  lines.push(' */')
  return lines.join('\n')
}

function generateApiClientContent(operationMap: Record<string, OperationInfo>, useStrictResponse = false): string {
  const ids = Object.keys(operationMap).sort()
  const QUERY_HTTP = new Set(['GET', 'HEAD', 'OPTIONS'])
  const isQuery = (id: string) => QUERY_HTTP.has(operationMap[id].method)
  const hasPathParams = (id: string) => operationMap[id].path.includes('{')

  // Registry for invalidateOperations support
  const registryEntries = ids.map((id) => `  ${id}: { path: '${operationMap[id].path}' },`).join('\n')

  // Response type to use for ALL operations (queries and mutations)
  const responseType = useStrictResponse ? 'ApiResponseStrict' : 'ApiResponse'

  // Generic factory helpers (4 patterns)
  const helpers = `/**
 * Generic query helper for operations without path parameters.
 * @internal
 */
function _queryNoParams<Op extends AllOps>(
  base: _Config,
  cfg: { path: string; method: HttpMethod; listPath: string | null; operationId?: string },
  enums: Record<string, unknown>,
) {
  type Response = ${responseType}<Op>
  type QueryParams = ApiQueryParams<Op>
  type ErrorData = ApiErrorData<Op>

  const useQuery = (
    options?: QueryOptions<Response, QueryParams, ErrorData>,
  ): QueryReturn<Response, Record<string, never>, ErrorData> =>
    useEndpointQuery<Response, Record<string, never>, QueryParams, ErrorData>(
      { ...base, ...cfg },
      undefined,
      options,
    )

  const useLazyQuery = (
    options?: Omit<QueryOptions<Response, QueryParams, ErrorData>, 'queryParams' | 'onLoad' | 'enabled'>,
  ): LazyQueryReturn<Response, Record<string, never>, QueryParams, ErrorData> =>
    useEndpointLazyQuery<Response, Record<string, never>, QueryParams, ErrorData>(
      { ...base, ...cfg },
      undefined,
      options,
    )

  return {
    /**
     * Query hook for this operation.
     *
     * Returns an object with:
     * - \`data\`: The response data
     * - \`isLoading\`: Whether the query is loading
     * - \`error\`: Error object if the query failed
     * - \`refetch\`: Function to manually trigger a refetch
     * - \`isPending\`: Alias for isLoading
     * - \`status\`: 'pending' | 'error' | 'success'
     *
     * @param options - Query options (enabled, refetchInterval, etc.)
     * @returns Query result object
     */
    useQuery,
    /**
     * Lazy query hook for this operation.
     *
     * Returns an object with:
     * - \`data\`: The response data
     * - \`isPending\`: True while a fetch is in progress
     * - \`isSuccess\`: True after at least one successful fetch
     * - \`isError\`: True after a failed fetch
     * - \`error\`: The error from the last failed fetch
     * - \`fetch\`: Execute the query imperatively
     *
     * @param options - Lazy query options (staleTime, errorHandler, axiosOptions)
     * @returns Lazy query result object
     */
    useLazyQuery,
    /**
     * Build a URL string for this operation without executing a fetch.
     *
     * Synchronous; only accepts plain values. Only flat scalar query params
     * are supported (see \`buildUrl\`). The axios \`baseURL\` is read at call time.
     *
     * @param queryParams - Optional flat query parameters to append.
     * @returns Full URL string.
     */
    urlFor: (queryParams?: QueryParams): string =>
      buildUrl(base.axios.defaults.baseURL, cfg.path, undefined, queryParams),
    enums,
  } as const
}

/**
 * Generic query helper for operations with path parameters.
 * @internal
 */
function _queryWithParams<Op extends AllOps>(
  base: _Config,
  cfg: { path: string; method: HttpMethod; listPath: string | null; operationId?: string },
  enums: Record<string, unknown>,
) {
  type PathParams = ApiPathParams<Op>
  type PathParamsInput = ApiPathParamsInput<Op>
  type Response = ${responseType}<Op>
  type QueryParams = ApiQueryParams<Op>
  type ErrorData = ApiErrorData<Op>

  // Two-overload interface: non-function (exact via object-literal checking) +
  // getter function (exact via NoExcessReturn constraint).
  type _UseQuery = {
    (
      pathParams: PathParamsInput | Ref<PathParamsInput> | ComputedRef<PathParamsInput>,
      options?: QueryOptions<Response, QueryParams, ErrorData>,
    ): QueryReturn<Response, PathParams, ErrorData>
    <F extends () => PathParamsInput>(
      pathParams: NoExcessReturn<PathParamsInput, F>,
      options?: QueryOptions<Response, QueryParams, ErrorData>,
    ): QueryReturn<Response, PathParams, ErrorData>
  }

  type _UseLazyQuery = {
    (
      pathParams: PathParamsInput | Ref<PathParamsInput> | ComputedRef<PathParamsInput>,
      options?: Omit<QueryOptions<Response, QueryParams, ErrorData>, 'queryParams' | 'onLoad' | 'enabled'>,
    ): LazyQueryReturn<Response, PathParams, QueryParams, ErrorData>
    <F extends () => PathParamsInput>(
      pathParams: NoExcessReturn<PathParamsInput, F>,
      options?: Omit<QueryOptions<Response, QueryParams, ErrorData>, 'queryParams' | 'onLoad' | 'enabled'>,
    ): LazyQueryReturn<Response, PathParams, QueryParams, ErrorData>
  }

  const _impl = (
    pathParams: ReactiveOr<PathParamsInput>,
    options?: QueryOptions<Response, QueryParams, ErrorData>,
  ): QueryReturn<Response, PathParams, ErrorData> =>
    useEndpointQuery<Response, PathParams, QueryParams, ErrorData>(
      { ...base, ...cfg },
      pathParams as _PathParamsCast,
      options,
    )

  const _lazyImpl = (
    pathParams: ReactiveOr<PathParamsInput>,
    options?: Omit<QueryOptions<Response, QueryParams, ErrorData>, 'queryParams' | 'onLoad' | 'enabled'>,
  ): LazyQueryReturn<Response, PathParams, QueryParams, ErrorData> =>
    useEndpointLazyQuery<Response, PathParams, QueryParams, ErrorData>(
      { ...base, ...cfg },
      pathParams as _PathParamsCast,
      options,
    )

  return {
    /**
     * Query hook for this operation.
     *
     * Returns an object with:
     * - \`data\`: The response data
     * - \`isLoading\`: Whether the query is loading
     * - \`error\`: Error object if the query failed
     * - \`refetch\`: Function to manually trigger a refetch
     * - \`isPending\`: Alias for isLoading
     * - \`status\`: 'pending' | 'error' | 'success'
     *
     * @param pathParams - Path parameters (object, ref, computed, or getter function)
     * @param options - Query options (enabled, refetchInterval, etc.)
     * @returns Query result object
     */
    useQuery: _impl as _UseQuery,
    /**
     * Lazy query hook for this operation.
     *
     * Returns an object with:
     * - \`data\`: The response data
     * - \`isPending\`: True while a fetch is in progress
     * - \`isSuccess\`: True after at least one successful fetch
     * - \`isError\`: True after a failed fetch
     * - \`error\`: The error from the last failed fetch
     * - \`fetch\`: Execute the query imperatively
     *
     * @param pathParams - Path parameters (object, ref, computed, or getter function)
     * @param options - Lazy query options (staleTime, errorHandler, axiosOptions)
     * @returns Lazy query result object
     */
    useLazyQuery: _lazyImpl as _UseLazyQuery,
    /**
     * Build a URL string for this operation without executing a fetch.
     *
     * Useful when a URL is needed directly — e.g. for <img :src>, anchor hrefs,
     * or any context where the browser/native element handles the request.
     *
     * Unlike \`useQuery\`, \`urlFor\` is synchronous and only accepts plain values —
     * not refs, computed, or getter functions. Wrap in \`computed(...)\` for reactivity.
     *
     * Only flat scalar query params are supported (see \`buildUrl\`).
     * The axios \`baseURL\` is read at call time.
     *
     * @param pathParams  - Path parameters to substitute into the URL template (plain object).
     * @param queryParams - Optional flat query parameters to append.
     * @returns Full URL string.
     *
     * @example
     * const url = api.getAssetDocumentFile.urlFor(
     *   { asset_id: assetId, document_ref: doc.document_ref },
     *   { view: true }
     * )
     */
    urlFor: (pathParams: PathParamsInput, queryParams?: QueryParams): string =>
      buildUrl(base.axios.defaults.baseURL, cfg.path, pathParams, queryParams),
    enums,
  } as const
}

/**
 * Generic mutation helper for operations without path parameters.
 * @internal
 */
function _mutationNoParams<Op extends AllOps>(
  base: _Config,
  cfg: { path: string; method: HttpMethod; listPath: string | null; operationId?: string },
  enums: Record<string, unknown>,
) {
  type RequestBody = ApiRequest<Op>
  type Response = ${responseType}<Op>
  type QueryParams = ApiQueryParams<Op>
  type ErrorData = ApiErrorData<Op>

  const useMutation = (
    options?: MutationOptions<Response, Record<string, never>, RequestBody, QueryParams, ErrorData>,
  ): MutationReturn<Response, Record<string, never>, RequestBody, QueryParams, ErrorData> =>
    useEndpointMutation<Response, Record<string, never>, RequestBody, QueryParams, ErrorData>(
      { ...base, ...cfg },
      undefined,
      options,
    )

  return {
    /**
     * Mutation hook for this operation.
     *
     * Returns an object with:
     * - \`mutate\`: Synchronous mutation function (returns void)
     * - \`mutateAsync\`: Async mutation function (returns Promise)
     * - \`data\`: The response data
     * - \`isLoading\`: Whether the mutation is in progress
     * - \`error\`: Error object if the mutation failed
     * - \`isPending\`: Alias for isLoading
     * - \`status\`: 'idle' | 'pending' | 'error' | 'success'
     *
     * @param options - Mutation options (onSuccess, onError, etc.)
     * @returns Mutation result object
     */
    useMutation,
    enums,
  } as const
}

/**
 * Generic mutation helper for operations with path parameters.
 * @internal
 */
function _mutationWithParams<Op extends AllOps>(
  base: _Config,
  cfg: { path: string; method: HttpMethod; listPath: string | null; operationId?: string },
  enums: Record<string, unknown>,
) {
  type PathParams = ApiPathParams<Op>
  type PathParamsInput = ApiPathParamsInput<Op>
  type RequestBody = ApiRequest<Op>
  type Response = ${responseType}<Op>
  type QueryParams = ApiQueryParams<Op>
  type ErrorData = ApiErrorData<Op>

  // Three-overload interface:
  // 1. Deferred path params — omit or pass undefined/null; supply at mutateAsync() time via pathParams variable
  // 2. Eager path params — object, Ref, or ComputedRef (exact via object-literal checking)
  // 3. Getter function — exact via NoExcessReturn constraint
  type _UseMutation = {
    (
      pathParams?: undefined | null,
      options?: MutationOptions<Response, PathParams, RequestBody, QueryParams, ErrorData>,
    ): MutationReturn<Response, PathParams, RequestBody, QueryParams, ErrorData>
    (
      pathParams: PathParamsInput | Ref<PathParamsInput> | ComputedRef<PathParamsInput>,
      options?: MutationOptions<Response, PathParams, RequestBody, QueryParams, ErrorData>,
    ): MutationReturn<Response, PathParams, RequestBody, QueryParams, ErrorData>
    <F extends () => PathParamsInput>(
      pathParams: NoExcessReturn<PathParamsInput, F>,
      options?: MutationOptions<Response, PathParams, RequestBody, QueryParams, ErrorData>,
    ): MutationReturn<Response, PathParams, RequestBody, QueryParams, ErrorData>
  }

  const _impl = (
    pathParams: ReactiveOr<PathParamsInput> | undefined | null,
    options?: MutationOptions<Response, PathParams, RequestBody, QueryParams, ErrorData>,
  ): MutationReturn<Response, PathParams, RequestBody, QueryParams, ErrorData> =>
    useEndpointMutation<Response, PathParams, RequestBody, QueryParams, ErrorData>(
      { ...base, ...cfg },
      pathParams as _PathParamsCast,
      options,
    )

  return {
    /**
     * Mutation hook for this operation.
     *
     * Returns an object with:
     * - \`mutate\`: Synchronous mutation function (returns void)
     * - \`mutateAsync\`: Async mutation function (returns Promise)
     * - \`data\`: The response data
     * - \`isLoading\`: Whether the mutation is in progress
     * - \`error\`: Error object if the mutation failed
     * - \`isPending\`: Alias for isLoading
     * - \`status\`: 'idle' | 'pending' | 'error' | 'success'
     *
     * @param pathParams - Path parameters (object, ref, computed, getter function, or undefined/null for deferred supply at call time)
     * @param options - Mutation options (onSuccess, onError, etc.)
     * @returns Mutation result object
     */
    useMutation: _impl as _UseMutation,
    enums,
  } as const
}`

  // createApiClient factory with operation calls
  const factoryCalls = ids
    .map((id) => {
      const op = operationMap[id]
      const { path: apiPath, method } = op
      const listPath = computeListPath(id, op, operationMap)
      const listPathStr = listPath ? `'${listPath}'` : 'null'
      const query = isQuery(id)
      const withParams = hasPathParams(id)

      const cfg = `{ path: '${apiPath}', method: HttpMethod.${method}, listPath: ${listPathStr}, operationId: '${id}' }`
      const helper = query
        ? withParams
          ? '_queryWithParams'
          : '_queryNoParams'
        : withParams
          ? '_mutationWithParams'
          : '_mutationNoParams'

      // Build JSDoc comment
      const docLines: string[] = []

      // Summary/description
      if (op.summary) {
        docLines.push(op.summary)
      }
      if (op.description && op.description !== op.summary) {
        docLines.push(op.description)
      }

      // Path parameters
      if (op.pathParams && op.pathParams.length > 0) {
        const paramList = op.pathParams.map((p) => `${p.name}: ${p.type}`).join(', ')
        docLines.push(`@param pathParams - { ${paramList} }`)
      }

      // Request body
      if (op.requestBodySchema) {
        docLines.push(`@param body - Request body type: ${op.requestBodySchema}`)
      }

      // Response
      if (op.responseSchema) {
        docLines.push(`@returns Response type: ${op.responseSchema}`)
      }

      const jsDoc = docLines.length > 0 ? `\n    /**\n     * ${docLines.join('\n     * ')}\n     */` : ''

      return `${jsDoc}\n    ${id}: ${helper}<'${id}'>(base, ${cfg}, ${id}_enums),`
    })
    .join('')

  // Enum imports
  const enumImports = ids.map((id) => `  ${id}_enums,`).join('\n')

  // Type alias for AllOps
  const allOpsType = `type AllOps = keyof operations`

  return `// Auto-generated from OpenAPI specification - do not edit manually
// Use \`createApiClient\` to instantiate a fully-typed API client.

import type { AxiosInstance } from 'axios'
import type { Ref, ComputedRef } from 'vue'
import {
  useEndpointQuery,
  useEndpointMutation,
  useEndpointLazyQuery,
  defaultQueryClient,
  HttpMethod,
  buildUrl,
  type QueryOptions,
  type MutationOptions,
  type QueryReturn,
  type MutationReturn,
  type LazyQueryReturn,
  type ReactiveOr,
  type NoExcessReturn,
  type MaybeRefOrGetter,
} from '@qualisero/openapi-endpoint'

import type { QueryClient } from '@tanstack/vue-query'

import type {
  ApiResponse${useStrictResponse ? ',\n  ApiResponseStrict' : ''},
  ApiRequest,
  ApiPathParams,
  ApiPathParamsInput,
  ApiQueryParams,
  ApiErrorData,
  operations,
} from './api-operations.js'

import {
${enumImports}
} from './api-operations.js'

// ============================================================================
// Operations registry (for invalidateOperations support)
// ============================================================================

const _registry = {
${registryEntries}
} as const

// ============================================================================
// Internal config type
// ============================================================================

type _Config = {
  axios: AxiosInstance
  queryClient: QueryClient
  operationsRegistry: typeof _registry
}

// ============================================================================
// Type alias for path params cast (avoids repetition)
// ============================================================================

type _PathParamsCast = MaybeRefOrGetter<Record<string, string | number | undefined> | null | undefined>

// ============================================================================
// Type alias for all operations
// ============================================================================

${allOpsType}

// ============================================================================
// Shared generic factory helpers (4 patterns)
// ============================================================================

${helpers}

// ============================================================================
// Public API client factory
// ============================================================================

/**
 * Create a fully-typed API client.
 *
 * Each operation in the spec is a property of the returned object:
 * - GET/HEAD/OPTIONS → \`api.opName.useQuery(...)\`
 * - POST/PUT/PATCH/DELETE → \`api.opName.useMutation(...)\`
 * - All operations → \`api.opName.enums.fieldName.Value\`
 *
 * @example
 * \`\`\`ts
 * import { createApiClient } from './generated/api-client'
 * import axios from 'axios'
 *
 * const api = createApiClient(axios.create({ baseURL: '/api' }))
 *
 * // In a Vue component:
 * const { data: pets } = api.listPets.useQuery()
 * const create = api.createPet.useMutation()
 * create.mutate({ data: { name: 'Fluffy' } })
 * \`\`\`
 */
export function createApiClient(axios: AxiosInstance, queryClient: QueryClient = defaultQueryClient) {
  const base: _Config = { axios, queryClient, operationsRegistry: _registry }
  return {
${factoryCalls}
  } as const
}

/** The fully-typed API client instance type. */
export type ApiClient = ReturnType<typeof createApiClient>
`
}

async function generateApiClientFile(
  openApiSpec: OpenAPISpec,
  outputDir: string,
  excludePrefix: string | null,
  useStrictResponse = false,
): Promise<void> {
  const operationMap = buildOperationMap(openApiSpec, excludePrefix)
  const content = await formatTs(generateApiClientContent(operationMap, useStrictResponse))
  fs.writeFileSync(path.join(outputDir, 'api-client.ts'), content)
  console.log(`✅ Generated api-client.ts (${Object.keys(operationMap).length} operations)`)
}

// ============================================================================

function printUsage(): void {
  console.log(`
Usage: npx @qualisero/openapi-endpoint <openapi-input> <output-directory> [options]
       npx @qualisero/openapi-endpoint   (no args: discovers openapi-codegen.config.json in cwd)

Config-file mode:
  Create openapi-codegen.config.json in your project root to codegen multiple specs in one
  invocation. Running with no arguments discovers and uses the config automatically.

  Example openapi-codegen.config.json:
    {
      "options": { "enumCase": "const", "defaultNonNullable": false },
      "specs": [
        { "input": "../specs/api.json", "output": "src/api/openapi_generated/api" },
        { "input": "../specs/other.json", "output": "src/api/openapi_generated/other" }
      ]
    }

  The "options" block sets shared defaults for all specs. Each spec entry can override
  any option. CLI flags (e.g. --enum-case) only apply in positional-arg mode.

Arguments:
  openapi-input      Path to OpenAPI JSON file or URL to fetch it from
  output-directory   Directory where generated files will be saved

Options:
  --exclude-prefix PREFIX       Exclude operations with operationId starting with PREFIX
                                (default: '_deprecated', use 'false' to disable)
  --use-strict-response         Use ApiResponseStrict for responses (only readonly/required fields required)
                                (default: false; when disabled, ALL fields required)
  --enum-case STYLE             Casing style for generated enum member labels (default: pascal)
                                'pascal' = PascalCase labels (e.g. Available, InProgress): default, byte-identical to prior versions
                                'const'  = CONSTANT_CASE / SCREAMING_SNAKE_CASE labels (e.g. AVAILABLE, IN_PROGRESS)
                                Changes only code-level label names; the values sent to the API are unchanged.
                                Label collisions abort codegen; re-run without this flag or fix the spec.
  --emit-value-schemas [MODE]   Emit api-value-schemas.ts with portable JSON Schema data for use with AJV
                                (with ajv-formats registered), JSONForms, react-jsonschema-form, etc.
                                format keywords are emitted by design. (default: off)
                                'request' = emit requestSchemas only (default when flag is present)
                                'all'     = emit requestSchemas + first 2xx responseSchemas per operation
  --default-non-nullable BOOL   Whether openapi-typescript treats properties with a 'default' as non-optional
                                (default: true — current behaviour; will flip to false in the next major version)
                                Only sound for responses ("the server fills the default"). For request bodies,
                                defaultNonNullable:true makes PATCH group fields non-optional, which is incorrect.
                                Pass 'false' to opt in to the future default: schema-declared optionality is kept.
  --help, -h                    Show this help message

Examples:
  npx @qualisero/openapi-endpoint ./api/openapi.json ./src/generated
  npx @qualisero/openapi-endpoint https://api.example.com/openapi.json ./src/api
  npx @qualisero/openapi-endpoint ./api.json ./src/gen --exclude-prefix _internal
  npx @qualisero/openapi-endpoint ./api.json ./src/gen --exclude-prefix false
  npx @qualisero/openapi-endpoint ./api.json ./src/gen --use-strict-response true
  npx @qualisero/openapi-endpoint ./api.json ./src/gen --enum-case const
  npx @qualisero/openapi-endpoint ./api.json ./src/gen --emit-value-schemas
  npx @qualisero/openapi-endpoint ./api.json ./src/gen --emit-value-schemas all

This command will generate:
  - openapi-types.ts        (TypeScript types from OpenAPI spec)
  - api-client.ts           (Fully-typed createApiClient factory — main file to use)
  - api-operations.ts       (Operations map + type aliases)
  - api-types.ts            (Types namespace for type-only access)
  - api-enums.ts            (Type-safe enum objects from OpenAPI spec)
  - api-schemas.ts          (Type aliases for schema objects from OpenAPI spec)
  - api-value-schemas.ts    (JSON Schema data for validation/forms — only with --emit-value-schemas)

Response Typing (--use-strict-response):
  By default, ApiResponse makes ALL fields required for all endpoint responses
  (GET, POST, PUT, PATCH, DELETE). This assumes the API always returns all fields
  regardless of how they're marked in the OpenAPI spec.

  When --use-strict-response is enabled, ApiResponseStrict is used instead, which
  only marks fields as required if they are:
  - readonly (server-generated fields like 'id'), OR
  - marked as required in the OpenAPI spec
  All other fields remain optional.

  Note: readonly only affects REQUEST BODIES (mutations), not response types.
  Request bodies always exclude readonly fields (client cannot set them).
`)
}

// ============================================================================
// New helper functions for operation-named API
// ============================================================================

/**
 * Parses an already-loaded OpenAPISpec into a map of operationId → OperationInfo.
 * @param openApiSpec The parsed OpenAPI spec object
 * @param excludePrefix Operations with this prefix are excluded
 * @returns Map of operation ID to { path, method }
 */
function buildOperationMap(openApiSpec: OpenAPISpec, excludePrefix: string | null): Record<string, OperationInfo> {
  const map: Record<string, OperationInfo> = {}

  for (const [pathUrl, pathItem] of Object.entries(openApiSpec.paths)) {
    for (const [method, rawOp] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.includes(method as (typeof HTTP_METHODS)[number])) continue
      const op = rawOp as OpenAPIOperation & {
        summary?: string
        description?: string
        parameters?: Array<{ name: string; in: string; schema?: { type?: string; $ref?: string } }>
        requestBody?: OpenAPIBodyObject
        responses?: Record<string, OpenAPIBodyObject>
      }
      if (!op.operationId) continue
      if (excludePrefix && op.operationId.startsWith(excludePrefix)) continue

      // Extract path and query parameters
      const pathParams: Array<{ name: string; type: string }> = []
      const queryParams: Array<{ name: string; type: string }> = []
      if (op.parameters) {
        for (const param of op.parameters) {
          const type = param.schema?.type || 'string'
          if (param.in === 'path') {
            pathParams.push({ name: param.name, type })
          } else if (param.in === 'query') {
            queryParams.push({ name: param.name, type })
          }
        }
      }

      // Extract request body schema
      let requestBodySchema: string | undefined
      const reqBodyRef = getJsonBodySchema(openApiSpec, op.requestBody)?.$ref
      if (reqBodyRef) {
        requestBodySchema = reqBodyRef.split('/').pop()
      }

      // Extract response schema (from 200/201 responses)
      let responseSchema: string | undefined
      if (op.responses) {
        for (const statusCode of ['200', '201']) {
          const resRef = getJsonBodySchema(openApiSpec, op.responses[statusCode])?.$ref
          if (resRef) {
            responseSchema = resRef.split('/').pop()
            break
          }
        }
      }

      map[op.operationId] = {
        path: pathUrl,
        method: method.toUpperCase() as HttpMethod,
        summary: op.summary,
        description: op.description,
        pathParams: pathParams.length > 0 ? pathParams : undefined,
        queryParams: queryParams.length > 0 ? queryParams : undefined,
        requestBodySchema,
        responseSchema,
      }
    }
  }

  return map
}

/**
 * Converts an OpenAPI enum array to `{ MemberName: 'value' }`.
 * @param values Enum values (may include null)
 * @returns Object with PascalCase keys and string literal values
 */
function enumArrayToObject(
  values: (string | number | null)[],
  style: EnumCase,
  context: string,
): Record<string, string> {
  const labelMap = buildMemberLabelMap(values, style, context, { includeNull: false })
  const obj: Record<string, string> = {}
  for (const [label, value] of labelMap) {
    obj[label] = String(value)
  }
  return obj
}

/**
 * For each operation, extract enum fields from:
 *  1. Request body object properties (direct `enum` or `$ref` to an enum schema)
 *  2. Query and path parameters with `enum`
 * @param openApiSpec The parsed OpenAPI spec
 * @param operationMap Map from buildOperationMap
 * @returns operationId → { fieldName → { MemberName: 'value' } }
 */
function buildOperationEnums(
  openApiSpec: OpenAPISpec,
  operationMap: Record<string, OperationInfo>,
  style: EnumCase,
): Record<string, Record<string, Record<string, string>>> {
  // Schema-level enum lookup: schemaName → { MemberName: value }
  const schemaEnumLookup: Record<string, Record<string, string>> = {}
  if (openApiSpec.components?.schemas) {
    for (const [schemaName, schema] of Object.entries(openApiSpec.components.schemas)) {
      if (schema.enum) {
        schemaEnumLookup[schemaName] = enumArrayToObject(schema.enum, style, `components.schemas.${schemaName}`)
      }
    }
  }

  function resolveEnums(schema: OpenAPISchema, context: string): Record<string, string> | null {
    if (schema.enum) return enumArrayToObject(schema.enum, style, context)
    if (typeof schema.$ref === 'string') {
      const name = schema.$ref.split('/').pop()!
      return schemaEnumLookup[name] ?? null
    }
    return null
  }

  const result: Record<string, Record<string, Record<string, string>>> = {}

  for (const [_pathUrl, pathItem] of Object.entries(openApiSpec.paths)) {
    for (const [method, rawOp] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.includes(method as (typeof HTTP_METHODS)[number])) continue
      const op = rawOp as OpenAPIOperation & {
        requestBody?: OpenAPIBodyObject
        parameters?: Array<{ name: string; in: string; schema?: OpenAPISchema }>
      }
      if (!op.operationId || !(op.operationId in operationMap)) continue

      const fields: Record<string, Record<string, string>> = {}

      // Request body properties
      const bodyProps = getJsonBodySchema(openApiSpec, op.requestBody)?.properties
      if (bodyProps) {
        for (const [fieldName, fieldSchema] of Object.entries(bodyProps)) {
          const resolved = resolveEnums(fieldSchema, `${op.operationId}.${fieldName}`)
          if (resolved) fields[fieldName] = resolved
        }
      }

      // Query + path parameters
      for (const param of op.parameters ?? []) {
        if (param.schema) {
          const resolved = resolveEnums(param.schema, `${op.operationId}.${param.name}`)
          if (resolved) fields[param.name] = resolved
        }
      }

      result[op.operationId] = fields
    }
  }

  return result
}

// ============================================================================
// New generators: api-operations.ts
// ============================================================================

/**
 * Generates the content for `api-operations.ts` file.
 * @param operationMap The operation info map
 * @param opEnums Per-operation enum fields
 * @param schemaEnumNames Names from api-enums.ts to re-export
 * @returns Generated TypeScript file content
 */
function generateApiOperationsContent(
  operationMap: Record<string, OperationInfo>,
  opEnums: Record<string, Record<string, Record<string, string>>>,
  schemaEnumNames: string[],
): string {
  const ids = Object.keys(operationMap).sort()
  const _queryIds = ids.filter((id) => ['GET', 'HEAD', 'OPTIONS'].includes(operationMap[id].method))
  const _mutationIds = ids.filter((id) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(operationMap[id].method))

  // Per-operation enum consts
  const enumConsts = ids
    .map((id) => {
      const fields = opEnums[id] ?? {}
      const body = Object.entries(fields)
        .map(([field, vals]) => {
          const members = Object.entries(vals)
            .map(([k, v]) => `    ${k}: ${JSON.stringify(v)} as const,`)
            .join('\n')
          return `  ${field}: {\n${members}\n  } as const,`
        })
        .join('\n')
      return `export const ${id}_enums = {\n${body}\n} as const`
    })
    .join('\n\n')

  // Operations map
  const opEntries = ids
    .map((id) => `  ${id}: { path: '${operationMap[id].path}', method: HttpMethod.${operationMap[id].method} },`)
    .join('\n')

  // Type helpers — now use openapi-typescript `operations` directly (not OpenApiOperations)
  const typeHelpers = `
type AllOps = keyof operations

/** Response data type (ALL fields required - default). */
export type ApiResponse<K extends AllOps> = _ApiResponse<operations, K>
/** Response data type (only readonly/required fields required - strict mode). */
export type ApiResponseStrict<K extends AllOps> = _ApiResponseStrict<operations, K>
/** Request body type. */
export type ApiRequest<K extends AllOps> = _ApiRequest<operations, K>
/** Path parameters type. */
export type ApiPathParams<K extends AllOps> = _ApiPathParams<operations, K>
/** Path parameters input type (allows undefined values for reactive resolution). */
export type ApiPathParamsInput<K extends AllOps> = _ApiPathParamsInput<operations, K>
/** Query parameters type. */
export type ApiQueryParams<K extends AllOps> = _ApiQueryParams<operations, K>
/** Error data type (union of JSON bodies from 4xx / 5xx / default responses). */
export type ApiErrorData<K extends AllOps> = _ApiErrorData<operations, K>
/** AxiosError typed to this operation's error body. */
export type ApiError<K extends AllOps> = _ApiErrorOf<operations, K>`

  // Re-exports
  // Use type-only wildcard export to avoid duplicate identifier errors
  const reExports =
    schemaEnumNames.length > 0
      ? schemaEnumNames.map((n) => `export { ${n} } from './api-enums'`).join('\n') +
        "\nexport type * from './api-enums'"
      : '// No schema-level enums to re-export'

  return `// Auto-generated from OpenAPI specification - do not edit manually

import type { operations } from './openapi-types'
import { HttpMethod } from '@qualisero/openapi-endpoint'
import type {
  ApiResponse as _ApiResponse,
  ApiResponseStrict as _ApiResponseStrict,
  ApiRequest as _ApiRequest,
  ApiPathParams as _ApiPathParams,
  ApiPathParamsInput as _ApiPathParamsInput,
  ApiQueryParams as _ApiQueryParams,
  ApiErrorData as _ApiErrorData,
  ApiErrorOf as _ApiErrorOf,
} from '@qualisero/openapi-endpoint'

export type { operations }

${reExports}

// ============================================================================
// Per-operation enum values
// ============================================================================

${enumConsts}

// ============================================================================
// Operations map (kept for inspection / backward compatibility)
// ============================================================================

const operationsBase = {
${opEntries}
} as const

export const openApiOperations = operationsBase as typeof operationsBase & Pick<operations, keyof typeof operationsBase>
export type OpenApiOperations = typeof openApiOperations

// ============================================================================
// Convenience type aliases
// ============================================================================
${typeHelpers}
`
}

/**
 * Async wrapper for generateApiOperationsContent.
 */
async function generateApiOperationsFile(
  openApiSpec: OpenAPISpec,
  outputDir: string,
  excludePrefix: string | null,
  schemaEnumNames: string[],
  style: EnumCase,
): Promise<void> {
  console.log('🔨 Generating api-operations.ts...')
  const operationMap = buildOperationMap(openApiSpec, excludePrefix)
  const opEnums = buildOperationEnums(openApiSpec, operationMap, style)
  const content = await formatTs(generateApiOperationsContent(operationMap, opEnums, schemaEnumNames))
  fs.writeFileSync(path.join(outputDir, 'api-operations.ts'), content)
  console.log(`✅ Generated api-operations.ts (${Object.keys(operationMap).length} operations)`)
}

// ============================================================================
// New generators: api-types.ts
// ============================================================================

/**
 * Generates the content for `api-types.ts` file.
 * @param operationMap The operation info map
 * @param opEnums Per-operation enum fields
 * @returns Generated TypeScript file content
 */
function generateApiTypesContent(
  operationMap: Record<string, OperationInfo>,
  opEnums: Record<string, Record<string, Record<string, string>>>,
): string {
  const ids = Object.keys(operationMap).sort()
  const isQuery = (id: string) => ['GET', 'HEAD', 'OPTIONS'].includes(operationMap[id].method)

  const namespaces = ids
    .map((id) => {
      const info = operationMap[id]
      const query = isQuery(id)
      const fields = opEnums[id] ?? {}
      const { responseSchema, requestBodySchema, method, path: opPath } = info

      const enumTypes = Object.entries(fields)
        .map(([fieldName, vals]) => {
          const typeName = fieldName.charAt(0).toUpperCase() + fieldName.slice(1)
          const union = Object.values(vals)
            .map((v) => `'${v}'`)
            .join(' | ')
          return `      /** \`${union}\` */\n      export type ${typeName} = ${union}`
        })
        .join('\n')

      const responseSrc = responseSchema
        ? ` Source: components['schemas']['${responseSchema}'] (${method} ${opPath})`
        : ''
      const requestSrc = requestBodySchema
        ? ` Source: components['schemas']['${requestBodySchema}'] (${method} ${opPath})`
        : ''

      const commonLines = [
        `    /**\n     * Response type \u2014 ALL fields required via RequireAll<T> (default, transitional).\n     *\n     * This is a stopgap for specs that do not yet encode dump-direction \`required\`:\n     * it asserts the API serialises every documented field, which may not be true\n     * when a backend serialiser omits fields without a \`dump_default\`.\n     *\n     * When the spec carries \`x-direction-finalized: true\`, presence policy is already\n     * encoded as spec-side \`required\` and RequireAll is a no-op \u2014 Response \u2261 StrictResponse.\n     * Use StrictResponse for spec-faithful optionality; in a later major the duality\n     * collapses and this alias is dropped for finalized specs.${responseSrc}\n     */`,
        `    export type Response       = _ApiResponse<OpenApiOperations, '${id}'>`,
        `    /**\n     * Response type \u2014 only \`readonly\`/\`required\` fields are required (spec-faithful).\n     *\n     * Reflects the spec as written: optional fields stay optional, readonly fields\n     * (server-generated) are required, and required fields are required.\n     *\n     * When the spec carries \`x-direction-finalized: true\`, this type is equivalent\n     * to Response (the transitional duality collapses). Prefer this type for\n     * spec fidelity; it becomes the sole type for finalized specs in a later major.${responseSrc}\n     */`,
        `    export type StrictResponse = _ApiResponseStrict<OpenApiOperations, '${id}'>`,
      ]
      if (!query) {
        commonLines.push(
          `    /** Request body type.${requestSrc} */`,
          `    export type Request      = _ApiRequest<OpenApiOperations, '${id}'>`,
        )
      }
      commonLines.push(
        `    /** Path parameters. */`,
        `    export type PathParams   = _ApiPathParams<OpenApiOperations, '${id}'>`,
        `    /** Query parameters. */`,
        `    export type QueryParams  = _ApiQueryParams<OpenApiOperations, '${id}'>`,
      )

      const enumNs = enumTypes ? `    export namespace Enums {\n${enumTypes}\n    }` : `    export namespace Enums {}`

      return `  export namespace ${id} {\n${commonLines.join('\n')}\n${enumNs}\n  }`
    })
    .join('\n\n')

  return `/* eslint-disable */
// Auto-generated from OpenAPI specification — do not edit manually

import type {
  ApiResponse as _ApiResponse,
  ApiResponseStrict as _ApiResponseStrict,
  ApiRequest as _ApiRequest,
  ApiPathParams as _ApiPathParams,
  ApiQueryParams as _ApiQueryParams,
} from '@qualisero/openapi-endpoint'
import type { operations as OpenApiOperations } from './openapi-types'

/**
 * Type-only namespace for all API operations.
 *
 * @example
 * \`\`\`ts
 * import type { Types } from './generated/api-types'
 *
 * type Pet       = Types.getPet.Response
 * type NewPet    = Types.createPet.Request
 * type PetStatus = Types.createPet.Enums.Status   // 'available' | 'pending' | 'adopted'
 * type Params    = Types.getPet.PathParams         // { petId: string }
 * \`\`\`
 */
export namespace Types {
${namespaces}
}
`
}

/**
 * Async wrapper for generateApiTypesContent.
 */
async function generateApiTypesFile(
  openApiSpec: OpenAPISpec,
  outputDir: string,
  excludePrefix: string | null,
  style: EnumCase,
): Promise<void> {
  console.log('🔨 Generating api-types.ts...')
  const operationMap = buildOperationMap(openApiSpec, excludePrefix)
  const opEnums = buildOperationEnums(openApiSpec, operationMap, style)
  const content = await formatTs(generateApiTypesContent(operationMap, opEnums))
  fs.writeFileSync(path.join(outputDir, 'api-types.ts'), content)
  console.log(`✅ Generated api-types.ts`)
}

// ============================================================================
// New generator: api-value-schemas.ts
// ============================================================================

/**
 * Generates the content for `api-value-schemas.ts`.
 *
 * @param openApiSpec  Parsed OpenAPI spec
 * @param excludePrefix  Operations with this prefix are excluded (same filter as other generators)
 * @param mode  'request' — only request schemas emitted; 'all' — also emits first 2xx response schema
 */
function generateApiValueSchemasContent(
  openApiSpec: OpenAPISpec,
  excludePrefix: string | null,
  mode: 'request' | 'all',
): string {
  const rawSchemas = openApiSpec.components?.schemas ?? {}

  const requestSchemasMap: Record<string, unknown> = {}
  const responseSchemasMap: Record<string, unknown> = {}
  const allReferencedNames = new Set<string>()

  /**
   * Collect shared-component ref names from a converted entry, skipping names
   * defined in the entry's own $defs (those refs resolve locally, so they must
   * not trigger the dangling-$ref warning or pull in same-named components).
   */
  const addReferencedNames = (converted: unknown): void => {
    const entry = converted as { $defs?: unknown }
    const localDefs =
      typeof entry === 'object' && entry !== null && typeof entry.$defs === 'object' && entry.$defs !== null
        ? (entry.$defs as Record<string, unknown>)
        : {}
    const localNames = new Set(Object.keys(localDefs))
    for (const name of localNames) {
      if (Object.prototype.hasOwnProperty.call(rawSchemas, name)) {
        console.warn(
          `⚠️  Value schema warning: entry-local $defs name '${name}' collides with a component schema — refs to '#/$defs/${name}' resolve to the entry-local definition after resolveSchema()`,
        )
      }
    }
    collectRefNames(converted, rawSchemas).forEach((n) => {
      if (!localNames.has(n)) allReferencedNames.add(n)
    })
  }

  for (const [_pathUrl, pathItem] of Object.entries(openApiSpec.paths)) {
    for (const [method, rawOp] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.includes(method as (typeof HTTP_METHODS)[number])) continue
      const op = rawOp as OpenAPIOperation & {
        requestBody?: OpenAPIBodyObject
        responses?: Record<string, OpenAPIBodyObject>
      }
      if (!op.operationId) continue
      if (excludePrefix && op.operationId.startsWith(excludePrefix)) continue

      // Request body schema (one-level $ref deref + JSON media-type selection)
      const reqBodySchema = getJsonBodySchema(openApiSpec, op.requestBody)
      if (reqBodySchema) {
        const converted = toJsonSchema(reqBodySchema)
        requestSchemasMap[op.operationId] = converted
        addReferencedNames(converted)
      } else if (op.requestBody) {
        // Non-JSON media types only, an unresolvable/nested $ref, or no content
        console.warn(
          `⚠️  Value schema warning: operation '${op.operationId}' has a requestBody without an extractable JSON schema — skipped from requestSchemas`,
        )
      }

      // First 2xx application/json response schema (only when mode === 'all')
      if (mode === 'all' && op.responses) {
        const twoxxCodes = Object.keys(op.responses)
          // Lexicographic compare is correct for all valid OpenAPI status keys:
          // '2XX' wildcards are intentionally admitted, and concrete codes sort before them.
          .filter((c) => c >= '200' && c < '300')
          .sort()
        let emitted = false
        for (const code of twoxxCodes) {
          const resSchema = getJsonBodySchema(openApiSpec, op.responses[code])
          if (resSchema) {
            const converted = toJsonSchema(resSchema)
            responseSchemasMap[op.operationId] = converted
            addReferencedNames(converted)
            emitted = true
            break
          }
        }
        if (!emitted) {
          // Warn only when something was actually skipped: an unresolvable $ref,
          // or content (after one-level deref) with no extractable JSON schema.
          // Content-less responses (e.g. 204) have nothing to emit — no warning.
          const skipped = twoxxCodes.some((code) => {
            const raw = op.responses?.[code]
            if (!raw) return false
            const resolved = derefBodyObject(raw, openApiSpec.components)
            if (!resolved) return true // dangling, external, or nested $ref
            const content = resolved.content
            return typeof content === 'object' && content !== null && Object.keys(content).length > 0
          })
          if (skipped) {
            console.warn(
              `⚠️  Value schema warning: operation '${op.operationId}' has a 2xx response without an extractable JSON schema — skipped from responseSchemas`,
            )
          }
        }
      }
    }
  }

  // Build schemaDefs: transitively referenced component schemas, converted and sorted
  const schemaDefs: Record<string, unknown> = {}
  for (const name of [...allReferencedNames].sort()) {
    if (Object.prototype.hasOwnProperty.call(rawSchemas, name)) {
      schemaDefs[name] = toJsonSchema(rawSchemas[name])
    } else {
      console.warn(
        `⚠️  Value schema warning: ref '#/$defs/${name}' collected but '${name}' is not in components.schemas — emitted schema will have a dangling $ref`,
      )
    }
  }

  const schemaDefsJson = JSON.stringify(schemaDefs, null, 2)
  const requestSchemasJson = JSON.stringify(requestSchemasMap, null, 2)
  // responseSchemasMap is only populated when mode === 'all'
  const responseSchemasJson = JSON.stringify(responseSchemasMap, null, 2)

  return `// Auto-generated from OpenAPI specification - do not edit manually

import type { operations } from './openapi-types'
import type { ValueSchema, SchemaDefs } from '@qualisero/openapi-endpoint'

export const schemaDefs: SchemaDefs = ${schemaDefsJson}

export const requestSchemas: Partial<Record<keyof operations, ValueSchema>> = ${requestSchemasJson}

export const responseSchemas: Partial<Record<keyof operations, ValueSchema>> = ${responseSchemasJson}
`
}

/**
 * Async wrapper for generateApiValueSchemasContent.
 */
async function generateApiValueSchemasFile(
  openApiSpec: OpenAPISpec,
  outputDir: string,
  excludePrefix: string | null,
  mode: 'request' | 'all',
): Promise<void> {
  console.log('🔨 Generating api-value-schemas.ts...')
  const content = await formatTs(generateApiValueSchemasContent(openApiSpec, excludePrefix, mode))
  fs.writeFileSync(path.join(outputDir, 'api-value-schemas.ts'), content)
  console.log(`✅ Generated api-value-schemas.ts`)
}

/**
 * Validates that no two distinct non-enum schema names map to the same exported alias
 * after schema-suffix removal, PascalCase conversion, and reserved-name suffixing.
 * Runs before any file is written so a collision aborts codegen with zero output.
 * Throws with a descriptive message naming the colliding schema names and the resulting alias.
 */
function assertNoSchemaAliasCollisions(openApiSpec: OpenAPISpec): void {
  if (!openApiSpec.components?.schemas) return

  // Build set of enum schema names to skip (mirrors the filter in generateApiSchemasContent)
  const enumSchemaNames = new Set<string>()
  for (const [schemaName, schema] of Object.entries(openApiSpec.components.schemas)) {
    if (schema.enum && Array.isArray(schema.enum)) {
      enumSchemaNames.add(schemaName)
    }
  }

  const RESERVED_EXPORT_NAMES = new Set(['Error'])
  const aliasToSource = new Map<string, string>()

  for (const schemaName of Object.keys(openApiSpec.components.schemas)) {
    if (enumSchemaNames.has(schemaName)) continue

    const cleanedName = removeSchemaSuffix(schemaName)
    const exportedName = toPascalCase(cleanedName)
    const safeExportedName = RESERVED_EXPORT_NAMES.has(exportedName) ? `${exportedName}Schema` : exportedName

    if (aliasToSource.has(safeExportedName)) {
      const existing = aliasToSource.get(safeExportedName)!
      throw new Error(
        `Schema alias collision: schemas "${existing}" and "${schemaName}" both map to exported alias "${safeExportedName}". ` +
          `Rename one of the schemas in the spec.`,
      )
    }
    aliasToSource.set(safeExportedName, schemaName)
  }
}

/**
 * Validates that no two distinct spec values map to the same label under the given style.
 * Runs before any file is written so a collision aborts codegen with zero output.
 * Throws with a descriptive message naming the colliding values, the collapsed label,
 * the context, and a remediation hint.
 */
function assertNoEnumLabelCollisions(openApiSpec: OpenAPISpec, excludePrefix: string | null, style: EnumCase): void {
  // Check schema-level enums as generateApiEnumsContent would.
  // includeNull: true mirrors the generator; null values are already absent because
  // extractEnumsFromSpec strips them upstream, so this makes no practical difference
  // but keeps the two code paths in sync if that filter ever changes.
  // Context uses the enum name for promoted enums (sourcePath = 'common suffix (promoted)')
  // and 'name (sourcePath)' for real schema/path enums so collisions are easy to locate.
  const schemaEnums = extractEnumsFromSpec(openApiSpec)
  for (const enumInfo of schemaEnums) {
    const isRealPath = /^(components|paths)\./.test(enumInfo.sourcePath ?? '')
    const ctx = isRealPath ? `${enumInfo.name} (${enumInfo.sourcePath})` : enumInfo.name
    buildMemberLabelMap(enumInfo.values, style, ctx, { includeNull: true })
  }

  // Check operation-level inline enums as buildOperationEnums would (includeNull: false)
  const operationMap = buildOperationMap(openApiSpec, excludePrefix)
  buildOperationEnums(openApiSpec, operationMap, style)
}

/**
 * Detects the x-direction-finalized root marker (plan §3) and logs an advisory notice.
 *
 * When the spec producer stamps this key, presence policy is fully encoded as dump-direction
 * `required` in the spec. In that case:
 * - RequireAll used by ApiResponse is a no-op over fully-required schemas (harmless).
 * - --use-strict-response is redundant (Response ≡ StrictResponse for this spec).
 *
 * No behaviour change is made; this is log-only in the 0.28.x cycle.
 * The duality collapses (RequireAll wrapper dropped) in the later major gated on this marker.
 */
function logDirectionFinalizedNotice(openApiSpec: OpenAPISpec, useStrictResponse: boolean): void {
  if (openApiSpec['x-direction-finalized'] !== true) return
  console.log(
    `ℹ️  Spec marker x-direction-finalized: true — presence policy is spec-side (dump-direction required encoded in spec).`,
  )
  console.log(`   ApiResponse's RequireAll wrapper is a no-op over fully-required schemas for this spec.`)
  if (!useStrictResponse) {
    console.log(
      `   --use-strict-response is redundant for this spec: Response ≡ StrictResponse when x-direction-finalized.`,
    )
  }
}

/**
 * Core generation pipeline for a single spec. All CLI paths (positional args and config-file)
 * converge here.
 */
async function generateForSpec(openapiInput: string, outputDir: string, opts: ResolvedOptions): Promise<void> {
  const { excludePrefix, useStrictResponse, enumCase, emitValueSchemasMode, defaultNonNullable } = opts

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
    console.log(`📁 Created output directory: ${outputDir}`)
  }

  // Fetch and parse OpenAPI spec once
  const openapiContent = await fetchOpenAPISpec(openapiInput)
  const openApiSpec: OpenAPISpec = JSON.parse(openapiContent)

  // §3 marker detection: log advisory when spec encodes presence policy natively (log-only; no behaviour change)
  logDirectionFinalizedNotice(openApiSpec, useStrictResponse)

  // Add missing operationIds
  addMissingOperationIds(openApiSpec)
  const openapiContentWithIds = JSON.stringify(openApiSpec, null, 2)

  // Collect schema enum names for re-export
  const schemaEnumNames = extractEnumsFromSpec(openApiSpec).map((e) => e.name)

  // Fail fast: detect collisions before any file is written
  assertNoSchemaAliasCollisions(openApiSpec)
  assertNoEnumLabelCollisions(openApiSpec, excludePrefix, enumCase)

  // Generate all files
  await Promise.all([
    generateTypes(openApiSpec, outputDir, defaultNonNullable),
    generateApiEnums(openapiContentWithIds, outputDir, excludePrefix, enumCase),
    generateApiSchemas(openapiContentWithIds, outputDir, excludePrefix),
    generateApiOperationsFile(openApiSpec, outputDir, excludePrefix, schemaEnumNames, enumCase),
    generateApiTypesFile(openApiSpec, outputDir, excludePrefix, enumCase),
    generateApiClientFile(openApiSpec, outputDir, excludePrefix, useStrictResponse),
    ...(emitValueSchemasMode !== null
      ? [generateApiValueSchemasFile(openApiSpec, outputDir, excludePrefix, emitValueSchemasMode)]
      : []),
  ])
}

/**
 * Parse a CodegenConfigOptions object (from config file or per-spec overrides) into a
 * ResolvedOptions, merging over a base set of defaults.
 */
function mergeConfigOptions(base: ResolvedOptions, overrides: CodegenConfigOptions): ResolvedOptions {
  const result = { ...base }
  if (overrides.enumCase !== undefined) result.enumCase = overrides.enumCase
  if (overrides.defaultNonNullable !== undefined) result.defaultNonNullable = overrides.defaultNonNullable
  if (overrides.useStrictResponse !== undefined) result.useStrictResponse = overrides.useStrictResponse
  if (overrides.excludePrefix !== undefined) {
    result.excludePrefix = overrides.excludePrefix === false ? null : overrides.excludePrefix
  }
  if (overrides.emitValueSchemas !== undefined) {
    result.emitValueSchemasMode = overrides.emitValueSchemas === false ? null : overrides.emitValueSchemas
  }
  return result
}

/**
 * Load and validate openapi-codegen.config.json from the given path.
 * Throws if the file is malformed or missing required fields.
 */
function loadCodegenConfig(configPath: string): CodegenConfig {
  const raw = fs.readFileSync(configPath, 'utf8')
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`Failed to parse ${configPath}: not valid JSON`)
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`${configPath}: must be a JSON object`)
  }
  const cfg = parsed as Record<string, unknown>
  if (!Array.isArray(cfg.specs)) {
    throw new Error(`${configPath}: "specs" must be an array`)
  }
  for (let i = 0; i < cfg.specs.length; i++) {
    const spec = cfg.specs[i] as Record<string, unknown>
    if (typeof spec.input !== 'string') {
      throw new Error(`${configPath}: specs[${i}].input must be a string`)
    }
    if (typeof spec.output !== 'string') {
      throw new Error(`${configPath}: specs[${i}].output must be a string`)
    }
  }
  return parsed as CodegenConfig
}

/**
 * Log the resolved options for a spec run.
 */
function logOptions(opts: ResolvedOptions): void {
  if (opts.excludePrefix) {
    console.log(`🚫 Excluding operations with operationId prefix: '${opts.excludePrefix}'`)
  } else {
    console.log(`✅ Including all operations (no exclusion filter)`)
  }
  if (opts.useStrictResponse) {
    console.log(`✅ Using ApiResponseStrict (only readonly/required fields required)`)
  } else {
    console.log(`✅ Using ApiResponse (ALL fields required)`)
  }
  if (opts.enumCase === 'const') {
    console.log(`✅ Using CONSTANT_CASE enum labels (--enum-case const)`)
  } else {
    console.log(`✅ Using PascalCase enum labels (default)`)
  }
  if (opts.emitValueSchemasMode !== null) {
    console.log(`✅ Emitting value schemas (mode: ${opts.emitValueSchemasMode}) → api-value-schemas.ts`)
  } else {
    console.log(`🚫 Value schema emission disabled (use --emit-value-schemas to enable)`)
  }
  if (opts.defaultNonNullable) {
    console.log(
      `✅ defaultNonNullable: true (properties with 'default' are non-optional; pass --default-non-nullable false to opt out)`,
    )
  } else {
    console.log(`✅ defaultNonNullable: false (schema-declared optionality preserved)`)
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    printUsage()
    process.exit(0)
  }

  // ─── Config-file mode ───────────────────────────────────────────────────────
  // When invoked with no positional args, discover openapi-codegen.config.json
  // in the working directory and run codegen for every spec entry.
  if (args.length === 0) {
    const configPath = path.join(process.cwd(), 'openapi-codegen.config.json')
    if (!fs.existsSync(configPath)) {
      printUsage()
      process.exit(0)
    }

    let cfg: CodegenConfig
    try {
      cfg = loadCodegenConfig(configPath)
    } catch (err) {
      console.error('❌ Error loading config:', err instanceof Error ? err.message : err)
      process.exit(1)
    }

    console.log(`📋 Loaded config: ${configPath} (${cfg.specs.length} spec(s))`)
    const sharedOpts = mergeConfigOptions(DEFAULT_OPTIONS, cfg.options ?? {})

    for (let i = 0; i < cfg.specs.length; i++) {
      const specEntry = cfg.specs[i]
      const specOpts = mergeConfigOptions(sharedOpts, specEntry)
      const inputPath = path.resolve(path.dirname(configPath), specEntry.input)
      const outputDir = path.resolve(path.dirname(configPath), specEntry.output)
      console.log(`\n▶ Spec ${i + 1}/${cfg.specs.length}: ${specEntry.input} → ${specEntry.output}`)
      logOptions(specOpts)
      try {
        await generateForSpec(inputPath, outputDir, specOpts)
      } catch (err) {
        console.error(`❌ Error generating spec ${i + 1}:`, err instanceof Error ? err.message : err)
        process.exit(1)
      }
    }

    console.log('\n🎉 All specs generated successfully!')
    return
  }

  if (args.length < 2) {
    console.error('❌ Error: At least 2 arguments are required')
    printUsage()
    process.exit(1)
  }

  const [openapiInput, outputDir, ...optionArgs] = args

  // ─── Positional-arg (one-off) mode ──────────────────────────────────────────────────
  // Parse options (all default to the same values used in config-file mode)
  let excludePrefix: string | null = DEFAULT_OPTIONS.excludePrefix
  let useStrictResponse: boolean = DEFAULT_OPTIONS.useStrictResponse
  let enumCase: EnumCase = DEFAULT_OPTIONS.enumCase
  let emitValueSchemasMode: 'request' | 'all' | null = DEFAULT_OPTIONS.emitValueSchemasMode
  let defaultNonNullable: boolean = DEFAULT_OPTIONS.defaultNonNullable

  for (let i = 0; i < optionArgs.length; i++) {
    if (optionArgs[i] === '--exclude-prefix') {
      if (i + 1 < optionArgs.length) {
        const value = optionArgs[i + 1]
        // If value is 'false', treat as no exclusion
        if (value === 'false') {
          excludePrefix = null
        } else {
          excludePrefix = value
        }
        i++ // Skip next arg since we consumed it
      } else {
        console.error('❌ Error: --exclude-prefix requires a value')
        printUsage()
        process.exit(1)
      }
    } else if (optionArgs[i] === '--use-strict-response') {
      const next = i + 1 < optionArgs.length ? optionArgs[i + 1] : undefined
      if (next === undefined || next.startsWith('-')) {
        // Bare flag, or next token is another option — means true
        useStrictResponse = true
      } else {
        // Support 'true' or 'false' values
        useStrictResponse = next !== 'false'
        i++ // Skip next arg since we consumed it
      }
    } else if (optionArgs[i] === '--enum-case') {
      if (i + 1 < optionArgs.length) {
        const value = optionArgs[i + 1]
        if (value !== 'pascal' && value !== 'const') {
          console.error(`❌ Error: --enum-case must be 'pascal' or 'const', got: ${JSON.stringify(value)}`)
          printUsage()
          process.exit(1)
        }
        enumCase = value
        i++ // Skip next arg since we consumed it
      } else {
        console.error('❌ Error: --enum-case requires a value (pascal or const)')
        printUsage()
        process.exit(1)
      }
    } else if (optionArgs[i] === '--emit-value-schemas') {
      const next = i + 1 < optionArgs.length ? optionArgs[i + 1] : undefined
      if (next === 'request' || next === 'all') {
        emitValueSchemasMode = next
        i++ // consume the value token
      } else if (next === undefined || next.startsWith('-')) {
        // Bare flag, or next token is another option — default to 'request'
        emitValueSchemasMode = 'request'
      } else {
        console.error(`❌ Error: --emit-value-schemas must be 'request' or 'all', got: ${JSON.stringify(next)}`)
        printUsage()
        process.exit(1)
      }
    } else if (optionArgs[i] === '--default-non-nullable') {
      if (i + 1 < optionArgs.length) {
        const value = optionArgs[i + 1]
        if (value !== 'true' && value !== 'false') {
          console.error(`❌ Error: --default-non-nullable must be 'true' or 'false', got: ${JSON.stringify(value)}`)
          printUsage()
          process.exit(1)
        }
        defaultNonNullable = value === 'true'
        i++ // Skip next arg since we consumed it
      } else {
        console.error('❌ Error: --default-non-nullable requires a value (true or false)')
        printUsage()
        process.exit(1)
      }
    } else {
      console.error(`❌ Error: Unknown option: ${JSON.stringify(optionArgs[i])}`)
      printUsage()
      process.exit(1)
    }
  }

  const opts: ResolvedOptions = { excludePrefix, useStrictResponse, enumCase, emitValueSchemasMode, defaultNonNullable }
  logOptions(opts)

  try {
    await generateForSpec(openapiInput, outputDir, opts)
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
