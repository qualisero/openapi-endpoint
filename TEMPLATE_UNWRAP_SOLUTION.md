# Vue Template Ref Auto-Unwrapping - SOLUTION FOUND

## Problem

Destructured refs from `openapi-endpoint`'s `useQuery` were not auto-unwrapped in Vue SFC templates when using `pnpm link`, requiring explicit `.value` access.

## Root Cause

**pnpm's `link` command uses symlinks which cause TypeScript/Vue's template type-checker to treat types from linked packages differently than installed packages**, preventing proper ref unwrapping even when type definitions are identical.

## Solution

✅ **Use `file:` protocol instead of `pnpm link` for local development**

### Before (doesn't work):

```bash
pnpm link ~/Projects/openapi-endpoint
```

### After (works perfectly):

```bash
pnpm add file:../../Projects/openapi-endpoint
```

Or in `package.json`:

```json
{
  "dependencies": {
    "@qualisero/openapi-endpoint": "file:../../Projects/openapi-endpoint"
  }
}
```

## Why This Works

- `file:` protocol creates a proper installation with correct peer dependency resolution
- Types are resolved through normal node_modules structure
- Vue's template type-checker recognizes refs from `file:` packages for auto-unwrapping
- `pnpm link` symlinks bypass normal dependency resolution, causing type identity issues

## Verification

✅ Template unwrapping works: `{{ data?.length }}`  
✅ Strong typing preserved  
✅ All type safety maintained  
✅ No changes needed to source code

## Implementation Details

### Code Changes Made (for correctness, not just the fix):

1. Wrapped `data` as `ComputedRef` instead of `Ref` for consistency:

   ```typescript
   return {
     ...query,
     data: computed(() => query.data.value) as ComputedRef<ApiResponse<Ops, Op> | undefined>,
     isEnabled,
     queryKey,
     onLoad,
     pathParams: resolvedPathParams,
   }
   ```

2. Used `ReturnType<typeof useEndpointQuery>` for proper type inference:
   ```typescript
   export type EndpointQueryReturn<Ops, Op> = ReturnType<typeof useEndpointQuery<Ops, Op>> & {
     onLoad: (callback: (data: ApiResponse<Ops, Op>) => void) => void
   }
   ```

## For Users

### Published Package (npm)

✅ Works out of the box - no special setup needed

### Local Development

✅ Use `file:` protocol for local package:

```bash
cd your-project
pnpm add file:../path/to/openapi-endpoint
```

After changes to openapi-endpoint:

```bash
cd openapi-endpoint
npm run build
# No need to reinstall - file: protocol picks up changes automatically
```

## Summary

The issue was **NOT** with the type definitions or implementation, but with how `pnpm link` handles module resolution. Using `file:` protocol instead of symlinks resolves the issue completely while maintaining full type safety and Vue template ref auto-unwrapping.
