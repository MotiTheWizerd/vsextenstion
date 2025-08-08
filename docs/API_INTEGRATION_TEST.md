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
  "timestamp": "2025-01-08T10:30:00.000Z",
  "source": "raydaemon-vscode"
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
     "timestamp": "2025-01-08T10:30:00.000Z",
     "source": "raydaemon-vscode"
   }
   ```
3. **Sends POST to:** `http://localhost:8000/api/messages`
4. **Displays response** in the chat

## 🚨 Error Handling

If your Ray server isn't running, you'll see helpful error messages:

- **❌ Connection Error**: Cannot connect to Ray API
- **❌ DNS Error**: Cannot resolve hostname  
- **❌ Timeout Error**: Ray API not responding
- **❌ API Error**: Specific error from your server

## 🔧 Server Requirements

Your Ray API server should:

1. **Accept POST requests** at `/api/messages`
2. **Return JSON response** in one of these formats:
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

## 🚀 Next Steps

1. **Start your Ray server** on `localhost:8000`
2. **Test the connection** with the `test` command
3. **Chat with your Ray AI** through the beautiful new interface!

Your RayDaemon is now a **fully functional AI chat interface** that connects to your Ray API! 🎉