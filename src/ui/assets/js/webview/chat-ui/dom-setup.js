// DOM and layout helpers for ModernChatUI

export function initializeUI(ui) {
  updateChatInputStructure(ui);
  // Note: welcome message intentionally removed per current UX
}

export function updateChatInputStructure(ui) {
  const inputContainer = ui.chatInput.parentElement;
  if (!inputContainer.querySelector(".input-wrapper")) {
    const wrapper = document.createElement("div");
    wrapper.className = "input-wrapper";
    wrapper.appendChild(ui.chatInput);
    wrapper.appendChild(ui.sendButton);
    inputContainer.appendChild(wrapper);
  }

  if (ui.statusBar && !ui.statusBar.querySelector(".status-indicator")) {
    ui.statusBar.innerHTML = `
      <div class="status-indicator"></div>
      <span>RayDaemon is ready</span>
    `;
  }
}

export function setStatus(ui, status) {
  const statusText = ui.statusBar?.querySelector("span");
  if (statusText) statusText.textContent = status;
}

export function adjustTextareaHeight(ui) {
  ui.chatInput.style.height = "auto";
  ui.chatInput.style.height = Math.min(ui.chatInput.scrollHeight, 120) + "px";
}

export function ensureInputWidth(ui) {
  const inputWrapper = ui.chatInput.parentElement;
  if (inputWrapper && inputWrapper.classList.contains("input-wrapper")) {
    const sendButtonWidth = ui.sendButton.offsetWidth;
    const gap = 12;
    const containerPadding = 48;
    const availableWidth = inputWrapper.offsetWidth - sendButtonWidth - gap - containerPadding;
    ui.chatInput.style.width = `${Math.max(availableWidth, 200)}px`;
  }
}

export function scrollToBottom(ui) {
  setTimeout(() => {
    ui.chatMessages.scrollTop = ui.chatMessages.scrollHeight;
  }, 10);
}

export function focusInput(ui) {
  if (ui.chatInput) ui.chatInput.focus();
}

