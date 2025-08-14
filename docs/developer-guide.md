# RayDaemon Developer Guide

## Architecture Overview

RayDaemon is built as a VS Code extension with a webview-based chat interface. The architecture consists of three main layers:

1. **Extension Layer** (`src/extension.ts`): Main VS Code extension logic
2. **Webview Layer** (`src/ui/`): Frontend chat interface and file operations
3. **Command Layer** (`src/commands/`): Command execution and file system operations

## Core Components

### Extension Layer

#### Main Extension (`src/extension.ts`)

- **Purpose**: Entry point, message handling, file backup system
- **Key Functions**:
  - `activate()`: Extension initialization
  - `executeCommandCallsAndSendResults()`: Command batch execution
  - `backupFileBeforeModification()`: File backup before Ray modifications
  - Message handlers for `openFile` and `showFileDiff`

#### File Backup System

```typescript
// Global storage for file backups
const fileBackups = new Map<string, string>();

// Backup workflow
backupFileBeforeModification() → executeOne() → clearOldBackups()
```

### Webview Layer

#### File Utilities (`src/ui/assets/js/webview/file-utils.js`)

- **Purpose**: Frontend file operations and UI generation
- **Key Classes**:
  - `FileUtils`: Main class for file operations
- **Key Methods**:
  - `createFileDropdown()`: Generates clickable file listings
  - `openFile()`: Handles file opening requests
  - `showFileDiff()`: Handles diff display requests
  - `getModifiedFiles()`: Identifies Ray-modified files

#### Message Handler (`src/ui/assets/js/webview/message-handler.js`)

- **Purpose**: Processes messages between webview and extension
- **Key Methods**:
  - `handleToolStatus()`: Processes command execution status
  - `handleIncomingMessage()`: Routes incoming messages

#### Chat UI (`src/ui/assets/js/webview/chat-ui.js`)

- **Purpose**: Main chat interface and user interactions
- **Key Methods**:
  - `postMessage()`: Sends messages to extension
  - `addMessage()`: Adds messages to chat interface

### Command Layer

#### Command Handler (`src/commands/commandHandler.ts`)

- **Purpose**: Command registration and execution
- **Key Functions**:
  - `handleCommand()`: Main command processing
  - `registerCommandHandlers()`: VS Code command registration

## Data Flow

### File Opening Flow

```
User clicks file → FileUtils.openFile() → postMessage({type: "openFile"})
→ Extension handler → Path resolution → VS Code API → File opens
```

### Diff Display Flow

```
User clicks diff icon → FileUtils.showFileDiff() → postMessage({type: "showFileDiff"})
→ Extension handler → Check backup → Multiple diff strategies → Diff view
```

### File Backup Flow

```
Command execution → getFilePathFromCommand() → backupFileBeforeModification()
→ Store in fileBackups Map → Execute command → clearOldBackups()
```

## Key Design Patterns

### Message Passing

- **Webview to Extension**: `vscode.postMessage()`
- **Extension to Webview**: `panel.webview.postMessage()`
- **Message Types**: `openFile`, `showFileDiff`, `toolStatus`, `rayResponse`

### Error Handling

- **Try-Catch Blocks**: Around all async operations
- **Fallback Strategies**: Multiple approaches for diff display
- **User Feedback**: Errors shown in VS Code notifications and webview

### Memory Management

- **Automatic Cleanup**: After each command batch
- **Size Limits**: Maximum 50 backups
- **Efficient Storage**: String-based Map storage

## Development Setup

### Prerequisites

- Node.js 16+
- VS Code 1.102.0+
- pnpm package manager

### Installation

```bash
git clone <repository>
cd raydaemon
pnpm install
```

### Building

```bash
# Development build
pnpm run compile

# Watch mode
pnpm run watch

# Production build
pnpm run package
```

### Testing

```bash
# Run tests
pnpm run test

# Type checking
pnpm run check-types

# Linting
pnpm run lint
```

## Code Organization

### File Structure

```
src/
├── extension.ts              # Main extension entry point
├── commands/                 # Command execution system
│   ├── commandHandler.ts     # Command registration and handling
│   └── commandMethods/       # Individual command implementations
├── ui/                       # Webview interface
│   ├── WebviewContent.ts     # HTML generation
│   └── assets/               # Frontend assets
│       ├── css/              # Stylesheets
│       └── js/               # JavaScript modules
│           └── webview/      # Webview-specific modules
└── config.ts                 # Configuration management
```

### Key Modules

#### `src/extension.ts`

- Extension lifecycle management
- Message handling between webview and extension
- File backup system implementation
- Command execution orchestration

#### `src/ui/assets/js/webview/file-utils.js`

- File operation utilities
- HTML generation for file listings
- Click event handling
- File path processing and validation

#### `src/commands/commandHandler.ts`

- Command registration with VS Code
- Command parsing and validation
- Error handling and user feedback

## Adding New Features

### Adding a New File Operation

1. **Frontend** (`file-utils.js`):

```javascript
newFileOperation(filePath) {
  // Validate and clean path
  const cleanPath = this.cleanFilePath(filePath);

  // Send message to extension
  this.chatUI.postMessage({
    type: "newFileOperation",
    filePath: cleanPath
  });
}
```

2. **Backend** (`extension.ts`):

```typescript
case "newFileOperation":
  try {
    const filePath = message.filePath;
    // Implement operation logic
    await performNewOperation(filePath);
  } catch (error) {
    // Handle errors
  }
  break;
```

### Adding a New Diff Strategy

1. **Add to diff handler** (`extension.ts`):

```typescript
// Approach N: New diff strategy
if (!diffShown) {
  try {
    await newDiffStrategy(uri);
    diffShown = true;
    console.log(`[RayDaemon] Showed diff using new strategy`);
  } catch (error) {
    console.log(`[RayDaemon] New strategy failed:`, error);
  }
}
```

### Adding a New Command Type

1. **Update backup detection** (`extension.ts`):

```typescript
function getFilePathFromCommand(command: string, args: any[]): string | null {
  switch (command) {
    case "newCommand":
      return typeof args[0] === "string" ? args[0] : null;
    // ... existing cases
  }
}
```

2. **Update UI detection** (`file-utils.js`):

```javascript
getModifiedFiles(results) {
  const fileModifyingCommands = ['write', 'append', 'replace', 'newCommand'];
  // ... rest of implementation
}
```

## Testing Guidelines

### Manual Testing Checklist

#### File Opening

- [ ] Click files in various command results
- [ ] Test with different file types (.js, .ts, .py, etc.)
- [ ] Test with absolute and relative paths
- [ ] Test error handling with non-existent files
- [ ] Test with special characters in file names

#### Diff Functionality

- [ ] Modify files using Ray commands
- [ ] Verify diff icons appear for modified files
- [ ] Click diff icons to view changes
- [ ] Test with different file sizes
- [ ] Test fallback scenarios (no Git, etc.)

#### Memory Management

- [ ] Execute many file modifications
- [ ] Verify backup cleanup occurs
- [ ] Monitor memory usage over time
- [ ] Test with large files

### Automated Testing

#### Unit Tests

```javascript
// Example test structure
describe("FileUtils", () => {
  it("should clean file paths correctly", () => {
    const fileUtils = new FileUtils();
    const cleaned = fileUtils.cleanFilePath('  "path/to/file.js"  ');
    expect(cleaned).toBe("path/to/file.js");
  });
});
```

#### Integration Tests

```javascript
// Example integration test
describe("File Opening Integration", () => {
  it("should open files from webview clicks", async () => {
    // Setup webview and extension
    // Simulate file click
    // Verify file opens in VS Code
  });
});
```

## Debugging

### Console Logging

- **Extension**: Use `console.log()` and `logInfo()`/`logError()`
- **Webview**: Use browser console (`F12` → Console)
- **VS Code**: Developer Console (`Help` → `Toggle Developer Tools`)

### Debug Configuration

```json
{
  "type": "extensionHost",
  "request": "launch",
  "name": "Launch Extension",
  "runtimeExecutable": "${execPath}",
  "args": ["--extensionDevelopmentPath=${workspaceFolder}"]
}
```

### Common Debug Scenarios

#### File Path Issues

```javascript
// Add logging to trace path resolution
console.log("Original path:", filePath);
console.log("Resolved path:", resolvedPath);
console.log("File exists:", await fs.exists(resolvedPath));
```

#### Message Passing Issues

```javascript
// Log all messages
window.addEventListener("message", (event) => {
  console.log("Received message:", event.data);
});
```

#### Memory Issues

```javascript
// Monitor backup count
console.log("Current backups:", fileBackups.size);
setInterval(() => {
  console.log("Backup count:", fileBackups.size);
}, 10000);
```

## Performance Considerations

### File Operations

- **Async Operations**: Use `async/await` for all file I/O
- **Error Boundaries**: Wrap operations in try-catch blocks
- **Path Validation**: Validate paths before file operations

### Memory Management

- **Backup Limits**: Keep reasonable limits on backup count
- **Cleanup Frequency**: Clean up after each command batch
- **String Storage**: Use efficient string storage for file content

### UI Performance

- **Lazy Loading**: Load content only when needed
- **Event Delegation**: Use efficient event handling
- **DOM Updates**: Minimize DOM manipulations

## Security Considerations

### File Access

- **Path Validation**: Validate all file paths
- **Workspace Boundaries**: Respect workspace folder boundaries
- **Permission Checks**: Handle permission errors gracefully

### HTML Generation

- **XSS Prevention**: Escape all user-provided content
- **Attribute Escaping**: Escape HTML attributes properly
- **Content Validation**: Validate content before display

### Message Handling

- **Input Validation**: Validate all message parameters
- **Type Checking**: Ensure proper types for all inputs
- **Error Handling**: Handle malformed messages gracefully

## Contributing

### Code Style

- **TypeScript**: Use strict typing
- **ESLint**: Follow configured linting rules
- **Formatting**: Use consistent formatting
- **Comments**: Document complex logic

### Pull Request Process

1. Fork the repository
2. Create a feature branch
3. Implement changes with tests
4. Update documentation
5. Submit pull request with description

### Issue Reporting

Include:

- VS Code version
- Extension version
- Steps to reproduce
- Expected vs actual behavior
- Console logs and error messages

## Future Enhancements

### Planned Features

- **Persistent Backups**: Store backups across sessions
- **Diff History**: Track multiple versions of changes
- **Export Functionality**: Save diffs to files
- **Undo System**: Revert changes using backups

### Technical Improvements

- **Performance Optimization**: Faster file operations
- **Better Error Handling**: More specific error messages
- **Enhanced UI**: Improved visual design
- **Configuration Options**: More user customization

### Architecture Evolution

- **Plugin System**: Support for custom file operations
- **API Extensions**: External tool integration
- **Cloud Sync**: Backup synchronization
- **Collaborative Features**: Multi-user support
