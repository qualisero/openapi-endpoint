# Test Suite for OpenAPI Endpoint Library

This directory contains comprehensive unit tests for the `@qualisero/openapi-endpoint` library.

## Test Structure

### Test Files

- **`openapi-utils.test.ts`** - Tests for utility functions (path resolution, query key generation, etc.)
- **`openapi-helpers.test.ts`** - Tests for helper functions (operation info, query/mutation detection, etc.)
- **`main-composables.test.ts`** - Tests for the main `useOpenApi` composable and its methods
- **`advanced-composables.test.ts`** - Advanced tests for individual composables with complex scenarios
- **`cli.test.ts`** - Tests for CLI code generation functionality
- **`cli-integration.test.ts`** - Integration tests validating the toy OpenAPI specification

### Test Fixtures

- **`fixtures/toy-openapi.json`** - A complete OpenAPI 3.0.3 specification for testing
  - Includes Pet Store API with CRUD operations
  - Covers various REST patterns (collection, resource, nested resources)
  - Includes proper schemas, parameters, and responses

## Test Coverage

Current test coverage (as of latest run):
- **Overall**: 72.44% statement coverage
- **Branches**: 89.06% branch coverage
- **Functions**: 76% function coverage

### Coverage by File
| File | Statements | Branches | Functions | Notes |
|------|------------|----------|-----------|-------|
| `index.ts` | 100% | 100% | 100% | Main entry point fully covered |
| `openapi-utils.ts` | 100% | 94.44% | 100% | Utility functions fully covered |
| `openapi-helpers.ts` | 97.18% | 76.47% | 100% | Helper functions well covered |
| `openapi-endpoint.ts` | 90.47% | 80% | 100% | Generic endpoint handler mostly covered |
| `openapi-query.ts` | 69.73% | 91.66% | 40% | Query composables partially covered |
| `openapi-mutation.ts` | 37.6% | 100% | 25% | Mutation composables need more coverage |
| `types.ts` | 100% | 100% | 100% | Type definitions fully covered |

## Running Tests

### Basic Commands

```bash
# Run all tests once
npm run test:run

# Run tests in watch mode
npm test

# Run tests with coverage
npm run test:coverage

# Run tests with UI (browser interface)
npm run test:ui
```

### Test Configuration

Tests are configured using Vitest with:
- **Environment**: jsdom (for Vue reactivity simulation)
- **Mocking**: Vue, TanStack Query, and Axios are mocked via `tests/setup.ts`
- **Global**: `describe`, `it`, `expect`, `vi` are available globally

## Test Approach

### Mocking Strategy

Since this is a library with peer dependencies (Vue, TanStack Query, Axios), we mock these dependencies to:
- Isolate the library's logic
- Avoid version conflicts during testing
- Focus on testing the library's own functionality

### Key Testing Patterns

1. **Type Safety**: Tests validate TypeScript type constraints and runtime behavior
2. **Path Resolution**: Comprehensive testing of OpenAPI path parameter handling
3. **Operation Detection**: Tests for distinguishing between query and mutation operations
4. **Error Handling**: Validation of error scenarios and edge cases
5. **Integration**: End-to-end scenarios using the toy OpenAPI specification

### Test Data

The toy OpenAPI specification (`fixtures/toy-openapi.json`) includes:
- **6 operations**: `listPets`, `createPet`, `getPet`, `updatePet`, `deletePet`, `listUserPets`
- **Multiple HTTP methods**: GET, POST, PUT, DELETE
- **Path parameters**: `{petId}`, `{userId}`
- **Nested resources**: `/users/{userId}/pets`
- **Complete schemas**: Pet, NewPet with proper typing

## Test Categories

### Unit Tests
- Individual function testing
- Isolated component behavior
- Error condition handling
- Type safety validation

### Integration Tests
- Multi-component interactions
- OpenAPI specification validation
- Code generation logic testing
- End-to-end scenarios

### CLI Tests
- Command-line interface validation
- Code generation patterns
- File structure validation
- OpenAPI parsing logic

## Adding New Tests

When adding new functionality:

1. **Create tests first** (TDD approach recommended)
2. **Follow existing patterns** for consistency
3. **Mock external dependencies** appropriately
4. **Test both success and error paths**
5. **Validate TypeScript constraints** at runtime
6. **Update this README** if adding new test categories

### Test File Naming
- `*.test.ts` for unit tests
- `*-integration.test.ts` for integration tests
- Place in `tests/unit/` directory

### Common Test Utilities
- Use `vi.fn()` for mocking functions
- Use `expect().toThrow()` for error testing
- Use type assertions for TypeScript validation
- Mock reactive values with `{ value: ... }` pattern

## Continuous Integration

Tests are designed to run in CI environments with:
- No external dependencies
- Deterministic results
- Fast execution (< 3 seconds total)
- Clear error messages

## Notes

- CLI tests use pure functions to avoid Node.js mocking complexity
- Peer dependencies are intentionally not installed (library pattern)
- Coverage focuses on library logic, not mocked dependencies
- Tests validate both compile-time and runtime behavior