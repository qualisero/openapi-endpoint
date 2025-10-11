# Vue OpenAPI Query

[![npm version](https://badge.fury.io/js/@qualisero%2Fopenapi-endpoint.svg)](https://badge.fury.io/js/@qualisero%2Fopenapi-endpoint)
[![CI](https://github.com/qualisero/openapi-endpoint/workflows/CI/badge.svg)](https://github.com/qualisero/openapi-endpoint/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/@qualisero/openapi-endpoint)](https://bundlephobia.com/package/@qualisero/openapi-endpoint)

Type-safe OpenAPI integration for Vue Query (TanStack Query).

## Overview

Let's you get TanStack Vue Query composables that enforce consistency (name of endpoints, typing) with your API's `openapi.json` file:

```typescript
const { data, isLoading } = api.useQuery(OperationId.getPet, { petId: '123' })

const createPetMutation = api.useMutation(OperationId.createPet)
createPetMutation.mutate({ data: { name: 'Fluffy', species: 'cat' } })
```

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
- `api-operations.ts` - Streamlined operation definitions combining metadata and types

## Usage

### 1. Initialize the package

```typescript
// api/init.ts
import { useOpenApi } from '@qualisero/openapi-endpoint'
import axios from 'axios'

// Import your generated operations (includes both metadata and types)
import { OperationId, openApiOperations, type OpenApiOperations } from './generated/api-operations'

// Create axios instance
const axiosInstance = axios.create({
  baseURL: 'https://api.example.com',
})

// Initialize the package with the streamlined operations
const api = useOpenApi<OpenApiOperations>({
  operations: openApiOperations,
  axios: axiosInstance,
})

// Export for use in other parts of your application
export { api, OperationId }
```

### 2. Use the API in your components

```typescript
// In your Vue components
import { api, OperationId } from './api/init'

// Use queries for GET operations
const { data: pets, isLoading } = api.useQuery(OperationId.listPets)
const { data: pet } = api.useQuery(OperationId.getPet, { petId: '123' })

// Use mutations for POST/PUT/PATCH/DELETE operations
const createPetMutation = api.useMutation(OperationId.createPet)

// Execute mutations
await createPetMutation.mutateAsync({
  data: { name: 'Fluffy', species: 'cat' },
})
```
