# 🚀 API Integration Test Guide

## ✅ What's Been Updated

Your RayDaemon extension now **actually sends messages** to your configured API endpoint! Here's what changed:

### 🔧 Updated Files
- **`src/rayLoop.ts`** - Now sends real HTTP requests to your API
- **`src/apiClient.ts`** - Improved HTTP client with better error handling
- **`src/commands/commandHandler.ts`** - Added helpful test commands

### 🎯 API Configuration
Your messages are sent to: **`http://localhost:8000/api/messages`**

The request format matches your config:
```json
{
  "message": "User's message here",
  "model": null,
  "project_id": "my-workspace-a1b2c3d4",
  "chat_id": "chat-e5f6g7h8",
  "user_id": "user-b3c4d5e6f7g8"
}
```

## 🧪 How to Test

### 1. Build the Extension
```bash
pnpm run compile
```

### 2. Launch Development Mode
- Press `F5` in VS Code
- Opens Extension Development Host

### 3. Open RayDaemon Panel
- `Ctrl+Shift+P` → "RayDaemon: Open Panel"
- Or click the RayDaemon icon in sidebar

### 4. Test Commands

#### Built-in Commands (work offline):
- `ping` → Returns "🏓 Pong!"
- `status` → Shows your API configuration
- `help` → Lists all available commands
- `ls` → Lists files in current directory
- `read package.json` → Reads file contents

#### API Commands (require your server):
- `test` → Sends test message to your Ray API
- `Hello Ray!` → Any other message goes to your API
- `What's the weather?` → Forwards to Ray API

## 🔍 What Happens When You Send a Message

1. **User types:** "Hello Ray!"
2. **RayDaemon formats:** 
   ```json
   {
     "message": "Hello Ray!",
     "model": null,
     "project_id": "my-workspace-a1b2c3d4",
     "chat_id": "chat-e5f6g7h8",
     "user_id": "user-b3c4d5e6f7g8"
   }
   ```
3. **Sends POST to:** `http://localhost:8000/api/vscode_user_message`
4. **Displays response** in the chat

## 🚨 Error Handling

If your Ray server isn't running, you'll see helpful error messages:

- **❌ Connection Error**: Cannot connect to Ray API
- **❌ DNS Error**: Cannot resolve hostname  
- **❌ Timeout Error**: Ray API not responding
- **❌ API Error**: Specific error from your server

## 🔧 Server Requirements

Your Ray API server should:

1. **Accept POST requests** at `/api/vscode_user_message`
2. **Handle new message format** with `project_id` and `chat_id` fields
3. **Return JSON response** in one of these formats:
   ```json
   { "response": "Your response here" }
   // OR
   { "message": "Your response here" }
   // OR
   { "content": "Your response here" }
   // OR just plain text
   ```

## 🎯 Testing Checklist

- [ ] Extension builds successfully (`pnpm run compile`)
- [ ] Panel opens with modern chat UI
- [ ] `ping` command works (tests internal commands)
- [ ] `status` command shows your API endpoint
- [ ] `test` command attempts to connect to your API
- [ ] Custom messages are sent to your Ray API
- [ ] Error messages are helpful when server is down

## 📋 Message Structure Update

RayDaemon now sends a simplified message structure with session tracking:

### New Fields
- `project_id`: Unique identifier for your workspace (e.g., "my-project-a1b2c3d4")
- `chat_id`: Unique identifier for the chat session (e.g., "chat-e5f6g7h8")
- `user_id`: Unique identifier for the user/VS Code instance (e.g., "user-b3c4d5e6f7g8")

### Removed Fields
- `timestamp`: No longer included
- `source`: No longer included
- `thinking_budget`: Removed
- `include_system`: Removed
- `use_memory`: Removed
- `max_memory_messages`: Removed

### Server Updates Required
Update your server to handle the new format:
```python
def handle_message(data):
    message = data['message']
    project_id = data['project_id']  # NEW: Project identifier
    chat_id = data['chat_id']        # NEW: Chat session identifier
    user_id = data['user_id']        # NEW: User/VS Code instance identifier
    model = data.get('model')        # Usually null
    # ... process message with session context
```

## 🚀 Next Steps

1. **Update your Ray server** to handle the new message format
2. **Start your Ray server** on `localhost:8000`
3. **Test the connection** with the `test` command
4. **Chat with your Ray AI** through the beautiful new interface!

Your RayDaemon is now a **fully functional AI chat interface** with session tracking that connects to your Ray API! 🎉