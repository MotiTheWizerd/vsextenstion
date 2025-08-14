# RayDaemon Layout Visual Diagrams

## Main Layout Overview

### Standard RayDaemon Layout
```
┌─────────────┬─────────────────────────────────────┬─────────────────────┐
│             │                                     │                     │
│  SIDEBAR    │           MAIN EDITOR               │    RAYDAEMON CHAT   │
│             │         (ViewColumn.One)            │   (ViewColumn.Two)  │
│ ┌─────────┐ │                                     │                     │
│ │Explorer │ │  ┌─────────────────────────────┐    │ ┌─────────────────┐ │
│ │Git      │ │  │                             │    │ │  ⚔️😈 RayDaemon │ │
│ │Search   │ │  │        Code Editor          │    │ │                 │ │
│ │Ext.     │ │  │                             │    │ │ Chat Messages   │ │
│ └─────────┘ │  │    - Syntax Highlighting    │    │ │                 │ │
│             │  │    - IntelliSense           │    │ │ ┌─────────────┐ │ │
│             │  │    - Error Squiggles        │    │ │ │ Input Box   │ │ │
│             │  │    - Git Decorations        │    │ │ └─────────────┘ │ │
│             │  │                             │    │ │                 │ │
│             │  └─────────────────────────────┘    │ │ Status: Ready   │ │
│             │                                     │ └─────────────────┘ │
│             │                                     │                     │
└─────────────┴─────────────────────────────────────┴─────────────────────┘
```

## File Operation Flows

### 1. File Opening Flow
```
Step 1: User clicks file in chat
┌─────────────┬─────────────────────────────────────┬─────────────────────┐
│  SIDEBAR    │           MAIN EDITOR               │    RAYDAEMON CHAT   │
│             │                                     │                     │
│             │                                     │ ✅ Completed: Mod.. │
│             │                                     │ ┌─────────────────┐ │
│             │                                     │ │ 📄 index.js     │ │◄─ CLICK
│             │                                     │ │ 📁 src/         │ │
│             │                                     │ └─────────────────┘ │
└─────────────┴─────────────────────────────────────┴─────────────────────┘

Step 2: File opens in main editor
┌─────────────┬─────────────────────────────────────┬─────────────────────┐
│  SIDEBAR    │           MAIN EDITOR               │    RAYDAEMON CHAT   │
│             │                                     │                     │
│             │  ┌─────────────────────────────┐    │ ✅ Completed: Mod.. │
│             │  │ 📄 index.js                 │    │ ┌─────────────────┐ │
│             │  │                             │    │ │ 📄 index.js     │ │
│             │  │ import { message } from ... │    │ │ 📁 src/         │ │
│             │  │                             │    │ └─────────────────┘ │
│             │  │ console.log(message);       │    │                     │
│             │  │                             │    │                     │
│             │  └─────────────────────────────┘    │                     │
└─────────────┴─────────────────────────────────────┴─────────────────────┘
```

### 2. Diff Viewing Flow
```
Step 1: User clicks diff icon
┌─────────────┬─────────────────────────────────────┬─────────────────────┐
│  SIDEBAR    │           MAIN EDITOR               │    RAYDAEMON CHAT   │
│             │                                     │                     │
│             │                                     │ ✅ Completed: Mod.. │
│             │                                     │ ┌─────────────────┐ │
│             │                                     │ │ 📄 index.js 📊  │ │◄─ CLICK DIFF
│             │                                     │ └─────────────────┘ │
└─────────────┴─────────────────────────────────────┴─────────────────────┘

Step 2: Diff opens in main editor
┌─────────────┬─────────────────────────────────────┬─────────────────────┐
│  SIDEBAR    │           MAIN EDITOR               │    RAYDAEMON CHAT   │
│             │                                     │                     │
│             │  ┌─────────────────────────────┐    │ ✅ Completed: Mod.. │
│             │  │ index.js (Ray Changes)      │    │ ┌─────────────────┐ │
│             │  │                             │    │ │ 📄 index.js 📊  │ │
│             │  │ BEFORE    │    AFTER        │    │ └─────────────────┘ │
│             │  │ ────────  │  ────────       │    │                     │
│             │  │ - old code│  + new code     │    │                     │
│             │  │           │  + Ray changes  │    │                     │
│             │  └─────────────────────────────┘    │                     │
└─────────────┴─────────────────────────────────────┴─────────────────────┘
```

## Command Execution States

### 1. Starting State
```
┌─────────────┬─────────────────────────────────────┬─────────────────────┐
│  SIDEBAR    │           MAIN EDITOR               │    RAYDAEMON CHAT   │
│             │                                     │                     │
│             │                                     │ 🚀 Starting: 3 file │
│             │                                     │    modifications    │
│             │                                     │                     │
│             │                                     │ ┌─────────────────┐ │
│             │                                     │ │ write index.js  │ │
│             │                                     │ │ Plan, search... │ │
│             │                                     │ └─────────────────┘ │
└─────────────┴─────────────────────────────────────┴─────────────────────┘
```

### 2. Working State
```
┌─────────────┬─────────────────────────────────────┬─────────────────────┐
│  SIDEBAR    │           MAIN EDITOR               │    RAYDAEMON CHAT   │
│             │                                     │                     │
│             │                                     │ ⚡ Modifying files  │
│             │                                     │    (2/3) ●●●        │
│             │                                     │                     │
│             │                                     │ ┌─────────────────┐ │
│             │                                     │ │ write index.js  │ │
│             │                                     │ │ Plan, search... │ │
│             │                                     │ └─────────────────┘ │
└─────────────┴─────────────────────────────────────┴─────────────────────┘
```

### 3. Completed State
```
┌─────────────┬─────────────────────────────────────┬─────────────────────┐
│  SIDEBAR    │           MAIN EDITOR               │    RAYDAEMON CHAT   │
│             │                                     │                     │
│             │                                     │ ✅ Completed: Mod.. │
│             │                                     │ ┌─────────────────┐ │
│             │                                     │ │ 📄 index.js 📊  │ │◄─ Clickable
│             │                                     │ │ 📄 app.js   📊  │ │◄─ Clickable
│             │                                     │ │ 📄 utils.js 📊  │ │◄─ Clickable
│             │                                     │ └─────────────────┘ │
│             │                                     │     3 files ▼       │◄─ Expandable
└─────────────┴─────────────────────────────────────┴─────────────────────┘
```

## Panel Interaction Patterns

### Multi-File Workflow
```
Scenario: User reviews multiple files modified by Ray

Step 1: View file list
┌─────────────┬─────────────────────────────────────┬─────────────────────┐
│             │                                     │ ✅ Modified 3 files │
│             │                                     │ ┌─────────────────┐ │
│             │                                     │ │ 📄 index.js 📊  │ │
│             │                                     │ │ 📄 app.js   📊  │ │
│             │                                     │ │ 📄 utils.js 📊  │ │
│             │                                     │ └─────────────────┘ │
└─────────────┴─────────────────────────────────────┴─────────────────────┘

Step 2: Open first file
┌─────────────┬─────────────────────────────────────┬─────────────────────┐
│             │  ┌─────────────────────────────┐    │ ✅ Modified 3 files │
│             │  │ 📄 index.js                 │    │ ┌─────────────────┐ │
│             │  │ console.log('Hello World'); │    │ │ 📄 index.js 📊  │ │◄─ Opened
│             │  └─────────────────────────────┘    │ │ 📄 app.js   📊  │ │
│             │                                     │ │ 📄 utils.js 📊  │ │
│             │                                     │ └─────────────────┘ │
└─────────────┴─────────────────────────────────────┴─────────────────────┘

Step 3: View diff for first file
┌─────────────┬─────────────────────────────────────┬─────────────────────┐
│             │  ┌─────────────────────────────┐    │ ✅ Modified 3 files │
│             │  │ index.js (Ray Changes)      │    │ ┌─────────────────┐ │
│             │  │ BEFORE    │    AFTER        │    │ │ 📄 index.js 📊  │ │◄─ Diff shown
│             │  │ ────────  │  ────────       │    │ │ 📄 app.js   📊  │ │
│             │  │ - old     │  + new code     │    │ │ 📄 utils.js 📊  │ │
│             │  └─────────────────────────────┘    │ └─────────────────┘ │
└─────────────┴─────────────────────────────────────┴─────────────────────┘

Step 4: Continue with next file
┌─────────────┬─────────────────────────────────────┬─────────────────────┐
│             │  ┌─────────────────────────────┐    │ ✅ Modified 3 files │
│             │  │ 📄 app.js                   │    │ ┌─────────────────┐ │
│             │  │ function main() { ... }     │    │ │ 📄 index.js 📊  │ │
│             │  └─────────────────────────────┘    │ │ 📄 app.js   📊  │ │◄─ Now opened
│             │                                     │ │ 📄 utils.js 📊  │ │
│             │                                     │ └─────────────────┘ │
└─────────────┴─────────────────────────────────────┴─────────────────────┘
```

## Error States and Fallbacks

### File Opening Error
```
┌─────────────┬─────────────────────────────────────┬─────────────────────┐
│  SIDEBAR    │           MAIN EDITOR               │    RAYDAEMON CHAT   │
│             │                                     │                     │
│             │  ┌─────────────────────────────┐    │ ❌ Error: Failed to │
│             │  │ ❌ File Not Found           │    │    open file        │
│             │  │                             │    │                     │
│             │  │ The file 'missing.js' could│    │ ┌─────────────────┐ │
│             │  │ not be found or opened.     │    │ │ 📄 missing.js   │ │◄─ Error
│             │  │                             │    │ └─────────────────┘ │
│             │  │ [Try Again] [Cancel]        │    │                     │
│             │  └─────────────────────────────┘    │                     │
└─────────────┴─────────────────────────────────────┴─────────────────────┘
```

### Diff Fallback (No Ray Backup)
```
┌─────────────┬─────────────────────────────────────┬─────────────────────┐
│  SIDEBAR    │           MAIN EDITOR               │    RAYDAEMON CHAT   │
│             │                                     │                     │
│             │  ┌─────────────────────────────┐    │ ℹ️ Opened file in   │
│             │  │ 📄 index.js                 │    │    editor. Check    │
│             │  │                             │    │    SCM for changes  │
│             │  │ console.log('Hello World'); │    │                     │
│             │  │                             │    │ ┌─────────────────┐ │
│             │  │ // Ray's changes visible    │    │ │ 📄 index.js 📊  │ │◄─ Fallback
│             │  │ // in Git decorations       │    │ └─────────────────┘ │
│             │  └─────────────────────────────┘    │                     │
└─────────────┴─────────────────────────────────────┴─────────────────────┘
```

## Responsive Layout Behavior

### Narrow Window (Collapsed Sidebar)
```
┌─────────────────────────────────────────────┬─────────────────────┐
│                MAIN EDITOR                  │    RAYDAEMON CHAT   │
│           (ViewColumn.One)                  │   (ViewColumn.Two)  │
│                                             │                     │
│  ┌─────────────────────────────────────┐    │ ┌─────────────────┐ │
│  │                                     │    │ │  ⚔️😈 RayDaemon │ │
│  │        Code Editor                  │    │ │                 │ │
│  │                                     │    │ │ Chat Messages   │ │
│  │    - Full width for code            │    │ │                 │ │
│  │    - More space for editing         │    │ │ ┌─────────────┐ │ │
│  │    - Sidebar can be toggled         │    │ │ │ Input Box   │ │ │
│  │                                     │    │ │ └─────────────┘ │ │
│  │                                     │    │ └─────────────────┘ │
│  └─────────────────────────────────────┘    │                     │
└─────────────────────────────────────────────┴─────────────────────┘
```

### Wide Window (All Panels Visible)
```
┌─────────┬─────────────────────────────────────────┬─────────────────────┐
│SIDEBAR  │              MAIN EDITOR                │    RAYDAEMON CHAT   │
│         │            (ViewColumn.One)             │   (ViewColumn.Two)  │
│Explorer │                                         │                     │
│Git      │  ┌─────────────────────────────────┐    │ ┌─────────────────┐ │
│Search   │  │                                 │    │ │  ⚔️😈 RayDaemon │ │
│Ext.     │  │        Code Editor              │    │ │                 │ │
│         │  │                                 │    │ │ Chat Messages   │ │
│         │  │    - Optimal width for code     │    │ │                 │ │
│         │  │    - Side-by-side diffs         │    │ │ ┌─────────────┐ │ │
│         │  │    - Multiple tabs visible      │    │ │ │ Input Box   │ │ │
│         │  │                                 │    │ │ └─────────────┘ │ │
│         │  └─────────────────────────────────┘    │ └─────────────────┘ │
└─────────┴─────────────────────────────────────────┴─────────────────────┘
```

## ViewColumn Reference

### VS Code ViewColumn Enum
```typescript
enum ViewColumn {
  Active = -1,    // Currently active column
  Beside = -2,    // Column beside the active one
  One = 1,        // First column (main editor)
  Two = 2,        // Second column (RayDaemon chat)
  Three = 3,      // Third column (additional panels)
  Four = 4,       // Fourth column (rarely used)
  // ... up to Nine = 9
}
```

### RayDaemon Usage Map
```typescript
const RAYDAEMON_LAYOUT = {
  // Chat interface - persistent right panel
  CHAT_PANEL: ViewColumn.Two,
  
  // File operations - main editor area
  FILE_OPENING: ViewColumn.One,
  DIFF_VIEWING: ViewColumn.One,
  CODE_EDITING: ViewColumn.One,
  
  // Future extensions
  TERMINAL_PANEL: ViewColumn.Three,  // If implemented
  OUTPUT_PANEL: ViewColumn.Three,    // If implemented
};
```

This visual documentation provides a comprehensive understanding of how RayDaemon's layout system works, making it easier for users and developers to understand the spatial relationships and interaction patterns within the VS Code environment.