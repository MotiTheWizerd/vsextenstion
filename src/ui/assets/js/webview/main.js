import ModernChatUI from "./chat-ui.js";
import MessageHandler from "./message-handler.js";

// Acquire the VS Code API
const vscode = acquireVsCodeApi();

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  const chatUI = new ModernChatUI(vscode);
  const messageHandler = new MessageHandler(chatUI);

  // Listen for messages from extension
  window.addEventListener("message", (event) => {
    try {
      messageHandler.handleIncomingMessage(event.data);
    } catch (error) {
      console.error("Error handling message:", error);
    }
  });

  // Handle page unload
  window.addEventListener("beforeunload", () => {
    chatUI.postMessage({ command: "webviewUnload" });
  });

  // Focus input after initialization
  setTimeout(() => {
    chatUI.focusInput();
    chatUI.ensureInputWidth();
  }, 100);
});
