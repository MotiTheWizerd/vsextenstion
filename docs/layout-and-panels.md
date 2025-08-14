# RayDaemon Layout and Panel Management

## Overview

RayDaemon integrates seamlessly with VS Code's multi-panel layout system, providing an optimal user experience for AI-assisted development. This document explains how the layout works, panel management, and the user experience design decisions.

## VS Code Layout Architecture

### Panel System

VS Code uses a column-based layout system with the following structure:

```
┌─────────────┬─────────────────────┬─────────────────┬─────────────────┐
│             │                     │                 │                 │
│  Sidebar    │    ViewColumn.One   │ ViewColumn.Two  │ ViewColumn.Three│
│  (Explorer, │   (Main Editor)     │ (Secondary)     │ (Tertiary)      │
│   Search,   │                     │                 │                 │
│   etc.)     │                     │                 │                 │
│             │                     │                 │                 │
└─────────────┴─────────────────────┴─────────────────┴─────────────────┘
```

### RayDaemon Panel Placement

RayDaemon strategically uses **ViewColumn.Two** (secondary panel) for its chat interface:

```
┌─────────────┬─────────────────────┬─────────────────┐
│             │                     │                 │
│  Explorer   │    Main Editor      │ RayDaemon Chat  │
│  Git        │    (Code Files)     │ (AI Assistant)  │
│  Search     │    (Diffs)          │                 │
│  Extensions │    (Documentation)  │                 │
│             │                     │                 │
└─────────────┴─────────────────────┴─────────────────┘
```

## Panel Management Strategy

### 1. Chat Panel (ViewColumn.Two)

**Purpose**: Persistent AI assistant interface
**Location**: Right panel (ViewColumn.Two)
**Behavior**:

- Opens automatically on extension activation
- Remains persistent across sessions
- Provides continuous access to Ray AI

```typescript
// Chat panel creation
const panel = vscode.window.createWebviewPanel(
  "rayDaemonChat",
  "RayDaemon Chat",
  {
    viewColumn: vscode.ViewColumn.Two,
    preserveFocus: false,
  }
  // ... webview options
);
```

### 2. File Operations (ViewColumn.One)

**Purpose**: Code editing and file viewing
**Location**: Main editor area (ViewColumn.One)
**Behavior**:

- All file opening operations target the main editor
- Diff views open in the main editor area
- Preserves the chat panel accessibility

```typescript
// File opening
await vscode.window.showTextDocument(uri, {
  viewColumn: vscode.ViewColumn.One,
});

// Diff viewing
await vscode.commands.executeCommand(
  "vscode.diff",
  beforeUri,
  afterUri,
  title,
  {
    viewColumn: vscode.ViewColumn.One,
    preview: false,
  }
);
```

## User Experience Design

### Optimal Workflow Layout

The layout is designed to support the following workflow:

1. **Chat with Ray** (Right Panel)

   - Ask questions
   - Request code changes
   - Review command results
   - Monitor progress

2. **View Results** (Main Editor)

   - Open files mentioned in chat
   - Review diffs of Ray's changes
   - Edit code as needed
   - Compare before/after states

3. **Navigate Project** (Sidebar)
   - Browse file structure
   - Use Git integration
   - Search across files
   - Manage extensions

### Layout Benefits

#### **Persistent Chat Access**

- Chat remains visible while working with files
- No need to switch between tabs
- Continuous conversation flow
- Real-time status updates

#### **Dedicated Editor Space**

- Main editor area reserved for code
- Diffs open in proper editor context
- Full syntax highlighting and IntelliSense
- Standard VS Code editing experience

#### **Contextual Awareness**

- See Ray's suggestions while viewing code
- Compare changes side-by-side with chat
- Maintain conversation context
- Quick access to file operations

## Panel Interaction Patterns

### File Opening Flow

```
User clicks file in chat → Message sent to extension → File opens in ViewColumn.One
     ↓                           ↓                            ↓
Chat remains open          Extension processes          Main editor shows file
in ViewColumn.Two          openFile message             with full editing capabilities
```

### Diff Viewing Flow

```
User clicks diff icon → Ray-specific diff created → Diff opens in ViewColumn.One
     ↓                        ↓                           ↓
Chat shows file list    Temp file with original    Side-by-side comparison
with diff indicators    content is created         shows Ray's exact changes
```

### Command Execution Flow

```
User types command → Ray processes → Results shown in chat → Files clickable
     ↓                    ↓               ↓                      ↓
Chat input active    Status indicators   Completion message    Open in main editor
in ViewColumn.Two    show progress       with file dropdown    (ViewColumn.One)
```

## Technical Implementation

### Panel Creation and Management

#### Chat Panel Lifecycle

```typescript
// Extension activation
export function activate(context: vscode.ExtensionContext) {
  // Auto-open chat panel
  setTimeout(() => {
    vscode.commands.executeCommand("raydaemon.openPanel");
  }, 2000);
}

// Panel creation
function createChatPanel() {
  if (currentPanel) {
    // Reveal existing panel
    currentPanel.reveal(vscode.ViewColumn.Two, false);
    return;
  }

  // Create new panel
  currentPanel = vscode.window.createWebviewPanel(
    "rayDaemonChat",
    "RayDaemon Chat",
    { viewColumn: vscode.ViewColumn.Two },
    webviewOptions
  );
}
```

#### File Operation Routing

```typescript
// All file operations target main editor
const FILE_VIEW_COLUMN = vscode.ViewColumn.One;

// File opening
case "openFile":
  await vscode.window.showTextDocument(uri, {
    viewColumn: FILE_VIEW_COLUMN,
  });
  break;

// Diff viewing
case "showFileDiff":
  await vscode.commands.executeCommand('vscode.diff',
    beforeUri, afterUri, title,
    { viewColumn: FILE_VIEW_COLUMN }
  );
  break;
```

### Responsive Layout Handling

#### Panel Visibility Management

```typescript
// Handle panel disposal
panel.onDidDispose(() => {
  currentPanel = undefined;
});

// Handle panel state changes
panel.onDidChangeViewState((e) => {
  if (e.webviewPanel.visible) {
    // Panel is visible - update UI state
  }
});
```

#### Focus Management

```typescript
// Preserve focus patterns
const preserveFocus = {
  chat: false, // Chat gets focus when opened
  files: true, // Files don't steal focus from chat
  diffs: true, // Diffs don't steal focus from chat
};
```

## Layout Customization

### User Preferences

Users can customize the layout through VS Code settings:

#### Panel Position

- **Default**: Right panel (ViewColumn.Two)
- **Alternative**: Can be moved to other positions via VS Code's panel management

#### Panel Size

- **Adjustable**: Users can resize panels by dragging borders
- **Persistent**: VS Code remembers panel sizes across sessions

#### Panel Visibility

- **Toggle**: Users can hide/show panels as needed
- **Keyboard Shortcuts**: Standard VS Code shortcuts apply

### Developer Configuration

#### ViewColumn Constants

```typescript
// Layout configuration
const LAYOUT_CONFIG = {
  CHAT_PANEL: vscode.ViewColumn.Two, // Right panel for chat
  MAIN_EDITOR: vscode.ViewColumn.One, // Main editor for files
  TERTIARY: vscode.ViewColumn.Three, // Additional panel if needed
};
```

#### Panel Options

```typescript
const WEBVIEW_OPTIONS = {
  enableScripts: true,
  retainContextWhenHidden: true, // Keep chat state when hidden
  localResourceRoots: [
    // Security boundaries
    vscode.Uri.file(path.join(context.extensionPath, "src", "ui")),
  ],
};
```

## Accessibility and Usability

### Keyboard Navigation

- **Tab Order**: Logical tab order between chat and editor
- **Focus Management**: Proper focus handling for screen readers
- **Keyboard Shortcuts**: Standard VS Code shortcuts work in all panels

### Screen Reader Support

- **ARIA Labels**: Proper labeling for chat interface elements
- **Semantic HTML**: Structured content for assistive technologies
- **Status Announcements**: Progress updates announced to screen readers

### Visual Design

- **High Contrast**: Supports VS Code's high contrast themes
- **Font Scaling**: Respects VS Code's font size settings
- **Color Themes**: Adapts to user's chosen color theme

## Performance Considerations

### Memory Management

- **Panel Lifecycle**: Proper cleanup when panels are closed
- **Webview Context**: Retained context for better performance
- **Resource Loading**: Efficient loading of webview assets

### Rendering Optimization

- **Lazy Loading**: Content loaded as needed
- **Virtual Scrolling**: Efficient handling of long chat histories
- **Debounced Updates**: Optimized UI updates during rapid changes

## Troubleshooting Layout Issues

### Common Problems

#### Panel Not Opening

```typescript
// Check if panel creation failed
if (!currentPanel) {
  console.error("Failed to create chat panel");
  vscode.window.showErrorMessage("Could not open RayDaemon chat");
}
```

#### Wrong Panel Location

```typescript
// Verify ViewColumn assignment
console.log("Panel ViewColumn:", currentPanel.viewColumn);
// Should be ViewColumn.Two for chat
```

#### Focus Issues

```typescript
// Debug focus management
panel.onDidChangeViewState((e) => {
  console.log("Panel visible:", e.webviewPanel.visible);
  console.log("Panel active:", e.webviewPanel.active);
});
```

### Diagnostic Commands

#### Panel State Inspection

```javascript
// In webview console
console.log("Webview state:", {
  visible: document.visibilityState,
  focused: document.hasFocus(),
  dimensions: {
    width: window.innerWidth,
    height: window.innerHeight,
  },
});
```

#### Layout Debugging

```typescript
// Extension console
console.log(
  "Active editor:",
  vscode.window.activeTextEditor?.document.fileName
);
console.log("Visible editors:", vscode.window.visibleTextEditors.length);
console.log("Panel state:", currentPanel?.visible);
```

## Future Enhancements

### Planned Layout Features

- **Multi-Chat Support**: Multiple chat panels for different contexts
- **Floating Panels**: Detachable chat windows
- **Custom Layouts**: User-defined panel arrangements
- **Split Views**: Horizontal panel splitting options

### Integration Improvements

- **Terminal Integration**: Embedded terminal in chat panel
- **Output Channel**: Dedicated output panel for Ray operations
- **Status Bar**: Enhanced status bar integration
- **Minimap Integration**: File change indicators in minimap

## Best Practices

### For Users

1. **Keep Chat Open**: Leave the chat panel open for continuous interaction
2. **Use Main Editor**: Open files in the main editor for full functionality
3. **Resize Panels**: Adjust panel sizes based on your workflow needs
4. **Keyboard Shortcuts**: Learn VS Code shortcuts for efficient panel navigation

### For Developers

1. **Consistent ViewColumns**: Always use the same ViewColumn for similar operations
2. **Focus Management**: Preserve user focus patterns
3. **Error Handling**: Graceful handling of panel creation failures
4. **Performance**: Optimize webview content for smooth interactions

This layout system provides an optimal balance between AI assistance accessibility and traditional code editing workflows, ensuring users can efficiently interact with Ray while maintaining full access to VS Code's powerful editing capabilities.
