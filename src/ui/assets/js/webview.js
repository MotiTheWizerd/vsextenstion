/**
 * Modern Chat UI for RayDaemon
 * Handles chat interface interactions with a modern design similar to Kiro/Claude
 */

// Simple markdown to HTML converter
class MarkdownParser {
  static parse(text) {
    if (!text) {return "";}

    // Convert headers
    text = text.replace(/^### (.*$)/gm, "<h3>$1</h3>");
    text = text.replace(/^## (.*$)/gm, "<h2>$1</h2>");
    text = text.replace(/^# (.*$)/gm, "<h1>$1</h1>");

    // Convert code blocks
    text = text.replace(/```([\s\S]*?)```/g, (match, code) => {
      return `<pre><code>${this.escapeHtml(code.trim())}</code></pre>`;
    });

    // Convert inline code
    text = text.replace(/`([^`]+)`/g, "<code>$1</code>");

    // Convert links
    text = text.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    // Convert bold and italic
    text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    text = text.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    text = text.replace(/_([^_]+)_/g, "<em>$1</em>");

    // Convert lists
    text = text.replace(/^\s*[-*]\s+(.*$)/gm, "<li>$1</li>");
    text = text.replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>");

    // Convert line breaks
    text = text.replace(/\n/g, "<br>");

    return text;
  }

  static escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

class ModernChatUI {
  constructor() {
    this.chatInput = document.getElementById("chatInput");
    this.chatMessages = document.getElementById("chatMessages");
    this.sendButton = document.getElementById("sendButton");
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
    // Update the HTML structure to match modern design
    this.updateChatInputStructure();
    this.addWelcomeMessage();
  }

  updateChatInputStructure() {
    // Wrap the input in a modern container
    const inputContainer = this.chatInput.parentElement;
    if (!inputContainer.querySelector(".input-wrapper")) {
      const wrapper = document.createElement("div");
      wrapper.className = "input-wrapper";

      // Move input and button to wrapper
      wrapper.appendChild(this.chatInput);
      wrapper.appendChild(this.sendButton);

      inputContainer.appendChild(wrapper);
    }

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

  addWelcomeMessage() {
    this.addMessage(
      "assistant",
      "Hello! I'm RayDaemon, your AI assistant. How can I help you today?",
      {
        isMarkdown: true,
        showAvatar: true,
      }
    );
  }

  postMessage(message) {
    vscode.postMessage(message);
  }

  initializeEventListeners() {
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

    // Handle paste events
    this.chatInput.addEventListener("paste", (e) => {
      this.handlePaste(e);
    });

    // Focus input when clicking in chat area
    this.chatMessages.addEventListener("click", () => {
      this.chatInput.focus();
    });

    // Handle window resize to maintain input width
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
    this.sendButton.textContent = hasText ? "Send" : "Send";
  }

  handleSendMessage() {
    const message = this.chatInput.value.trim();
    if (!message) {return;}

    // Add user message with avatar
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
      this.postMessage({
        type: "chat",
        content: message,
      });

      // Timeout for typing indicator
      this.typingTimeout = setTimeout(() => {
        this.showTypingIndicator(false);
        this.addMessage(
          "assistant",
          "Sorry, I didn't receive a response. Please try again.",
          {
            isMarkdown: false,
            showAvatar: true,
          }
        );
      }, 30000);
    } catch (error) {
      console.error("Error sending message:", error);
      this.showTypingIndicator(false);
      this.addMessage(
        "assistant",
        "Failed to send message. Please try again.",
        {
          isMarkdown: false,
          showAvatar: true,
        }
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
    
    // Mark working messages for easy identification
    if (isWorking) {
      messageDiv.setAttribute('data-working', 'true');
    }

    // Add avatar if requested
    if (showAvatar) {
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

    // Add timestamp
    const timeDiv = document.createElement("div");
    timeDiv.className = "message-time";
    timeDiv.textContent = timestamp.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    contentDiv.appendChild(timeDiv);

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

    this.chatMessages.appendChild(messageDiv);
    this.scrollToBottom();

    return messageDiv;
  }

  handleIncomingMessage(message) {
    console.log("Received message:", message);

    // Clear typing indicator and timeout for any incoming response
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }
    this.showTypingIndicator(false);

    // Handle different message types
    if (message.type === "chat_response") {
      this.addMessage("assistant", message.content, {
        isMarkdown: true,
        showAvatar: true,
      });
      return;
    }

    if (message.type === "rayResponse" && message.data) {
      const { content, isWorking, isFinal } = message.data;
      if (content) {
        // If this is a final response and we have a working message, replace it
        if (isFinal !== false && !isWorking) {
          const workingMessage = this.chatMessages.querySelector('[data-working="true"]');
          if (workingMessage) {
            workingMessage.remove();
          }
        }
        
        this.addMessage("assistant", content, {
          isMarkdown: true,
          showAvatar: true,
          isWorking: isWorking || false,
        });
      }
      return;
    }

    // Handle command-based messages
    if (message.command) {
      switch (message.command) {
        case "addMessage":
          this.addMessage(message.sender, message.content, {
            ...message.options,
            showAvatar: true,
          });
          break;
        case "showTyping":
          this.showTypingIndicator(message.typing);
          break;
        case "clearChat":
          this.clearChat();
          break;
        case "setStatus":
          this.setStatus(message.status);
          break;
        case "chatError":
          this.addMessage("assistant", `Error: ${message.error}`, {
            isMarkdown: false,
            showAvatar: true,
          });
          break;
      }
    }
  }

  navigateHistory(direction) {
    if (this.messageHistory.length === 0) {return;}

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

  handlePaste(event) {
    const items = (event.clipboardData || event.originalEvent.clipboardData)
      .items;

    for (const item of items) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) {
          this.handleFileUpload(file);
          event.preventDefault();
          return;
        }
      }
    }
  }

  handleFileUpload(file) {
    const reader = new FileReader();

    reader.onload = (e) => {
      this.postMessage({
        command: "fileUpload",
        filename: file.name,
        type: file.type,
        size: file.size,
        content: e.target.result,
      });
    };

    reader.readAsDataURL(file);
  }

  clearChat() {
    this.chatMessages.innerHTML = "";
    this.addWelcomeMessage();
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
      const gap = 12; // Gap between input and button
      const containerPadding = 48; // Total horizontal padding
      
      const availableWidth = inputWrapper.offsetWidth - sendButtonWidth - gap - containerPadding;
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

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  const chatUI = new ModernChatUI();

  // Listen for messages from extension
  window.addEventListener("message", (event) => {
    try {
      chatUI.handleIncomingMessage(event.data);
    } catch (error) {
      console.error("Error handling message:", error);
    }
  });

  // Handle page unload
  window.addEventListener("beforeunload", () => {
    chatUI.postMessage({ command: "webviewUnload" });
  });

  // Focus input after initialization and ensure proper sizing
  setTimeout(() => {
    chatUI.focusInput();
    chatUI.ensureInputWidth();
  }, 100);
});
