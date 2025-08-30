import { WebviewRegistry } from "../ui/webview-registry";

export function hideTyping(message?: string) {
  const panel = WebviewRegistry.getPreferred();
  if (!panel) return;
  try {
    panel.webview.postMessage({ command: "showTyping", typing: false });
    if (message) {
      panel.webview.postMessage({
        command: "addMessage",
        sender: "system",
        content: message,
        options: { isMarkdown: false },
      });
    }
  } catch (e) {
    // best-effort
    console.warn("[RayDaemon] hideTyping notify failed", e);
  }
}

