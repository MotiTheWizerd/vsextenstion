# 📋 API Message Structure Update

## Overview

This document describes the changes made to the JSON message structure sent from RayDaemon to the Ray API. The update simplifies the message format and adds session tracking capabilities.

## 🔄 Changes Summary

### Removed Fields
- `thinking_budget` - Previously set to `0`
- `include_system` - Previously set to `true`
- `use_memory` - Previously set to `true`
- `max_memory_messages` - Previously set to `10`

### Added Fields
- `project_id` - Unique identifier for the current workspace/project
- `chat_id` - Unique identifier for the current chat session
- `user_id` - Unique UUID4 identifier for the current user (provided by server login)

## 📝 New JSON Structure

### User Message Format

**Before:**
```json
{
  "message": "Hello, can you help me write a function?",
  "model": null,
  "thinking_budget": 0,
  "include_system": true,
  "use_memory": true,
  "max_memory_messages": 10
}
```

**After:**
```json
{
  "message": "Hello, can you help me write a function?",
  "model": null,
  "project_id": "my-workspace-a1b2c3d4",
  "chat_id": "chat-e5f6g7h8",
  "user_id": "user-b3c4d5e6f7g8"
}
```

### Message with Command Results Format

**Before:**
```json
{
  "message": "Hello, can you help me write a function?",
  "command_results": [...],
  "model": null,
  "thinking_budget": 0,
  "include_system": true,
  "use_memory": true,
  "max_memory_messages": 10
}
```

**After:**
```json
{
  "message": "Hello, can you help me write a function?",
  "command_results": [...],
  "model": null,
  "project_id": "my-workspace-a1b2c3d4",
  "chat_id": "chat-e5f6g7h8",
  "user_id": "user-b3c4d5e6f7g8"
}
```

## 🏗️ Implementation Details

### Session Management

A new `SessionManager` class handles the generation and management of session identifiers:

#### Project ID Generation
- **With Workspace**: Based on workspace folder name and path hash
  - Format: `{workspace-name}-{hash}` (e.g., `my-project-a1b2c3d4`)
  - Hash: First 8 characters of MD5 hash of workspace path
  - Ensures consistency across VS Code sessions for the same project
- **Without Workspace**: Random fallback
  - Format: `project-{random}` (e.g., `project-f9e8d7c6`)

#### Chat ID Generation
- **Format**: `chat-{random}` (e.g., `chat-b5a4c3d2`)
- **Persistence**: Maintained throughout the current VS Code session
- **Reset**: New chat ID can be generated with `startNewChat()` method

#### User ID Management
- **Server-Based Authentication**: User logs into server and receives UUID4 user_id
  - Format: Standard UUID4 (e.g., `550e8400-e29b-41d4-a716-446655440000`)
  - Provided by server login response after successful authentication
  - Consistent across all devices and VS Code instances for the same user
- **Default Fallback**: Static default UUID4 when not logged in
  - Format: `00000000-0000-4000-8000-000000000000`
  - Used until user successfully logs into server

### File Changes

#### Modified Files
1. **`src/config.ts`**
   - Updated `formatMessage()` function
   - Updated `formatMessageWithResults()` function
   - Added SessionManager import and usage

2. **`src/utils/sessionManager.ts`** (New)
   - Singleton class for session management
   - Project ID and Chat ID generation logic
   - Workspace-based project identification

### API Configuration

The API endpoint remains unchanged:
```typescript
apiEndpoint: "http://localhost:8000/api/vscode_user_message"
```

Headers remain the same:
```typescript
apiHeaders: {
  "Content-Type": "application/json"
}
```

## 🔍 Usage Examples

### Session Information Access

```typescript
import { SessionManager } from "./utils/sessionManager";
import { UserAuth } from "./utils/userAuth";

const sessionManager = SessionManager.getInstance();
const userAuth = UserAuth.getInstance();

// Get current session info
const sessionInfo = sessionManager.getSessionInfo();
console.log(sessionInfo.projectId); // "my-workspace-a1b2c3d4"
console.log(sessionInfo.chatId);    // "chat-e5f6g7h8"
console.log(sessionInfo.userId);    // "550e8400-e29b-41d4-a716-446655440000"

// Check if user is logged in
console.log(userAuth.isAuthenticated()); // true/false

// Handle server login response
const loginResponse = {
  user_id: "550e8400-e29b-41d4-a716-446655440000",
  username: "john_doe",
  email: "john@example.com",
  token: "jwt_token_here"
};
userAuth.handleLoginSuccess(loginResponse);

// Start a new chat session
const newChatId = sessionManager.startNewChat();
console.log(newChatId); // "chat-x9y8z7w6"

// Logout user (resets to default user_id)
userAuth.logout();
```

### Message Formatting

The config functions now automatically include session information:

```typescript
import { config } from "./config";

// User message
const messageData = config.formatMessage("Hello Ray!");
// Returns: { message: "Hello Ray!", model: null, project_id: "...", chat_id: "...", user_id: "..." }

// Message with command results
const messageWithResults = config.formatMessageWithResults("Hello", []);
// Returns: { message: "Hello", command_results: [], model: null, project_id: "...", chat_id: "..." }
```

## 🧪 Testing

### Manual Testing

1. **Project ID Consistency**
   - Open a workspace in VS Code
   - Send a message and note the project_id
   - Restart VS Code with the same workspace
   - Send another message - project_id should be identical

2. **Chat ID Persistence**
   - Send multiple messages in the same session
   - Verify chat_id remains the same across messages

3. **User Authentication Flow**
   - Before login: Verify user_id is default UUID4 (`00000000-0000-4000-8000-000000000000`)
   - After server login: Verify user_id changes to server-provided UUID4
   - Across devices: Same user should get same user_id when logged in

4. **New Chat Session**
   - Call `sessionManager.startNewChat()`
   - Send a message - chat_id should be different, user_id should remain same

5. **User Logout**
   - Call `userAuth.logout()`
   - Verify user_id resets to default UUID4

6. **No Workspace Fallback**
   - Open VS Code without a workspace folder
   - Send a message - should get `project-{random}` format

### Example Test Scenario

```typescript
// Test workspace-based project ID
const sessionManager = SessionManager.getInstance();

// Simulate workspace: /path/to/my-awesome-project
// Expected project_id: "my-awesome-project-{hash}"

const projectId = sessionManager.getProjectId();
console.log("Project ID:", projectId);

const chatId = sessionManager.getChatId();
console.log("Chat ID:", chatId);

const userId = sessionManager.getUserId();
console.log("User ID:", userId);

// Check authentication status
const userAuth = UserAuth.getInstance();
console.log("Is Authenticated:", userAuth.isAuthenticated());

// Send a test message
const messageData = config.formatMessage("Test message");
console.log("Message data:", messageData);
```

## 🔧 Server-Side Considerations

Servers receiving these messages should expect:

### Required Fields
- `message` (string) - The user's message
- `project_id` (string) - Project identifier
- `chat_id` (string) - Chat session identifier
- `user_id` (string) - User identifier (UUID4 from server login or default)

### Optional Fields
- `model` (null) - Model specification (currently null)
- `command_results` (array) - Present only in follow-up messages

### Migration from Old Format
If your server was expecting the old fields, you'll need to update your server code to:
1. Remove dependencies on `thinking_budget`, `include_system`, `use_memory`, `max_memory_messages`
2. Add handling for `project_id`, `chat_id`, and `user_id`
3. Implement user authentication endpoint that returns user_id in login response
4. Use these new fields for session tracking and context management

## 🚀 Benefits

### Simplified Structure
- Removed unused configuration fields
- Cleaner, more focused message format
- Easier to understand and maintain

### Session Tracking
- **Project-level tracking**: Associate conversations with specific projects
- **Chat-level tracking**: Track individual conversation threads
- **User-level tracking**: Associate conversations with authenticated users across all devices
- **Cross-Device Consistency**: Same user_id across different machines when logged in

### Future Extensibility
- Foundation for project-specific features
- Support for multiple concurrent conversations
- Potential for conversation history and context management

## 🔄 Migration Guide

### For Extension Developers
No changes needed - the new structure is automatically applied to all outgoing messages.

### For Server Developers
Update your message handlers to:

```python
# Before
def handle_message(data):
    message = data['message']
    thinking_budget = data.get('thinking_budget', 0)
    include_system = data.get('include_system', True)
    # ... handle old fields

# After  
def handle_message(data):
    message = data['message']
    project_id = data['project_id']
    chat_id = data['chat_id']
    user_id = data['user_id']  # UUID4 from user authentication
    
    # Check if user is authenticated (not using default ID)
    is_authenticated = user_id != "00000000-0000-4000-8000-000000000000"
    
    # ... use new session identifiers
```

### Server Authentication Integration
```python
# Login endpoint example
@app.route('/api/login', methods=['POST'])
def login():
    credentials = request.json
    user = authenticate_user(credentials)
    
    if user:
        return jsonify({
            'user_id': str(user.uuid),  # UUID4 for the user
            'username': user.username,
            'email': user.email,
            'token': generate_jwt_token(user)
        })
    else:
        return jsonify({'error': 'Invalid credentials'}), 401
```

### Database Schema Updates
Consider updating your database to track conversations by project and chat:

```sql
-- Example schema
CREATE TABLE conversations (
    id UUID PRIMARY KEY,
    project_id VARCHAR(255) NOT NULL,
    chat_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW(),
    INDEX idx_project_chat (project_id, chat_id),
    INDEX idx_user (user_id)
);
```

## 📋 Checklist for Testing

- [ ] Messages contain `project_id`, `chat_id`, and `user_id`
- [ ] Messages do not contain old fields (`thinking_budget`, etc.)
- [ ] Project ID is consistent for the same workspace
- [ ] Chat ID persists across messages in the same session
- [ ] User ID is consistent across VS Code sessions for the same user
- [ ] New chat sessions generate new chat IDs but keep same user ID
- [ ] Fallback project ID works when no workspace is open
- [ ] Command result messages include all session identifiers
- [ ] Server can process the new message format

## 🎯 Next Steps

1. **Update server-side code** to handle new message format
2. **Test integration** with the new JSON structure
3. **Consider implementing** project and chat-based features using the new identifiers
4. **Monitor** for any issues with the simplified message format

---

*This update maintains backward compatibility for the core functionality while providing a cleaner, more extensible message structure for future enhancements.*