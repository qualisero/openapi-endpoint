# GitHub Copilot Instructions for @qualisero/openapi-endpoint

## Project Overview

This is a TypeScript library that provides type-safe OpenAPI integration for Vue Query (TanStack Query). The package enables developers to generate TypeScript types and operation definitions from OpenAPI specifications and use them seamlessly with Vue composition API and TanStack Query.

### Key Features

- **Code Generation**: CLI tool to generate TypeScript types and streamlined operation metadata from OpenAPI specs
- **Type Safety**: Full TypeScript support with strict typing for API operations
- **Vue Integration**: Built for Vue 3 with composition API support
- **TanStack Query**: Leverages TanStack Query for reactive data fetching and caching
- **Path Parameters**: Automatic resolution and validation of OpenAPI path parameters
- **Streamlined API**: Single composable (`useOpenApi`) provides unified access to queries, mutations, and generic endpoints

## Project Structure

```
src/
├── cli.ts                 # Command-line tool for code generation
├── index.ts              # Main entry point and useOpenApi composable
├── types.ts              # Core TypeScript type definitions
├── openapi-query.ts      # Query operations (GET requests)
├── openapi-mutation.ts   # Mutation operations (POST/PUT/PATCH/DELETE)
├── openapi-endpoint.ts   # Generic endpoint handler
├── openapi-helpers.ts    # Helper functions for operations
└── openapi-utils.ts      # Utility functions for path resolution
bin/
└── openapi-codegen.js    # CLI entry point
```

## Current API Structure (Post-Streamlining)

The library provides a unified API through the `useOpenApi` composable:

```typescript
// Primary usage pattern - always use the main API composable
const api = useOpenApi<OpenApiOperations>({
  operations: openApiOperations, // Generated streamlined operations
  axios: axiosInstance,
})

// Preferred API methods (use these instead of individual composables):
api.useQuery() // For GET operations
api.useMutation() // For POST/PUT/PATCH/DELETE operations
api.useEndpoint() // Generic endpoint (auto-detects operation type)
api.debug() // Debug utility
```

**Important**: Emphasize using the unified API (`api.useQuery`, `api.useMutation`, `api.useEndpoint`) rather than individual composables (`useEndpointQuery`, `useEndpointMutation`) directly.

## Development Guidelines

### Code Style and Conventions

1. **TypeScript**: Use strict TypeScript with proper type annotations
   - Prefer explicit return types for public functions
   - Use interface over type for object definitions where possible
   - Leverage conditional types and mapped types for API typing

2. **Vue Composables**: Follow Vue composition API patterns
   - Use `ref`, `computed`, and `watch` appropriately
   - Return consistent object structure from composables
   - Support reactive parameters with `MaybeRefOrGetter<T>`

3. **Error Handling**:
   - Use descriptive error messages with operation context
   - Validate path parameters before making requests
   - Handle axios errors gracefully with proper typing

4. **Naming Conventions**:
   - Use `useEndpoint*` pattern for composables
   - Use `*Options` suffix for configuration types
   - Use descriptive variable names that indicate their reactive nature

5. **Code Quality & Testing**: **MANDATORY** - Test and validate after EVERY code change
   - **ALWAYS** run `npm run fix` after EVERY code change (combines lint:fix + format)
   - **ALWAYS** run `npm run check` before committing (combines types + lint + format:check)
   - **ALWAYS** run `npm run test:run` to verify all tests pass
   - **ALWAYS** run `npm run types` and `npm run types:test` to ensure type safety
   - Testing and type validation are REQUIRED after every single code modification
   - Format, lint fixing, and testing are non-negotiable for all code changes and PRs

### Testing Strategy - CRITICAL

**Runtime and Type Testing**:

- Run `npm run test:run` after every code change to ensure runtime behavior is correct
- Run `npm run types:test` after every code change to ensure TypeScript compilation succeeds
- Tests must validate both functionality and type safety
- Use the streamlined `openApiOperations` format in all new tests
- Follow existing test patterns in `tests/unit/main-composables.test.ts` for proper API usage

### Key Dependencies

**Peer Dependencies** (required by consumers):

- `vue`: ^3.5.22 - Vue 3 composition API
- `@tanstack/vue-query`: ^5.90.2 - Data fetching and caching
- `axios`: ^1.12.2 - HTTP client

**Dev Dependencies**:

- `typescript`: ^5.9.2 - TypeScript compiler
- `openapi-typescript`: ^7.9.1 - OpenAPI type generation
- `@types/node`: ^24.7.0 - Node.js type definitions

### Code Change Workflow - MANDATORY STEPS

For EVERY code change, follow this exact sequence:

1. **Make your code changes**
2. **IMMEDIATELY after any code modification, run:**
   ```bash
   npm run fix         # Auto-fix linting and format all files
   npm run test:run    # Verify all tests pass
   ```
3. **For documentation changes affecting JSDoc comments, also run:**
   ```bash
   npm run docs:publish        # Regenerate API documentation
   ```
4. **Before committing, verify everything works:**
   ```bash
   npm run check       # Comprehensive checks (types + lint + format)
   ```
5. **Commit your changes**

**This workflow is NON-NEGOTIABLE** - no code changes should be committed without running the fix and test commands. Documentation changes require JSDoc regeneration.

**For publishing documentation to GitHub Pages (maintainers only):**

```bash
npm run docs:publish  # Generate and publish docs to gh-pages branch
```

### Efficient Copilot Agent Setup

**Quick Start Commands**:

```bash
# Initial setup
npm install
npm run check  # Verify everything works

# Development workflow
npm run dev     # Start test watcher
npm run fix     # Fix code after changes
npm run check   # Final verification before commit
```

**For Building and Testing**:

- `npm run build` - Build the library for production
- `npm run test:coverage` - Run tests with coverage reports
- `npm run test:ui` - Interactive test runner with web UI
- `npm run types` - Type-check source code only
- `npm run types:test` - Type-check test files only

### Current Project State (Updated 2025-01-11)

- **Current Version**: 0.3.5
- **Node.js**: Compatible with modern Node.js versions
- **TypeScript**: 5.9.2 with strict mode enabled
- **Linting**: ESLint 9.37.0 with TypeScript integration
- **Formatting**: Prettier 3.6.2 with consistent configuration
- **Testing**: Vitest 3.2.4 with jsdom environment

### Building and Testing

```bash
# Build the library
npm run build

# Type checking only
npm run types

# Prepare for publishing
npm run prepublishOnly
```

**Note**: The project currently has build errors due to missing peer dependencies in the development environment. This is expected and normal for a library package.

### CLI Tool Usage

The package provides a CLI tool for generating TypeScript definitions:

```bash
# Generate from local OpenAPI file
npx @qualisero/openapi-endpoint ./api/openapi.json ./src/generated

# Generate from remote URL
npx @qualisero/openapi-endpoint https://api.example.com/openapi.json ./src/api
```

Generated files:

- `openapi-types.ts` - TypeScript type definitions
- `api-operations.ts` - Streamlined operation definitions combining metadata and types

#### CLI Implementation Patterns

The CLI follows these patterns:

- **Error Messages**: Use emoji prefixes (❌, ✅, 🔨, 📁, 📊, 🎉) for clear visual feedback
- **Validation**: Strict argument validation with helpful usage messages
- **Async Operations**: Use `Promise.all()` for parallel generation of both files
- **File System**: Create output directories recursively if they don't exist
- **Error Handling**: Comprehensive try-catch with context-specific error messages

### Implementation Patterns

#### Primary API Usage (Recommended)

```typescript
// Initialize once with streamlined operations
const api = useOpenApi<OpenApiOperations>({
  operations: openApiOperations, // From generated api-operations.ts
  axios: axiosInstance,
})

// Use the unified API methods
const { data: pets, isLoading } = api.useQuery(OperationId.listPets)
const createPet = api.useMutation(OperationId.createPet)
const genericEndpoint = api.useEndpoint(OperationId.getPet, { petId: '123' })
```

#### Query Operations (GET/HEAD/OPTIONS)

```typescript
// Use for read-only operations with automatic type inference
const userQuery = api.useQuery(
  OperationId.getUser,
  { userId: '123' },
  {
    enabled: true,
    onLoad: (data) => console.log('User loaded:', data),
    axiosOptions: { headers: { 'Custom-Header': 'value' } },
  },
)

// Access reactive properties
const userData = userQuery.data
const isLoading = userQuery.isLoading
const queryKey = userQuery.queryKey
```

#### Mutation Operations (POST/PUT/PATCH/DELETE)

```typescript
// Use for data modifications with cache management
const createUser = api.useMutation(OperationId.createUser, {
  onSuccess: async (data, vars) => {
    // Automatic cache invalidation and updates
  },
})

// Execute the mutation
await createUser.mutateAsync({
  data: userData,
  pathParams: { orgId: '123' }, // if needed
})
```

#### Path Parameter Resolution

```typescript
// Supports dynamic path parameters with validation
const resolvedPath = resolvePath('/users/{userId}/posts/{postId}', {
  userId: '123',
  postId: '456',
})
// Results in: '/users/123/posts/456'

// Check if all required parameters are provided
const isResolved = isPathResolved(resolvedPath)
```

#### Error Handling Pattern

```typescript
// Structured error handling with context
if (!isPathResolved(resolvedPath.value)) {
  return Promise.reject(
    new Error(
      `Query for '${String(operationId)}' cannot be used, as path is not resolved: ${resolvedPath.value} (params: ${JSON.stringify(pathParams)})`,
    ),
  )
}
```

### Type Safety Guidelines

1. **Use Streamlined Operations**: Always use the generated `openApiOperations` format
2. **Path Parameters**: Leverage `GetPathParameters<Ops, Op>` for type-safe path parameters
3. **Response Types**: Use `GetResponseData<Ops, Op>` for type-safe response handling
4. **Reactive Parameters**: Support `MaybeRefOrGetter<T>` for dynamic values

### Common Patterns

1. **Reactive Parameters**:

   ```typescript
   // Good: supports both static and reactive values
   pathParams?: MaybeRefOrGetter<GetPathParameters<Ops, Op> | null | undefined>
   ```

2. **Error Context**: Include operation ID and path information in error messages

   ```typescript
   throw new Error(`Operation '${String(operationId)}' failed: ${resolvedPath.value}`)
   ```

3. **JSDoc Documentation**: Use comprehensive documentation for public APIs
   ```typescript
   /**
    * @template Ops Operations interface extending base Operations type
    * @param operationId The OpenAPI operation ID to query
    * @returns Query object with strict typing and helpers
    */
   ```

**Important**: Keep this instruction file concise and focus on the unified API (`useOpenApi`) rather than individual composables.

### What NOT to do

1. Don't modify peer dependency versions without careful consideration
2. Don't add runtime dependencies that conflict with Vue/TanStack Query ecosystems
3. Don't break the composable patterns established in the codebase
4. Don't remove type safety features or bypass TypeScript strict mode
5. Don't modify the CLI interface without updating documentation

### Testing Considerations

When adding tests (if requested):

- Mock axios responses appropriately
- Test both success and error scenarios
- Verify reactive parameter updates work correctly
- Test path parameter resolution edge cases
- Ensure type safety is maintained in test scenarios

### Documentation Updates

When making changes:

- Update README.md if public API changes
- **Update README badges** when relevant information changes:
  - Version badge automatically updates with npm releases
  - CI badge reflects latest workflow status
  - Coverage badge updates with codecov integration
  - License badge should be updated if license changes
  - Bundle size badge reflects published package size
- Update TypeScript comments for public functions
- Ensure code examples in docs remain accurate
- Update CLI usage examples if command interface changes

#### README Badge Maintenance

The README includes several status badges that should be maintained:

1. **NPM Version Badge**: `[![npm version](https://badge.fury.io/js/@qualisero%2Fopenapi-endpoint.svg)](https://badge.fury.io/js/@qualisero%2Fopenapi-endpoint)` - Updates automatically with npm releases
2. **CI Status Badge**: `[![CI](https://github.com/qualisero/openapi-endpoint/workflows/CI/badge.svg)](https://github.com/qualisero/openapi-endpoint/actions/workflows/ci.yml)` - Shows current build status
3. **Coverage Badge**: `[![codecov](https://codecov.io/gh/qualisero/openapi-endpoint/branch/main/graph/badge.svg)](https://codecov.io/gh/qualisero/openapi-endpoint)` - Shows test coverage percentage
4. **License Badge**: `[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)` - Update if license changes
5. **Bundle Size Badge**: `[![npm bundle size](https://img.shields.io/bundlephobia/minzip/@qualisero/openapi-endpoint)](https://bundlephobia.com/package/@qualisero/openapi-endpoint)` - Shows minified+gzipped package size

When drafting PRs, verify that:

- All badges are displaying correctly and are not broken
- Coverage badge reflects accurate test coverage improvements
- CI badge shows passing status
- Version badge matches the current published version

## Notes for AI Assistants

- This is a library package, so build errors due to missing peer dependencies are normal
- The focus is on type safety and developer experience
- Pay attention to Vue reactivity patterns and TanStack Query integration
- The CLI tool is a crucial part of the developer workflow
- Maintain backward compatibility unless explicitly requested to break it
- **MANDATORY**: Always run linting and formatting fixes after EVERY code change:
  - `npm run lint:fix` to automatically fix ESLint issues
  - `npm run format` to automatically format all files with Prettier
  - `npm run lint` to verify linting passes (must have zero errors)
  - `npm run format:check` to verify formatting passes (must have zero warnings)
  - These commands MUST be run after every code modification without exception
- Check linting and unit tests to ensure all CI tests will pass any new PR

### CRITICAL: Zero-Tolerance Format Policy

**NO CODE CHANGES ARE ACCEPTABLE WITHOUT PROPER FORMATTING AND LINTING:**

1. **After EVERY single code modification** (even a single line change):
   - Run `npm run lint:fix`
   - Run `npm run format`
   - Verify with `npm run lint` (zero errors required)
   - Verify with `npm run format:check` (zero warnings required)

2. **No exceptions, no shortcuts, no "I'll do it later"** - format fixes are immediate and mandatory

3. **This applies to:**
   - New features
   - Bug fixes
   - Documentation updates
   - Configuration changes
   - Test file modifications
   - Any file modification whatsoever

4. **If you skip formatting/linting, the changes are invalid and must be redone**

### Package Configuration

The package.json includes these important configurations:

- **Type: module** - Uses ES modules exclusively
- **Exports field** - Provides both types and import paths
- **Bin field** - Exposes the CLI tool as `openapi-codegen`
- **Files field** - Only dist and bin directories are published
- **PeerDependencies** - Vue, TanStack Query, and Axios must be provided by consumers

### Available Scripts

- `npm run build` - Compile TypeScript to dist/
- `npm run types` - Type checking without emit
- `npm run prepublishOnly` - Build and type check before publishing
