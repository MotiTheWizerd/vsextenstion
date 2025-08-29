# RayDaemon Developer Guide

## Architecture Overview

RayDaemon is built as a VS Code extension with a webview-based chat interface supporting multi-round tool execution workflows. The architecture consists of four main layers:

1. **Extension Layer** (`src/extension.ts`): Main VS Code extension logic, multi-round execution handling
2. **Webview Layer** (`src/ui/`): Frontend chat interface and file operations
3. **Command Layer** (`src/commands/`): Command execution and file system operations
4. **Session Layer** (`src/utils/sessionManager.ts`): Project and chat session management
5. **Registry** (`src/ui/webview-registry.ts`): Central registry for the single, primary chat panel

## API Message Structure

RayDaemon uses a simplified JSON structure for communication with Ray API:

### Current Message Format
```json
{
  "message": "User's message here",
  "model": null,
  "project_id": "my-workspace-a1b2c3d4",
  "chat_id": "chat-e5f6g7h8",
  "user_id": "user-b3c4d5e6f7g8"
}
```

### Message with Command Results
```json
{
  "message": "User's message here",
  "command_results": [...],
  "model": null,
  "project_id": "my-workspace-a1b2c3d4",
  "chat_id": "chat-e5f6g7h8",
  "user_id": "user-b3c4d5e6f7g8"
}
```

### Session Management
- **Project ID**: Generated from workspace folder name and path hash for consistency
- **Chat ID**: Unique identifier for each chat session, persists during VS Code session
- **User ID**: Generated from VS Code machine ID hash for user consistency across sessions
- **API Endpoint**: `http://localhost:8000/api/vscode_user_message`

### Multi-Round Tool Execution

RayDaemon supports complex workflows where Ray can send follow-up responses with additional command calls, enabling iterative task completion:

```
User Request → Ray Response (Commands) → Execute → Send Results → Ray Follow-up (More Commands) → Execute → Final Response
```

**Critical**: As of v1.2.2, a race condition fix ensures follow-up command rounds execute without blocking.

## Core Components

### Session Layer

#### SessionManager (`src/utils/sessionManager.ts`)

- **Purpose**: Manages project and chat session identifiers
- **Key Features**:
  - Singleton pattern for consistent session management
  - Workspace-based project ID generation with fallback
  - Chat session management with new session support
  - Automatic ID generation using crypto module

```typescript
const sessionManager = SessionManager.getInstance();
const sessionInfo = sessionManager.getSessionInfo();
// Returns: { projectId: "workspace-hash", chatId: "chat-random", userId: "user-hash" }
```

### Extension Layer

#### Main Extension (`src/extension.ts`)

- **Purpose**: Entry point, message handling, file backup system, execution state management
- **Key Functions**:
  - `activate()`: Extension initialization
  - `executeCommandCallsAndSendResults()`: Command batch execution with race condition prevention
  - `backupFileBeforeModification()`: File backup before Ray modifications
  - Message handlers for `openFile` and `showFileDiff`
  - Initializes `WebviewRegistry`-backed chat panel and editor guards

#### Configuration (`src/config.ts`)

- **Purpose**: API configuration and message formatting with session tracking
- **Key Features**:
  - Automatic session ID injection into all messages
  - Simplified message structure (removed legacy fields)
  - Consistent formatting for user messages and command results

```typescript
// Automatically includes project_id and chat_id
const messageData = config.formatMessage("Hello Ray!");
```

#### CommandExecutor (`src/extension_utils/commandExecutor.ts`)

- **Purpose**: Multi-round tool execution with proper state management
- **Critical Fix (v1.2.2)**: Race condition prevention in multi-round execution
- **Key Features**:
  - Execution state tracking with `isExecutingTools` flag
  - Reset execution state BEFORE sending results to Ray (prevents race condition)
  - Support for follow-up command rounds without blocking
  - Unique execution ID tracking for debugging multi-round flows

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

- **Purpose**: Processes messages between webview and extension, handles multi-round execution UI updates
- **Key Methods**:
  - `handleIncomingMessage()`: Main message router with duplicate prevention
  - `handleToolStatus()`: Tool execution progress for multi-round workflows
  - `handleRayResponse()`: Response processing with follow-up support

## Critical Race Condition Fix (v1.2.2)

### Problem
Multi-round tool execution workflows were failing with "Tools already executing, skipping duplicate execution" errors.

### Root Cause
```typescript
// BEFORE (broken):
async executeCommandCallsAndSendResults() {
  this.isExecutingTools = true;
  // ... execute tools ...
  await sendResultsToRay();  // May trigger follow-up with more commands
  // ... isExecutingTools still true when follow-up arrives ...
  finally {
    this.isExecutingTools = false; // Too late!
  }
}
```

### Solution
```typescript
// AFTER (fixed):
async executeCommandCallsAndSendResults() {
  this.isExecutingTools = true;
  // ... execute tools ...
  this.isExecutingTools = false;  // Reset BEFORE sending results
  await sendResultsToRay();  // Follow-up commands can now execute
  finally {
    this.isExecutingTools = false; // Ensure cleanup
  }
}
```

### Files Modified
- `src/extension_utils/commandExecutor.ts`: Primary race condition fix
- `src/rayLoop.ts`: ActiveToolExecution flag management  
- `src/ui/RayDaemonViewProvider.ts`: Duplicate message prevention
- `src/ui/webview-registry.ts`: Single chat panel registry
- `src/extension_utils/editorGuards.ts`: Prevent editors from opening in chat group

## Message Contracts (Shared Types)

- `src/types/messages.ts` centralizes `RayRequest`, `RayResponse`, `CommandCall`, `CommandResult`.
- `src/commands/execFactory.ts` imports shared `CommandCall`/`CommandResult` to avoid drift.
- `src/extension_utils/rayResponseHandler.ts` and `src/rayLoop.ts` use `RayResponse` consistently.
- Enforcement:
  - `command_calls` → local exec
  - `command_results` → summaries; a visible fallback is shown if only results arrive without content.

## Multi-Round Execution Debugging

### Execution ID Tracking
Each tool execution gets a unique ID for debugging:
```
[RayDaemon] [123456] executeCommandCallsAndSendResults CALLED
[RayDaemon] [789012] executeCommandCallsAndSendResults CALLED  ← Follow-up round
```

### Success Pattern
```
[RayDaemon] [XXXXXX] Current isExecutingTools state: false
[RayDaemon] [XXXXXX] Setting isExecutingTools = true and starting execution
[RayDaemon] [XXXXXX] isExecutingTools reset to false, now sending results to Ray
[RayDaemon] [YYYYYY] Current isExecutingTools state: false  ← Should be false for follow-ups
```

### Failure Pattern (Before Fix)
```
[RayDaemon] [YYYYYY] Current isExecutingTools state: true  ← Race condition!
[RayDaemon] [YYYYYY] RACE CONDITION: Tools already executing, skipping duplicate execution
```
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
├── utils/                    # Utility modules
│   └── sessionManager.ts     # Session and ID management
└── config.ts                 # Configuration and message formatting
```

### Key Modules

#### `src/extension.ts`

- Extension lifecycle management
- Message handling between webview and extension
- File backup system implementation
- Command execution orchestration

#### `src/config.ts`

- API endpoint and header configuration
- Message formatting with automatic session injection
- Support for both user messages and command results
- Session-aware message structure

#### `src/utils/sessionManager.ts`

- Singleton session management
- Project ID generation from workspace context
- Chat session lifecycle management
- Cryptographic ID generation for uniqueness

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

### Adding Session-Aware Features

1. **Access Session Information**:

```typescript
import { SessionManager } from "./utils/sessionManager";

const sessionManager = SessionManager.getInstance();
const { projectId, chatId } = sessionManager.getSessionInfo();
```

2. **Start New Chat Session**:

```typescript
// Start a new chat (generates new chat_id)
const newChatId = sessionManager.startNewChat();
```

3. **Project-Specific Features**:

```typescript
// Use project_id for project-specific functionality
const projectConfig = getProjectConfig(sessionManager.getProjectId());
```

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

describe("SessionManager", () => {
  it("should generate consistent project IDs", () => {
    const sessionManager = SessionManager.getInstance();
    const projectId1 = sessionManager.getProjectId();
    const projectId2 = sessionManager.getProjectId();
    expect(projectId1).toBe(projectId2);
  });

  it("should generate unique chat IDs", () => {
    const sessionManager = SessionManager.getInstance();
    const chatId1 = sessionManager.getChatId();
    const chatId2 = sessionManager.startNewChat();
    expect(chatId1).not.toBe(chatId2);
  });

  it("should generate consistent user IDs", () => {
    const sessionManager = SessionManager.getInstance();
    const userId1 = sessionManager.getUserId();
    const userId2 = sessionManager.getUserId();
    expect(userId1).toBe(userId2);
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
- **Project Context**: Use project_id for project-specific AI context
- **Chat History**: Leverage chat_id for conversation persistence
- **User Context**: Use user_id for user-specific preferences and history
- **Multi-Chat Support**: Support multiple concurrent chat sessions

### Technical Improvements

- **Performance Optimization**: Faster file operations
- **Better Error Handling**: More specific error messages
- **Enhanced UI**: Improved visual design
- **Configuration Options**: More user customization

### Architecture Evolution

- **Plugin System**: Support for custom file operations
- **API Extensions**: External tool integration
- **Cloud Sync**: Backup synchronization with project/chat/user awareness
- **Collaborative Features**: Multi-user support with session tracking
- **Session Persistence**: Store and restore session state across VS Code restarts
- **Advanced Session Management**: Project switching, chat archiving, user preferences, and context management
