# File Uploads

This guide covers how to handle file uploads using `multipart/form-data` with `@qualisero/openapi-endpoint`.

## File Upload Overview

File uploads use the `multipart/form-data` content type, which allows sending binary files along with other form data. This library supports both:

- **FormData objects** - Directly upload browser `FormData` instances
- **Binary strings** - Upload binary data as string (for some APIs)

## Basic File Upload with FormData

### Simple Single File Upload

```typescript
import { api } from './api/init'
import { QueryOperationId, MutationOperationId } from './api/generated/api-operations'

async function uploadAvatar(userId: string, file: File) {
  const formData = new FormData()
  formData.append('avatar', file)

  const uploadMutation = api.useMutation(MutationOperationId.uploadUserAvatar, { userId })

  return uploadMutation.mutateAsync({
    data: formData,
  })
}

// Usage
const fileInput = document.querySelector('input[type="file"]')
const file = fileInput.files[0]
await uploadAvatar('123', file)
```

### File Upload with Additional Fields

```typescript
import { api } from './api/init'

async function uploadDocument(userId: string, file: File, description: string) {
  const formData = new FormData()
  formData.append('document', file)
  formData.append('description', description)

  const uploadMutation = api.useMutation(MutationOperationId.uploadUserDocument, { userId })

  return uploadMutation.mutateAsync({
    data: formData,
  })
}

await uploadDocument('123', file, 'Contract document')
```

## Vue Component File Upload

### Complete File Upload Component

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { api } from './api/init'

const fileInput = ref<HTMLInputElement | null>(null)
const isUploading = ref(false)
const uploadError = ref<string | null>(null)

const uploadAvatar = async (userId: string, file: File) => {
  isUploading.value = true
  uploadError.value = null

  try {
    const formData = new FormData()
    formData.append('avatar', file)

    const uploadMutation = api.useMutation(MutationOperationId.uploadUserAvatar, { userId })
    await uploadMutation.mutateAsync({
      data: formData,
    })

    alert('Upload successful!')
  } catch (error) {
    uploadError.value = error instanceof Error ? error.message : 'Upload failed'
  } finally {
    isUploading.value = false
  }
}

const handleFileChange = (userId: string) => {
  const file = fileInput.value?.files?.[0]
  if (file) {
    uploadAvatar(userId, file)
  }
}
</script>

<template>
  <div>
    <input ref="fileInput" type="file" @change="handleFileChange('123')" accept="image/*" />
    <p v-if="isUploading">Uploading...</p>
    <p v-if="uploadError" class="error">{{ uploadError }}</p>
  </div>
</template>
```

### File Upload with Progress

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { api } from './api/init'

const file = ref<File | null>(null)
const uploadProgress = ref(0)
const isUploading = ref(false)

const uploadFile = async () => {
  if (!file.value) return

  isUploading.value = true
  uploadProgress.value = 0

  try {
    const formData = new FormData()
    formData.append('file', file.value)

    const uploadMutation = api.useMutation(
      'uploadDocument',
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

    await uploadMutation.mutateAsync({ data: formData })
  } finally {
    isUploading.value = false
  }
}
</script>

<template>
  <div>
    <input type="file" @change="(e) => (file = e.target.files[0])" />
    <button @click="uploadFile" :disabled="isUploading || !file">Upload</button>

    <div v-if="isUploading" class="progress-bar">
      <div class="progress-fill" :style="{ width: uploadProgress + '%' }"></div>
    </div>
    <p>{{ uploadProgress }}%</p>
  </div>
</template>
```

## Multiple File Uploads

### Upload Multiple Files

```typescript
import { api } from './api/init'

async function uploadMultipleFiles(userId: string, files: File[]) {
  const formData = new FormData()

  files.forEach((file, index) => {
    formData.append(`files[${index}]`, file)
    // Or use same field name:
    // formData.append('files', file)
  })

  const uploadMutation = api.useMutation(MutationOperationId.uploadUserFiles, { userId })

  return uploadMutation.mutateAsync({
    data: formData,
  })
}

// Usage
const fileInput = document.querySelector('input[type="file"][multiple]')
const files = Array.from(fileInput.files)
await uploadMultipleFiles('123', files)
```

## Binary String Upload

Some APIs accept binary data as string instead of FormData:

```typescript
import { api } from './api/init'

async function uploadBinaryData(userId: string, binaryString: string) {
  const uploadMutation = api.useMutation(MutationOperationId.uploadUserAvatar, { userId })

  return uploadMutation.mutateAsync({
    data: {
      file: binaryString, // Binary data as string
    },
  })
}

// Convert File to binary string
const file = fileInput.files[0]
const reader = new FileReader()
reader.onload = async () => {
  const binaryString = reader.result as string
  await uploadBinaryData('123', binaryString)
}
reader.readAsBinaryString(file)
```

## File Upload with Cache Invalidation

```typescript
import { api } from './api/init'

const { data: userProfile } = api.useQuery(QueryOperationId.getUserProfile, { userId: '123' })

const uploadAvatar = async (userId: string, file: File) => {
  const formData = new FormData()
  formData.append('avatar', file)

  const uploadMutation = api.useMutation(
    'uploadUserAvatar',
    { userId },
    {
      // Automatically invalidate related queries after upload
      invalidateOperations: ['getUserProfile'],

      onSuccess: (data) => {
        console.log('Avatar uploaded:', data)
        // userProfile will automatically refetch
      },
      onError: (error) => {
        console.error('Upload failed:', error)
      },
    },
  )

  return uploadMutation.mutateAsync({
    data: formData,
  })
}
```

## File Type Validation

### Validate File Type Before Upload

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { api } from './api/init'

const file = ref<File | null>(null)
const error = ref<string | null>(null)

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

const handleFileSelect = (e: Event) => {
  const selectedFile = (e.target as HTMLInputElement).files?.[0]
  if (!selectedFile) return

  // Validate file type
  if (!ALLOWED_TYPES.includes(selectedFile.type)) {
    error.value = `Invalid file type. Allowed: ${ALLOWED_TYPES.join(', ')}`
    return
  }

  // Validate file size
  if (selectedFile.size > MAX_SIZE) {
    error.value = 'File too large. Maximum size is 5MB'
    return
  }

  file.value = selectedFile
  error.value = null
}

const uploadFile = async () => {
  if (!file.value) return

  const formData = new FormData()
  formData.append('file', file.value)

  const uploadMutation = api.useMutation(
    'uploadDocument',
    {},
    {
      onSuccess: () => {
        file.value = null
        alert('Upload successful!')
      },
      onError: (err) => {
        error.value = err instanceof Error ? err.message : 'Upload failed'
      },
    },
  )

  await uploadMutation.mutateAsync({ data: formData })
}
</script>

<template>
  <div>
    <input type="file" accept="image/jpeg,image/png,image/gif" @change="handleFileSelect" />
    <button @click="uploadFile" :disabled="!file">Upload</button>

    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>
```

## Image Preview Before Upload

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { api } from './api/init'

const file = ref<File | null>(null)
const previewUrl = ref<string | null>(null)

const handleFileSelect = (e: Event) => {
  const selectedFile = (e.target as HTMLInputElement).files?.[0]
  if (!selectedFile) return

  file.value = selectedFile

  // Create preview URL
  previewUrl.value = URL.createObjectURL(selectedFile)
}

const uploadFile = async () => {
  if (!file.value) return

  const formData = new FormData()
  formData.append('avatar', file.value)

  const uploadMutation = api.useMutation(
    'uploadUserAvatar',
    { userId: '123' },
    {
      onSuccess: () => {
        // Cleanup preview
        if (previewUrl.value) {
          URL.revokeObjectURL(previewUrl.value)
          previewUrl.value = null
        }
        file.value = null
      },
    },
  )

  await uploadMutation.mutateAsync({ data: formData })
}
</script>

<template>
  <div>
    <input type="file" @change="handleFileSelect" accept="image/*" />
    <div v-if="previewUrl" class="preview">
      <img :src="previewUrl" alt="Preview" />
      <button @click="uploadFile">Upload</button>
    </div>
  </div>
</template>
```

## Best Practices

1. **Validate files on client** - Check file type and size before uploading to save bandwidth

2. **Show upload progress** - Use axios's `onUploadProgress` to show feedback to users

3. **Invalidate cache on success** - Automatically refresh related queries after upload

4. **Handle errors gracefully** - Show clear error messages when uploads fail

5. **Clean up resources** - Use `URL.revokeObjectURL()` for preview URLs

6. **Use FormData for uploads** - It's the standard way to upload files in browsers

7. **Test with real files** - File uploads can have issues that don't appear with small test data

## What's Next?

- [Cache Management](./06-cache-management.md) - Learn about advanced cache control strategies
