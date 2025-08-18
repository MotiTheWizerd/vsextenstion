/**
 * Modern Chat UI for RayDaemon
 * Handles chat interface interactions with a modern design similar to Kiro/Claude
 */
import './webview/markdown-parser.js';
import './webview/file-utils.js';
import ModernChatUI from './webview/chat-ui.js';
import MessageHandler from './webview/message-handler.js';

// Acquire the VS Code API
const vscode = acquireVsCodeApi();

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  const chatUI = new ModernChatUI(vscode);
  
  // Handle page unload
  window.addEventListener("beforeunload", () => {
    chatUI.postMessage({ command: "webviewUnload" });
  });

  console.log("Chat UI modules loaded");
});
