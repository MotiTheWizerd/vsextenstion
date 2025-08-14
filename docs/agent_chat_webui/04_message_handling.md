# Message Handling System

## Overview

The message handling system in the Agent Chat WebUI manages bidirectional communication between the VS Code extension and the webview interface. It ensures reliable message delivery, proper formatting, and appropriate UI updates.

## Message Types

### 1. Outbound Messages

```javascript
class ModernChatUI {
  handleSendMessage() {
    const message = this.chatInput.value.trim();
    if (!message) return;

    this.postMessage({
      type: "chat",
      content: message,
    });
  }

  postMessage(message) {
    vscode.postMessage(message);
  }
}
```

#### Types of Outbound Messages:
1. **Chat Messages**
   - User text input
   - Command requests
   - Status queries

2. **File Operations**
   ```javascript
   postMessage({
     command: "fileUpload",
     filename: file.name,
     type: file.type,
     size: file.size,
     content: e.target.result,
   });
   ```

3. **System Messages**
   ```javascript
   postMessage({ command: "webviewReady" });
   postMessage({ command: "webviewUnload" });
   ```

### 2. Inbound Messages

```javascript
window.addEventListener("message", (event) => {
  messageHandler.handleIncomingMessage(event.data);
});
```

#### Types of Inbound Messages:
1. **Assistant Responses**
   - Text responses
   - Command results
   - Error messages

2. **Status Updates**
   - Tool execution status
   - Processing indicators
   - System state changes

3. **Tool Messages**
   - Tool execution progress
   - Tool results
   - Tool errors

## Message Processing

### 1. Message Queue Management
- Message ordering
- Delivery confirmation
- Retry logic
- Error recovery

### 2. Message Transformation
- Markdown processing
- Code formatting
- Link handling
- Special character escaping

### 3. UI Updates
```javascript
class ModernChatUI {
  addMessage(sender, content, options = {}) {
    // Clear typing indicator
    this.showTypingIndicator(false);
    
    // Create message element
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${sender}`;
    
    // Add content with proper formatting
    const contentDiv = document.createElement("div");
    contentDiv.className = "message-content";
    
    if (options.isMarkdown) {
      contentDiv.innerHTML = MarkdownParser.parse(content);
    } else {
      contentDiv.textContent = content;
    }
    
    // Add to chat and scroll
    this.chatMessages.appendChild(messageDiv);
    this.scrollToBottom();
  }
}
```

## Error Handling

### 1. Message Errors
```javascript
try {
  messageHandler.handleIncomingMessage(event.data);
} catch (error) {
  console.error("Error handling message:", error);
}
```

### 2. Network Errors
```javascript
handleSendMessage() {
  try {
    this.postMessage({
      type: "chat",
      content: message,
    });
  } catch (error) {
    console.error("Error sending message:", error);
    this.showTypingIndicator(false);
    this.addMessage(
      "assistant",
      "Failed to send message. Please try again.",
      {
        isMarkdown: false,
        showAvatar: true,
      }
    );
  }
}
```

### 3. Timeout Handling
```javascript
this.typingTimeout = setTimeout(() => {
  this.showTypingIndicator(false);
  this.addMessage(
    "assistant",
    "Sorry, I didn't receive a response. Please try again.",
    {
      isMarkdown: false,
      showAvatar: true,
    }
  );
}, 30000);
```

## Message Flow Diagram

```
User Input → ModernChatUI
  ↓
Format & Validate
  ↓
postMessage() → VS Code Extension
  ↓
Extension Processing
  ↓
Extension Response → Webview
  ↓
MessageHandler
  ↓
UI Update → ModernChatUI
  ↓
Display to User
```

## Best Practices

1. **Message Validation**
   - Input sanitization
   - Type checking
   - Size limits
   - Content validation

2. **Error Recovery**
   - Graceful degradation
   - User feedback
   - Retry mechanisms
   - State recovery

3. **Performance**
   - Message batching
   - Efficient DOM updates
   - Resource cleanup
   - Memory management
