# RayDaemon - AI Agent Control Panel for VS Code

RayDaemon is a VS Code extension that provides an agent-based control panel with daemon monitoring capabilities, file operations, and Ray-specific diff functionality. It creates a modern chat interface for interacting with AI agents and provides comprehensive file management and change tracking.

## Features

### 🚀 **Agent Control Panel**
- Modern chat interface similar to AI assistants like Kiro/Claude
- Real-time command execution with status indicators
- Background daemon monitoring with heartbeat (5-second intervals)
- Tabbed interface for Editor, Chat, and Logs

### 📁 **Enhanced File Operations**
- **Clickable File Results**: Click on any file in command results to open it directly in VS Code
- **Smart Path Resolution**: Handles both absolute and relative file paths automatically
- **File Type Icons**: Visual indicators for different file types (JS, TS, Python, etc.)
- **Error Handling**: Comprehensive error messages and fallback strategies

### 🔍 **Ray-Specific Diff Functionality**
- **Change Tracking**: Automatically tracks files modified by Ray during the current session
- **Pre-Modification Backups**: Creates snapshots of files before Ray modifies them
- **Ray-Specific Diffs**: Shows exactly what Ray changed, not just Git changes
- **Multiple Diff Strategies**: Fallback approaches ensure diff functionality always works
- **Memory Management**: Automatic cleanup prevents memory leaks

### 🛠 **Command Execution**
- Batch command processing with progress indicators
- Support for file system operations (read, write, append, replace)
- Search functionality (text, regex, symbols)
- Directory listing and navigation
- Diagnostic analysis and error reporting

### 🎨 **Modern UI/UX**
- Clean, modern interface design
- Expandable file dropdowns (shows up to 10 files with "show more" indicators)
- Visual status indicators for command execution
- Responsive layout with proper error handling

## How It Works

### File Opening
1. Ray executes commands that involve files (read, write, search, etc.)
2. Results are displayed in the webview with clickable file items
3. Click any file to open it directly in VS Code
4. Supports both workspace-relative and absolute paths

### Ray-Specific Diff Tracking
1. **Before Modification**: When Ray is about to modify a file, the system automatically backs up the original content
2. **Command Execution**: Ray executes the modification command
3. **Diff Display**: Click the diff icon (📊) next to modified files to see exactly what Ray changed
4. **Fallback Options**: If Ray-specific diff fails, falls back to Git diff or SCM view

### Memory Management
- Automatically clears old backups after each command batch
- Keeps the 50 most recent file backups
- Prevents memory leaks during long sessions

## Requirements

- **VS Code**: Version 1.102.0 or higher
- **Node.js**: For extension runtime
- **Git** (optional): For enhanced diff functionality
- **Workspace**: Works best with opened workspace folders for relative path resolution

## Installation & Setup

1. Install the extension from the VS Code marketplace
2. Open a workspace folder for best path resolution
3. The extension will automatically activate and show the RayDaemon panel
4. Start interacting with Ray through the chat interface

## Usage

### Opening Files
- Execute Ray commands that involve files (read, write, search, etc.)
- Look for the green "Completed" status with file count
- Click the file count to expand the file list
- Click any file name to open it in VS Code

### Viewing Ray Changes
- After Ray modifies files, look for the diff icon (📊) next to modified files
- Click the diff icon to see exactly what Ray changed
- The diff shows "before Ray" vs "current" content
- If Ray-specific diff fails, it falls back to Git diff or SCM view

### Commands
- `RayDaemon: Open Panel` - Opens the main control panel
- `RayDaemon: Open from Sidebar` - Opens panel from sidebar icon

## Extension Settings

This extension contributes the following settings:

* `raydaemon.enable`: Enable/disable the RayDaemon extension
* `raydaemon.daemonInterval`: Heartbeat interval in milliseconds (default: 5000)
* `raydaemon.maxBackups`: Maximum number of file backups to keep (default: 50)

## Architecture

### File Backup System
- **Storage**: In-memory Map with file path as key and original content as value
- **Triggers**: Automatically backs up files before `write`, `append`, or `replace` commands
- **Cleanup**: Automatic cleanup after command execution to prevent memory leaks

### Diff Display Strategies
1. **Ray-Specific**: Shows changes between pre-Ray backup and current content
2. **Git Extension**: Uses VS Code's Git extension API
3. **SCM Command**: Uses Source Control Management commands
4. **Manual Git**: Constructs Git URIs manually
5. **Fallback**: Opens file and shows SCM view

### Message Flow
```
User Message → Ray API → Tool Execution → Results → Ray Follow-up → More Tools → Completion
     ↓             ↓           ↓              ↓            ↓             ↓           ↓
  Webview ↔ Extension ↔ CommandExecutor → sendResults → processResponse → Execute → UI Update
```

**Multi-Round Execution**: Ray can send follow-up responses with additional commands, creating iterative workflows that complete complex tasks through multiple execution rounds.

## Known Issues

- **Large Files**: Very large files (>10MB) may cause performance issues during backup
- **Binary Files**: Binary files are not suitable for diff display
- **Git Repositories**: Some diff features work best in Git repositories
- **Path Resolution**: Complex symbolic links may not resolve correctly

## Troubleshooting

### Files Not Opening
1. Check that the workspace folder is properly opened
2. Verify file paths in the console logs
3. Ensure file permissions allow VS Code access

### Diff Not Working
1. Verify the file was actually modified by Ray (look for diff icon)
2. Check if you're in a Git repository for enhanced diff features
3. Look at console logs for specific error messages
4. Try the fallback: manually open the file and check SCM view

## Development

### Key Files
- `src/extension.ts`: Main extension logic, message handlers, backup system
- `src/ui/assets/js/webview/file-utils.js`: Frontend file operations and UI
- `src/ui/assets/js/webview/message-handler.js`: Message processing and status handling
- `docs/file-operations-and-diff.md`: Comprehensive technical documentation

### Building
```bash
pnpm install
pnpm run compile
```

### Testing
```bash
pnpm run test
```

## Release Notes

### 1.2.2 - Critical Race Condition Fix & Multi-Round Tool Execution

**Critical Fixes:**
- 🚨 **Race Condition Fix**: Fixed critical bug where multi-round tool execution would fail with "Tools already executing, skipping duplicate execution"
- 🔄 **Multi-Round Tool Execution**: Ray can now send follow-up responses with additional command calls that execute successfully
- ⚡ **Infinite Loop Prevention**: Eliminated infinite loops where Ray would wait indefinitely for results that never came
- 🛠️ **Robust Workflow Support**: Complex workflows with multiple command rounds now complete successfully

**Technical Improvements:**
- **Execution State Management**: Fixed race condition in `CommandExecutor` by resetting `isExecutingTools` flag before sending results to Ray
- **Follow-up Response Handling**: Enhanced processing of Ray's follow-up responses containing additional commands
- **Tool Status UI**: Multi-round executions now properly display progress for all command rounds
- **Error Recovery**: Improved error handling to prevent deadlocks in tool execution state

**Examples of Fixed Workflows:**
- "Fix syntax errors in my CSS and JS files" - now completes all fix rounds
- "Analyze my codebase and create documentation" - multi-step operations work end-to-end
- "Refactor this code and add error handling" - iterative improvements complete successfully

### 1.2.1 - Improved Command Grouping & Status Messages

**New Features:**
- 🎯 **Smart Command Categorization**: Commands are now properly grouped by type (diagnostics, file modifications, searches, etc.)
- 📊 **Precise Status Messages**: Status messages now accurately reflect the specific types of operations performed
- 🔄 **Mixed Operation Handling**: When multiple types of commands are executed, the system shows clear breakdowns

**Improvements:**
- **Better Command Grouping**: Diagnostic analysis is no longer mixed with file modification messages
- **Clearer Status Indicators**: Each command type gets appropriate status messages
- **Reduced Duplication**: Eliminates duplicate status messages for mixed operations
- **More Specific Descriptions**: Status messages now provide precise information about what was accomplished

### 1.2.0 - Enhanced File Operations & Ray-Specific Diff

**New Features:**
- ✨ **Clickable File Results**: Click any file in command results to open directly in VS Code
- 🔍 **Ray-Specific Diff Tracking**: See exactly what changes Ray made to files
- 📊 **Automatic File Backup**: System backs up files before Ray modifies them
- 🎨 **Enhanced UI**: Modern file listings with icons and proper path display
- 🧠 **Memory Management**: Automatic cleanup prevents memory leaks

**Improvements:**
- Better error handling for file operations
- Multiple fallback strategies for diff display
- Comprehensive logging and debugging
- HTML escaping for special characters in file paths
- Responsive UI with hover states and click feedback

**Technical:**
- Added file backup system with automatic cleanup
- Implemented multi-tier diff display approach
- Enhanced message passing between webview and extension
- Added comprehensive documentation

### 1.1.0 - Agent Control Panel

**Features:**
- Modern chat interface for AI agent interaction
- Real-time command execution with status indicators
- Background daemon monitoring
- Tabbed interface design

### 1.0.0 - Initial Release

**Features:**
- Basic RayDaemon functionality
- VS Code extension framework  
- Command execution system

## Known Issues & Troubleshooting

### Multi-Round Tool Execution
If you experience issues with complex workflows that involve multiple command rounds:

1. **Check Console Logs**: Look for "Tools already executing" errors (should not appear in v1.2.2+)
2. **Verify Completion**: Ensure all command rounds complete with proper status messages
3. **Monitor Progress**: Tool status UI should show progress for all execution rounds

### Performance with Large Operations
- **Large Files**: Operations on files >10MB may show slower progress
- **Batch Operations**: Multiple file operations are processed efficiently in batches
- **Memory Management**: Automatic cleanup prevents memory issues during long sessions

### Error Recovery
- **Failed Commands**: Individual command failures don't stop entire workflows
- **Network Issues**: Connection problems are handled gracefully with retry mechanisms
- **State Recovery**: Extension maintains consistent state even after errors

---

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
* Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
* Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
