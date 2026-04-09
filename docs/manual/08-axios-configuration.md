# Axios Configuration

This guide covers advanced Axios configuration options for queries and mutations, including authentication, request/response transformations, progress tracking, and custom properties.

## What is axiosOptions?

The `axiosOptions` parameter in queries and mutations allows you to pass configuration options directly to the underlying Axios instance. This gives you full control over HTTP behavior while maintaining type safety and integration with TanStack Query.

```typescript
const { data } = api.listPets.useQuery({
  axiosOptions: {
    headers: { 'X-Custom-Header': 'value' },
    timeout: 5000,
  },
})
```

## Standard Axios Options

### Authentication

#### Bearer Token Authentication

```typescript
const { data } = api.listPets.useQuery({
  axiosOptions: {
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
    },
  },
})
```

#### Basic Authentication

```typescript
const { data } = api.listPets.useQuery({
  axiosOptions: {
    auth: {
      username: 'myuser',
      password: 'mypassword',
    },
  },
})
```

#### Custom Authentication Headers

```typescript
const { data } = api.listPets.useQuery({
  axiosOptions: {
    headers: {
      'X-API-Key': 'secret-api-key',
      'X-Request-ID': generateRequestId(),
      'X-Client-Version': '1.0.0',
    },
  },
})
```

### Request Configuration

#### Timeout

```typescript
// Query timeout
const { data } = api.listPets.useQuery({
  axiosOptions: {
    timeout: 5000, // 5 seconds
  },
})

// Mutation timeout
const createPet = api.createPet.useMutation(
  {},
  {
    axiosOptions: {
      timeout: 15000, // 15 seconds for mutations
    },
  },
)
```

#### Override Base URL

```typescript
const { data } = api.listPets.useQuery({
  axiosOptions: {
    baseURL: 'https://backup-api.example.com',
  },
})
```

#### Request Cancellation

```typescript
import { ref, onUnmounted } from 'vue'

const controller = new AbortController()

const { data } = api.listPets.useQuery({
  axiosOptions: {
    signal: controller.signal,
  },
})

// Cancel request on unmount
onUnmounted(() => {
  controller.abort()
})

// Or cancel on demand
const cancelRequest = () => {
  controller.abort()
}
```

### Headers

```typescript
const { data } = api.listPets.useQuery({
  axiosOptions: {
    headers: {
      // Content types
      'Content-Type': 'application/json',
      Accept: 'application/json',

      // Custom headers
      'X-Custom-Header': 'custom-value',
      'X-Request-ID': 'req-123',
      'X-Client-Version': '1.0.0',

      // Authentication
      Authorization: 'Bearer token123',
      'X-API-Key': 'secret-api-key',
    },
  },
})
```

### Parameters

```typescript
const { data } = api.listPets.useQuery({
  axiosOptions: {
    params: {
      // Additional query parameters
      timestamp: Date.now(),
      version: 'v2',
    },
  },
})

// Custom parameter serialization
const { data } = api.listPets.useQuery({
  axiosOptions: {
    paramsSerializer: (params) => {
      return Object.keys(params)
        .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
        .join('&')
    },
  },
})
```

### Request/Response Transformation

#### Transform Request

```typescript
const createPet = api.createPet.useMutation(
  {},
  {
    axiosOptions: {
      transformRequest: [
        (data, headers) => {
          // Apply custom transformation
          const transformed = {
            ...data,
            timestamp: Date.now(),
            clientVersion: '1.0.0',
          }
          return JSON.stringify(transformed)
        },
      ],
    },
  },
)
```

#### Transform Response

```typescript
const { data } = api.listPets.useQuery({
  axiosOptions: {
    transformResponse: [
      (data) => {
        const parsed = JSON.parse(data)
        // Apply custom transformation
        if (Array.isArray(parsed)) {
          return parsed.map((item) => ({
            ...item,
            _loadedAt: Date.now(),
          }))
        }
        return parsed
      },
    ],
  },
})
```

### Progress Tracking

#### Upload Progress

```typescript
const uploadProgress = ref(0)

const uploadMutation = api.uploadFile.useMutation(
  {},
  {
    axiosOptions: {
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          uploadProgress.value = Math.round((progressEvent.loaded * 100) / progressEvent.total)
        }
      },
    },
  },
)

// In template
<template>
  <div v-if="uploadMutation.isPending">
    Uploading: {{ uploadProgress }}%
  </div>
</template>
```

#### Download Progress

```typescript
const downloadProgress = ref(0)

const { data } = api.downloadFile.useQuery({
  fileId: '123',
  axiosOptions: {
    onDownloadProgress: (progressEvent) => {
      if (progressEvent.total) {
        downloadProgress.value = Math.round((progressEvent.loaded * 100) / progressEvent.total)
      }
    },
  },
})

// In template
<template>
  <div v-if="isPending">
    Downloading: {{ downloadProgress }}%
  </div>
</template>
```

### CORS and Credentials

```typescript
const { data } = api.listPets.useQuery({
  axiosOptions: {
    withCredentials: true, // Include cookies in cross-origin requests
    xsrfCookieName: 'XSRF-TOKEN',
    xsrfHeaderName: 'X-XSRF-TOKEN',
  },
})
```

### Proxy Configuration

```typescript
const { data } = api.listPets.useQuery({
  axiosOptions: {
    proxy: {
      protocol: 'http',
      host: 'proxy.example.com',
      port: 8080,
      auth: {
        username: 'proxyuser',
        password: 'proxypass',
      },
    },
  },
})
```

### Response Validation

```typescript
const { data } = api.listPets.useQuery({
  axiosOptions: {
    // Accept 200-299 as success
    validateStatus: (status) => status >= 200 && status < 300,

    // Or custom logic
    validateStatus: (status) => {
      return status === 200 || status === 201 || status === 204
    },
  },
})
```

### Response Configuration

```typescript
const { data } = api.listPets.useQuery({
  axiosOptions: {
    responseType: 'json',
    responseEncoding: 'utf8',
    maxContentLength: 2000, // Max response body size
    maxBodyLength: 1000, // Max request body size
  },
})
```

### Redirect Configuration

```typescript
const { data } = api.listPets.useQuery({
  axiosOptions: {
    maxRedirects: 5, // Maximum number of redirects
    decompress: true, // Automatic decompression
  },
})
```

## Custom Properties

The `AxiosRequestConfigExtended` type supports arbitrary custom properties beyond standard Axios options. This is useful for:

- Custom error handling middleware
- Request tracking and logging
- Custom retry logic
- Request metadata for analytics

### Basic Custom Properties

```typescript
const { data } = api.listPets.useQuery({
  axiosOptions: {
    // Standard Axios options
    timeout: 5000,
    headers: { 'X-Custom-Header': 'value' },

    // Custom properties
    manualErrorHandling: true,
    handledByAxios: false,
    customRetryCount: 3,
    debugMode: true,
  },
})
```

### Complex Custom Properties

```typescript
const { data } = api.listPets.useQuery({
  axiosOptions: {
    timeout: 5000,

    // Request metadata
    requestMetadata: {
      requestId: 'req-123',
      source: 'list-pets',
      userId: 'user-456',
    },

    // Custom error handling
    manualErrorHandling: (error: unknown) => {
      console.log('Handling error:', error)
      return false // Let Axios handle it
    },

    // Custom retry strategy
    customRetryStrategy: {
      maxRetries: 3,
      backoffFactor: 2,
      retryableStatuses: [408, 429, 500, 502, 503, 504],
    },

    // Logging configuration
    loggingConfig: {
      logLevel: 'debug',
      includeHeaders: true,
      includeBody: false,
      includeTiming: true,
    },

    // Request tracking
    requestTrackingId: 'track-456',
  },
})
```

### Using Custom Properties with Interceptors

You can access custom properties in Axios interceptors:

```typescript
// In your API initialization
import axios from 'axios'

const apiClient = axios.create({
  baseURL: 'https://api.example.com',
})

apiClient.interceptors.request.use((config) => {
  // Access custom properties
  if (config.manualErrorHandling) {
    console.log('Manual error handling enabled')
  }

  if (config.loggingConfig) {
    console.log(`[${config.loggingConfig.logLevel}] Request to ${config.url}`)
  }

  if (config.requestMetadata) {
    config.headers['X-Request-ID'] = config.requestMetadata.requestId
    config.headers['X-Request-Source'] = config.requestMetadata.source
  }

  return config
})

// Use in queries
const { data } = api.listPets.useQuery({
  axiosOptions: {
    manualErrorHandling: true,
    loggingConfig: {
      logLevel: 'info',
      includeHeaders: true,
    },
    requestMetadata: {
      requestId: generateRequestId(),
      source: 'list-pets',
    },
  },
})
```

## Merging Behavior

### Hook-Level vs Call-Level Options

For mutations, you can set axios options at hook time and override them at call time:

```typescript
const createPet = api.createPet.useMutation(
  {},
  {
    axiosOptions: {
      timeout: 5000,
      headers: {
        'X-Setup-Header': 'setup-value',
        'Content-Type': 'application/json',
      },
    },
  },
)

// Override at call time
await createPet.mutateAsync({
  data: { name: 'Fluffy' },
  axiosOptions: {
    timeout: 10000, // Override setup timeout
    headers: {
      'X-Call-Header': 'call-value', // Additional header
      'Content-Type': 'application/xml', // Override Content-Type
    },
  },
})
```

**Merging rules:**

- Call-level options override hook-level options
- Headers are merged (call-level headers override hook-level headers for same keys)
- All other properties are completely replaced by call-level options

### Lazy Query Merging

For lazy queries, you can set axios options at hook time and override them in fetch():

```typescript
const query = api.listPets.useLazyQuery({
  axiosOptions: {
    timeout: 5000,
    headers: { 'X-Hook-Level': 'value' },
  },
})

// Override at fetch time
await query.fetch({
  queryParams: { limit: 10 },
  axiosOptions: {
    timeout: 10000, // Override
    headers: { 'X-Fetch-Level': 'value' }, // Additional
  },
})
```

## Common Patterns

### Per-Request Authentication Token

```typescript
const getAuthToken = () => {
  return localStorage.getItem('authToken') || ''
}

const { data } = api.listPets.useQuery({
  axiosOptions: {
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
    },
  },
})
```

### Reactive Authentication

```typescript
const authToken = ref<string>(getAuthToken())

const { data } = api.listPets.useQuery({
  axiosOptions: computed(() => ({
    headers: {
      Authorization: `Bearer ${authToken.value}`,
    },
  })),
})

// Updates when authToken changes
authToken.value = 'new-token'
```

### Request Timeout with Retry

```typescript
const { data } = api.listPets.useQuery({
  axiosOptions: {
    timeout: 5000,
    customRetryStrategy: {
      maxRetries: 3,
      backoffFactor: 2,
      initialDelay: 1000,
    },
  },
})
```

### Conditional Headers

```typescript
const includeDebugHeaders = ref(true)

const { data } = api.listPets.useQuery({
  axiosOptions: computed(() => ({
    headers: {
      ...(includeDebugHeaders.value && {
        'X-Debug-Mode': 'true',
        'X-Request-ID': generateRequestId(),
      }),
    },
  })),
})
```

### Environment-Specific Configuration

```typescript
const isDev = import.meta.env.DEV

const { data } = api.listPets.useQuery({
  axiosOptions: {
    ...(isDev && {
      debugMode: true,
      loggingConfig: {
        logLevel: 'debug',
        includeHeaders: true,
        includeBody: true,
      },
    }),
  },
})
```

## Best Practices

1. **Use axiosOptions sparingly** - Most configuration should be done at the axios instance level (during `createApiClient`)

2. **Prefer reactive values** - Use `computed()` or `ref()` for values that need to update reactively

3. **Don't duplicate authentication** - Set authentication headers globally in the axios instance, per-request only when needed

4. **Use appropriate timeouts** - Queries: 5-10s, Mutations: 15-30s

5. **Handle cancellation** - Use AbortController to cancel requests when components unmount

6. **Avoid excessive transformations** - Request/response transformations can make debugging difficult

7. **Document custom properties** - If using custom properties for interceptors, document them clearly

8. **Test error scenarios** - Test timeouts, cancellations, and network errors

## Complete Example

```typescript
import { ref, computed, onUnmounted } from 'vue'
import { api } from './api/init'

// Authentication token (reactive)
const authToken = ref(localStorage.getItem('authToken') || '')

// Upload progress
const uploadProgress = ref(0)

// Request cancellation
const controller = new AbortController()

onUnmounted(() => {
  controller.abort()
})

// Query with full axios configuration
const {
  data: pets,
  isLoading,
  error,
} = api.listPets.useQuery({
  axiosOptions: computed(() => ({
    // Authentication
    headers: {
      Authorization: `Bearer ${authToken.value}`,
      'X-Request-ID': generateRequestId(),
    },

    // Timeout
    timeout: 5000,

    // Progress tracking
    onDownloadProgress: (progressEvent) => {
      if (progressEvent.total) {
        console.log(`Download progress: ${progressEvent.loaded} / ${progressEvent.total}`)
      }
    },

    // Request cancellation
    signal: controller.signal,

    // Custom properties
    requestMetadata: {
      requestId: generateRequestId(),
      source: 'list-pets',
      userId: getUserId(),
    },

    // Debug mode (development only)
    ...(import.meta.env.DEV && {
      debugMode: true,
      loggingConfig: {
        logLevel: 'debug',
        includeHeaders: true,
        includeBody: false,
        includeTiming: true,
      },
    }),
  })),
})

// Mutation with full axios configuration
const uploadMutation = api.uploadFile.useMutation(
  {},
  {
    axiosOptions: {
      // Authentication
      headers: {
        Authorization: `Bearer ${authToken.value}`,
      },

      // Longer timeout for uploads
      timeout: 60000, // 60 seconds

      // Upload progress
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          uploadProgress.value = Math.round((progressEvent.loaded * 100) / progressEvent.total)
        }
      },

      // Request cancellation
      signal: controller.signal,

      // Custom retry strategy
      customRetryStrategy: {
        maxRetries: 3,
        backoffFactor: 2,
        retryableStatuses: [408, 429, 500, 502, 503, 504],
      },
    },

    // Success handler
    onSuccess: (data) => {
      console.log('Upload successful:', data)
      uploadProgress.value = 0
    },

    // Error handler
    onError: (error) => {
      console.error('Upload failed:', error)
      uploadProgress.value = 0
    },
  },
)

const handleUpload = async (file: File) => {
  const formData = new FormData()
  formData.append('file', file)

  await uploadMutation.mutateAsync({
    data: formData,
  })
}
```

## What's Next?

- [Queries](./02-queries.md) - Learn about queries and query options
- [Mutations](./03-mutations.md) - Learn about mutations and mutation options
- [File Uploads](./05-file-uploads.md) - Learn about file uploads with progress tracking
- [Cache Management](./06-cache-management.md) - Learn about advanced cache control strategies
