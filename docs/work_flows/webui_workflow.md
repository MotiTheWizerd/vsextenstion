# RayDaemon — UI Architecture & Chat Rendering (Developer Guide)

> **Scope:** How the VS Code webview UI is put together: rendering lifecycle, IPC message flow, how **command calls** are displayed from the UI’s perspective, and all chat‑UI related features (typing, status, errors, progress).  
> **Audience:** Frontend contributors working in `src/ui/*` and the message bridge with the extension.

---

## 1) Big Picture

The UI is a **VS Code webview** that renders a chat interface and receives messages from the extension via `postMessage`. Conceptually:

```
Webview (HTML/CSS/JS)  <— IPC —  Extension (TypeScript)  <—>  Ray Server
```

- The **webview** gets HTML from `getWebviewContent()` and JS/CSS bundles from `webViewContentUtils`.
- The webview exposes `const vscode = acquireVsCodeApi();` for two‑way messaging.
- The **extension** posts UI events like: typing indicators, assistant responses, progress, errors.
- The **UI** sends user intents (e.g., `sendMessage`, `openFile`, `openChatPanel`) back to the extension.

---

## 2) Files & Responsibilities (UI side)

- `src/ui/WebviewContent.ts`  
  Generates HTML (CSP + nonce), injects CSS/JS strings produced by:
  - `src/ui/webViewContentUtils/styles.ts` → base styles
  - `src/ui/webViewContentUtils/scripts.ts` → aggregated JS (client logic)
  - `src/ui/webViewContentUtils/html.ts` → final HTML wrapper (sets `acquireVsCodeApi()`)

- `src/ui/RayDaemonViewProvider.ts` (extension host for the webview)  
  *Bridge* that wires:
  - `onDidReceiveMessage` (messages from UI → extension)
  - posts messages back to UI (typing, responses, errors)
  - exposes a shim for `currentPanel` so legacy code can call `postMessage`

> Note: The compiled build in `out/ui/*` is the generated artifact; this guide refers to `src/` as the canonical source.

---

## 3) Message Channels (UI ↔ Extension)

### UI → Extension

- **`{ command: 'sendMessage', message }`**  
  User typed in the chat input and hit send.
- **`{ command: 'openFile', filePath }`**  
  User clicked a file link in results.
- **`{ command: 'openChatPanel' }`**  
  Ensure the chat view is visible/active.
- (Optional) **handshake** like `{ type: 'READY' }` if you implement one.

Use:
```js
const vscode = acquireVsCodeApi();
vscode.postMessage({ command: 'sendMessage', message: '...' });
```

### Extension → UI

- **`{ type: 'showTypingIndicator' }` / `{ type: 'hideTypingIndicator' }`**
- **`{ type: 'rayResponse', data: { content, isFinal, isWorking } }`**  
  The core assistant payload to render.
- **`{ type: 'error', message }`**
- (Optional) progress events if you stream tool steps.

> The extension typically posts a **non‑final** message first (pre‑tools) and a **final** message after tool execution and Ray’s follow‑up webhook.

---

## 4) Rendering Lifecycle (UI)

1. **User sends text** → UI posts `{command:'sendMessage'}` to the extension.
2. UI sets local state: **append user bubble**, clear input, **show typing…**.
3. Extension replies quickly with `{type:'showTypingIndicator'}` (idempotent on the UI).
4. When Ray responds (possibly after tools), extension posts:
   ```jsonc
   { "type": "rayResponse",
     "data": { "content": "…markdown or plain text…", "isFinal": false|true, "isWorking": false } }
   ```
5. UI **appends assistant bubble**. If `isFinal === false`, keep typing indicator or “working” chip.  
   When a later **final** arrives, **update** the last assistant message or append a new final bubble (your choice—recommend *append* to preserve history).
6. On `{type:'hideTypingIndicator'}` or a final response, remove the typing chip.

> Tip: Treat `isFinal=false` as **provisional** content. Store a `pendingAssistantId` to correlate and update/append cleanly.

---

## 5) Command Calls — from the UI point of view

Although commands are executed in the extension, the UI should **reflect** them so users see what’s happening.

Recommended UI model (state):

```ts
type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;          // markdown or plain text
  ts: number;
  meta?: {
    isFinal?: boolean;
    isWorking?: boolean;
    tools?: ToolBadge[];    // visible badges like "Searching", "Reading file", etc.
  };
};

type ToolBadge = {
  label: string;            // e.g., "Searching \"foo\""
  status: 'pending'|'ok'|'error';
  elapsedMs?: number;
};
```

**How it renders:**

- When extension posts the **non‑final** assistant text (pre‑tools), it can also include a list of **tool labels** (derived from `generateToolNames()` in the executor). The UI shows these as **badges** under the assistant bubble, initially in `pending`.
- While tools run, the extension may send optional progress mini‑events (you can subscribe and update badges).
- After tools complete and Ray returns a **final** response, the UI updates badges to `ok`/`error` with elapsed times and appends the **final assistant bubble**.

Minimal mapping table:

| Extension event | UI effect |
|---|---|
| `rayResponse (isFinal=false)` | Append assistant bubble with provisional text; show tool badges (pending) if provided. |
| `progress:updateTool` (optional) | Update a badge label/status. |
| `rayResponse (isFinal=true)` | Append final assistant bubble; mark badges as done (ok/error); hide typing. |
| `error` | Show toast and/or append a red “error” bubble. |

> Even if your current extension doesn’t emit fine‑grained progress, designing the UI state like this keeps you future‑proof.

---

## 6) Markdown, Links, and File Actions

- Render assistant `content` using a safe Markdown renderer (no raw HTML).  
- File paths in tool results should be clickable:
  - The UI sends `{ command: 'openFile', filePath }` to extension.
  - The extension opens the document via VS Code APIs.
- Long code blocks: collapse after N lines with a “Show more” expander to avoid giant DOM nodes.

---


## 8) Error Surfaces

UI should handle gracefully:

- **Network**: show a toast (“Couldn’t reach Ray. Retrying…”) and keep the typing chip if the extension is retrying.
- **Tool failure**: render badges with `error`, and include the error message in a collapsible details block under the assistant message.
- **Payload too large**: show truncated content with a “Copy full to clipboard” or “Save to file” action.

---

## 9) Panel Lifecycle

- The extension creates a **WebviewView** (not a Panel) so the UI can persist in the side area.  
- To keep state across visibility toggles, rely on VS Code’s built‑in webview state (`vscode.setState/getState`) or let the extension pass a cached history snapshot on reveal.
- If you implement a **MessageBus** on the extension side, it will buffer posts when the webview is not yet ready and flush on `setWebview()`.

---

## 10) Performance Notes

- **Batch DOM updates**: when appending many messages or a long markdown render, use `requestAnimationFrame` or minimal reflows.
- **Virtualize long transcripts** (thousands of nodes) using a windowing lib or simple viewport slicing.
- **Avoid giant messages**: if `content.length` is huge, truncate and offer a “view full” action to open a separate document.

---

## 11) Minimal Client Skeleton (UI script)

Below is a compact pattern your bundled `webview.js` should implement:

```js
const vscode = acquireVsCodeApi();

// state
let messages = [];

function appendMessage(msg) {
  messages.push(msg);
  render(); // your renderer
}

function setTyping(show) {
  const el = document.getElementById('typing');
  el.style.display = show ? 'block' : 'none';
}

window.addEventListener('message', (event) => {
  const { type, data, message } = event.data || {};
  switch (type) {
    case 'showTypingIndicator':
      setTyping(true);
      break;
    case 'hideTypingIndicator':
      setTyping(false);
      break;
    case 'rayResponse':
      appendMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data?.content ?? '',
        ts: Date.now(),
        meta: { isFinal: !!data?.isFinal, isWorking: !!data?.isWorking }
      });
      if (data?.isFinal) setTyping(false);
      break;
    case 'error':
      appendMessage({ role: 'system', content: `❌ ${message}`, ts: Date.now() });
      setTyping(false);
      break;
  }
});

// user input -> extension
document.getElementById('send').addEventListener('click', () => {
  const input = document.getElementById('input');
  const text = input.value.trim();
  if (!text) return;
  appendMessage({ role: 'user', content: text, ts: Date.now() });
  setTyping(true);
  vscode.postMessage({ command: 'sendMessage', message: text });
  input.value = '';
});
```

This is intentionally vanilla; if you use React/Svelte, the exact wiring is the same—just updated through state setters.

---

## 12) Visual Treatment for Command Calls (Badges)

Example HTML for badges under an assistant bubble:

```html
<div class="tool-badges">
  <span class="badge pending">Searching "foo"</span>
  <span class="badge ok">Reading README.md</span>
  <span class="badge error" title="ENOENT">Opening missing.js</span>
</div>
```

CSS sketch:
```css
.badge { padding: 2px 8px; border-radius: 999px; font-size: 12px; }
.badge.pending { background: #7773; }
.badge.ok { background: #2e7d3230; }
.badge.error { background: #c6282830; }
```

When the final message arrives, badges flip from `pending` to `ok`/`error` and show elapsed time if provided.

---

## 13) CSP & Asset Loading

- The HTML wrapper sets a strict **CSP** with a runtime nonce. Load your single JS bundle using that nonce.
- Avoid inline scripts other than the injected bundle. Any third‑party libs must be vendored/bundled.
- Images: allow `data:` and `https:` (as configured in `html.ts`).

---
111111111111
## 14) Developer Probes

- **Ping loop:** every 10s send `{ type:'PING' }` to the extension and expect `{ type:'PONG' }` back to verify IPC health (optional).
- **Dummy rayResponse:** bind a dev button in the UI that fakes a `rayResponse` payload to test rendering quickly.
- **Perf overlay:** measure render durations for large markdown texts.

---

## 15) FAQ (UI)

- **Q:** I see logs from the extension but nothing in the UI.  
  **A:** Inspect the Webview DevTools console. Ensure your script bundle is loaded (no CSP errors), and that `window.addEventListener('message', …)` is attached in the same JS context that’s actually running.

- **Q:** How do I render giant code blocks?  
  **A:** Collapse after N lines; add “expand” and “copy” buttons. Consider syntax-highlight on demand (lazy load).

- **Q:** Can the UI trigger commands directly?  
  **A:** Yes, but keep the pattern: UI → `{command: 'sendMessage'}` → Extension → Ray → Webhook → Extension → UI. For local one‑offs (open file), UI can post `{command: 'openFile', filePath}`.

---

*End of guide — aligned with the canonical `src/ui/*` structure and the message shapes posted by the extension.*
