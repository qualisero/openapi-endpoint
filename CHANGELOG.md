# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.3] - 2024-10-10

### Changed

- **ENFORCED**: Mandatory format and lint fixing after every code change
- Enhanced copilot instructions with explicit zero-tolerance formatting policy
- Updated workflow to require `npm run lint:fix` and `npm run format` after every code modification
- Standardized format commands to use npm scripts instead of direct tool calls
- Added critical section emphasizing that no code changes are acceptable without proper formatting
- Updated project state information to reflect current versions and tooling

### Developer Experience

- Clear workflow documentation for mandatory formatting steps
- Enhanced AI assistant guidelines with non-negotiable formatting requirements
- Strengthened enforcement language to eliminate formatting compliance issues

## [0.3.2] - 2024-10-10

### Added

- Added `errorHandler` option to `QueryOptions` and `MutationOptions` types
- Custom error handler function can now be provided to `api.useQuery()` and `api.useMutation()` calls
- Error handlers are called with the error object when axios calls fail, allowing custom error processing
- Error handlers support both synchronous and asynchronous functions
- Error handlers can optionally return a value to recover from errors, or throw/rethrow to propagate errors

### Changed

- Enhanced query and mutation functions to include try-catch blocks for error handling
- Both `queryFn` and `mutationFn` now support optional custom error handling
- **BREAKING**: When an `errorHandler` is provided, it is responsible for deciding whether to rethrow errors or not
- If `errorHandler` doesn't throw and returns `undefined`, the operation is considered "recovered" and succeeds with undefined data
- If `errorHandler` returns a value, that value is used as the operation result
- Without an `errorHandler`, the original error throwing behavior is preserved

## [0.3.1] - 2024-10-10

### Fixed

- Fixed `axiosOptions` not being passed to axios interceptors in `useEndpoint` calls
- The `optionsOrNull` parameter in `useEndpoint` function now properly detects when options are passed as the first argument
- Custom headers and configuration (like `skipErrorHandling`) are now accessible in axios interceptors

### Added

- Comprehensive integration tests for `axiosOptions` functionality using real axios instances
- Version management requirements in development guidelines
- Changelog update requirements for all code changes

### Changed

- Updated copilot instructions to require version bumping and changelog updates for every code change
- Package version bumped from 0.3.0 to 0.3.1

## [0.2.0] - 2024-10-07

### Added

- ESLint configuration with TypeScript support
- Prettier code formatting integration
- GitHub Actions CI workflow for code quality checks
- New npm scripts for linting and formatting:
  - `lint` - Run ESLint on all files
  - `lint:fix` - Auto-fix linting issues where possible
  - `format` - Format all files with Prettier
  - `format:check` - Check if files are properly formatted

### Changed

- Applied consistent code formatting across all source files
- Improved code quality with automated linting rules

### Developer Experience

- CI pipeline now validates code style and formatting
- Automatic enforcement of consistent code standards
- Better development workflow with integrated tooling

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
