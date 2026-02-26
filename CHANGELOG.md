# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.18.0] - 2026-02-26

### Added

- **Lazy queries** — New `useLazyQuery` hook for imperative query execution
  - `fetch(options)` method executes queries on demand with params passed at call time
  - `useLazyQuery()` on every generated query operation (no-path and with-path)
  - No auto-fire on mount or param change — full control over request timing
  - Cache sharing with `useQuery` — both composables share same cache entry
  - Default `staleTime: Infinity` — execute only when explicitly called
  - New types: `LazyQueryReturn<TResponse, TPathParams, TQueryParams>`, `LazyQueryFetchOptions<TQueryParams>`
  - Export: `useEndpointLazyQuery` from package

### Changed

- **Type safety** — Reverted `queryParams?: ReactiveOr<TQueryParams | undefined>` to `ReactiveOr<TQueryParams>`
  - The `| undefined` type relaxation from 0.17.1 is superseded by `useLazyQuery`
  - Required query params must be provided; TypeScript enforces this at compile time
  - This is a breaking change for code that adopted the 0.17.1 pattern (but that version was not released)

### Documentation

- Added [Lazy Queries guide](./docs/manual/07-lazy-queries.md) with comprehensive examples
- Updated [Queries guide](./docs/manual/02-queries.md) with lazy query overview
- Updated [Reactive Parameters guide](./docs/manual/04-reactive-parameters.md) with lazy query patterns

## [0.17.0] - 2025-02-25

### Added

- **Deferred path parameters for mutations** — Create mutations without path params at hook time, then provide them at call time via `mutateAsync({ pathParams: { ... } })`
  - New third overload for `_UseMutation`: `(pathParams?: undefined | null, options?) => MutationReturn<...>`
  - Enables pattern: `const mutation = api.updatePet.useMutation()` then `await mutation.mutateAsync({ data, pathParams: { petId } })`
  - Supports providing mutation options without path params: `useMutation(undefined, { invalidateOperations: ... })`
  - Useful when path params loaded asynchronously or mutation used across different items

### Changed

- **Type improvements** — `QueryReturn` now extends TanStack's `UseQueryReturnType<T, Error>` instead of manually redeclaring fields
  - Removed manual field declarations for `refetch`, `isPending`, `isLoading`, `isSuccess`, `isError`, `error`
  - Now inherits all TanStack fields: `status`, `isFetching`, `fetchStatus`, `isStale`, etc.
  - `refetch()` return type is now `Promise<QueryObserverResult<T, E>>` (was incorrectly `Promise<void>`)

### Changed

- **Breaking change (minor)**: `refetch()` return type is more specific
  - Old: `Promise<void>` (incorrect)
  - New: `Promise<QueryObserverResult<T, E>>` (accurate to TanStack)
  - Most calling code unaffected (just `await query.refetch()`)
  - Only breaks explicit `Promise<void>` type annotations (which were incorrect)

### Fixed

- `QueryReturn.isEnabled` now explicitly overrides TanStack's version to add path-parameter validation
  - TanStack's `isEnabled` only tracks the `enabled` option
  - Ours also gates on whether path params are fully resolved
- Removed duplicate `refetchEndpoints` spreading in mutation `onSuccess` callback
- Removed unused type imports (`Ref`, `UseQueryReturnType`, `Refetchable`) for cleaner linting

### Documentation

- Added comprehensive examples for deferred path parameters in mutations
- Clarified that mutations DO support reactive path params (`ref`, `computed`, getter functions)
  - Key difference from queries: mutations don't auto-execute when params change
  - Updated examples to use `computed(() => ({ petId: ... }))` instead of incorrect `{ petId: ref }`
- Added section on using cache options with deferred path params
- Updated all JSDoc comments to document the new third overload

## [0.16.0] - 2025-02-24

### Added

- Query return types test suite with 67 tests for end-to-end type verification
- Compile-time type compatibility checks for `refetch()`, `data`, error states
- Bidirectional type checks to verify inferred types match expected OpenAPI types

### Changed

- **QueryReturn** now extends `Omit<UseQueryReturnType, 'data' | 'isEnabled'>` plus custom fields
  - Inherits `refetch`, `isPending`, `isLoading`, `isSuccess`, `isError`, `error` from TanStack
  - Custom `data` field as `ComputedRef<TResponse | undefined>` instead of TanStack's `Ref<TData | undefined>`
  - Custom `isEnabled` that gates on path param resolution + TanStack's `enabled` option
- **Refetchable** interface updated: `refetch` return type changed to `Promise<unknown>` for compatibility

### Fixed

- Stale internal type cast in `openapi-mutation.ts`: removed `{ refetch: () => Promise<void> }[]` in favor of `Refetchable[]`
- Resolved 4 Copilot review comments on typing and documentation

### Removed

- Unused type import `UseQueryReturnType` from test file
- Redundant type casts and annotations that are now properly inferred

## [0.15.0] - 2026-02-24

### Changed

- **BREAKING**: Removed `QueryClientLike` interface - use `QueryClient` directly
  - `createApiClient()` now accepts `QueryClient` from `@tanstack/vue-query` instead of `QueryClientLike`
  - Eliminates need for type casts like `as any` when creating API clients
  - Improved TypeScript autocomplete and error messages
  - Internal casts removed from `openapi-query.ts` and `openapi-mutation.ts`

### Removed

- `QueryClientLike` interface from public API exports
- Internal `as QueryClient` type casts

### Added

- Comprehensive typing and regression tests to prevent `QueryClient` casting issues
  - Runtime tests in `tests/bugfix/queryclient-no-cast.test.ts` (5 tests)
  - Type compatibility tests in `tests/bugfix/queryclient-types.test.ts` (3 tests)

### Migration

1. Remove any `as any` or `as QueryClient` type casts when calling `createApiClient`
2. Regenerate API clients to get updated type signatures
3. If using `QueryClientLike` type directly, replace with `QueryClient` from `@tanstack/vue-query`

## [0.14.0] - 2026-02-24

### Changed

- **BREAKING**: Simplified API client initialization with `createApiClient()` factory
  - Removed two-argument `useOpenApi(config, operationConfig)` function
  - New API: `createApiClient(axios, queryClient?)`
  - No need for `operationConfig` - configuration is embedded in generated code
  - See updated README.md and documentation for migration guide

### Removed

- `operationConfig` parameter from API initialization
- `openapi-typed-operations.ts` file generation (replaced by `api-client.ts`)
- Two-argument `useOpenApi` overload

### Added

- `api-client.ts` generated file with `createApiClient()` factory
- Operation namespace pattern: `api.getPet.useQuery()`, `api.createPet.useMutation()`
- Embedded per-operation configuration in generated code
- Simplified type extraction helpers

## [0.13.2] - 2026-02-19

### Changed

- Simplified type API with improved overloads for path parameters
- Added `HasExcessPathParams` type for stricter path parameter validation
- Added `NoPathParams` and `WithPathParams` types for better type inference

### Removed

- **`useEndpoint` function removed** — Use `useQuery`/`useMutation` directly instead
- **`queryClient` export removed** — No longer part of public API
- **Internal exports removed** — `useEndpointQuery`, `useEndpointMutation` no longer exported from index

## [0.13.1] - 2025-02-16

### Changed

- Updated docs/examples to use OperationId constants and correct query keys derived from paths.
- Replaced deprecated `cacheTime` examples with `gcTime` in manual docs.

## [0.13.0] - 2025-02-13

### Changed

- **BREAKING**: Renamed type helpers to shorter, more intuitive names:
  - `GetResponseData<Ops, Op>` → `ApiResponse<Op>` (simplified usage with OpType)
  - `GetRequestBody<Ops, Op>` → `ApiRequest<Op>`
  - `GetPathParameters<Ops, Op>` → `ApiPathParams<Op>`
  - `GetQueryParameters<Ops, Op>` → `ApiQueryParams<Op>`
  - Old names removed entirely (no backward compatibility aliases)
- **BREAKING**: `ApiResponse` now requires ALL fields regardless of `required` status in OpenAPI schema
  - All response fields are now required - no null checks needed
  - Added `ApiResponseSafe` for opt-out: only readonly fields required, others preserve optional status
- **BREAKING**: Made `isQueryMethod` and `isMutationMethod` internal (not exported from public API)
- Removed `types-documentation.ts` - type documentation now inline in `types.ts`
- Simplified `index.ts` exports - all public types exported directly from `types.ts`
- Added inline JSDoc to `QQueryOptions` and `QMutationOptions` properties for better intellisense
- Updated CLI to generate simplified type aliases using new names

### Added

- `ApiResponseSafe<Op>` type for unreliable backends - only readonly fields required, others optional

### Removed

- `types-documentation.ts` — redundant JSDoc-enhanced re-exports
- Unused `OperationId` type alias from `types.ts`
- Direct `components` and `operations` type access from tests and examples

## [0.12.0] - 2025-11-22

### Added

- Auto-generation of operation IDs for OpenAPI endpoints without explicit operationIds
- Intelligent operation ID generation with customizable path prefix stripping (default `/api`)
- Snake_case to camelCase conversion within path segments for clean operation IDs
- File extension detection for appropriate prefix selection (`get` for files vs `list` for collections)
- Period-to-PascalCase conversion in operation ID generation
- Automatic collision detection and resolution for duplicate operation IDs with path parameter disambiguation
- Comprehensive test suite with 258 tests covering all operation ID generation scenarios

### Changed

- CLI code generation now preprocesses OpenAPI specs to add missing operation IDs before type generation
- `openapi-typescript` moved from devDependencies to peerDependencies for better consumer compatibility

## [0.11.0] - 2025-11-20

### Added

- Reactive query parameters with automatic refetch support - query parameters can now be reactive using `ref`, `computed`, or function-based values
- Type-safe query parameters extracted from OpenAPI specification via new `GetQueryParameters` type
- `queryParams` option for `useQuery`, `useMutation`, and `useEndpoint` methods with full reactivity support
- Automatic TanStack Query key generation that includes query params to trigger refetch on changes
- Comprehensive test suite with 383 lines of tests covering reactive query parameters functionality
- Documentation and examples for reactive query parameters in README

### Changed

- Query parameters are now included in TanStack Query keys for automatic cache invalidation and refetch
- Enhanced type definitions with `GetQueryParameters` type for compile-time query parameter validation

## [0.10.1] - 2025-10-28

### Fixed

- TypeScript error when using custom axios properties in axiosOptions - now supports properties like `manualErrorHandling` and `handledByAxios` through module augmentation

## [0.10.0] - 2025-10-28

### Added

- Exposed `pathParams` property in endpoint returns for debugging and introspection of current path parameter values
- Comprehensive test suite for reactive path parameters with 8 new test cases covering all pathParams types

### Fixed

- Reactive path parameters for function-based pathParams - functions passed as pathParams now properly track reactive dependencies
- Consistent reactive patterns across query and mutation composables for improved reliability

### Changed

- Enhanced `getParamsOptionsFrom` utility to properly recognize functions as pathParams instead of options
- Improved reactivity handling with consistent `toValue()` usage within computed functions

## [0.9.0] - 2025-10-13

### Changed

- **BREAKING**: Modified `mutationFn` to return Promise instead of extracting `data` for better TanStack Query compatibility
- **BREAKING**: Mutation `data` property now returns `AxiosResponse<T>` instead of `T` directly - access response data via `mutation.data.data`
- **BREAKING**: Error handling for mutations must now use `.catch()` on `mutateAsync()` instead of `errorHandler` option

### Removed

- **BREAKING**: Removed `errorHandler` option from mutation configurations (kept for queries)
- **BREAKING**: Removed `errorHandler` parameter from `QMutationVars` and `QMutationOptions` types

### Fixed

- Improved mutation compatibility with TanStack Query's expected patterns and error handling

## [0.8.0] - 2025-10-13

### Added

- Per-mutation axios options and error handler overrides for `mutate` and `mutateAsync` calls
- Support for passing `axiosOptions` directly to mutation calls with proper merging of setup and per-call options
- Support for passing `errorHandler` directly to mutation calls that overrides setup-time error handlers
- Enhanced `QMutationVars` type with optional `axiosOptions` and `errorHandler` fields for type-safe overrides

### Changed

- Extended mutation implementation to merge setup-time and per-call axios configuration options
- Updated JSDoc documentation to reflect new per-mutation override capabilities

## [0.7.0] - 2025-10-13

### Added

- Multipart/form-data support for file upload endpoints
- Type-safe file upload operations alongside existing JSON API support
- `FormData` as valid input type for multipart endpoints with `Writable<Body> | FormData` typing
- Comprehensive test suite for multipart functionality with 11 new test cases

### Changed

- Enhanced `GetRequestBody` type to handle both `application/json` and `multipart/form-data` content types
- Extended toy OpenAPI specification with `uploadPetPic` endpoint demonstrating multipart usage

## [0.6.0] - 2025-10-11

### Added

- Advanced usage examples in README demonstrating automatic operation type detection with `api.useEndpoint`
- Comprehensive cache management and refetching control documentation with practical examples
- Reactive parameter handling examples showing query chaining and conditional enabling
- JSDoc documentation generation with GitHub Pages deployment (`npm run docs`, `npm run docs:publish`)
- Comprehensive test suite for advanced usage patterns (187 total tests)

### Changed

- Enhanced README with detailed "Advanced Usage" section covering real-world scenarios
- Improved development workflow with JSDoc generation integrated into documentation updates
- Updated ESLint configuration to exclude generated documentation files

### Fixed

- Cache management logic in mutations - corrected `dontUpdateCache` and `dontInvalidate` flag handling

## [0.5.0] - 2025-10-11

### Added

- Comprehensive test coverage for TanStack Query and Axios options with 176 total tests
- TypeScript compilation error validation tests to ensure type safety at compile time
- Advanced Axios configuration tests covering request/response transformation, timeout, proxy, authentication
- TanStack Query-specific tests for retry behavior, cache invalidation, data transformation and meta configuration
- Error handler tests for both queries and mutations with async support

### Changed

- Improved code clarity by consolidating imports, extracting shared constants, and removing dead code
- Streamlined type definitions with better organization and reduced complexity
- Enhanced mutation parameter handling to support operations without request bodies

### Fixed

- DELETE operation support - mutations without request bodies now work correctly without requiring `data` parameter
- Type safety for operations with optional request bodies - `data` parameter is now properly optional when not needed

## [0.4.0] - 2025-01-11

### Added

- Comprehensive JSDoc documentation for all `useOpenApi` methods (`useQuery`, `useMutation`, `useEndpoint`)
- New npm scripts: `dev` (test watcher), `check` (comprehensive validation), and `fix` (auto-format and lint)
- Enhanced CLI code generation with streamlined operations format

### Changed

- **Streamlined operations format**: CLI now generates `openapi-typed-operations.ts` with unified metadata and types
- **Improved API structure**: Consolidated API through unified `useOpenApi` composable
- **Enhanced type safety**: Removed type-unsafe string literals in favor of proper `OperationId` usage
- **Updated test suite**: All tests now use the new streamlined operations format
- **Better developer experience**: Simplified setup with improved documentation and workflow scripts

### Fixed

- Type safety issues with operation ID usage throughout codebase
- Removed unnecessary empty objects from API calls

## [0.3.5] - 2024-10-10

### Fixed

- Vue Query options type support for `api.useQuery()` and `api.useMutation()` methods
- TypeScript compilation errors when using options like `staleTime`, `retry`, and `refetchOnWindowFocus`

## [0.3.4] - 2024-10-10

### Changed

- Improved CHANGELOG format to be more concise and focus on user-facing changes
- Updated version bump guidelines to clarify when to use minor vs patch versions
- Enhanced CHANGELOG update rules to emphasize brevity for patch versions

## [0.3.3] - 2024-10-10

### Changed

- Enforced mandatory formatting and linting after every code change
- Updated development workflow requirements for code quality consistency

## [0.3.2] - 2024-10-10

### Added

- `errorHandler` option for custom error processing in queries and mutations
- Support for error recovery patterns with optional return values

### Changed

- **BREAKING**: Error handlers now control error propagation behavior
- Enhanced error handling with try-catch blocks in query and mutation functions

## [0.3.1] - 2024-10-10

### Fixed

- `axiosOptions` not being passed to axios interceptors in `useEndpoint` calls
- Options parameter detection in `useEndpoint` function

### Added

- Integration tests for `axiosOptions` functionality

## [0.2.0] - 2024-10-07

### Added

- ESLint and Prettier configuration for code quality
- GitHub Actions CI workflow
- Linting and formatting npm scripts

### Changed

- Applied consistent code formatting across all source files

## [0.1.0] - 2024-10-06

### Added

- Initial release of Vue OpenAPI Query library
- Type-safe OpenAPI integration for Vue Query (TanStack Query)
- CLI tool for generating TypeScript types from OpenAPI specifications
- Support for query operations (GET requests) with Vue composables
- Support for mutation operations (POST/PUT/PATCH/DELETE) with Vue composables
- Automatic path parameter resolution and validation
- Built-in cache management and query invalidation
- Full TypeScript support with strict typing
