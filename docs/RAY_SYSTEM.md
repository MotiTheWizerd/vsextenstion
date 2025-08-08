# 🚀 RayDaemon Multi-Layer Intent Resolution System

## 🧠 Architecture Overview

```
[User types in chat]
       ↓
[postMessage from Webview → extension.ts]
       ↓
[handleCommand(input)] ← 🧩 ROUTING LAYER
       ↓
→ internal function → OR external agent call → OR tool dispatch
       ↓
[postMessage back to Webview]
       ↓
[Chat panel updates with response]
```

## 🔁 Command Flow

### 1. User Sends Message

From the Webview (RayDaemon UI), user types:

```
show logs from today
```

### 2. Message Enters Core Loop

Inside extension.ts:

```typescript
panel.webview.onDidReceiveMessage((msg) => {
  if (msg.type === "chat") {
    const result = await handleCommand(msg.content);
    panel.webview.postMessage({ type: "chat_response", content: result });
  }
});
```

### 3. handleCommand() – Routing Layer

This is the bridge that decides:

- Should we call an internal tool?
- Should we send to Ray loop daemon (localhost:8000/reflect/deep)?
- Should we fallback to external agent API?

```typescript
async function handleCommand(input: string): Promise<string> {
  // Internal commands
  console.log('[Router] input:', input);
  if (input.startsWith("read ")) return await readFile(input.slice(5));
  if (input.startsWith("list ")) {
    console.log('inside list')
  let arg = input.slice(5).trim();

  const result = await listFiles(arg);
  if (!result || result.length === 0) return "not found";
  return result;
}

  if (input === "status") return "Daemon is alive and ticking.";
  if (input === "ping") return "pong";
  if (input.startsWith("show logs")) return await showLogs(input);

  // 🛰 Forward to Ray loop for complex reasoning
  return await sendToRayLoop(input);
}
```

### 4. Ray Loop Integration

{ task_chain : [{"action" : "quickOpen", "param" : "core/agent.ts" },{"action" : "revealLine", "param" : { lineNumber: 200, at: "center" }}]}



## 🛠 Built-in Commands

### File System Commands

- `read filename.txt` - Read file contents
- `list` or `list folder/` - List files and directories
- `show logs` or `show logs from today` - Show daemon logs

### System Commands

- `status` - Check daemon status
- `ping` - Simple connectivity test

### Complex Queries

Any other input gets sent to:

1. **Ray Loop** (localhost:8000/reflect/deep) - Primary reasoning engine
2. **External Agent** (fallback) - If Ray loop is unavailable

## 🔧 Configuration

Edit `src/config.ts`:

```typescript
export const config = {
  // Ray loop endpoint (local reasoning engine) - primary
  rayLoopEndpoint: "http://localhost:8000/reflect/deep",

  // External agent API endpoint (fallback)
  apiEndpoint: "http://localhost:8000/api/messages",

  apiHeaders: {
    "Content-Type": "application/json",
    // 'Authorization': 'Bearer YOUR_TOKEN_HERE'
  },
};
```

## 🚦 Testing the System

1. **Build**: `pnpm run compile`
2. **Launch**: Press F5 in VS Code
3. **Open Panel**: Command palette → "RayDaemon: Open Panel"
4. **Test Commands**:
   - `ping` → Should return "pong"
   - `status` → Should return "Daemon is alive and ticking."
   - `list` → Should show workspace files
   - `read package.json` → Should show file contents
   - `show logs from today` → Should show today's logs
   - `What is the meaning of life?` → Should forward to Ray loop/agent

## 🔄 Message Flow

### Internal Commands

```
User: "ping"
→ handleCommand("ping")
→ return "pong"
→ Display in chat
```

### Ray Loop Integration

```
User: "Explain this code"
→ handleCommand("Explain this code")
→ sendToRayLoop("Explain this code")
→ POST http://localhost:8000/reflect/deep
→ Return Ray's response
→ Display in chat
```

### Fallback Chain

```
User: "Complex question"
→ Try Ray Loop (localhost:8000/reflect/deep)
→ If fails, try External Agent API
→ If fails, return error message
```

## 🎯 Key Features

✅ **Multi-layer intent resolution**
✅ **Internal tool dispatch**
✅ **Ray loop integration**
✅ **External agent fallback**
✅ **File system operations**
✅ **Real-time chat interface**
✅ **Error handling and fallbacks**

This isn't just API routing - it's a complete reasoning system that connects chat, code, memory, and daemon into one unified loop.

Ready to test! 🚀
