# Vue OpenAPI Query

Type-safe OpenAPI integration for Vue Query (TanStack Query).

## Installation

```bash
npm install @yourorg/vue-openapi-query
```

## Usage

### 1. Initialize the package

```typescript
// api/init.ts
import { initOpenApi } from '@yourorg/vue-openapi-query'
import { QueryClient } from '@tanstack/vue-query'
import axios from 'axios'
import { HttpMethod } from '@yourorg/vue-openapi-query'

// Import your generated OpenAPI types
import type { operations } from './openapi-types'

// Define your operation IDs and info
export enum OperationId {
  listItems = 'listItems',
  getItem = 'getItem',
  createItem = 'createItem',
  updateItem = 'updateItem',
  deleteItem = 'deleteItem',
}

export const OPERATION_INFO = {
  [OperationId.listItems]: { path: '/items/', method: HttpMethod.GET },
  [OperationId.getItem]: { path: '/items/{id}', method: HttpMethod.GET },
  [OperationId.createItem]: { path: '/items/', method: HttpMethod.POST },
  [OperationId.updateItem]: { path: '/items/{id}', method: HttpMethod.PUT },
  [OperationId.deleteItem]: { path: '/items/{id}', method: HttpMethod.DELETE },
}

// Create axios instance
const axiosInstance = axios.create({
  baseURL: 'https://api.example.com',
})

// Create query client
const queryClient = new QueryClient()

// Initialize the package
initOpenApi({
  operations: OPERATION_INFO,
  axios: axiosInstance,
  queryClient,
})
```
