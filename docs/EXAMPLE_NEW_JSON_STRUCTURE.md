# Example: New JSON Structure with user_id

## Complete Example Output

Here's what the actual JSON looks like when RayDaemon sends messages to the Ray API with the new structure including `user_id`:

### User Message Example
```json
{
  "message": "Hello Ray! Can you help me write a Python function to parse JSON files?",
  "model": null,
  "project_id": "my-awesome-project-a1b2c3d4",
  "chat_id": "chat-e5f6g7h8",
  "user_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Message with Command Results Example
```json
{
  "message": "Hello Ray! Can you help me write a Python function to parse JSON files?",
  "command_results": [
    {
      "command": "write",
      "args": ["json_parser.py", "import json\n\ndef parse_json_file(filename):\n    with open(filename, 'r') as f:\n        return json.load(f)"],
      "ok": true,
      "output": "File 'json_parser.py' written successfully"
    },
    {
      "command": "read",
      "args": ["json_parser.py"],
      "ok": true,
      "output": "import json\n\ndef parse_json_file(filename):\n    with open(filename, 'r') as f:\n        return json.load(f)"
    }
  ],
  "model": null,
  "project_id": "my-awesome-project-a1b2c3d4",
  "chat_id": "chat-e5f6g7h8",
  "user_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

## Field Explanations

### Core Fields
- **`message`**: The actual user input or original message
- **`model`**: AI model specification (currently always `null`)

### Session Tracking Fields
- **`project_id`**: Identifies the workspace/project
  - Format: `{workspace-name}-{hash8chars}`
  - Example: `"my-awesome-project-a1b2c3d4"`
  - Consistent across VS Code sessions for the same workspace

- **`chat_id`**: Identifies the current chat session
  - Format: `chat-{random16chars}`
  - Example: `"chat-e5f6g7h8"`
  - Unique per chat session, persists during VS Code session

- **`user_id`**: Identifies the authenticated user
  - Format: Standard UUID4 from server authentication
  - Example: `"550e8400-e29b-41d4-a716-446655440000"`
  - Consistent across all devices and VS Code instances for the same authenticated user
  - Default: `"00000000-0000-4000-8000-000000000000"` when not logged in

### Optional Fields
- **`command_results`**: Present only in follow-up messages after tool execution
  - Contains array of command execution results
  - Each result includes: `command`, `args`, `ok`, `output`/`error`

## Real-World Session Flow

### Session 1: User starts new project
```json
{
  "message": "Create a simple web server",
  "model": null,
  "project_id": "web-server-project-f1e2d3c4",
  "chat_id": "chat-a1b2c3d4",
  "user_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Session 2: User continues same project, new chat
```json
{
  "message": "Add error handling to the server",
  "model": null,
  "project_id": "web-server-project-f1e2d3c4",  // Same project
  "chat_id": "chat-e5f6g7h8",                   // New chat
  "user_id": "550e8400-e29b-41d4-a716-446655440000"  // Same user
}
```

### Session 3: User opens different project
```json
{
  "message": "Help me debug this algorithm",
  "model": null,
  "project_id": "algorithm-debug-b5c6d7e8",     // Different project
  "chat_id": "chat-i9j0k1l2",                   // New chat
  "user_id": "550e8400-e29b-41d4-a716-446655440000"  // Same user
}
```

## Authentication Flow Example

### 1. User Login
```bash
curl -X POST http://localhost:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "password": "secure_password"
  }'
```

**Server Response:**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "john_doe",
  "email": "john@example.com",
  "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "expires_at": "2025-01-09T10:30:00.000Z"
}
```

### 2. Server Processing Example

Here's how your server might process these messages:

```python
def handle_vscode_message(data):
    # Extract session information
    message = data['message']
    project_id = data['project_id']
    chat_id = data['chat_id']
    user_id = data['user_id']
    
    # Check if user is authenticated
    is_authenticated = user_id != "00000000-0000-4000-8000-000000000000"
    
    if is_authenticated:
        # Get authenticated user contexts
        user_context = get_user_preferences(user_id)
        user_permissions = get_user_permissions(user_id)
    else:
        # Handle anonymous/default user
        user_context = get_default_context()
        user_permissions = get_anonymous_permissions()
    
    project_context = get_project_context(project_id)
    chat_history = get_chat_history(chat_id)
    
    # Process with full context
    response = ai_process(
        message=message,
        user_context=user_context,
        project_context=project_context,
        chat_history=chat_history,
        authenticated=is_authenticated
    )
    
    # Store for future reference
    store_message(project_id, chat_id, user_id, message, response)
    
    return response
```

## Testing the New Structure

### Quick Test Script
```bash
curl -X POST http://localhost:8000/api/vscode_user_message \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Test message with new structure",
    "model": null,
    "project_id": "test-project-12345678",
    "chat_id": "chat-abcdef01",
    "user_id": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

### Expected Server Response
Your server should respond with something like:
```json
{
  "response": "I received your test message for project test-project-12345678, chat chat-abcdef01, user 550e8400-e29b-41d4-a716-446655440000",
  "status": "success"
}
```

## Migration Notes

### What Changed
- ❌ Removed: `thinking_budget`, `include_system`, `use_memory`, `max_memory_messages`
- ✅ Added: `project_id`, `chat_id`, `user_id`

### What Stayed the Same
- ✅ Same endpoint: `/api/vscode_user_message`
- ✅ Same HTTP method: `POST`
- ✅ Same content type: `application/json`
- ✅ Same core fields: `message`, `model`, `command_results`

### Benefits
- **Cleaner Structure**: Removed 4 unused fields
- **Better Tracking**: Project, chat, and user identification
- **Future-Ready**: Foundation for advanced features like user preferences, project contexts, and multi-chat support

### Authentication States

#### Before Login (Default State)
```json
{
  "message": "Hello",
  "model": null,
  "project_id": "my-project-a1b2c3d4",
  "chat_id": "chat-e5f6g7h8",
  "user_id": "00000000-0000-4000-8000-000000000000"
}
```

#### After Server Login
```json
{
  "message": "Hello",
  "model": null,
  "project_id": "my-project-a1b2c3d4",
  "chat_id": "chat-e5f6g7h8", 
  "user_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Cross-Device Consistency
The same user logging in from different machines will always get the same `user_id`, enabling:
- Shared conversation history
- Consistent user preferences
- Cross-device project access
- Unified user analytics

This new structure provides everything needed for sophisticated session management while keeping the API clean and focused.