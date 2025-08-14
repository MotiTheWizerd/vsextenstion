# RayDaemon Layout Quick Reference

## Panel Layout Overview

```
┌─────────────┬─────────────────────┬─────────────────┐
│  Sidebar    │    Main Editor      │ RayDaemon Chat  │
│  (Explorer) │    (Your Code)      │ (AI Assistant)  │
│             │                     │                 │
│  • Files    │  • Code Files       │  • Chat with AI │
│  • Git      │  • Diffs            │  • File Results │
│  • Search   │  • Documentation    │  • Status       │
│             │                     │                 │
└─────────────┴─────────────────────┴─────────────────┘
```

## Where Things Open

| Action | Opens In | Why |
|--------|----------|-----|
| **Click file in chat** | Main Editor | Full editing capabilities |
| **Click diff icon (📊)** | Main Editor | Side-by-side comparison |
| **Ray chat interface** | Right Panel | Always accessible |
| **Command results** | Right Panel | Context with conversation |

## Key Interactions

### 📁 **File Opening**
1. Ray completes a task → Shows file list in chat
2. Click any file name → Opens in main editor
3. Chat stays open → Continue conversation

### 📊 **Diff Viewing**  
1. Ray modifies files → Diff icons (📊) appear
2. Click diff icon → Shows before/after in main editor
3. See exact changes → Ray's modifications highlighted

### 💬 **Chat Flow**
1. Type commands → Chat input (right panel)
2. Ray responds → Messages appear in chat
3. Click results → Open in main editor
4. Continue → Chat remains accessible

## Panel Benefits

### **Right Panel (Chat)**
✅ Always visible while coding  
✅ Real-time status updates  
✅ Clickable file results  
✅ Persistent conversation  

### **Main Editor**
✅ Full VS Code editing features  
✅ Syntax highlighting  
✅ IntelliSense support  
✅ Git decorations  
✅ Proper diff views  

## Common Workflows

### **Review Ray's Changes**
```
1. Ray: "Modified 3 files" → Chat shows file list
2. You: Click first file → Opens in main editor  
3. You: Click diff icon → See Ray's changes
4. You: Review/edit → Make adjustments
5. You: Click next file → Continue review
```

### **Iterative Development**
```
1. You: "Fix the login bug" → Type in chat
2. Ray: Analyzes and fixes → Shows modified files
3. You: Click files → Review changes
4. You: "Add error handling" → Follow-up request
5. Ray: Updates code → Shows new changes
```

### **File Exploration**
```
1. Ray: "Found 5 files" → Search results in chat
2. You: Click any file → Opens for viewing
3. You: Browse code → Full editor features
4. You: Ask questions → Chat about the code
```

## Keyboard Shortcuts

| Action | Shortcut | Result |
|--------|----------|--------|
| **Open RayDaemon** | `Ctrl+Shift+P` → "RayDaemon" | Opens chat panel |
| **Focus Chat** | Click in chat input | Type commands |
| **Focus Editor** | `Ctrl+1` | Switch to main editor |
| **Toggle Sidebar** | `Ctrl+B` | Show/hide file explorer |

## Tips & Tricks

### **Maximize Productivity**
- Keep chat open while coding
- Use diff view to understand changes
- Resize panels to fit your workflow
- Use keyboard shortcuts for quick navigation

### **Panel Management**
- Drag panel borders to resize
- Chat panel remembers your size preference
- Sidebar can be collapsed for more code space
- Multiple editor tabs work normally

### **File Operations**
- All files open in main editor (not chat)
- Diffs show exact Ray changes
- Original VS Code features work normally
- Git integration shows all changes

## Troubleshooting

### **File Won't Open**
- Check file path in console
- Ensure workspace is open
- Verify file permissions

### **Diff Not Showing**
- Look for diff icon (📊) next to files
- Only Ray-modified files have diffs
- Fallback opens file + SCM view

### **Chat Not Visible**
- Use Command Palette → "RayDaemon: Open Panel"
- Check if panel was accidentally closed
- Panel opens in right column by default

### **Wrong Panel Location**
- Files should open in main editor (center)
- Chat should be in right panel
- If wrong, restart VS Code

## Layout Customization

### **Panel Sizes**
- Drag borders between panels
- VS Code remembers your preferences
- Adjust based on screen size

### **Panel Visibility**
- Hide/show panels as needed
- Use View menu for panel options
- Keyboard shortcuts for quick toggles

### **Themes & Colors**
- RayDaemon adapts to your VS Code theme
- High contrast support available
- Font sizes follow VS Code settings

This layout is designed to give you the best of both worlds: powerful AI assistance that's always accessible, combined with VS Code's full editing capabilities in the main workspace.