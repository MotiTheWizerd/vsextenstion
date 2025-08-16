/**
 * Bundled webview JavaScript for RayDaemon
 * This file contains all the necessary classes and initialization code
 */

// First, include the MarkdownParser
class MarkdownParser {
  static parse(text) {
    if (!text) {
      return "";
    }

    // Convert headers
    text = text.replace(/^### (.*$)/gm, "<h3>$1</h3>");
    text = text.replace(/^## (.*$)/gm, "<h2>$1</h2>");
    text = text.replace(/^# (.*$)/gm, "<h1>$1</h1>");

    // Convert bold and italic
    text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/\*(.*?)\*/g, "<em>$1</em>");

    // Convert code blocks
    text = text.replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>");
    text = text.replace(/`([^`]+)`/g, "<code>$1</code>");

    // Convert links
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Convert line breaks
    text = text.replace(/\n/g, "<br>");

    return text;
  }
}

// VS Code API will be available as global 'vscode' variable from HTML template

// Simple FileUtils class with essential functionality
class FileUtils {
  constructor(chatUI) {
    this.chatUI = chatUI;
  }

  hasFileResults(results) {
    if (!results || results.length === 0) {
      return false;
    }
    // Simple check for file-like results
    return results.some(
      (result) =>
        result &&
        typeof result === "object" &&
        (result.filePath || result.path || result.file)
    );
  }

  extractFileList(results) {
    if (!results || results.length === 0) {
      return [];
    }

    const files = [];
    results.forEach((result) => {
      if (result && typeof result === "object") {
        if (result.filePath) {
          files.push({ path: result.filePath });
        } else if (result.path) {
          files.push({ path: result.path });
        } else if (result.file) {
          files.push({ path: result.file });
        }
      }
    });

    return files;
  }

  createFileDropdown(results, totalCount) {
    const files = this.extractFileList(results);
    if (files.length === 0) {
      return "";
    }

    let html = '<div class="tool-dropdown" style="display: none;">';
    files.forEach((file) => {
      html += `<div class="tool-file-item" data-file-path="${file.path}">${file.path}</div>`;
    });
    html += "</div>";

    return html;
  }

  toggleToolDropdown(messageDiv) {
    const dropdown = messageDiv.querySelector(".tool-dropdown");
    if (dropdown) {
      const isVisible = dropdown.style.display !== "none";
      dropdown.style.display = isVisible ? "none" : "block";
    }
  }
}

// ModernChatUI class
class ModernChatUI {
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

    // Notify extension that webview is ready
    this.postMessage({ command: "webviewReady" });
  }

  initializeUI() {
    this.updateChatInputStructure();
  }

  updateChatInputStructure() {
    // Update typing indicator with dots
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

    // Update status bar with indicator
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
    console.log("Initializing event listeners.");

    // Send message on button click
    this.sendButton.addEventListener("click", () => this.handleSendMessage());

    // Handle keyboard events
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

    // Auto-resize textarea and ensure proper width
    this.chatInput.addEventListener("input", () => {
      this.adjustTextareaHeight();
      this.updateSendButton();
      this.ensureInputWidth();
    });

    // Focus input when clicking in chat area
    this.chatMessages.addEventListener("click", (e) => {
      if (
        e.target.closest(
          ".tool-count, .tool-file-item, .copy-button, a, button"
        )
      ) {
        return;
      }
      this.chatInput.focus();
    });

    // Handle window resize
    window.addEventListener("resize", () => {
      this.ensureInputWidth();
      this.adjustTextareaHeight();
    });

    // Ensure input stretches on focus
    this.chatInput.addEventListener("focus", () => {
      this.ensureInputWidth();
    });
  }

  updateSendButton() {
    const hasText = this.chatInput.value.trim().length > 0;
    this.sendButton.disabled = !hasText;
  }

  handleSendMessage() {
    console.log("handleSendMessage called");
    const message = this.chatInput.value.trim();
    if (!message) {
      console.log("Message is empty, returning.");
      return;
    }

    // Add user message
    console.log("Adding user message to UI:", message);
    this.addMessage("user", message, { showAvatar: true });

    // Clear input
    this.chatInput.value = "";
    this.adjustTextareaHeight();
    this.updateSendButton();

    // Show typing indicator
    this.showTypingIndicator(true);

    // Add to history
    this.messageHistory.push(message);
    if (this.messageHistory.length > 50) {
      this.messageHistory.shift();
    }

    try {
      console.log("Attempting to post message to extension:", {
        command: "sendMessage",
        message: message,
      });
      this.postMessage({
        command: "sendMessage",
        message: message,
      });

      // Timeout for typing indicator
      this.typingTimeout = setTimeout(() => {
        this.showTypingIndicator(false);
        this.addMessage(
          "assistant",
          "Sorry, I didn't receive a response. Please try again.",
          { isMarkdown: false, showAvatar: true }
        );
      }, 30000);
    } catch (error) {
      console.error("Error sending message from webview:", error);
      this.showTypingIndicator(false);
      this.addMessage(
        "assistant",
        "Failed to send message. Please try again.",
        { isMarkdown: false, showAvatar: true }
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
    } = options;

    if (replaceLast) {
      const lastMessage = this.chatMessages.lastElementChild;
      if (lastMessage && lastMessage.classList.contains("message")) {
        lastMessage.remove();
      }
    }

    // Always clear typing indicator when adding any message
    this.showTypingIndicator(false);
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

    // Add avatar if requested
    if (showAvatar && !isToolMessage) {
      const avatar = document.createElement("div");
      avatar.className = "message-avatar";
      avatar.textContent = sender === "user" ? "U" : "R";
      messageDiv.appendChild(avatar);
    }

    // Create message content
    const contentDiv = document.createElement("div");
    contentDiv.className = "message-content";

    if (isMarkdown && content) {
      contentDiv.innerHTML = MarkdownParser.parse(content);
    } else {
      contentDiv.textContent = content || "";
    }

    messageDiv.appendChild(contentDiv);

    // Add timestamp (only for non-tool messages)
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
    // Ensure the input takes full available width
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

// Simple MessageHandler class
class MessageHandler {
  constructor(chatUI) {
    this.chatUI = chatUI;
  }

  handleIncomingMessage(data) {
    console.log("Received message:", data);

    if (!data || !data.type) {
      console.log("Invalid message data");
      return;
    }

    switch (data.type) {
      case "addMessage":
        this.handleAddMessage(data);
        break;
      case "response":
        this.handleResponse(data);
        break;
      case "error":
        this.handleError(data);
        break;
      case "toolStatus":
        this.handleToolStatus(data);
        break;
      case "clearChat":
        this.chatUI.clearChat();
        break;
      case "setStatus":
        this.chatUI.setStatus(data.status);
        break;
      case "showTypingIndicator":
        this.chatUI.showTypingIndicator(true);
        break;
      case "hideTypingIndicator":
        this.chatUI.showTypingIndicator(false);
        break;
      default:
        console.log("Unknown message type:", data.type);
    }
  }

  handleAddMessage(data) {
    this.chatUI.addMessage(data.role || "assistant", data.content, {
      isMarkdown: true,
      showAvatar: true,
      replaceLast: data.replaceLast,
    });
  }

  handleResponse(data) {
    this.chatUI.addMessage("assistant", data.content, {
      isMarkdown: true,
      showAvatar: true,
      replaceLast: data.replaceLast,
    });
  }

  handleError(data) {
    this.chatUI.addMessage("assistant", `Error: ${data.message}`, {
      isMarkdown: false,
      showAvatar: true,
    });
  }

  handleToolStatus(data) {
    // Simple tool status handling
    const { status, tools } = data;

    if (status === "starting") {
      const toolList =
        tools && tools.length > 0 ? tools.join(", ") : "Processing";
      this.chatUI.addMessage("system", `🚀 Starting: ${toolList}`, {
        isMarkdown: false,
        isToolMessage: true,
      });
    } else if (status === "completed") {
      const toolList = tools && tools.length > 0 ? tools.join(", ") : "Task";
      this.chatUI.addMessage("system", `✅ Completed: ${toolList}`, {
        isMarkdown: false,
        isToolMessage: true,
      });
    } else if (status === "failed") {
      const toolList = tools && tools.length > 0 ? tools.join(", ") : "Task";
      this.chatUI.addMessage("system", `❌ Failed: ${toolList}`, {
        isMarkdown: false,
        isToolMessage: true,
      });
    }
  }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded, initializing chat UI");

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

  console.log("Chat UI initialized successfully");
});
