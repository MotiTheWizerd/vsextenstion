# Tools WebUI Workflow Documentation

## Overview

This document outlines the complete workflow for developing and maintaining the tool call display system in the RayDaemon chat WebUI. This system provides visual feedback when Ray executes commands, showing starting, working, and completion states with modern design and user-friendly information.

## Architecture Overview

### Components Involved

1. **Backend (Extension Side)**
   - `toolStatusNotifier.ts` - Sends tool status updates to WebUI
   - `commandExecutor.ts` - Orchestrates tool execution
   - `commandProcessor.ts` - Processes individual commands

2. **Frontend (WebUI Side)**
   - `webview-bundle.js` - Main message handler and UI logic
   - `tool-status.css` - Styling for tool status messages
   - `tool-icons.css` - Icon definitions for different tool types

3. **Message Flow**
   - Extension → WebView via `postMessage`
   - WebView processes and displays tool status
   - Automatic cleanup of transient messages

## Development Workflow

### 1. Adding New Tool Types

#### Step 1: Update Tool Categories
**File:** `src/extension_utils/commandExecutorTools/toolStatusNotifier.ts`

```typescript
function getToolCategory(toolName: string): string {
  // Add your new tool mapping
  if (toolNameLower === "your_new_tool") {
    return "your_category";
  }
  
  // Or add pattern matching
  if (toolNameLower.includes("your_pattern")) {
    return "your_category";
  }
}
```

#### Step 2: Add Icon Mapping
**File:** `src/ui/assets/css/webviewCssStyles/tool-icons.css`

```css
.tool-your-new-tool-icon::before {
    content: "🆕"; /* Your emoji or icon */
}
```

#### Step 3: Update JavaScript Icon Mapping
**File:** `src/ui/assets/js/webview-bundle.js`

```javascript
const getToolIcon = (toolName) => {
  // Add exact matching
  if (toolNameLower === "your_new_tool") return "tool-your-new-tool-icon";
  
  // Or pattern matching in the fallback section
}
```

### 2. Modifying Tool Status Styles

#### Adding New Status Types
**File:** `src/ui/assets/css/webviewCssStyles/tool-status.css`

```css
.tool-status.your-new-status {
    background: linear-gradient(135deg, rgba(R, G, B, 0.2) 0%, rgba(R, G, B, 0.1) 100%);
    border: 1px solid rgba(R, G, B, 0.25);
    border-left: 3px solid rgba(R, G, B, 0.8);
}

.tool-status.your-new-status .tool-status-icon {
    background: rgba(R, G, B, 0.25);
    color: rgba(R, G, B, 1);
}
```

#### Customizing Animations
```css
@keyframes your-custom-animation {
    0% { /* start state */ }
    50% { /* middle state */ }
    100% { /* end state */ }
}

.tool-status.your-status {
    animation: your-custom-animation 2s infinite;
}
```

### 3. Message Lifecycle Management

#### Understanding Message Flow

1. **Starting Message**
   ```typescript
   // Backend sends
   {
     type: "toolStatus",
     data: {
       status: "starting",
       tools: ["tool_name"],
       totalCount: 3,
       // ...
     }
   }
   ```

2. **Working Updates**
   ```typescript
   {
     status: "working",
     currentIndex: 1,
     tools: ["current_tool"]
   }
   ```

3. **Completion**
   ```typescript
   {
     status: "completed", // or "failed" or "partial"
     successCount: 2,
     failedCount: 1,
     results: [...]
   }
   ```

#### Message Tracking System

**File:** `src/ui/assets/js/webview-bundle.js`

```javascript
class MessageHandler {
  constructor(chatUI) {
    this.activeToolStatusMessages = []; // Track all active messages
    this.finalToolStatusMessage = null; // Track final result message
  }

  removeTransientToolStatusMessages() {
    // Remove all non-final messages when new ones arrive
    this.activeToolStatusMessages.forEach(msg => {
      if (msg !== this.finalToolStatusMessage) {
        msg.remove();
      }
    });
  }
}
```

### 4. Testing Tool Status Messages

#### Manual Testing Checklist

1. **Single Tool Execution**
   - [ ] Starting message appears
   - [ ] Starting message disappears when working begins
   - [ ] Working message shows correct tool name
   - [ ] Completion message appears with correct status
   - [ ] Previous messages are cleaned up

2. **Batch Tool Execution**
   - [ ] Starting message shows total count
   - [ ] Working messages update with progress (1/3, 2/3, etc.)
   - [ ] Completion shows success/failure counts
   - [ ] Expandable details work for multiple tools

3. **Error Scenarios**
   - [ ] Failed status shows appropriate error styling
   - [ ] Partial completion shows mixed results
   - [ ] Error messages don't break the UI

#### Adding Debug Logging

```javascript
// In handleToolStatus method
console.group(`[ToolStatus] Processing ${status} for ${tools.join(', ')}`);
console.log('Message data:', data);
console.log('Current active messages:', this.activeToolStatusMessages.length);
console.groupEnd();
```

### 5. Performance Considerations

#### Memory Management
- Tool status messages are automatically cleaned up
- Only final messages are preserved in chat history
- DOM elements are properly removed to prevent memory leaks

#### Animation Performance
- Use CSS transforms instead of changing layout properties
- Utilize `will-change` property for animated elements
- Keep animations under 16ms per frame

```css
.tool-status {
    will-change: transform, opacity;
    transform: translateZ(0); /* Force hardware acceleration */
}
```

### 6. Accessibility Guidelines

#### Screen Reader Support
```css
.tool-status-icon {
    /* Hide decorative icons from screen readers */
    aria-hidden: true;
}
```

```html
<!-- Add proper ARIA labels -->
<div class="tool-status" role="status" aria-live="polite">
  <div class="tool-status-title" aria-label="Tool execution status">
    Starting: Reading file
  </div>
</div>
```

#### Keyboard Navigation
- Ensure expandable elements are keyboard accessible
- Add proper focus indicators
- Support Enter/Space key activation

### 7. Common Issues and Solutions

#### Issue: Messages Not Appearing
**Possible Causes:**
- CSS display properties being overridden
- JavaScript errors preventing message creation
- Message type mismatch

**Solution:**
```javascript
// Force visibility
setTimeout(() => {
  document.querySelectorAll(".message.system").forEach((el) => {
    el.style.display = "flex";
    el.style.width = "100%";
  });
}, 100);
```

#### Issue: Memory Leaks
**Possible Causes:**
- Event listeners not being removed
- DOM elements not being properly cleaned up

**Solution:**
```javascript
// Proper cleanup
removeMessage(messageElement) {
  // Remove event listeners
  messageElement.removeEventListener('click', this.clickHandler);
  
  // Remove from tracking arrays
  const index = this.activeToolStatusMessages.indexOf(messageElement);
  if (index > -1) {
    this.activeToolStatusMessages.splice(index, 1);
  }
  
  // Remove from DOM
  messageElement.remove();
}
```

#### Issue: Style Conflicts
**Possible Causes:**
- CSS specificity issues
- VSCode theme overrides

**Solution:**
```css
/* Use higher specificity */
.vscode-dark .tool-status.starting {
    background: linear-gradient(...) !important;
}
```

### 8. Adding New Message Types

#### Backend Changes
1. Update `toolStatusNotifier.ts` to send new status
2. Add status to TypeScript interfaces
3. Update command executor logic

#### Frontend Changes
1. Add CSS styles for new status
2. Update JavaScript handler
3. Add icon mapping
4. Test message lifecycle

### 9. Debugging Tools

#### Browser DevTools
- Use React DevTools to inspect component state
- Monitor network tab for message flow
- Use Performance tab to identify bottlenecks

#### Console Debugging
```javascript
// Enable verbose logging
localStorage.setItem('debug-tool-status', 'true');

// In code
if (localStorage.getItem('debug-tool-status')) {
  console.log('[ToolStatus Debug]', ...args);
}
```

#### VSCode Output Panel
- Check "RayDaemon" output channel for backend logs
- Look for tool execution status messages
- Monitor for error messages

### 10. Best Practices

#### CSS Organization
- Keep tool-specific styles in `tool-status.css`
- Use CSS custom properties for consistent theming
- Follow BEM naming convention for new classes

#### JavaScript Organization
- Keep tool status logic in MessageHandler class
- Use helper functions for complex operations
- Maintain separation of concerns

#### Performance
- Debounce rapid status updates
- Use CSS animations over JavaScript animations
- Minimize DOM manipulation

#### Accessibility
- Always provide text alternatives for visual indicators
- Ensure color is not the only way to convey information
- Test with screen readers

### 11. Future Enhancements

#### Planned Features
- [ ] Progress bars for long-running operations
- [ ] Estimated time remaining
- [ ] Detailed error information in expandable sections
- [ ] Tool execution history
- [ ] Performance metrics display

#### Extension Points
- Plugin system for custom tool status renderers
- Configurable status message templates
- User preference for status detail level

### 12. Version History

| Version | Changes | Date |
|---------|---------|------|
| 1.0 | Initial implementation with basic status messages | [Date] |
| 2.0 | Enhanced design with modern CSS and lifecycle management | [Date] |
| 2.1 | Added tool-specific icons and expandable details | [Date] |

---

## Quick Reference

### Key Files
- `toolStatusNotifier.ts` - Backend status sender
- `webview-bundle.js` - Frontend message handler
- `tool-status.css` - Status styling
- `tool-icons.css` - Icon definitions

### Key Classes
- `.tool-status` - Main status container
- `.tool-status.starting` - Starting state
- `.tool-status.working` - Working state  
- `.tool-status.completed` - Success state
- `.tool-status.failed` - Error state
- `.tool-status.partial` - Mixed results state

### Key Methods
- `showInitialStatus()` - Send starting message
- `updateExecutionProgress()` - Send working update
- `showFinalStatus()` - Send completion message
- `handleToolStatus()` - Process status in WebUI
- `removeTransientToolStatusMessages()` - Clean up old messages

For questions or issues, refer to the main documentation or create an issue in the project repository.