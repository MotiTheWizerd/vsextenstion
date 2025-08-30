// Message composition, history, and typing indicator

export function addMessage(ui, sender, content, options = {}) {
  console.group(`[ChatUI] Adding message from ${sender}`);
  console.log("Content length:", content?.length || 0);
  console.log("Options:", options);

  const wasScrolledToBottom = isScrolledToBottom(ui);
  const {
    timestamp = new Date(),
    isMarkdown = true,
    showAvatar = false,
    replaceLast = false,
    isWorking = false,
    isToolMessage = false,
    customElement,
  } = options;

  if (replaceLast) {
    const lastMessage = ui.chatMessages.lastElementChild;
    if (lastMessage && lastMessage.classList.contains("message")) {lastMessage.remove();}
  }

  if (customElement) {
    const wrapper = document.createElement("div");
    wrapper.className = "message system";
    const contentDiv = document.createElement("div");
    contentDiv.className = "message-content";
    contentDiv.appendChild(customElement);
    wrapper.appendChild(contentDiv);
    ui.chatMessages.appendChild(wrapper);
    if (wasScrolledToBottom) {ui.scrollToBottom();}
    console.groupEnd();
    return wrapper;
  }

  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${sender}`;
  if (isWorking) {messageDiv.setAttribute("data-working", "true");}
  if (isToolMessage) {messageDiv.classList.add("tool-message");}

  if (showAvatar && !isToolMessage) {
    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = sender === "user" ? "U" : "R";
    messageDiv.appendChild(avatar);
  }

  const contentDiv = document.createElement("div");
  contentDiv.className = "message-content";
  if (isMarkdown && content) {contentDiv.innerHTML = MarkdownParser.parse(content);}
  else {contentDiv.textContent = content || "";}
  messageDiv.appendChild(contentDiv);

  if (!isToolMessage) {
    const timeDiv = document.createElement("div");
    timeDiv.className = "message-time";
    timeDiv.textContent = timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    contentDiv.appendChild(timeDiv);
  }

  // Add copy buttons to code blocks
  contentDiv.querySelectorAll("pre").forEach((pre) => {
    const copyButton = document.createElement("button");
    copyButton.className = "copy-button";
    copyButton.innerHTML = "📋";
    copyButton.title = "Copy code";
    copyButton.addEventListener("click", () => {
      const code = pre.querySelector("code")?.textContent || "";
      navigator.clipboard.writeText(code).then(() => {
        copyButton.textContent = "✓";
        setTimeout(() => {
          copyButton.innerHTML = "📋";
        }, 2000);
      });
    });
    pre.appendChild(copyButton);
  });

  ui.chatMessages.appendChild(messageDiv);
  if (wasScrolledToBottom) {ui.scrollToBottom();}

  const expandableCount = messageDiv.querySelector(".tool-count.expandable");
  if (expandableCount) {
    expandableCount.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      ui.fileUtils.toggleToolDropdown(messageDiv);
    });
  }

  console.groupEnd();
  return messageDiv;
}

function isScrolledToBottom(ui) {
  const threshold = 20;
  return ui.chatMessages.scrollTop + ui.chatMessages.clientHeight >= ui.chatMessages.scrollHeight - threshold;
}

export function handleSendMessage(ui) {
  const message = ui.chatInput.value.trim();
  if (!message) {return;}
  ui.addMessage("user", message, { showAvatar: true });
  ui.chatInput.value = "";
  ui.adjustTextareaHeight();
  ui.updateSendButton();
  ui.showTypingIndicator(true);
  ui.messageHistory.push(message);
  if (ui.messageHistory.length > 50) {ui.messageHistory.shift();}
  try {
    ui.postMessage({ type: "chat", content: message });
    ui.typingTimeout = setTimeout(() => {
      ui.addMessage("assistant", "Sorry, I didn't receive a response. Please try again.", {
        isMarkdown: false,
        showAvatar: true,
      });
    }, 30000);
  } catch (error) {
    console.error("Error sending message from webview:", error);
    ui.showTypingIndicator(false);
    ui.addMessage("assistant", "Failed to send message. Please try again.", {
      isMarkdown: false,
      showAvatar: true,
    });
  }
}

export function navigateHistory(ui, direction) {
  if (ui.messageHistory.length === 0) {return;}
  if (direction === "up" && ui.historyIndex < ui.messageHistory.length - 1) {ui.historyIndex++;}
  else if (direction === "down" && ui.historyIndex >= 0) {ui.historyIndex--;}
  else {return;}

  const message = ui.historyIndex >= 0
    ? ui.messageHistory[ui.messageHistory.length - 1 - ui.historyIndex]
    : "";
  ui.chatInput.value = message;
  ui.adjustTextareaHeight();
  ui.updateSendButton();
}

export function showTypingIndicator(ui, show) {
  if (ui.typingTimeout) {clearTimeout(ui.typingTimeout);}
  ui.typingIndicator.classList.toggle("show", show);
  
  // Update send button state
  if (ui.sendButton) {
    ui.sendButton.setAttribute("data-state", show ? "working" : "idle");
  }
  
  // Propagate global working state for broader UI reactions
  try { window.AgentWork && window.AgentWork.setWorking(!!show); } catch (_) {}
  if (show) {ui.scrollToBottom();}
}

export function updateSendButton(ui) {
  // Keep button always enabled (visual state handles meaning)
  ui.sendButton.disabled = false;
}
