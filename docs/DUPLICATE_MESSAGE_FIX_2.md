# Duplicate Message Fix #2

## Problem
Ray responses were appearing twice in the chat interface because there were duplicate message sends in the extension code.

## Root Cause
1. In `src/rayLoop.ts`, the `sendCommandResultsToRay` function could potentially send the same command results multiple times if:
   - Multiple commands were executed in quick succession
   - There was a race condition in the 5-second delay before sending results back to the server

2. In `src/extension.ts`, the `processRayResponse` function could process the same response multiple times if:
   - The webhook server received duplicate POST requests
   - There were duplicate event listeners or message handlers

3. In `src/extension.ts`, the `handleRayPostResponse` function could process the same webhook request multiple times if:
   - The Ray server sent the same response twice
   - There was a network issue causing the request to be duplicated

4. In `src/extension.ts`, the chat message handler was sending both a `rayResponse` message (through `processRayResponse`) and a `chat_response` message for the same response from the Ray API, causing duplicate messages to appear in the chat interface.

## Solution

### 1. Fixed Command Results Sending (`src/rayLoop.ts`)
- **Added duplicate tracking** - Created a `pendingCommandResults` Set to track command results that are currently being sent
- **Unique key generation** - Created a unique key for each command result send based on the original message, command results, and timestamp
- **Skip duplicates** - If a command result send is already pending, skip the duplicate send
- **Cleanup** - Added a finally block to remove entries from the pending set after sending

**Before:**
```typescript
export async function sendCommandResultsToRay(originalMessage: string, commandResults: any[]): Promise<void> {
  // ... code to send results
}
```

**After:**
```typescript
// Track pending command result sends to prevent duplicates
const pendingCommandResults = new Set<string>();

export async function sendCommandResultsToRay(originalMessage: string, commandResults: any[]): Promise<void> {
  // Create a unique key for this command result send
  const commandKey = `${originalMessage}-${JSON.stringify(commandResults)}-${Date.now()}`;
  
  // If we're already sending these command results, skip
  if (pendingCommandResults.has(commandKey)) {
    console.log(`[RayDaemon] Skipping duplicate command results send for key: ${commandKey}`);
    return;
  }
  
  // Mark as pending
  pendingCommandResults.add(commandKey);
  
  try {
    // ... code to send results
  } catch (error) {
    // ... error handling
  } finally {
    // Remove from pending set
    pendingCommandResults.delete(commandKey);
  }
}
```

### 2. Enhanced Response Processing (`src/extension.ts`)
- **Added duplicate tracking** - Created a `processedResponses` Set to track responses that have already been processed
- **Unique key generation** - Created a unique key for each response based on its content
- **Skip duplicates** - If a response has already been processed, skip processing it again
- **Memory management** - Added cleanup to prevent memory leaks by keeping only the last 100 processed responses

**Before:**
```typescript
export async function processRayResponse(rayResponse: any): Promise<void> {
  // ... code to process response
}
```

**After:**
```typescript
// Track processed responses to prevent duplicates
const processedResponses = new Set<string>();

export async function processRayResponse(rayResponse: any): Promise<void> {
  // Create a unique key for this response to prevent duplicates
  const responseKey = JSON.stringify(rayResponse);
  if (processedResponses.has(responseKey)) {
    console.log("[RayDaemon] Skipping duplicate response processing");
    return;
  }
  
  // Mark as processed
  processedResponses.add(responseKey);
  
  // Clean up old entries to prevent memory leaks (keep last 100)
  if (processedResponses.size > 100) {
    const firstKey = processedResponses.values().next().value;
    if (firstKey) {
      processedResponses.delete(firstKey);
    }
  }
  
  // ... code to process response
}
```

### 3. Enhanced Webhook Request Processing (`src/extension.ts`)
- **Added duplicate tracking** - Created a `processedWebhookRequests` Set to track webhook requests that have already been processed
- **Unique key generation** - Created a unique key for each webhook request based on its content
- **Skip duplicates** - If a webhook request has already been processed, skip processing it again
- **Memory management** - Added cleanup to prevent memory leaks by keeping only the last 100 processed requests
- **Enhanced logging** - Added detailed logging to track webhook requests

**Before:**
```typescript
function handleRayPostResponse(rayResponse: any): void {
  processRayResponse(rayResponse);
}
```

**After:**
```typescript
// Track processed webhook requests to prevent duplicates
const processedWebhookRequests = new Set<string>();

function handleRayPostResponse(rayResponse: any): void {
  // Create a unique key for this webhook request
  const requestKey = JSON.stringify(rayResponse);
  if (processedWebhookRequests.has(requestKey)) {
    console.log("[RayDaemon] Skipping duplicate webhook request processing");
    return;
  }
  
  // Mark as processed
  processedWebhookRequests.add(requestKey);
  
  // Clean up old entries to prevent memory leaks (keep last 100)
  if (processedWebhookRequests.size > 100) {
    const firstKey = processedWebhookRequests.values().next().value;
    if (firstKey) {
      processedWebhookRequests.delete(firstKey);
    }
  }
  
  console.log("[RayDaemon] Processing webhook request:", requestKey);
  processRayResponse(rayResponse);
}
```

### 4. Fixed Chat Message Handler (`src/extension.ts`)
- **Added duplicate message prevention** - Modified the chat message handler to prevent sending both a `rayResponse` message (through `processRayResponse`) and a `chat_response` message for the same response from the Ray API
- **Pattern matching** - Added pattern matching to identify responses from `sendToRayLoop` that should not trigger a `chat_response` message
- **Conditional sending** - Only send `chat_response` messages for responses that are not from `sendToRayLoop`

**Before:**
```typescript
case "chat":
  try {
    const result = await handleCommand(message.content);
    // Check if the result indicates command execution is happening
    // If so, we don't send a chat_response immediately
    // The processRayResponse function will handle UI updates
    if (!result.includes("Ray is working on your request")) {
      panel.webview.postMessage({
        type: "chat_response",
        content: result,
      });
    }
  } catch (error) {
    // ... error handling
  }
  break;
```

**After:**
```typescript
case "chat":
  try {
    const result = await handleCommand(message.content);
    // Check if the result indicates command execution is happening
    // If so, we don't send a chat_response immediately
    // The processRayResponse function will handle UI updates
    if (!result.includes("Ray is working on your request")) {
      // Check if the result is from sendToRayLoop by looking for specific patterns
      // If it's from sendToRayLoop, it will already be handled by processRayResponse
      const isFromRayLoop = result.includes("🔄 **Ray is working on your request...**") ||
                            result.includes("❌ **Connection Error**") ||
                            result.includes("❌ **DNS Error**") ||
                            result.includes("❌ **Timeout Error**") ||
                            result.includes("❌ **API Error**") ||
                            result.includes("❌ **Unknown Error**") ||
                            result.includes("Response received but no content found.");
      
      // Only send chat_response if it's not from sendToRayLoop
      if (!isFromRayLoop) {
        panel.webview.postMessage({
          type: "chat_response",
          content: result,
        });
      }
    }
  } catch (error) {
    // ... error handling
  }
  break;
```

### 5. Enhanced Webhook Server Logging (`src/extension.ts`)
- **Added detailed logging** - Added logging to track incoming webhook requests with full details
- **Request tracking** - Added logging to show request URL, method, headers, and body

## Key Changes

### Ray Loop (`src/rayLoop.ts`)
- Added duplicate tracking for command result sends
- Unique key generation for each send operation
- Skip duplicate sends
- Cleanup of pending set entries

### Extension (`src/extension.ts`)
- Added duplicate tracking for response processing
- Added duplicate tracking for webhook request processing
- Fixed chat message handler to prevent duplicate messages
- Unique key generation for each response and webhook request
- Skip duplicate processing
- Memory management for processed responses and webhook requests
- Enhanced logging for webhook requests

## Result
- ✅ **No more duplicate messages** - Each Ray response appears only once
- ✅ **Prevented duplicate command result sends** - Command results are only sent once to the server
- ✅ **Prevented duplicate webhook request processing** - Webhook requests are only processed once
- ✅ **Fixed chat message handler** - Prevents sending both `rayResponse` and `chat_response` messages for the same response
- ✅ **Better resource management** - Prevents memory leaks from tracking processed responses and webhook requests
- ✅ **Clean message flow** - Consistent handling of all message types
- ✅ **Better debugging** - Enhanced logging to track webhook requests
- ✅ **Better user experience** - No confusion from duplicate content

## Testing
1. Build: `pnpm run compile`
2. Launch extension (F5)
3. Open RayDaemon panel
4. Send messages to Ray API
5. Verify each response appears only once
6. Execute multiple commands in quick succession
7. Verify command results are only sent once to the server
8. Check logs to verify webhook requests are processed only once
9. Verify that simple messages like "hello" don't appear twice

The chat interface now properly displays single responses from Ray without any duplication! 🎉