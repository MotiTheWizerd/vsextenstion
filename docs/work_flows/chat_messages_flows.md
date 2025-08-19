# RayDaemon – Message & Tool Flow (VS Code Extension)

This doc maps the full path of a user message from the webview UI → extension → Ray API → (optional) multi-round tool execution → response back to UI, including the critical race condition fixes for multi-round execution workflows.

---

## High-Level Sequence

1. **User types in the chat UI (webview).**
2. Webview sends `{ command: 'sendMessage', message }` to the extension.
3. Extension shows typing status and **POSTs** the message to **Ray API** (`config.apiEndpoint`).
4. **Ray** replies **asynchronously** to a local **webhook server** (port `config.webhookPort`, default `3001`).
5. The extension's **RayResponseHandler** processes the response:
   - If `command_calls` present → run tools via **CommandExecutor**, then send results back to Ray (round-trip).
   - **Ray may send follow-up responses with MORE command_calls** → additional execution rounds.
   - Otherwise → immediately post the final content to the webview (`type: 'rayResponse'`).
6. **Multi-round execution**: Steps 4-5 may repeat multiple times for complex workflows.
7. Webview renders the message(s); typing indicator hides.

---

## Key Modules (build paths)

- **UI rendering & container**
  - `out/ui/WebviewContent.js` → builds the webview HTML, injects CSS/JS via `getHtml()` and `getScripts()` / `getStyles()`.
  - `out/ui/webViewContentUtils/html.js` → wraps HTML; exposes `vscode = acquireVsCodeApi()` to JS.
  - `out/ui/RayDaemonViewProvider.js` → registers the **WebviewView**, wires message passing.
- **Extension core**
  - `out/extension_utils/extensionManager.js` → lifecycle, registers providers, starts webhook server.
  - `out/commands/index.js` → registers `raydaemon.openChatPanel` and content creation for the panel.
- **Network & loop**
  - `out/config.js` → endpoints and payload shaping (`apiEndpoint`, `webhookPort`, `formatMessage`).
  - `out/apiClient.js` → low-level HTTP client used by the loop and result posting.
  - `out/rayLoop.js` → `sendToRayLoop()`, `sendCommandResultsToRay()`, active tool execution flags.
  - `out/extension_utils/webhookServer.js` → local HTTP server that Ray calls back.
  - `out/extension_utils/rayResponseHandler.js` → central handler to route Ray’s replies into UI and tool exec.
- **Tools / command execution**
  - `out/extension_utils/commandExecutor.js` → parses and executes `command_calls`, builds progress UI, returns results.

---

## Detailed Flow

### 1) Webview → Extension (user sends message)

- The **webview** JS posts an IPC message to the extension with `command: 'sendMessage'` and a payload `message`.
- In the extension, `RayDaemonViewProvider` listens:
  - `webviewView.webview.onDidReceiveMessage(async (message) => { ... })`
  - On `'sendMessage'` → calls `this.handleChatMessage(message.message)`.
  - UI feedback:
    - Posts `type: 'showTypingIndicator'` to the webview immediately.
    - On error, posts `type: 'hideTypingIndicator'` and an `error` message.

> Code ref: `out/ui/RayDaemonViewProvider.js` (listener and `handleChatMessage`).

### 2) Extension → Ray (primary request)

- The request path is handled through the **Ray loop**:
  - `sendToRayLoop(prompt)` formats the payload with `config.formatMessage()` and posts to `config.apiEndpoint` using `ApiClient.post()`.
  - Endpoint defaults (from build):  
    - `apiEndpoint: "http://localhost:8000/api/vscode_user_message"`  
    - `headers: { "Content-Type": "application/json" }`

> Code refs: `out/rayLoop.js`, `out/config.js`, `out/apiClient.js`.

### 3) Ray → Extension (webhook callback)

- The extension runs a local **WebhookServer** that listens on `webhookPort` (default `3001`).
- Ray sends its streamed/final response to this server.
- The server forwards the payload to `RayResponseHandler.handleRayPostResponse(rayResponse)`.

> Code refs: `out/extension_utils/webhookServer.js`, `out/extension_utils/extensionManager.js` (startup), `out/extension_utils/rayResponseHandler.js`.

### 4) Response routing & UI updates

`RayResponseHandler.handleRayPostResponse()` does:

- **Dedup guard** (`processedResponses` Set) so the same webhook isn’t processed twice.
- **“Working” status**: when appropriate, posts a transient “Ray is working” message to UI.
- **Branch A – Tool calls present** (`rayResponse.command_calls?.length > 0`):
  1. Extract a **human-facing** `content` (assistant text before/around tools).
  2. Post a non-final update to UI:
     ```js
     currentPanel.webview.postMessage({
       type: "rayResponse",
       data: { content, isFinal: false, isWorking: false }
     })
     ```
  3. Execute tools via **CommandExecutor.executeCommandCallsAndSendResults(content, commandCalls)**.
  4. **CRITICAL**: Reset `isExecutingTools = false` BEFORE sending results to prevent race condition.
  5. Send the structured **command results back to Ray** (`sendCommandResultsToRay()`), which makes another **POST** to the Ray server (same endpoint family) with `formatMessageWithResults(...)`.
  6. Expect a **follow-up webhook** from Ray which may contain:
     - Final response (no more tools) → Branch B
     - **More command_calls** → Branch A repeats (multi-round execution)
- **Branch B – No tools**:
  - Immediately post the **final** message to the webview:
    ```js
    currentPanel.webview.postMessage({
      type: "rayResponse",
      data: { content, isFinal: true, isWorking: false }
    })
    ```

> Code refs: `out/extension_utils/rayResponseHandler.js`, `out/extension_utils/commandExecutor.js`, `out/rayLoop.js`.

### 5) Tool Execution (inside the extension)

- The `CommandExecutor` iterates over `command_calls` and runs matching handlers (FS, diagnostics, search, navigation, etc.):
  - Handlers under `out/commands/handlers/…`
  - FS ops under `out/commands/commandMethods/fs/…`
  - Diagnostics under `out/commands/commandMethods/diagnostics/…`
- It builds **user-friendly progress labels** (e.g., "Reading file", "Searching ..."), aggregates structured results, and returns them to the loop for posting back to Ray.
- **Race Condition Fix**: `isExecutingTools` flag is reset to `false` immediately after tool execution completes but BEFORE sending results to Ray, allowing follow-up command rounds to execute without blocking.

> Code refs: `out/extension_utils/commandExecutor.js`, `out/commands/handlers/*`, `out/commands/commandMethods/*`.

---

## Important Objects & Message Shapes

### Payload to Ray (initial)
Built via `config.formatMessage(message)`:
```json
{
  "message": "…user text…",
  "model": null,
  "thinking_budget": 0,
  "include_system": true,
  "use_memory": true,
  "max_memory_messages": 10
}
```

### Payload to Ray (with tool results)
Built via `config.formatMessageWithResults(message, commandResults)`:
```json
{
  "message": "…assistant content that triggered tools…",
  "command_results": [ /* structured tool outputs */ ],
  "model": null,
  "thinking_budget": 0,
  "include_system": true,
  "use_memory": true,
  "max_memory_messages": 10
}
```

### Webview updates from extension
```js
// Non-final update (pre-tools or streaming)
{ type: "rayResponse", data: { content, isFinal: false, isWorking: false } }

// Final message
{ type: "rayResponse", data: { content, isFinal: true,  isWorking: false } }

// Typing indicator
{ type: "showTypingIndicator" } / { type: "hideTypingIndicator" }
```

---

## Where the UI can “drop” a message

If logs show the response but UI doesn’t update, the likely handoff point is here:

- `RayResponseHandler` → `currentPanel.webview.postMessage({ type: "rayResponse", … })`
- Or: the **webview JS** lacks a `window.addEventListener('message', …)` that **handles** `type: "rayResponse"` and triggers a React/state update. (The HTML builder injects `jsContent`, so ensure your `src/ui/assets/js/webview/*.js` bundles are included and attach the listener.)

> The build references `src/ui/assets/js/webview-bundle.js` & friends inside `scripts.js`. Verify your bundler actually emits these and they are concatenated into `jsContent`.

---

## Startup & Global Panel Reference

- `ExtensionManager.activate()`
  - Registers the **WebviewView** provider.
  - Starts a **daemon heartbeat** and the **WebhookServer**.
  - Maintains a **global.currentPanel** shim so other modules can call `panel.webview.postMessage(...)` safely.

> Code refs: `out/extension_utils/extensionManager.js`, `out/messaging.js` (helper posting types), `out/commands/index.js` (panel command).

---

## Endpoints & Ports (defaults)

- **POST** to Ray: `http://localhost:8000/api/vscode_user_message`
- **Webhook server** (listen): `http://localhost:3001/…`

Change via `out/config.js` (or corresponding `src/config.ts`).

---

## Minimal Trace to Debug the Current Issue

1. Confirm webhook hit → `RayResponseHandler.handleRayPostResponse CALLED` in logs.
2. Right after that, add a log around `currentPanel.webview.postMessage({ type: "rayResponse", … })` with the **string length** of `content`.
3. In **Webview DevTools**, verify a listener updates UI on `type: "rayResponse"`.
4. **Multi-round execution**: If tools are present, watch for multiple execution rounds:
   - First round: `[XXXXXX] executeCommandCallsAndSendResults CALLED` with `isExecutingTools: false`
   - Follow-up: `[YYYYYY] executeCommandCallsAndSendResults CALLED` with `isExecutingTools: false` (should NOT show "Tools already executing")
5. Watch for duplicate-skip: the `processedResponses` Set hashes the **entire** webhook JSON. If the server retries with the same body, a second UI post will be skipped.
6. **Critical**: Look for absence of "Tools already executing, skipping duplicate execution" errors in follow-up rounds.

---

*Generated from the bundled build in `/mnt/data/media_unzipped/out`.*
