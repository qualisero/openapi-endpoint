import * as fs from 'fs'
import * as path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { HttpMethod } from './types.js'

const execAsync = promisify(exec)

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
}

interface OperationInfo {
  path: string
  method: HttpMethod
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
 * Checks if a path ends with a file extension.
 *
 * @param pathUrl - The path to check
 * @returns true if the path ends with a file extension (e.g., .json, .xml)
 */
function hasFileExtension(pathUrl: string): boolean {
  // Match common file extensions at the end of the path (before path parameters)
  const segments = pathUrl.split('/').filter((s) => s.length > 0 && !s.startsWith('{'))
  if (segments.length === 0) return false
  const lastSegment = segments[segments.length - 1]
  return /\.\w+$/.test(lastSegment)
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
function generateOperationId(pathUrl: string, method: string, prefixToStrip: string = ''): string {
  const methodLower = method.toLowerCase()

  // Strip prefix if provided and path starts with it
  let effectivePath = pathUrl
  if (prefixToStrip && pathUrl.startsWith(prefixToStrip)) {
    effectivePath = pathUrl.substring(prefixToStrip.length)
  }

  // Remove leading/trailing slashes, replace slashes and periods with underscores
  // Filter out path parameters (e.g., {petId})
  const cleanPath = effectivePath
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .filter((segment) => segment.length > 0 && !segment.startsWith('{') && !segment.endsWith('}'))
    .join('_')
    .replace(/\./g, '_') // Replace periods with underscores

  // Convert the entire path (now with underscores) to PascalCase
  const entityName = snakeToPascalCase(cleanPath)

  // Determine prefix based on method and whether it's a collection or single resource
  let prefix = ''

  // Check if path ends with a parameter (single resource) or not (collection)
  const pathSegments = effectivePath
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .filter((segment) => segment.length > 0)
  const lastSegment = pathSegments[pathSegments.length - 1] || ''
  const isCollection = !lastSegment.startsWith('{') || pathSegments.length === 0

  switch (methodLower) {
    case 'get':
      // GET on file extension -> get, GET on collection -> list, GET on resource -> get
      if (hasFileExtension(effectivePath)) {
        prefix = 'get'
      } else {
        prefix = isCollection ? 'list' : 'get'
      }
      break
    case 'post':
      // POST usually creates, but check if it's a nested action
      if (pathSegments.length > 2 && !lastSegment.startsWith('{')) {
        // Nested action like /pets/{petId}/adopt -> postPetAdopt
        prefix = 'post'
      } else {
        prefix = 'create'
      }
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
  return prefix + entityName
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
  const usedOperationIds = new Map<string, { path: string; method: string }>()

  // First pass: collect existing operationIds
  Object.entries(openApiSpec.paths).forEach(([pathUrl, pathItem]) => {
    Object.entries(pathItem).forEach(([method, operation]) => {
      const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace']
      if (!httpMethods.includes(method.toLowerCase())) {
        return
      }

      const op = operation as OpenAPIOperation
      if (op.operationId) {
        usedOperationIds.set(op.operationId, { path: pathUrl, method })
      }
    })
  })

  // Second pass: generate operationIds for missing ones
  Object.entries(openApiSpec.paths).forEach(([pathUrl, pathItem]) => {
    Object.entries(pathItem).forEach(([method, operation]) => {
      const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace']
      if (!httpMethods.includes(method.toLowerCase())) {
        return
      }

      const op = operation as OpenAPIOperation
      if (!op.operationId) {
        // Generate operationId with prefix stripped
        let generatedId = generateOperationId(pathUrl, method, prefixToStrip)

        // Handle collisions by appending path segments
        if (usedOperationIds.has(generatedId)) {
          const existingEntry = usedOperationIds.get(generatedId)!
          console.log(
            `⚠️  Collision detected: '${generatedId}' already used by ${existingEntry.method.toUpperCase()} ${existingEntry.path}`,
          )

          // Try to disambiguate by adding removed segments back
          let effectivePath = pathUrl
          if (prefixToStrip && pathUrl.startsWith(prefixToStrip)) {
            effectivePath = pathUrl.substring(prefixToStrip.length)
          }

          const allSegments = effectivePath
            .replace(/^\/+|\/+$/g, '')
            .split('/')
            .filter((segment) => segment.length > 0)

          // Find segments that were removed (path parameters)
          const removedSegments = allSegments.filter((segment) => segment.startsWith('{') && segment.endsWith('}'))

          // Try adding back removed segments one by one until unique
          for (const segment of removedSegments) {
            const segmentName = segment.replace(/[{}]/g, '')
            const disambiguatedId = generatedId + snakeToPascalCase(segmentName)

            if (!usedOperationIds.has(disambiguatedId)) {
              generatedId = disambiguatedId
              console.log(`   ➜ Resolved collision with: '${generatedId}'`)
              break
            }
          }

          // If still colliding, append a counter
          if (usedOperationIds.has(generatedId)) {
            let counter = 2
            let uniqueId = `${generatedId}${counter}`
            while (usedOperationIds.has(uniqueId)) {
              counter++
              uniqueId = `${generatedId}${counter}`
            }
            generatedId = uniqueId
            console.log(`   ➜ Resolved collision with counter: '${generatedId}'`)
          }
        }

        op.operationId = generatedId
        usedOperationIds.set(generatedId, { path: pathUrl, method })
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
      const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace']
      if (!httpMethods.includes(method.toLowerCase())) {
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

  return `// Auto-generated from OpenAPI specification
// Do not edit this file manually

import type { operations } from './openapi-types'

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
  - openapi-types.ts    (TypeScript types from OpenAPI spec)
  - openapi-typed-operations.ts   (Operation IDs and info for use with this library)
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
    await Promise.all([generateTypes(openapiContent, outputDir), generateApiOperations(openapiContent, outputDir)])

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
