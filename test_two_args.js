// Quick test to verify two-argument behavior
import { useOpenApi } from './src/index.js'
import { OperationId, openApiOperations } from './tests/fixtures/openapi-typed-operations.js'
import { mockAxios } from './tests/setup.js'

const mockConfig = {
  operations: openApiOperations,
  axios: mockAxios,
}

const api = useOpenApi(mockConfig)

// Test 2-argument syntax (should work)
try {
  const query = api.useQuery(OperationId.listPets, {
    staleTime: 10000,
  })
  console.log('✅ Two-argument syntax works:', !!query)
} catch (error) {
  console.log('❌ Two-argument syntax failed:', error.message)
}

// Test 3-argument syntax (current tests)
try {
  const query = api.useQuery(OperationId.listPets, undefined, {
    staleTime: 10000,
  })
  console.log('✅ Three-argument syntax works:', !!query)
} catch (error) {
  console.log('❌ Three-argument syntax failed:', error.message)
}