# Symbol Commands

The RayDaemon extension provides powerful symbol analysis commands that leverage VS Code's DocumentSymbol API to extract and search for code symbols across your workspace.

## findSymbolsInFile

Extract all top-level and nested symbols from a single file using VS Code's DocumentSymbol API.

### Usage

```
findSymbolsInFile <filePath> [--no-children] [--depth|-d <number>] [--kind|-k <symbolKind>]
```

### Parameters

- `<filePath>`: Path to the file to analyze
- `[--no-children]`: Don't include nested symbols (only top-level)
- `[--depth|-d <number>]`: Maximum nesting depth to analyze (default: 10)
- `[--kind|-k <symbolKind>]`: Filter by specific symbol kinds

### Examples

```bash
# Analyze all symbols in a TypeScript file
findSymbolsInFile src/extension.ts

# Only top-level symbols
findSymbolsInFile src/extension.ts --no-children

# Limit nesting depth
findSymbolsInFile src/extension.ts --depth 2

# Only functions and methods
findSymbolsInFile src/extension.ts --kind function --kind method
```

## findAllSymbols

Walk the entire workspace and gather symbols from all matching files with incremental or full scan capabilities.

### Usage

```
findAllSymbols [directory] [--extensions|-e <extensions>] [--no-children] [--depth|-d <number>] [--max-files <number>] [--max-show <number>] [--no-progress] [--incremental] [--flat] [--kind|-k <symbolKind>]
```

### Parameters

- `[directory]`: Directory to search (default: current directory)
- `[--extensions|-e <extensions>]`: File extensions or groups to analyze (default: "code")
- `[--no-children]`: Don't include nested symbols
- `[--depth|-d <number>]`: Maximum symbol nesting depth (default: 10)
- `[--max-files <number>]`: Maximum files to process (default: 1000)
- `[--max-show <number>]`: Maximum files to show in output (default: 50)
- `[--no-progress]`: Disable progress notifications
- `[--incremental]`: Use incremental processing with delays
- `[--flat]`: Show flat list instead of grouped by file
- `[--kind|-k <symbolKind>]`: Filter by specific symbol kinds

### Examples

```bash
# Analyze all code files in workspace
findAllSymbols

# Analyze only TypeScript files in src directory
findAllSymbols src --extensions .ts,.tsx

# Incremental scan with progress
findAllSymbols --incremental

# Only classes and interfaces
findAllSymbols --kind class --kind interface

# Flat output format
findAllSymbols --flat
```

## searchSymbols

Search for symbols by name across the workspace.

### Usage

```
searchSymbols <query> [directory] [--extensions|-e <extensions>] [--no-children] [--no-progress] [--kind|-k <symbolKind>]
```

### Parameters

- `<query>`: Symbol name to search for (case-insensitive partial matching)
- `[directory]`: Directory to search (default: current directory)
- `[--extensions|-e <extensions>]`: File extensions or groups to search
- `[--no-children]`: Don't include nested symbols in search
- `[--no-progress]`: Disable progress notifications
- `[--kind|-k <symbolKind>]`: Filter by specific symbol kinds

### Examples

```bash
# Find all symbols containing "handler"
searchSymbols handler

# Find functions named "execute" in src directory
searchSymbols execute src --kind function

# Search in TypeScript files only
searchSymbols Component --extensions .ts,.tsx
```

## Symbol Kinds

The following symbol kinds are supported for filtering:

- **FILE** - File symbols
- **MODULE** - Module declarations
- **NAMESPACE** - Namespace declarations
- **PACKAGE** - Package declarations
- **CLASS** - Class declarations
- **METHOD** - Method definitions
- **PROPERTY** - Property declarations
- **FIELD** - Field declarations
- **CONSTRUCTOR** - Constructor methods
- **ENUM** - Enum declarations
- **INTERFACE** - Interface declarations
- **FUNCTION** - Function declarations
- **VARIABLE** - Variable declarations
- **CONSTANT** - Constant declarations
- **STRING** - String literals
- **NUMBER** - Number literals
- **BOOLEAN** - Boolean literals
- **ARRAY** - Array declarations
- **OBJECT** - Object declarations
- **KEY** - Object keys
- **NULL** - Null values
- **ENUM_MEMBER** - Enum members
- **STRUCT** - Struct declarations
- **EVENT** - Event declarations
- **OPERATOR** - Operator declarations
- **TYPE_PARAMETER** - Type parameters

## Extension Groups

All symbol commands support the same extension groups as `findByExtension`:

- **code**: Programming language files
- **web**: Web development files
- **docs**: Documentation files
- **config**: Configuration files
- **images**: Image files
- **media**: Media files
- **data**: Data files

## Output Format

### Symbol Display

Each symbol is displayed with:
- Icon representing the symbol kind
- Symbol name
- Optional detail information
- Location (line:column)
- Nested symbols (indented)

### Icons

- 📄 File
- 📦 Module/Package
- 🏷️ Namespace/Type Parameter
- 🏛️ Class
- ⚡ Method/Function/Event
- 🔧 Property/Field
- 🏗️ Constructor/Struct
- 📋 Enum/Enum Member
- 🔌 Interface
- 📊 Variable
- 🔒 Constant
- 📝 String
- 🔢 Number
- ✅ Boolean
- 📚 Array
- 🔑 Key
- ❌ Null
- ➕ Operator

## Performance Considerations

- **Large Workspaces**: Use `--max-files` to limit processing
- **Progress Tracking**: Disable with `--no-progress` for faster execution
- **Incremental Mode**: Use `--incremental` for better responsiveness
- **Symbol Filtering**: Use `--kind` filters to reduce output size
- **Extension Filtering**: Specify exact extensions instead of groups for better performance

## Error Handling

- Files without symbol providers are skipped with warnings
- Permission errors are logged but don't stop the analysis
- Invalid symbol kinds are ignored
- Progress notifications show completion status and error counts