# File Operations and Ray-Specific Diff Functionality

## Overview

This document describes the enhanced file operations and diff functionality implemented in RayDaemon, which allows users to:

1. **Click to open files** from completed command results in the webview
2. **View Ray-specific diffs** showing exactly what changes Ray made to files during the current session
3. **Track file modifications** with automatic backup and cleanup

## Features

### 1. File Opening from Webview

When Ray executes commands that involve files (like `read`, `write`, `search`, etc.), the results are displayed in the webview with clickable file items. Users can click on any file to open it directly in VS Code.

#### Implementation Details

- **Frontend**: `src/ui/assets/js/webview/file-utils.js`

  - `createFileDropdown()`: Generates HTML for file listings with clickable items
  - `openFile()`: Handles click events and sends `openFile` messages to the extension
  - HTML escaping prevents issues with special characters in file paths

- **Backend**: `src/extension.ts`
  - `openFile` message handler resolves file paths and opens them in VS Code
  - Supports both absolute and relative paths
  - Includes comprehensive error handling and logging

### 2. Ray-Specific Diff Functionality

The system tracks changes made by Ray during the current session and provides diff views showing exactly what Ray modified.

#### How It Works

1. **Pre-Modification Backup**: Before Ray executes any file-modifying command (`write`, `append`, `replace`), the system automatically backs up the current file content
2. **Command Execution**: Ray modifies the file as requested
3. **Diff Display**: When users click the diff icon, they see changes between the pre-Ray content and current content

#### Implementation Components

##### File Backup System (`src/extension.ts`)

```typescript
// Global storage for file backups
const fileBackups = new Map<string, string>();

// Backup file before Ray modifies it
async function backupFileBeforeModification(filePath: string): Promise<void>;

// Extract file path from command arguments
function getFilePathFromCommand(command: string, args: any[]): string | null;

// Memory management
function clearOldBackups(): void;
function clearAllBackups(): void;
```

##### Diff Display Logic

The diff functionality uses a multi-tier approach:

1. **Primary**: Ray-specific diff (pre-Ray content vs. current content)
2. **Secondary**: Git extension diff (if Git extension is available)
3. **Tertiary**: SCM diff command
4. **Quaternary**: Manual Git URI construction
5. **Fallback**: Open file + show SCM view with informative message

##### Frontend Integration (`src/ui/assets/js/webview/file-utils.js`)

- `getModifiedFiles()`: Identifies files modified by Ray based on command results
- `createFileDropdown()`: Adds diff icons to modified files
- `showFileDiff()`: Handles diff icon clicks and sends `showFileDiff` messages

## Technical Architecture

### Message Flow

```
User clicks file → FileUtils.openFile() → postMessage({type: "openFile"}) → Extension handler → VS Code API
User clicks diff → FileUtils.showFileDiff() → postMessage({type: "showFileDiff"}) → Extension handler → Diff view
```

### File Modification Tracking

```
Command execution → backupFileBeforeModification() → executeOne() → File modified → Diff available
```

### Memory Management

- Automatic cleanup after each command batch execution
- Keeps only the 50 most recent backups
- Manual cleanup function available for testing

## Configuration

### File-Modifying Commands

The system automatically tracks these commands:

- `write`: Creates or overwrites files
- `append`: Adds content to existing files
- `replace`: Replaces content in files

### Backup Storage

- **Location**: In-memory Map (`fileBackups`)
- **Key**: Absolute file path
- **Value**: Original file content as string
- **Lifecycle**: Cleared after command batch completion

## Error Handling

### File Opening Errors

- Invalid file paths
- Non-existent files
- Permission issues
- Path resolution failures

All errors are:

- Logged to console with detailed information
- Displayed to user via VS Code notifications
- Sent back to webview for display

### Diff Display Errors

- Missing backup content
- Git repository issues
- VS Code API failures
- File system access problems

Fallback strategies ensure users always get some form of file access even if diff fails.

## User Experience

### Visual Indicators

- **File Icons**: Different icons for different file types (📄 .js, 📘 .ts, 🐍 .py, etc.)
- **Diff Icons**: Small diff icon (📊) appears next to files modified by Ray
- **File Paths**: Displayed with proper directory structure
- **Click Feedback**: Hover states and click handling

### Interaction Patterns

1. **File Lists**: Expandable dropdowns showing up to 10 files with "show more" indicators
2. **Click Actions**:
   - Click file name/icon → Open file
   - Click diff icon → Show Ray-specific diff
3. **Error Messages**: Clear, actionable error messages for failed operations

## Performance Considerations

### Memory Usage

- Automatic cleanup prevents memory leaks
- Configurable backup limit (currently 50 files)
- String storage is efficient for typical file sizes

### File I/O

- Asynchronous file operations prevent UI blocking
- Minimal file reads (only when backing up)
- Efficient path resolution and validation

### UI Responsiveness

- Non-blocking message passing between webview and extension
- Lazy loading of file content
- Efficient HTML generation with proper escaping

## Debugging and Logging

### Console Logs

Comprehensive logging at key points:

- File backup operations
- Path resolution steps
- Diff display attempts
- Error conditions
- Memory cleanup operations

### Log Levels

- `console.log()`: General information and flow
- `console.error()`: Error conditions
- `logInfo()`: Extension-level information
- `logError()`: Extension-level errors

## Future Enhancements

### Potential Improvements

1. **Persistent Backups**: Store backups to disk for session persistence
2. **Diff History**: Track multiple versions of Ray modifications
3. **Selective Backup**: Allow users to choose which files to track
4. **Export Diffs**: Save diff results to files
5. **Undo Functionality**: Revert Ray changes using backups

### Configuration Options

1. **Backup Limits**: User-configurable backup count
2. **File Filters**: Include/exclude patterns for backup
3. **Diff Preferences**: Default diff tool selection
4. **UI Customization**: File icon themes, layout options

## Testing

### Manual Testing Scenarios

1. **File Opening**:

   - Click files in various command results
   - Test with different file types and paths
   - Verify error handling for non-existent files

2. **Diff Functionality**:

   - Modify files with Ray commands
   - Click diff icons to verify Ray-specific changes
   - Test fallback scenarios (no Git, etc.)

3. **Memory Management**:
   - Execute many file modifications
   - Verify backup cleanup occurs
   - Monitor memory usage over time

### Automated Testing

Consider adding:

- Unit tests for path resolution
- Integration tests for message passing
- Performance tests for large file operations
- Memory leak detection tests

## Troubleshooting

### Common Issues

1. **Files not opening**: Check file paths, permissions, and VS Code workspace setup
2. **Diff not showing**: Verify Git repository status and extension availability
3. **Memory issues**: Check backup cleanup and consider manual cleanup
4. **Path resolution**: Ensure workspace folders are properly configured

### Debug Steps

1. Check browser console for webview errors
2. Check VS Code Developer Console for extension errors
3. Verify file paths are correctly resolved
4. Test with simple file operations first

## Code References

### Key Files

- `src/extension.ts`: Main extension logic, message handlers, backup system
- `src/ui/assets/js/webview/file-utils.js`: Frontend file operations and UI
- `src/ui/assets/js/webview/message-handler.js`: Message processing and status handling
- `src/ui/assets/js/webview/chat-ui.js`: Chat interface and message posting

### Key Functions

- `backupFileBeforeModification()`: Creates file backups before Ray modifications
- `openFile` message handler: Opens files in VS Code from webview clicks
- `showFileDiff` message handler: Displays Ray-specific diffs with fallbacks
- `createFileDropdown()`: Generates clickable file listings in webview
- `getModifiedFiles()`: Identifies files modified by Ray commands

This documentation provides a comprehensive overview of the file operations and diff functionality, serving as both a technical reference and user guide for the implemented features.
