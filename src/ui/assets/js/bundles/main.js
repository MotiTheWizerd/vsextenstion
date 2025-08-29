// Extracted initialization from webview-bundle.js
import ModernChatUI from "./chat-ui.js";
import MessageHandler from "./message-handler.js";

document.addEventListener("DOMContentLoaded", () => {
  const chatUI = new ModernChatUI(vscode);
  const messageHandler = new MessageHandler(chatUI);

  window.addEventListener("message", (event) => {
    try {
      messageHandler.handleIncomingMessage(event.data);
    } catch (error) {
      console.error("Error handling message:", error);
    }
  });

  window.addEventListener("beforeunload", () => {
    chatUI.postMessage({ command: "webviewUnload" });
  });

  setTimeout(() => {
    // chatUI.focusInput();
    chatUI.ensureInputWidth();
  }, 100);
});

