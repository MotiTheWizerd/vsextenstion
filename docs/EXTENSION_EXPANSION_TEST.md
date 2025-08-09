# Extension Expansion Test

This document shows how the `expandExtensions()` helper function works to fix the critical bug.

## The Problem

Before the fix:
- `findAllSymbols` with default `extensions = "code"`
- This string was passed directly to `findByExtension`
- `findByExtension` would normalize "code" to ".code"
- Result: Search for files with `.code` extension (which don't exist)

## The Solution

After the fix with `expandExtensions()`:

```typescript
function expandExtensions(extensions: string | string[]): string | string[] {
  if (Array.isArray(extensions)) {
    return extensions;
  }
  
  // Check if it's a known extension group
  if (extensions in EXTENSION_GROUPS) {
    return EXTENSION_GROUPS[extensions as keyof typeof EXTENSION_GROUPS];
  }
  
  // Check if it's comma-separated extensions
  if (extensions.includes(",")) {
    return extensions.split(",").map(ext => ext.trim());
  }
  
  // Return as-is (single extension)
  return extensions;
}
```

## Test Cases

| Input | Output |
|-------|--------|
| `"code"` | `['.js', '.ts', '.jsx', '.tsx', '.py', '.java', ...]` |
| `"web"` | `['.html', '.css', '.scss', '.sass', '.less', '.vue', '.svelte']` |
| `".ts"` | `".ts"` |
| `".js,.ts"` | `[".js", ".ts"]` |
| `[".py", ".js"]` | `[".py", ".js"]` |

## Commands Fixed

1. **findAllSymbols**: Now properly expands "code" to actual programming language extensions
2. **searchSymbols**: Now properly expands "code" to actual programming language extensions

Both commands now call `expandExtensions(extensions)` before passing to the underlying functions.

## Verification

To verify the fix works:

1. Run `findAllSymbols` (should find TypeScript, JavaScript, Python files, etc.)
2. Run `searchSymbols myFunction` (should search in actual code files)
3. Both should now work with the default "code" extension group