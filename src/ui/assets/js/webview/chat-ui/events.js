// Wiring of DOM event listeners for ModernChatUI

export function initializeEventListeners(ui) {
  ui.sendButton.addEventListener("click", () => {
    const state = ui.sendButton.getAttribute("data-state");
    if (state === "working") {
      try { ui.postMessage({ command: "cancelAgent" }); } catch (_) {}
      return;
    }
    ui.handleSendMessage();
  });

  ui.initializeDropdowns();

  ui.chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ui.handleSendMessage();
      return;
    }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      ui.navigateHistory(e.key === "ArrowUp" ? "up" : "down");
      e.preventDefault();
      return;
    }
    if (e.key.length === 1 || e.key === "Backspace" || e.key === "Delete") {
      ui.historyIndex = -1;
    }
  });

  ui.chatInput.addEventListener("input", () => {
    ui.adjustTextareaHeight();
    ui.updateSendButton();
    ui.ensureInputWidth();
  });

  ui.chatInput.addEventListener("paste", (e) => ui.handlePaste(e));

  ui.chatMessages.addEventListener("click", (e) => {
    if (e.target.closest(".tool-count, .tool-file-item, .copy-button, a, button")) return;
    ui.chatInput.focus();
  });

  window.addEventListener("resize", () => {
    ui.ensureInputWidth();
    ui.adjustTextareaHeight();
  });

  ui.chatInput.addEventListener("focus", () => ui.ensureInputWidth());
}
