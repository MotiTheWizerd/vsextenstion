# Changelog

All notable changes to the RayDaemon extension will be documented in this file.

## [1.2.1] - 2024-12-19 - Improved Command Grouping & Status Messages

### Fixed

#### Command Grouping Issues
- **Mixed Command Types**: Fixed issue where diagnostic analysis commands were being grouped with file modification commands
- **Duplicate Status Messages**: Eliminated duplicate completion messages for the same batch of operations
- **Inappropriate Grouping**: Commands are now properly categorized by their actual function rather than generic grouping

#### Status Message Accuracy
- **Diagnostic Commands**: Now properly identified and labeled as "Analyzed X diagnostics" instead of generic messages
- **File Modifications**: File write/append/replace operations get specific "Modified X files" messages
- **Search Operations**: Search commands get proper "Found X matches" or "Searched codebase" messages
- **Mixed Operations**: When multiple command types are executed, shows clear breakdown like "Analyzed 11 diagnostics + 2 file modifications"

### Added

#### Smart Command Categorization System
- **Command Categories**: Added 6 distinct categories (diagnostic, fileModification, fileReading, search, listing, indexing, other)
- **Category Detection**: Intelligent detection based on command names and patterns
- **Priority Handling**: Primary category determines the main message, with secondary categories noted
- **Flexible Messaging**: Different message formats for single-category vs mixed-category operations

#### Enhanced Message Generation
- **Category-Specific Messages**: Each command type gets appropriate completion messages
- **Result Analysis**: Messages include specific counts (diagnostics found, files modified, matches discovered)
- **Mixed Operation Support**: Clear indication when multiple types of operations are performed
- **Consistent Formatting**: Standardized message format across all command types

### Technical Changes

#### Message Handler (`src/ui/assets/js/webview/message-handler.js`)
- **New Functions**:
  - `categorizeCommands()`: Intelligently categorizes commands by type
  - `generateCategoryMessage()`: Creates appropriate messages based on command categories
  - `generateDiagnosticMessage()`: Specific messaging for diagnostic operations
  - `generateFileModificationMessage()`: Specific messaging for file modifications
  - `generateSearchMessage()`: Specific messaging for search operations
  - `generateMixedMessage()`: Handles multiple command types in one batch

#### Command Detection Logic
- **Diagnostic Commands**: `diagnostic`, `getalldiagnostics`, `getfilediagnostics`
- **File Modification**: `write`, `append`, `replace`
- **File Reading**: `read`, `open`
- **Search Commands**: `search`, `find` + `symbol`
- **Listing Commands**: `list`, `ls`
- **Indexing Commands**: `index`, `loadindex`, `createindex`

#### Improved Batch Description
- **Consistent Logic**: `getBatchDescription()` now uses the same categorization system
- **Better Starting Messages**: More accurate "Starting: X diagnostics + Y other operations" messages
- **Reduced Redundancy**: Eliminates generic messages when specific categories are available

### Improved

#### User Experience
- **Clearer Status Updates**: Users now see exactly what types of operations are being performed
- **Reduced Confusion**: No more misleading messages that group unrelated operations
- **Better Progress Tracking**: More informative progress messages during command execution
- **Consistent Terminology**: Standardized language across all status messages

#### Message Accuracy
- **Specific Counts**: Messages now include actual counts of diagnostics, files, matches, etc.
- **Operation Context**: Clear indication of what was accomplished in each category
- **Error Context**: Better error messages that specify which type of operation failed
- **Result Summaries**: Comprehensive summaries that accurately reflect what was done

## [1.2.0] - 2024-12-19 - Enhanced File Operations & Ray-Specific Diff

### Added

#### File Opening Functionality
- **Clickable File Results**: Users can now click on files in command results to open them directly in VS Code
- **Smart Path Resolution**: Automatic handling of both absolute and relative file paths
- **File Type Icons**: Visual indicators for different file types (📄 .js, 📘 .ts, 🐍 .py, etc.)
- **HTML Escaping**: Proper escaping of special characters in file paths to prevent display issues

#### Ray-Specific Diff Tracking
- **Automatic File Backup**: System automatically backs up file content before Ray modifies it
- **Pre-Modification Snapshots**: Creates snapshots using `write`, `append`, and `replace` command detection
- **Ray-Specific Diff View**: Shows exactly what Ray changed, not just Git changes
- **Multi-Tier Diff Strategy**: 
  1. Ray-specific diff (pre-Ray vs current)
  2. Git extension API diff
  3. SCM command diff
  4. Manual Git URI construction
  5. Fallback to file opening + SCM view

#### Memory Management
- **Automatic Cleanup**: Clears old backups after each command batch execution
- **Configurable Limits**: Keeps only the 50 most recent file backups
- **Memory Leak Prevention**: Proactive cleanup to prevent memory issues during long sessions

#### Enhanced UI/UX
- **Expandable File Dropdowns**: Shows up to 10 files with "show more" indicators
- **Diff Icons**: Visual diff indicators (📊) appear next to files modified by Ray
- **Better Error Messages**: Comprehensive error handling with user-friendly messages
- **Hover States**: Interactive feedback for clickable elements

### Technical Changes

#### Backend (`src/extension.ts`)
- Added `fileBackups` Map for storing pre-modification file content
- Implemented `backupFileBeforeModification()` function
- Added `getFilePathFromCommand()` for extracting file paths from command arguments
- Enhanced `openFile` message handler with path resolution and error handling
- Completely rewrote `showFileDiff` message handler with multi-tier approach
- Added `clearOldBackups()` and `clearAllBackups()` for memory management
- Integrated backup logic into command execution flow

#### Frontend (`src/ui/assets/js/webview/file-utils.js`)
- Enhanced `createFileDropdown()` with HTML escaping and diff icons
- Improved `getModifiedFiles()` to detect Ray-modified files from command results
- Added comprehensive logging to `openFile()` and `showFileDiff()` methods
- Implemented proper event handling for file clicks vs diff icon clicks
- Added HTML generation debugging for troubleshooting

#### Message Handling (`src/ui/assets/js/webview/message-handler.js`)
- Enhanced file result detection in `hasFileResults()`
- Improved completion message generation with detailed result analysis
- Better integration with file utilities for dropdown creation

### Improved

#### Error Handling
- **File Opening**: Detailed error messages for invalid paths, missing files, permission issues
- **Diff Display**: Graceful fallbacks when primary diff methods fail
- **Path Resolution**: Better handling of workspace-relative vs absolute paths
- **User Feedback**: Clear error messages sent back to webview and shown as VS Code notifications

#### Logging & Debugging
- **Comprehensive Logging**: Added detailed console logs at all key points
- **Error Tracking**: Better error reporting with context information
- **Debug Information**: File path resolution steps, backup operations, diff attempts
- **Performance Monitoring**: Memory usage and cleanup operation logging

#### Code Quality
- **Type Safety**: Better TypeScript typing for message handlers and file operations
- **Error Boundaries**: Proper try-catch blocks around all async operations
- **Code Organization**: Separated concerns between backup, diff, and file operations
- **Documentation**: Inline comments explaining complex logic

### Fixed

#### File Path Issues
- **Special Characters**: HTML escaping prevents issues with quotes and other special characters
- **Path Resolution**: Proper handling of Windows vs Unix path separators
- **Workspace Relative Paths**: Correct resolution of relative paths within workspace
- **File Existence Checking**: Validation before attempting to open files

#### Memory Issues
- **Backup Accumulation**: Automatic cleanup prevents unlimited memory growth
- **Temporary Files**: Proper cleanup of temporary diff files
- **Event Listeners**: Proper cleanup of event handlers to prevent memory leaks

#### UI Issues
- **Click Handling**: Proper event propagation to distinguish file clicks from diff icon clicks
- **HTML Generation**: Proper escaping prevents broken HTML from special characters
- **Visual Feedback**: Better hover states and click feedback

### Documentation

#### Added Documentation Files
- `docs/file-operations-and-diff.md`: Comprehensive technical documentation
- Updated `README.md` with new features and usage instructions
- `CHANGELOG.md`: This changelog file

#### Documentation Sections
- **Architecture Overview**: How the backup and diff system works
- **Technical Implementation**: Detailed code references and flow diagrams
- **User Guide**: How to use the new file operations and diff features
- **Troubleshooting**: Common issues and solutions
- **Development Guide**: Information for contributors and developers

### Performance

#### Optimizations
- **Lazy Loading**: File content only loaded when needed for backups
- **Efficient Storage**: String-based storage for file backups
- **Batch Processing**: Cleanup operations batched for efficiency
- **Async Operations**: Non-blocking file I/O operations

#### Memory Management
- **Automatic Limits**: Configurable backup limits prevent memory issues
- **Proactive Cleanup**: Regular cleanup during normal operation
- **Efficient Data Structures**: Map-based storage for O(1) lookup performance

## [1.1.0] - Previous Release

### Added
- Modern chat interface for AI agent interaction
- Real-time command execution with status indicators
- Background daemon monitoring
- Tabbed interface design

## [1.0.0] - Initial Release

### Added
- Basic RayDaemon functionality
- VS Code extension framework
- Command execution system

---

## Development Notes

### Testing Performed
- Manual testing of file opening with various file types and paths
- Diff functionality testing with different modification scenarios
- Memory management testing with multiple command executions
- Error handling testing with invalid paths and missing files
- UI interaction testing for click handling and visual feedback

### Known Limitations
- Large files (>10MB) may impact performance during backup
- Binary files not suitable for diff display
- Some diff features work best in Git repositories
- Complex symbolic links may not resolve correctly

### Future Enhancements
- Persistent backups across sessions
- Diff history tracking
- User-configurable backup settings
- Export diff functionality
- Undo/revert capabilities using backups