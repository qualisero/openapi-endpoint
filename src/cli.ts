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

function parseOperationsFromSpec(openapiContent: string): {
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
 * Converts a string to PascalCase.
 * Handles snake_case, kebab-case, and space-separated strings.
 */
function toPascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('')
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
 * Extracts all enums from an OpenAPI spec.
 * Walks through components.schemas and finds all properties with enum values.
 * Deduplicates by creating a unique name based on schema + property name.
 */
function extractEnumsFromSpec(openApiSpec: OpenAPISpec): EnumInfo[] {
  const enums: EnumInfo[] = []
  const seenEnumValues = new Map<string, string>() // Maps JSON stringified values -> enum name (for deduplication)

  if (!openApiSpec.components?.schemas) {
    return enums
  }

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

      const enumName = toPascalCase(schemaName) + toPascalCase(propName)
      const valuesKey = JSON.stringify(enumValues.sort())

      // Check if we've seen this exact set of values before
      const existingName = seenEnumValues.get(valuesKey)
      if (existingName) {
        // Skip - same enum values already extracted with a different name
        console.log(`  ↳ Skipping ${enumName} (duplicate of ${existingName})`)
        continue
      }

      seenEnumValues.set(valuesKey, enumName)

      enums.push({
        name: enumName,
        values: enumValues,
        sourcePath: `components.schemas.${schemaName}.properties.${propName}`,
      })
    }
  }

  // Sort by name for consistent output
  enums.sort((a, b) => a.name.localeCompare(b.name))

  return enums
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

  const enumExports = enums
    .map((enumInfo) => {
      const members = enumInfo.values
        .map((value) => {
          const memberName = toEnumMemberName(value)
          const valueStr = typeof value === 'string' ? `'${value}'` : value
          return `  ${memberName}: ${valueStr} as const,`
        })
        .join('\n')

      return `/**
 * Enum values from ${enumInfo.sourcePath}
 */
export const ${enumInfo.name} = {
${members}
} as const

export type ${enumInfo.name} = typeof ${enumInfo.name}[keyof typeof ${enumInfo.name}]
`
    })
    .join('\n')

  return `// Auto-generated from OpenAPI specification
// Do not edit this file manually

${enumExports}
`
}

/**
 * Generates the api-enums.ts file from the OpenAPI spec.
 */
async function generateApiEnums(openapiContent: string, outputDir: string): Promise<void> {
  console.log('🔨 Generating api-enums.ts file...')

  const openApiSpec: OpenAPISpec = JSON.parse(openapiContent)
  const enums = extractEnumsFromSpec(openApiSpec)

  const tsContent = generateApiEnumsContent(enums)
  const outputPath = path.join(outputDir, 'api-enums.ts')
  fs.writeFileSync(outputPath, tsContent)

  console.log(`✅ Generated api-enums file: ${outputPath}`)
  console.log(`📊 Found ${enums.length} unique enums`)
}

function generateApiOperationsContent(operationIds: string[], operationInfoMap: Record<string, OperationInfo>): string {
  // Generate operationsBase dictionary
  const operationsBaseContent = operationIds
    .map((id) => {
      const info = operationInfoMap[id]
      return `  ${id}: {\n    path: '${info.path}',\n    method: HttpMethod.${info.method},\n  },`
    })
    .join('\n')

  // Generate OperationId enum content
  const operationIdContent = operationIds.map((id) => `  ${id}: '${id}' as const,`).join('\n')

  // Generate OpType namespace content
  const opTypeContent = operationIds.map((id) => `  export type ${id} = typeof OperationId.${id}`).join('\n')

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
export const openApiOperations = operationsBase as typeof operationsBase & operations

export type OpenApiOperations = typeof openApiOperations

// Dynamically generate OperationId enum from the operations keys
export const OperationId = {
${operationIdContent}
} satisfies Record<keyof typeof operationsBase, keyof typeof operationsBase>

// Export the type for TypeScript inference
export type OperationId = keyof OpenApiOperations

// ============================================================================
// Type-safe API Helpers - Use OpType.XXX for type-safe access with intellisense
// ============================================================================

/**
 * Response data type for an API operation.
 * All fields are REQUIRED - no null checks needed.
 * @example
 *   type Response = ApiResponse<OpType.getPet>
 */
export type ApiResponse<K extends OperationId> = ApiResponseBase<OpenApiOperations, K>

/**
 * Response data type with safe typing for unreliable backends.
 * Only readonly properties are required; others may be undefined.
 * @example
 *   type Response = ApiResponseSafe<OpType.getPet>
 */
export type ApiResponseSafe<K extends OperationId> = ApiResponseSafeBase<OpenApiOperations, K>

/**
 * Request body type for a mutation operation.
 * @example
 *   type Request = ApiRequest<OpType.createPet>
 */
export type ApiRequest<K extends OperationId> = ApiRequestBase<OpenApiOperations, K>

/**
 * Path parameters type for an operation.
 * @example
 *   type Params = ApiPathParams<OpType.getPet>
 */
export type ApiPathParams<K extends OperationId> = ApiPathParamsBase<OpenApiOperations, K>

/**
 * Query parameters type for an operation.
 * @example
 *   type Params = ApiQueryParams<OpType.listPets>
 */
export type ApiQueryParams<K extends OperationId> = ApiQueryParamsBase<OpenApiOperations, K>

// ============================================================================
// OpType namespace - enables dot notation: ApiResponse<OpType.getPet>
// ============================================================================

/**
 * Namespace that mirrors OperationId properties as types.
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
`
}

async function generateApiOperations(openapiContent: string, outputDir: string): Promise<void> {
  console.log('🔨 Generating openapi-typed-operations.ts file...')

  const { operationIds, operationInfoMap } = parseOperationsFromSpec(openapiContent)

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
Usage: npx @qualisero/openapi-endpoint <openapi-input> <output-directory>

Arguments:
  openapi-input      Path to OpenAPI JSON file or URL to fetch it from
  output-directory   Directory where generated files will be saved

Examples:
  npx @qualisero/openapi-endpoint ./api/openapi.json ./src/generated
  npx @qualisero/openapi-endpoint https://api.example.com/openapi.json ./src/api

This command will generate:
  - openapi-types.ts              (TypeScript types from OpenAPI spec)
  - openapi-typed-operations.ts   (Operation IDs and info for use with this library)
  - api-enums.ts                  (Type-safe enum objects from OpenAPI spec)
`)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage()
    process.exit(0)
  }

  if (args.length !== 2) {
    console.error('❌ Error: Exactly 2 arguments are required')
    printUsage()
    process.exit(1)
  }

  const [openapiInput, outputDir] = args

  try {
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
      console.log(`📁 Created output directory: ${outputDir}`)
    }

    // Fetch OpenAPI spec content
    let openapiContent = await fetchOpenAPISpec(openapiInput)

    // Parse spec and add missing operationIds
    const openApiSpec: OpenAPISpec = JSON.parse(openapiContent)
    addMissingOperationIds(openApiSpec)
    openapiContent = JSON.stringify(openApiSpec, null, 2)

    // Generate both files
    await Promise.all([
      generateTypes(openapiContent, outputDir),
      generateApiOperations(openapiContent, outputDir),
      generateApiEnums(openapiContent, outputDir),
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
