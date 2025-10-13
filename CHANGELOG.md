# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- TanStack Query-specific tests for retry behavior, cache invalidation, data transformation, and meta configuration
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
