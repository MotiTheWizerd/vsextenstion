class ModernChatUI {
  constructor(vscodeApi) {
    this.vscodeApi = vscodeApi;
    this.fileUtils = new FileUtils(this);
    this.chatInput = document.getElementById("chatInput");
    this.sendButton = document.getElementById("sendButton");
    console.log("chatInput element:", this.chatInput);
    console.log("sendButton element:", this.sendButton);
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
    // Update the HTML structure to match modern design
    this.updateChatInputStructure();
    // this.addWelcomeMessage(); // Removed welcome message
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

    // Typing indicator HTML is defined in the base HTML template (html.ts)
    // Avoid duplicating its content here.

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
      },
    );
  }

  postMessage(message) {
    this.vscodeApi.postMessage(message);
  }

  initializeEventListeners() {
    console.log("Initializing event listeners.");
    // Send message on button click
    this.sendButton.addEventListener("click", () => this.handleSendMessage());

    // Initialize dropdown toggle
    this.initializeDropdowns();

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

    // Focus input when clicking in chat area (but not on interactive elements)
    this.chatMessages.addEventListener("click", (e) => {
      // Don't focus input if clicking on interactive elements
      if (
        e.target.closest(
          ".tool-count, .tool-file-item, .copy-button, a, button",
        )
      ) {
        return;
      }
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
    console.log("handleSendMessage called");
    const message = this.chatInput.value.trim();
    if (!message) {
      console.log("Message is empty, returning.");
      return;
    }

    // Add user message with avatar
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
        type: "chat",
        content: message,
      });
      this.postMessage({
        type: "chat",
        content: message,
      });

      // Timeout for typing indicator
      this.typingTimeout = setTimeout(() => {
        // Keep typing indicator active; do not hide here to allow long-running tool flows
        this.addMessage(
          "assistant",
          "Sorry, I didn't receive a response. Please try again.",
          {
            isMarkdown: false,
            showAvatar: true,
          },
        );
      }, 30000);
    } catch (error) {
      console.error("Error sending message from webview:", error);
      this.showTypingIndicator(false);
      this.addMessage(
        "assistant",
        "Failed to send message. Please try again.",
        {
          isMarkdown: false,
          showAvatar: true,
        },
      );
    }
  }

  addMessage(sender, content, options = {}) {
    console.group(`[ChatUI] Adding message from ${sender}`);
    console.log("Content length:", content?.length || 0);
    console.log("Options:", options);

    // Log the current scroll position and height before adding the message
    const wasScrolledToBottom = this.isScrolledToBottom();
    console.log("Was scrolled to bottom:", wasScrolledToBottom);
    console.log(
      "Current scroll position:",
      this.chatMessages.scrollTop,
      "of",
      this.chatMessages.scrollHeight,
    );
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

    // Do not auto-hide typing here; it is controlled by message flow.
    // Final responses or errors will explicitly clear the typing indicator.

    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${sender}`;

    // Mark working messages for easy identification
    if (isWorking) {
      messageDiv.setAttribute("data-working", "true");
    }

    // Mark tool messages for special styling
    if (isToolMessage) {
      messageDiv.classList.add("tool-message");
    }

    // Add avatar if requested (not for tool messages)
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

    // Log the message element before adding to DOM
    console.log("Message element created:", {
      className: messageDiv.className,
      innerHTML:
        messageDiv.innerHTML.substring(0, 100) +
        (messageDiv.innerHTML.length > 100 ? "..." : ""),
      dataset: { ...messageDiv.dataset },
    });

    // Add the message to the DOM
    console.log("Adding message to chatMessages container");
    this.chatMessages.appendChild(messageDiv);

    // Log the updated scroll height
    console.log("New scroll height:", this.chatMessages.scrollHeight);

    // Scroll to the bottom if we were already at the bottom
    if (wasScrolledToBottom) {
      console.log("Auto-scrolling to bottom");
      this.scrollToBottom();
    }

    // Add click handler for expandable tool counts
    const expandableCount = messageDiv.querySelector(".tool-count.expandable");
    if (expandableCount) {
      expandableCount.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.fileUtils.toggleToolDropdown(messageDiv);
      });
    }

    console.groupEnd();

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
    } else {
      console.log("Not auto-scrolling - user has scrolled up");
    }

    // Log the final state
    console.log(
      "Final scroll position:",
      this.chatMessages.scrollTop,
      "of",
      this.chatMessages.scrollHeight,
    );
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
    // this.addWelcomeMessage(); // Removed welcome message
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
    if (this.chatInput) {
      this.chatInput.focus();
    }
  }

  /**
   * Initialize dropdown toggles
   */
  initializeDropdowns() {
    // Toggle dropdown on button click
    document.addEventListener("click", (e) => {
      const dropdownToggle = e.target.closest(".dropdown-toggle");
      const dropdown = dropdownToggle?.closest(".dropdown");

      // Close all other dropdowns
      document.querySelectorAll(".dropdown").forEach((dropdown) => {
        if (dropdown !== dropdownToggle?.closest(".dropdown")) {
          dropdown.classList.remove("show");
        }
      });

      // Toggle the clicked dropdown
      if (dropdownToggle) {
        e.preventDefault();
        dropdown?.classList.toggle("show");
      } else {
        // Close dropdown when clicking outside
        document.querySelectorAll(".dropdown").forEach((dropdown) => {
          dropdown.classList.remove("show");
        });
      }
    });

    // Handle dropdown item selection
    document.addEventListener("click", (e) => {
      const dropdownItem = e.target.closest(".dropdown-item");
      if (!dropdownItem) {
        return;
      }

      const value = dropdownItem.dataset.value;
      const dropdown = dropdownItem.closest(".dropdown");
      const dropdownToggle = dropdown?.querySelector(".dropdown-toggle");

      if (dropdownToggle) {
        // Update the button text based on selection
        const icon = dropdownToggle.querySelector("span");
        if (icon) {
          const selectedText = dropdownItem.textContent.trim();
          icon.textContent = value === "agent" ? "∞ Agent" : selectedText;
        }

        // Close the dropdown
        dropdown.classList.remove("show");

        // Notify the extension about the selection
        this.postMessage({
          command: "agentModeSelected",
          mode: value,
        });
      }
    });

    // Close dropdown when pressing Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document.querySelectorAll(".dropdown").forEach((dropdown) => {
          dropdown.classList.remove("show");
        });
      }
    });
  }
}

// ModernChatUI is now globally available
export default ModernChatUI;
