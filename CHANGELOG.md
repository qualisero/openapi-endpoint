# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
