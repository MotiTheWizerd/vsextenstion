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

  // Initialize action bar buttons
  const actionBar = document.getElementById("actionBar");
  if (actionBar) {
    const newChatButton = document.getElementById("newChatButton");
    const historyButton = document.getElementById("historyButton");
    
    if (newChatButton) {
      newChatButton.addEventListener("click", () => {
        ui.handleNewChat();
      });
    }
    
    if (historyButton) {
      console.log("Setting up history button event listener");
      historyButton.addEventListener("click", () => {
        console.log("History button clicked!");
        ui.handleChatHistory();
      });
    } else {
      console.log("History button not found in DOM!");
    }
  }
}

export function setStatus(ui, status) {
  // Status functionality removed - replaced with action bar
  console.log("Status update (deprecated):", status);
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

