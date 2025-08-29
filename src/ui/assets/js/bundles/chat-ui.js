// Extracted from webview-bundle.js
import FileUtils from "./file-utils.js";
import MarkdownParser from "./markdown-parser.js";

export default class ModernChatUI {
  constructor(vscodeApi) {
    this.vscodeApi = vscodeApi;
    this.fileUtils = new FileUtils(this);
    this.chatInput = document.getElementById("chatInput");
    this.sendButton = document.getElementById("sendButton");
    this.chatMessages = document.getElementById("chatMessages");
    this.typingIndicator = document.getElementById("typingIndicator");
    this.statusBar = document.getElementById("statusBar");

    this.messageHistory = [];
    this.historyIndex = -1;
    this.typingTimeout = null;

    this.initializeEventListeners();
    this.initializeUI();
    this.scrollToBottom();

    this.postMessage({ command: "webviewReady" });
  }

  initializeUI() {
    this.updateChatInputStructure();
  }

  updateChatInputStructure() {
    if (
      this.typingIndicator &&
      !this.typingIndicator.querySelector(".typing-dots")
    ) {
      this.typingIndicator.innerHTML = `
        RayDaemon is thinking
        <div class="typing-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      `;
    }
    if (this.statusBar && !this.statusBar.querySelector(".status-indicator")) {
      this.statusBar.innerHTML = `
        <div class="status-indicator"></div>
        <span>RayDaemon is ready</span>
      `;
    }
  }

  postMessage(message) {
    this.vscodeApi.postMessage(message);
  }

  initializeEventListeners() {
    this.sendButton.addEventListener("click", () => this.handleSendMessage());
    this.chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.handleSendMessage();
        return;
      }
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        this.navigateHistory(e.key === "ArrowUp" ? "up" : "down");
        e.preventDefault();
        return;
      }
      if (e.key.length === 1 || e.key === "Backspace" || e.key === "Delete") {
        this.historyIndex = -1;
      }
    });
    this.chatInput.addEventListener("input", () => {
      this.adjustTextareaHeight();
      this.updateSendButton();
      this.ensureInputWidth();
    });
    this.chatMessages.addEventListener("click", (e) => {
      if (
        e.target.closest(
          ".tool-count, .tool-file-item, .copy-button, a, button",
        )
      ) {
        return;
      }
      this.chatInput.focus();
    });
    window.addEventListener("resize", () => {
      this.ensureInputWidth();
      this.adjustTextareaHeight();
    });
    this.chatInput.addEventListener("focus", () => {
      this.ensureInputWidth();
    });
  }

  updateSendButton() {
    const hasText = this.chatInput.value.trim().length > 0;
    this.sendButton.disabled = !hasText;
  }

  handleSendMessage() {
    const message = this.chatInput.value.trim();
    if (!message) {
      return;
    }
    this.addMessage("user", message, { showAvatar: true });
    this.chatInput.value = "";
    this.adjustTextareaHeight();
    this.updateSendButton();
    this.showTypingIndicator(true);
    this.messageHistory.push(message);
    if (this.messageHistory.length > 50) {
      this.messageHistory.shift();
    }
    try {
      this.postMessage({
        command: "sendMessage",
        message: message,
      });
      this.typingTimeout = setTimeout(() => {
        this.showTypingIndicator(false);
        this.addMessage(
          "assistant",
          "Sorry, I didn't receive a response. Please try again.",
          { isMarkdown: false, showAvatar: true },
        );
      }, 30000);
    } catch (error) {
      this.showTypingIndicator(false);
      this.addMessage(
        "assistant",
        "Failed to send message. Please try again.",
        { isMarkdown: false, showAvatar: true },
      );
    }
  }

  addMessage(sender, content, options = {}) {
    const {
      timestamp = new Date(),
      isMarkdown = true,
      showAvatar = false,
      replaceLast = false,
      isWorking = false,
      isToolMessage = false,
      customElement = null,
    } = options;
    if (replaceLast) {
      const lastMessage = this.chatMessages.lastElementChild;
      if (lastMessage && lastMessage.classList.contains("message")) {
        lastMessage.remove();
      }
    }
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${sender}`;
    if (isWorking) {
      messageDiv.setAttribute("data-working", "true");
    }
    if (isToolMessage) {
      messageDiv.classList.add("tool-message");
    }
    if (showAvatar && !isToolMessage) {
      const avatar = document.createElement("div");
      avatar.className = "message-avatar";
      avatar.textContent = sender === "user" ? "U" : "R";
      messageDiv.appendChild(avatar);
    }
    const contentDiv = document.createElement("div");
    contentDiv.className = "message-content";
    if (customElement) {
      contentDiv.appendChild(customElement);
    } else if (isMarkdown && content) {
      contentDiv.innerHTML = MarkdownParser.parse(content);
    } else {
      contentDiv.textContent = content || "";
    }
    messageDiv.appendChild(contentDiv);
    if (!isToolMessage) {
      const timeDiv = document.createElement("div");
      timeDiv.className = "message-time";
      timeDiv.textContent = timestamp.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      contentDiv.appendChild(timeDiv);
    }
    this.chatMessages.appendChild(messageDiv);
    this.scrollToBottom();
    return messageDiv;
  }

  navigateHistory(direction) {
    if (this.messageHistory.length === 0) {
      return;
    }
    if (
      direction === "up" &&
      this.historyIndex < this.messageHistory.length - 1
    ) {
      this.historyIndex++;
    } else if (direction === "down" && this.historyIndex >= 0) {
      this.historyIndex--;
    } else {
      return;
    }
    const message =
      this.historyIndex >= 0
        ? this.messageHistory[
            this.messageHistory.length - 1 - this.historyIndex
          ]
        : "";
    this.chatInput.value = message;
    this.adjustTextareaHeight();
    this.updateSendButton();
  }

  showTypingIndicator(show) {
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
    this.typingIndicator.classList.toggle("show", show);
    if (show) {
      this.scrollToBottom();
    }
  }

  clearChat() {
    this.chatMessages.innerHTML = "";
  }

  setStatus(status) {
    const statusText = this.statusBar?.querySelector("span");
    if (statusText) {
      statusText.textContent = status;
    }
  }

  adjustTextareaHeight() {
    this.chatInput.style.height = "auto";
    this.chatInput.style.height =
      Math.min(this.chatInput.scrollHeight, 120) + "px";
  }

  ensureInputWidth() {
    const inputWrapper = this.chatInput.parentElement;
    if (inputWrapper && inputWrapper.classList.contains("input-wrapper")) {
      const sendButtonWidth = this.sendButton.offsetWidth;
      const gap = 12;
      const containerPadding = 48;
      const availableWidth =
        inputWrapper.offsetWidth - sendButtonWidth - gap - containerPadding;
      this.chatInput.style.width = `${Math.max(availableWidth, 200)}px`;
    }
  }

  scrollToBottom() {
    setTimeout(() => {
      this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }, 10);
  }

  focusInput() {
    this.chatInput?.focus();
    this.ensureInputWidth();
  }
}

