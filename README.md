# Vue OpenAPI Query

Type-safe OpenAPI integration for Vue Query (TanStack Query).

## Installation

```bash
npm install @qualisero/openapi-endpoint
```

## Code Generation

This package includes a command-line tool to generate TypeScript types and operation definitions from your OpenAPI specification:

```bash
# Generate from local file
npx @qualisero/openapi-endpoint ./api/openapi.json ./src/generated

# Generate from remote URL
npx @qualisero/openapi-endpoint https://api.example.com/openapi.json ./src/api
```

This will generate two files in your specified output directory:

- `openapi-types.ts` - TypeScript type definitions for your API
- `api-operations.ts` - Operation IDs and metadata for use with this library

## Usage

### 1. Initialize the package

```typescript
// api/init.ts
import { useOpenApi } from '@qualisero/openapi-endpoint'
import { QueryClient } from '@tanstack/vue-query'
import axios from 'axios'

// Import your generated OpenAPI types and operations
import type { operations } from './generated/openapi-types'
import { OperationId, OPERATION_INFO } from './generated/api-operations'

// Create axios instance
const axiosInstance = axios.create({
  baseURL: 'https://api.example.com',
})

// Properly type the operations for the library
const operationInfoDict = OPERATION_INFO
type OperationsWithInfo = operations & typeof operationInfoDict

// Initialize the package
const api = useOpenApi({
  operations: operationInfoDict as OperationsWithInfo,
  axios: axiosInstance,
})
```
