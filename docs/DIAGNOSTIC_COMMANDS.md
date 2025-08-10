# Diagnostic Commands

This document describes the enhanced diagnostic commands that provide comprehensive access to VS Code's diagnostic system (errors, warnings, hints, and information messages) with advanced filtering, formatting, and automation features.

## Available Commands

### `getDiagnostics`

Get all current diagnostics across the workspace with advanced filtering and formatting.

**Usage:**

```
getDiagnostics [options]
```

**Severity Options:**

- `--errors-only` / `-e` - Show only errors
- `--warnings-only` / `-w` - Show only warnings
- `--info-only` / `-i` - Show only information messages
- `--hints-only` / `-H` - Show only hints (changed from -h to avoid help collision)
- `--severity <list>` - Comma-separated severity list (e.g., "error,warning")

**Filtering Options:**

- `--file-pattern` / `-f <pattern>` - Filter files by glob pattern (default) or substring
- `--substring` - Use substring matching instead of glob patterns
- `--max-files <n>` - Limit number of files to process (default: 1000)
- `--max-per-file <n>` - Limit issues shown per file (default: 100)

**Output Format Options:**

- `--summary` / `-s` - Show summary statistics only
- `--compact` / `-c` - Show compact one-line format
- `--json` - Output machine-readable JSON format
- `--no-emoji` - Use plain text markers [E][W][I][H] instead of emoji

**Organization Options:**

- `--group-by <type>` - Group results by: severity, folder, none (default: none)
- `--sort <type>` - Sort results by: severity, path, count (default: severity)

**Automation Options:**

- `--open-first` - Jump to the first diagnostic in editor
- `--open <n>` - Jump to the nth diagnostic in editor

**Examples:**

```bash
# Basic usage
getDiagnostics

# Show only errors and warnings
getDiagnostics --severity error,warning

# Filter by file pattern (glob)
getDiagnostics --file-pattern "src/**/*.ts"

# Compact format for CI/logs
getDiagnostics --compact --no-emoji

# JSON output for automation
getDiagnostics --json

# Group by severity, limit results
getDiagnostics --group-by severity --max-files 10

# Open first error automatically
getDiagnostics --errors-only --open-first
```

### `getFileDiagnostics`

Get diagnostics for a specific file with advanced options.

**Usage:**

```
getFileDiagnostics <filePath> [options]
```

**Severity Options:**

- `--errors-only` / `-e` - Show only errors
- `--warnings-only` / `-w` - Show only warnings
- `--info-only` / `-i` - Show only information messages
- `--hints-only` / `-H` - Show only hints
- `--severity <list>` - Comma-separated severity list

**Output Options:**

- `--no-source` - Don't show diagnostic source
- `--max-per-file <n>` - Limit issues shown (default: 100)
- `--json` - Output JSON format
- `--no-emoji` - Use plain text markers

**Automation Options:**

- `--open-first` - Jump to the first diagnostic
- `--open <n>` - Jump to the nth diagnostic

**Examples:**

```bash
# Basic usage
getFileDiagnostics src/extension.ts

# Only errors, open first one
getFileDiagnostics src/extension.ts --errors-only --open-first

# JSON output for automation
getFileDiagnostics src/extension.ts --json
```

### `watchDiagnostics`

Start, stop, check status, or take snapshot of diagnostic change monitoring.

**Usage:**

```
watchDiagnostics [action] [options]
```

**Actions:**

- `start` - Start monitoring (default)
- `stop` - Stop monitoring
- `status` - Show current status
- `once` - Take a single snapshot diff (useful for CI)

**Filter Options (for start):**

- `--severity <list>` - Monitor only specific severities
- `--file-pattern <pattern>` - Monitor only matching files
- `--debounce <ms>` - Debounce rapid changes (default: 100ms)

**Examples:**

```bash
# Start monitoring all changes
watchDiagnostics start

# Monitor only errors in src folder
watchDiagnostics start --severity error --file-pattern "src/**"

# Check current status
watchDiagnostics status

# Take single snapshot for CI
watchDiagnostics once
```

### `diagnosticStats`

Show diagnostic statistics summary for the workspace.

**Usage:**

```
diagnosticStats
```

## Integration with execFactory

All diagnostic commands are fully integrated with the execFactory system and can be called via:

1. **Direct command execution** - Through the command handler
2. **Ray API tool calls** - Via the `command_calls` array in Ray responses
3. **Batch execution** - Multiple diagnostic commands can be executed together

## VS Code API Integration

The diagnostic commands use the following VS Code APIs:

- `vscode.languages.getDiagnostics()` - Core API to fetch diagnostics
- `vscode.languages.onDidChangeDiagnostics` - Event listener for diagnostic changes
- `vscode.Diagnostic` - Individual diagnostic object format
- `vscode.DiagnosticSeverity` - Severity levels (Error, Warning, Information, Hint)
- `vscode.Uri` - File identification
- `vscode.Range` / `vscode.Position` - Location information

## Output Formats

### Standard Format

```
🔍 **Diagnostic Summary**

📊 **Total:** 5 issues in 2 files
❌ **Errors:** 2
⚠️ **Warnings:** 2
ℹ️ **Info:** 1
💡 **Hints:** 0

📋 **Details:**

📄 `src/extension.ts` — ❌2 ⚠️1 ℹ️1
   ❌ [Error] Cannot find module 'missing-module' (45:23) [typescript] (2307)
   ⚠️ [Warning] Unused variable 'unusedVar' (12:7) [typescript] (6196)
   ℹ️ [Info] Consider using const instead of let (8:5) [typescript]

📄 `src/commands.ts` — ❌1 ⚠️1
   ❌ [Error] Expected ';' (23:15) [typescript] (1005)
   ⚠️ [Warning] Missing return type annotation (15:20) [typescript]
```

### Compact Format

```
🔍 Found 5 issues in 2 files
❌ `src/extension.ts:45:23` - Cannot find module 'missing-module'
⚠️ `src/extension.ts:12:7` - Unused variable 'unusedVar'
ℹ️ `src/extension.ts:8:5` - Consider using const instead of let
❌ `src/commands.ts:23:15` - Expected ';'
⚠️ `src/commands.ts:15:20` - Missing return type annotation
```

### No-Emoji Format

```
[S] **Diagnostic Summary**

[#] **Total:** 5 issues in 2 files
[E] **Errors:** 2
[W] **Warnings:** 2
[I] **Info:** 1
[H] **Hints:** 0

[F] `src/extension.ts` — [E]2 [W]1 [I]1
   [E] [Error] Cannot find module 'missing-module' (45:23) [typescript] (2307)
```

### JSON Format

```json
{
  "totalFiles": 2,
  "totalDiagnostics": 5,
  "errorCount": 2,
  "warningCount": 2,
  "infoCount": 1,
  "hintCount": 0,
  "files": [
    {
      "uri": "file:///path/to/src/extension.ts",
      "relativePath": "src/extension.ts",
      "diagnostics": [...]
    }
  ]
}
```

## File Pattern Matching

### Glob Patterns (Default)

- `src/**/*.ts` - All TypeScript files in src and subdirectories
- `*.js` - All JavaScript files in root
- `test/**` - All files in test directory
- `**/*.{ts,js}` - All TypeScript and JavaScript files anywhere

### Substring Matching

Use `--substring` flag to switch to simple substring matching:

- `src/` - Files containing "src/" in path
- `.ts` - Files containing ".ts" in path

## Quality of Life Features

### Automation Integration

```bash
# Get compact snapshot for CI
getDiagnostics --compact --no-emoji --json

# Open first error automatically
getDiagnostics --errors-only --open-first

# Monitor only critical issues
watchDiagnostics start --severity error --file-pattern "src/**"
```

### Ray API Examples

**Get quick compact snapshot:**

```json
{
  "command_calls": [
    {
      "command": "getDiagnostics",
      "args": ["--compact", "--file-pattern", "src/**", "--no-emoji"]
    }
  ]
}
```

**Open first error automatically:**

```json
{
  "command_calls": [
    {
      "command": "getDiagnostics",
      "args": ["--errors-only", "--open-first"]
    }
  ]
}
```

**JSON output for processing:**

```json
{
  "command_calls": [
    {
      "command": "getDiagnostics",
      "args": ["--json", "--severity", "error,warning"]
    }
  ]
}
```

## Error Handling & Exit Codes

All diagnostic commands include proper error handling:

- **No workspace folder** - Returns appropriate error message
- **File not found** - Handles missing files gracefully
- **Invalid arguments** - Validates input parameters
- **API failures** - Catches and reports VS Code API errors

**Exit Code Semantics:**

- `0` - No diagnostics found (or filtered result empty)
- `1` - Diagnostics found (errors if --errors-only, otherwise any)
- `2` - Usage/API error

## Performance Considerations

- **Caching** - Diagnostic data is cached by VS Code
- **Filtering** - Commands support filtering to reduce output size
- **Limits** - Built-in limits prevent overwhelming output (`--max-files`, `--max-per-file`)
- **Incremental updates** - Watcher only reports actual changes
- **Debouncing** - Rapid changes are debounced to prevent spam
- **Glob optimization** - Efficient pattern matching with minimatch

## Multi-root Workspace Support

In multi-root workspaces, file paths are relative to each file's respective workspace folder, ensuring consistent behavior across different workspace configurations.
