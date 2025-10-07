# GitHub Copilot Instructions for @qualisero/openapi-endpoint

## Project Overview

This is a TypeScript library that provides type-safe OpenAPI integration for Vue Query (TanStack Query). The package enables developers to generate TypeScript types and operation definitions from OpenAPI specifications and use them seamlessly with Vue composition API and TanStack Query.

### Key Features

- **Code Generation**: CLI tool to generate TypeScript types and operation metadata from OpenAPI specs
- **Type Safety**: Full TypeScript support with strict typing for API operations
- **Vue Integration**: Built for Vue 3 with composition API support
- **TanStack Query**: Leverages TanStack Query for reactive data fetching and caching
- **Path Parameters**: Automatic resolution and validation of OpenAPI path parameters

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

### Key Dependencies

**Peer Dependencies** (required by consumers):

- `vue`: ^3.5.22 - Vue 3 composition API
- `@tanstack/vue-query`: ^5.90.2 - Data fetching and caching
- `axios`: ^1.12.2 - HTTP client

**Dev Dependencies**:

- `typescript`: ^5.9.2 - TypeScript compiler
- `openapi-typescript`: ^7.9.1 - OpenAPI type generation
- `@types/node`: ^24.7.0 - Node.js type definitions

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
- `api-operations.ts` - Operation metadata for the library

#### CLI Implementation Patterns

The CLI follows these patterns:

- **Error Messages**: Use emoji prefixes (❌, ✅, 🔨, 📁, 📊, 🎉) for clear visual feedback
- **Validation**: Strict argument validation with helpful usage messages
- **Async Operations**: Use `Promise.all()` for parallel generation of both files
- **File System**: Create output directories recursively if they don't exist
- **Error Handling**: Comprehensive try-catch with context-specific error messages

### Implementation Patterns

#### Query Operations (GET/HEAD/OPTIONS)

```typescript
// Use for read-only operations with automatic type inference
const userQuery = api.useQuery(
  'getUser',
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
const createUser = api.useMutation('createUser', {
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

1. **Operations Interface**: Define operations as an interface extending the base Operations type
2. **Path Parameters**: Use `GetPathParameters<Ops, Op>` to extract required path parameters
3. **Response Types**: Use `GetResponseData<Ops, Op>` for type-safe response handling
4. **Method Validation**: Runtime checks ensure operations match their expected HTTP methods

### Common Patterns to Follow

1. **Reactive Parameters**: Always support `MaybeRefOrGetter<T>` for dynamic values

   ```typescript
   // Good: supports both static and reactive values
   pathParams?: MaybeRefOrGetter<GetPathParameters<Ops, Op> | null | undefined>
   ```

2. **Query Keys**: Generate consistent query keys from resolved paths

   ```typescript
   const queryKey = computed(() => generateQueryKey(resolvedPath.value))
   ```

3. **Cache Management**: Implement automatic cache invalidation for related operations

   ```typescript
   await queryClient.cancelQueries({ queryKey: queryKey.value, exact: false })
   ```

4. **Error Context**: Include operation ID and path information in error messages

   ```typescript
   throw new Error(`Operation '${String(operationId)}' failed: ${resolvedPath.value}`)
   ```

5. **TypeScript Documentation**: Use comprehensive JSDoc comments for public APIs

   ```typescript
   /**
    * @template Ops Operations interface extending base Operations type
    * @template Op Specific operation key from the operations interface
    * @param operationId The OpenAPI operation ID to query
    * @returns Query object with strict typing and helpers
    */
   ```

6. **Composable Return Types**: Define explicit return types for composables
   ```typescript
   export type EndpointQueryReturn<Ops extends Operations<Ops>, Op extends keyof Ops> = ReturnType<
     typeof useEndpointQuery<Ops, Op>
   > & {
     onLoad: (callback: (data: GetResponseData<Ops, Op>) => void) => void
   }
   ```

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
- Increment version in package.json (either minor or patch, based on the amount of change)
- Update changelog for new features or breaking changes

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
- Check linting and unit tests to ensure all CI tests will pass any new PR

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
