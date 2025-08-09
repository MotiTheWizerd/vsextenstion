# Index-Based Symbol Commands

Fast symbol lookup and navigation using pre-built index files.

## Overview

These commands work with symbol index files (like `basicindex1.json`) to provide lightning-fast symbol search and navigation without relying on VS Code's API.

## Workflow

1. **Load Index**: `loadIndex ./basicindex1.json`
2. **Search Symbols**: `findSymbolFromIndex initContent`
3. **Navigate**: `gotoSymbolFromIndex ./content.js 14 0`

## Commands

### loadIndex

Load a symbol index file into memory for fast lookups.

```bash
# Load default index
loadIndex

# Load specific index file
loadIndex ./workspace-symbols.json
loadIndex /absolute/path/to/index.json
```

**Output:**
```
✅ Loaded basicindex1.json

📊 Statistics:
- Files: 45
- Symbols: 1,247
- Path: `/workspace/basicindex1.json`

🚀 Ready for fast symbol lookups with `findSymbolFromIndex`
```

### findSymbolFromIndex

Search for symbols using the loaded index.

```bash
# Basic search
findSymbolFromIndex initContent

# Case-sensitive search
findSymbolFromIndex MyClass --case-sensitive

# Exact match only
findSymbolFromIndex handleCommand --exact

# Limit results
findSymbolFromIndex init --max-results 10

# Filter by symbol kind
findSymbolFromIndex myFunc --kind Function
```

**Options:**
- `--case-sensitive, -c`: Case-sensitive matching
- `--exact, -e`: Exact name match only (default: substring)
- `--max-results, -m <number>`: Limit number of results
- `--kind, -k <kind>`: Filter by symbol kind

### gotoSymbolFromIndex

Navigate directly to a symbol using file coordinates.

```bash
# Navigate to specific position
gotoSymbolFromIndex ./src/main.ts 45 12

# Open in preview mode
gotoSymbolFromIndex ./utils.js 23 0 --preview

# Don't steal focus
gotoSymbolFromIndex ./config.ts 67 8 --preserve-focus
```

**Options:**
- `--preview`: Open in preview tab
- `--preserve-focus`: Don't steal focus from current editor### 
gotoSymbolByNameFromIndex

Find and navigate to a symbol by name in one command.

```bash
# Navigate to first match
gotoSymbolByNameFromIndex initContent

# Case-sensitive search
gotoSymbolByNameFromIndex MyClass --case-sensitive

# Fuzzy matching (substring search)
gotoSymbolByNameFromIndex handle --fuzzy

# Select specific match if multiple found
gotoSymbolByNameFromIndex init --match 2

# Open in preview without focus
gotoSymbolByNameFromIndex utils --preview --preserve-focus
```

**Options:**
- `--case-sensitive, -c`: Case-sensitive matching
- `--fuzzy, -f`: Use substring matching instead of exact
- `--match, -m <index>`: Select specific match (0-based)
- `--preview`: Open in preview tab
- `--preserve-focus`: Don't steal focus

### indexStatus

Show information about the currently loaded index.

```bash
indexStatus
```

**Output:**
```
✅ Index Status: Loaded

📊 Statistics:
- Symbols: 1,247
- Path: `/workspace/basicindex1.json`
- Created: 2025-01-08T15:30:45.123Z
- Total Files: 45
- Total Symbols: 1,247

🚀 Available Commands:
- `findSymbolFromIndex <name>` - Search symbols
- `gotoSymbolByNameFromIndex <name>` - Navigate to symbol
- `clearIndex` - Clear loaded index
```

### clearIndex

Clear the loaded index from memory.

```bash
clearIndex
```

### showSymbolMenu

Browse all symbols in the loaded index with optional filtering.

```bash
# Show all symbols
showSymbolMenu

# Filter by pattern
showSymbolMenu init

# Limit results
showSymbolMenu handle --max-results 20
```

## Index File Format

The commands expect JSON files with this structure:

```json
{
  "files": [
    {
      "relativePath": "src/main.ts",
      "symbols": [
        {
          "name": "initContent",
          "kind": "Function",
          "detail": "() => void",
          "range": {
            "start": { "line": 14, "character": 0 },
            "end": { "line": 20, "character": 1 }
          }
        }
      ]
    }
  ],
  "metadata": {
    "created": "2025-01-08T15:30:45.123Z",
    "totalFiles": 45,
    "totalSymbols": 1247
  }
}
```

## Performance Benefits

- **Instant search**: No VS Code API calls, pure in-memory lookup
- **Batch operations**: Load once, search many times
- **Offline capable**: Works without active language servers
- **Predictable**: Same results every time, no dynamic analysis

## Use Cases

### Code Navigation
```bash
loadIndex ./project-symbols.json
findSymbolFromIndex handleRequest
gotoSymbolByNameFromIndex handleRequest
```

### Debugging Workflow
```bash
loadIndex ./debug-symbols.json
gotoSymbolFromIndex ./src/error.ts 45 12
gotoSymbolFromIndex ./src/handler.ts 23 5
```

### Code Review
```bash
loadIndex ./review-symbols.json
showSymbolMenu Component --max-results 10
gotoSymbolByNameFromIndex ComponentA --match 0
```

## Error Handling

- **No index loaded**: Commands will prompt to use `loadIndex` first
- **Symbol not found**: Clear error message with suggestions
- **Invalid coordinates**: Positions are clamped to document bounds
- **File not found**: Graceful error with file path information

## Integration with Other Commands

These index commands work well with:
- `createIndex` - Generate index files
- `updateIndex` - Refresh existing indexes
- `exportIndex` - Create portable index files
- `openInEditorCmd` - Open multiple symbol locations