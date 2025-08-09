# Opening Multiple Files with openInEditorCmd

The `openInEditorCmd` command provides flexible support for opening multiple files in VS Code with various layout options and positioning control.

## Basic Usage

### Single File

```bash
# Open a single file
openInEditorCmd src/main.ts

# Open file at specific line and column
openInEditorCmd src/main.ts --line 45 --column 12
```

### Multiple Files - Simple

```bash
# Open multiple files as tabs in the same editor group
openInEditorCmd src/main.ts src/utils.ts src/config.ts

# Open files with mixed positioning
openInEditorCmd src/main.ts src/utils.ts:45 src/config.ts:12:5
```

## Advanced Multiple File Syntax

### File:Line:Column Format

```bash
# Open files with specific positions using colon notation
openInEditorCmd file1.ts:10:5 file2.ts:25 file3.ts

# Mix positioned and non-positioned files
openInEditorCmd README.md src/main.ts:45:12 package.json:8
```

### Layout Options

#### Tabs Layout (Default)

```bash
# All files open as tabs in the same editor group
openInEditorCmd --layout tabs file1.ts file2.ts file3.ts
```

#### Split Layout

```bash
# First file in main column, others create splits
openInEditorCmd --layout split file1.ts file2.ts file3.ts
```

#### Columns Layout

```bash
# Distribute files across specific columns (1, 2, 3, then cycle)
openInEditorCmd --layout columns file1.ts file2.ts file3.ts file4.ts
```

## Options

### Focus Control

```bash
# Don't steal focus from current editor
openInEditorCmd --preserve-focus file1.ts file2.ts

# Open in preview mode (single preview tab)
openInEditorCmd --preview file1.ts
```

### Combined Examples

```bash
# Open multiple files in split layout with positioning
openInEditorCmd --layout split --preserve-focus \
  src/main.ts:45:12 \
  src/utils.ts:23 \
  tests/main.test.ts:67:8

# Open config files as tabs
openInEditorCmd --layout tabs \
  package.json:5 \
  tsconfig.json:12 \
  .eslintrc.json \
  README.md:1
```

## Use Cases

### Code Review

```bash
# Open related files for review
openInEditorCmd --layout split \
  src/feature.ts:1 \
  src/feature.test.ts:1 \
  docs/feature.md:1
```

### Debugging Session

```bash
# Open files at error locations
openInEditorCmd --layout columns \
  src/main.ts:45:12 \
  src/utils.ts:23:5 \
  src/config.ts:67:8
```

### Documentation Writing

```bash
# Open docs and related source files
openInEditorCmd --layout split \
  README.md:1 \
  docs/api.md:1 \
  src/api.ts:1
```

### Jump to Definition Results

```bash
# Open multiple definition locations
openInEditorCmd --layout tabs \
  src/types.ts:15:8 \
  src/interfaces.ts:23:12 \
  src/models.ts:45:6
```

## Output Format

The command provides detailed feedback about the operation:

```
📁 **Opened 3/3 files (split layout)**

✅ src/main.ts:45:12
✅ src/utils.ts:23
❌ Failed to open src/missing.ts: File not found
```

## Error Handling

- **Individual file failures** don't stop the entire operation
- **Invalid line/column numbers** are validated and reported
- **Missing files** are reported but don't prevent other files from opening
- **Layout conflicts** are handled gracefully with fallbacks

## Integration with Other Commands

### With Symbol Search

```bash
# Find symbols and open their locations
findSymbol handleCommand --max-results 3
# Then use the results:
openInEditorCmd --layout split \
  src/commands/handler.ts:45:8 \
  src/commands/registry.ts:23:12 \
  src/utils/parser.ts:67:5
```

### With Text Search

```bash
# Search for text and open matches
searchText "TODO" --max-results 5
# Then open the files:
openInEditorCmd --layout tabs \
  src/main.ts:12 \
  src/utils.ts:45 \
  src/config.ts:23
```

### With Index Results

```bash
# Export index and open related files
createIndex --output workspace.json
openInEditorCmd --layout split \
  workspace.json:1 \
  src/main.ts:1 \
  README.md:1
```

## Performance Considerations

- **Batch delays**: 100ms delay between file opens to avoid overwhelming VS Code
- **Error isolation**: Individual file failures don't affect other files
- **Layout optimization**: Different layouts optimize for different use cases
- **Focus management**: Smart focus control to avoid disrupting workflow

## Tips and Best Practices

1. **Use layout options** to organize files logically for your task
2. **Combine with search commands** to quickly open relevant files
3. **Use preserve-focus** when opening reference files you don't need to edit immediately
4. **Leverage colon notation** for precise positioning from search results
5. **Mix positioned and non-positioned files** as needed for your workflow

## Limitations

- **Maximum files**: Practical limit around 10-15 files to avoid UI clutter
- **Column cycling**: Columns layout cycles through 3 columns maximum
- **Preview mode**: Only affects the first file in multiple file operations
- **Position validation**: Invalid positions are clamped to document bounds

## Error Messages

Common error messages and their meanings:

- `"Cannot use --line with multiple files"` - Use file:line:column format instead
- `"Invalid line number in file.ts:abc"` - Line number must be numeric
- `"Unknown option: --invalid"` - Check command syntax
- `"No files specified"` - At least one file path is required
