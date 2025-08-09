# Advanced Symbol Commands

The RayDaemon extension provides advanced symbol navigation and reference commands that leverage VS Code's workspace symbol search and reference APIs for precise code navigation.

## findSymbol

Locate a symbol by name across the workspace and return file + location information.

### Usage

```
findSymbol <symbolName> [--case-sensitive|-c] [--exact|-e] [--max-results|-m <number>] [--kind|-k <symbolKind>]
```

### Parameters

- `<symbolName>`: Name of the symbol to search for
- `[--case-sensitive|-c]`: Enable case-sensitive matching (default: case-insensitive)
- `[--exact|-e]`: Require exact name match (default: partial matching)
- `[--max-results|-m <number>]`: Maximum number of results to return (default: 100)
- `[--kind|-k <symbolKind>]`: Filter by specific symbol kinds

### Examples

```bash
# Find all symbols containing "handler"
findSymbol handler

# Find exact matches for "executeCommand"
findSymbol executeCommand --exact

# Find functions only, case-sensitive
findSymbol myFunction --kind function --case-sensitive

# Limit results to 10
findSymbol Component --max-results 10
```

### Output

Returns a formatted list showing:
- Symbol name with icon
- Symbol kind and container (if applicable)
- File path and exact location (line:column)

## getSymbolReferences

List all references to a given symbol, either by file location or by symbol name.

### Usage

**By file location:**
```
getSymbolReferences <filePath> <line> <character> [--no-declaration] [--context|-c <lines>] [--max-results|-m <number>]
```

**By symbol name:**
```
getSymbolReferences --name|-n <symbolName> [--file|-f <filePath>] [--no-declaration] [--context|-c <lines>] [--max-results|-m <number>]
```

### Parameters

- `<filePath>`: Path to file containing the symbol
- `<line>`: Line number (0-based)
- `<character>`: Character position (0-based)
- `<symbolName>`: Name of symbol to find references for
- `[--no-declaration]`: Exclude the symbol declaration from results
- `[--context|-c <lines>]`: Number of context lines around each reference (default: 0)
- `[--max-results|-m <number>]`: Maximum number of references (default: 1000)
- `[--file|-f <filePath>]`: Filter symbol search to specific file

### Examples

```bash
# Get references for symbol at specific location
getSymbolReferences src/extension.ts 45 12

# Get references with 2 lines of context
getSymbolReferences src/extension.ts 45 12 --context 2

# Find references by symbol name
getSymbolReferences --name handleCommand

# Find references for symbol in specific file
getSymbolReferences --name Component --file src/ui/

# Exclude declaration from results
getSymbolReferences --name myFunction --no-declaration
```

### Output

Returns grouped references by file showing:
- File path
- Line numbers and locations
- Context lines (if requested)
- Total reference count

## gotoSymbol

Open a file and jump directly to a symbol definition, either by coordinates or by symbol name.

### Usage

**By file location:**
```
gotoSymbol <filePath> <line> <character> [--preserve-focus]
```

**By symbol name:**
```
gotoSymbol --name|-n <symbolName> [--index|-i <number>] [--file|-f <filePath>] [--exact|-e] [--preserve-focus]
```

### Parameters

- `<filePath>`: Path to file to open
- `<line>`: Line number (0-based)
- `<character>`: Character position (0-based)
- `<symbolName>`: Name of symbol to navigate to
- `[--index|-i <number>]`: Index of symbol if multiple matches (default: 0)
- `[--file|-f <filePath>]`: Filter symbol search to specific file
- `[--exact|-e]`: Require exact symbol name match
- `[--preserve-focus]`: Don't steal focus from current editor

### Examples

```bash
# Navigate to specific coordinates
gotoSymbol src/extension.ts 45 12

# Navigate to symbol by name
gotoSymbol --name handleCommand

# Navigate to second occurrence of symbol
gotoSymbol --name Component --index 1

# Navigate to symbol in specific file
gotoSymbol --name myFunction --file src/commands/

# Exact match navigation
gotoSymbol --name executeCommand --exact
```

### Output

Returns confirmation with:
- Symbol information (name, kind, container)
- File path and location
- Code context around the symbol
- Navigation status

## gotoDefinition

Navigate to the definition of a symbol at a specific location (follows "Go to Definition" behavior).

### Usage

```
gotoDefinition <filePath> <line> <character> [--preserve-focus]
```

### Parameters

- `<filePath>`: Path to file containing the symbol
- `<line>`: Line number (0-based)
- `<character>`: Character position (0-based)
- `[--preserve-focus]`: Don't steal focus from current editor

### Examples

```bash
# Go to definition of symbol at location
gotoDefinition src/extension.ts 45 12

# Go to definition without stealing focus
gotoDefinition src/commands/handler.ts 23 8 --preserve-focus
```

### Output

Returns:
- Source location information
- Definition location and context
- Navigation confirmation

## Symbol Kinds

All commands support filtering by these symbol kinds:

- **FILE**, **MODULE**, **NAMESPACE**, **PACKAGE**
- **CLASS**, **INTERFACE**, **ENUM**, **STRUCT**
- **METHOD**, **FUNCTION**, **CONSTRUCTOR**
- **PROPERTY**, **FIELD**, **VARIABLE**, **CONSTANT**
- **STRING**, **NUMBER**, **BOOLEAN**, **ARRAY**, **OBJECT**
- **KEY**, **NULL**, **ENUM_MEMBER**
- **EVENT**, **OPERATOR**, **TYPE_PARAMETER**

## Integration with VS Code

These commands leverage VS Code's native language services:

- **Workspace Symbol Provider**: For symbol search across the workspace
- **Reference Provider**: For finding all symbol references
- **Definition Provider**: For "Go to Definition" functionality
- **Document Symbol Provider**: For file-specific symbol information

## Error Handling

- **File not found**: Clear error messages for missing files
- **Invalid coordinates**: Validation of line/character positions
- **No symbol provider**: Graceful handling when language services unavailable
- **No references found**: Informative messages when no results
- **Multiple symbols**: Clear indication when multiple matches exist

## Performance Considerations

- **Result limits**: Configurable limits prevent overwhelming output
- **Context control**: Optional context lines for performance
- **File filtering**: Narrow searches to specific files when possible
- **Exact matching**: Use exact matching for better performance when appropriate

## Use Cases

### Code Navigation
- Jump to function definitions
- Find all usages of a variable
- Navigate between related code sections

### Code Analysis
- Understand symbol relationships
- Track variable usage patterns
- Analyze code dependencies

### Refactoring Support
- Find all references before renaming
- Understand impact of changes
- Navigate complex codebases efficiently