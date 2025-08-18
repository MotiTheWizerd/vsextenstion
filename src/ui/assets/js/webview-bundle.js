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
        (result.filePath || result.path || result.file),
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
          ".tool-count, .tool-file-item, .copy-button, a, button",
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
          { isMarkdown: false, showAvatar: true },
        );
      }, 30000);
    } catch (error) {
      console.error("Error sending message from webview:", error);
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

    if (customElement) {
      // If we have a custom element, use it
      contentDiv.appendChild(customElement);
    } else if (isMarkdown && content) {
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
    // Track tool status messages to handle their lifecycle
    this.activeToolStatusMessages = [];
    this.finalToolStatusMessage = null;
  }

  // Remove transient tool status messages (starting/working) when a new one arrives
  removeTransientToolStatusMessages() {
    console.log(
      `Removing transient tool messages. Active count: ${this.activeToolStatusMessages.length}`,
    );

    // Remove all messages except the final one
    if (this.activeToolStatusMessages.length > 0) {
      this.activeToolStatusMessages.forEach((msg) => {
        // Skip the final message (don't remove it)
        if (msg !== this.finalToolStatusMessage) {
          console.log("Removing transient tool status message");
          if (msg && msg.parentNode) {
            msg.remove();
          }
        }
      });

      // Reset the array, keeping only the final message if it exists
      this.activeToolStatusMessages = this.finalToolStatusMessage
        ? [this.finalToolStatusMessage]
        : [];
    }
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
      case "rayResponse":
        this.handleResponse(data);
        break;
      case "error":
        this.handleError(data);
        break;
      case "toolStatus":
        console.log("✅ Tool Status:", data);
        this.handleToolStatus(data);
        break;
      case "clearChat":
        this.chatUI.clearChat();
        break;
      case "statusUpdate":
        this.chatUI.setStatus(data.content);
        break;
      default:
        console.log("Unknown message type", data.type);
    }

    // Handle rayResponse type messages
    if (data.type === "rayResponse" && data.data) {
      const { content, isWorking, isFinal, isCommandResult } = data.data;

      if (content) {
        // Skip old command result messages only if they're not final responses
        if (isCommandResult && !isFinal) {
          console.log("Skipping command result message (not final)");
          return;
        }

        // If this is a final response and we have a working message, replace it
        if (isFinal !== false && !isWorking) {
          const workingMessage = this.chatUI.chatMessages.querySelector(
            '[data-working="true"]',
          );
          if (workingMessage) {
            workingMessage.remove();
          }
        }

        this.chatUI.addMessage("assistant", content, {
          isMarkdown: true,
          showAvatar: true,
          replaceLast: isWorking,
          isWorking: isWorking,
        });
      }
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
    // Check if there are file contents
    if (data.data?.fileContents) {
      data.data.fileContents.forEach((fileContent) => {
        const langSpec = FileUtils.getLanguageFromPath(fileContent.path);
        const fileBlock = `\`\`\`${langSpec}\n${fileContent.content}\n\`\`\``;
        const content = `📄 **${fileContent.path}**\n\n${fileBlock}`;

        this.chatUI.addMessage("assistant", content, {
          isMarkdown: true,
          showAvatar: true,
        });
      });
    } else {
      // Handle regular response messages
      this.chatUI.addMessage("assistant", data.content, {
        isMarkdown: true,
        showAvatar: true,
        replaceLast: data.replaceLast,
      });
    }
  }

  handleError(data) {
    this.chatUI.addMessage("assistant", `Error: ${data.message}`, {
      isMarkdown: false,
      showAvatar: true,
    });
  }

  handleToolStatus(data) {
    // Enhanced tool status handling with modern design
    const {
      status,
      tools,
      totalCount,
      currentIndex,
      successCount,
      failedCount,
      results,
    } = data.data;
    console.log("✅ Tool Status:", data);
    console.log("Status value:", status, "Type:", typeof status);

    // Remove previous non-final tool status messages when a new one arrives
    this.removeTransientToolStatusMessages();

    // Get tool icon based on tool name
    const getToolIcon = (toolName) => {
      if (!toolName) return "tool-default-icon";

      const toolNameLower = toolName.toLowerCase();
      // Exact function name matching for better accuracy
      if (toolNameLower === "fetch") return "tool-fetch-icon";
      if (toolNameLower === "read_file") return "tool-read-icon";
      if (toolNameLower === "edit_file") return "tool-edit-file-icon";
      if (toolNameLower === "write_file") return "tool-write-icon";
      if (toolNameLower === "web_search") return "tool-web-search-icon";
      if (toolNameLower === "terminal") return "tool-terminal-icon";
      if (toolNameLower === "grep") return "tool-grep-icon";
      if (toolNameLower === "find_path") return "tool-find-path-icon";
      if (toolNameLower === "list_directory") return "tool-list-directory-icon";
      if (toolNameLower === "create_directory")
        return "tool-create-directory-icon";
      if (toolNameLower === "diagnostics") return "tool-diagnostics-icon";
      if (toolNameLower === "delete_path") return "tool-delete-path-icon";
      if (toolNameLower === "copy_path") return "tool-copy-path-icon";
      if (toolNameLower === "move_path") return "tool-move-path-icon";
      if (toolNameLower === "thinking") return "tool-thinking-icon";
      if (toolNameLower === "now") return "tool-now-icon";

      // Fallback to pattern matching for generic tools
      if (toolNameLower.includes("fetch") || toolNameLower.includes("get")) {
        return "tool-fetch-icon";
      } else if (
        toolNameLower.includes("write") ||
        toolNameLower.includes("edit") ||
        toolNameLower.includes("create")
      ) {
        return "tool-write-icon";
      } else if (
        toolNameLower.includes("read") ||
        toolNameLower.includes("file")
      ) {
        return "tool-read-icon";
      } else if (
        toolNameLower.includes("terminal") ||
        toolNameLower.includes("exec")
      ) {
        return "tool-terminal-icon";
      } else if (
        toolNameLower.includes("search") ||
        toolNameLower.includes("find") ||
        toolNameLower.includes("grep")
      ) {
        return "tool-search-icon";
      } else if (toolNameLower.includes("diagnostic")) {
        return "tool-diagnostics-icon";
      } else {
        return "tool-default-icon";
      }
    };

    // Create tool status element with enhanced design
    const createToolStatusElement = (statusType, toolList, details = {}) => {
      const element = document.createElement("div");
      element.className = `tool-status ${statusType}`;

      // Get the first tool name for main icon
      const mainTool = tools && tools.length > 0 ? tools[0] : "";
      const mainIcon = getToolIcon(mainTool);

      // Set emoji based on status
      let statusEmoji = "🛠️";
      if (statusType === "starting") statusEmoji = "🚀";
      else if (statusType === "working") statusEmoji = "⚙️";
      else if (statusType === "completed") statusEmoji = "✅";
      else if (statusType === "partial") statusEmoji = "⚠️";
      else if (statusType === "failed") statusEmoji = "❌";

      // Set title based on status
      let title = "";
      if (statusType === "starting") title = `Starting: ${toolList}`;
      else if (statusType === "working") title = `Working: ${toolList}`;
      else if (statusType === "completed") title = `Completed: ${toolList}`;
      else if (statusType === "partial")
        title = `Partially Completed: ${toolList}`;
      else if (statusType === "failed") title = `Failed: ${toolList}`;

      // Create status content
      let progressHTML = "";
      if (statusType === "working") {
        progressHTML = `<div class="tool-progress"></div>`;
      }

      // Create badge HTML if we have count info
      let badgeHTML = "";
      if (totalCount) {
        if (statusType === "starting" || statusType === "working") {
          badgeHTML = `<span class="tool-status-badge">${currentIndex || 1}/${totalCount}</span>`;
        } else if (statusType === "completed" && successCount !== undefined) {
          badgeHTML = `<span class="tool-status-badge">${successCount}/${totalCount} successful</span>`;
        } else if (statusType === "partial") {
          badgeHTML = `<span class="tool-status-badge">${successCount}/${totalCount} successful</span>`;
        } else if (statusType === "failed") {
          badgeHTML = `<span class="tool-status-badge">${failedCount || totalCount}/${totalCount} failed</span>`;
        }
      }

      // Build description based on status
      let description = "";
      if (statusType === "starting") {
        description = "Initializing operation...";
      } else if (statusType === "working") {
        description = `Processing ${currentIndex}/${totalCount}`;
      } else if (statusType === "completed") {
        description = "All operations completed successfully";
      } else if (statusType === "partial") {
        description = `${successCount} succeeded, ${failedCount} failed`;
      } else if (statusType === "failed") {
        description = "Operation failed";
      }

      // Assemble the HTML
      element.innerHTML = `
        <div class="tool-status-header">
          <div class="tool-status-icon ${mainIcon}">${statusEmoji}</div>
          <div class="tool-status-content">
            <div class="tool-status-title">${title}</div>
            <div class="tool-status-description">${description}</div>
            ${badgeHTML ? `<div class="tool-status-meta">${badgeHTML}</div>` : ""}
          </div>
        </div>
        ${progressHTML}
        ${
          tools && tools.length > 1
            ? `
          <div class="tool-details-toggle">View details (${tools.length} operations)</div>
          <div class="tool-details">
            ${tools
              .map(
                (tool, i) => `
              <div class="tool-detail-item">
                <span class="tool-icon ${getToolIcon(tool)}"></span> ${tool}
              </div>
            `,
              )
              .join("")}
          </div>
        `
            : ""
        }
      `;

      // Add click handler for the details toggle if it exists
      const detailsToggle = element.querySelector(".tool-details-toggle");
      if (detailsToggle) {
        detailsToggle.addEventListener("click", () => {
          element.classList.toggle("expanded");
          detailsToggle.textContent = element.classList.contains("expanded")
            ? `Hide details (${tools.length} operations)`
            : `View details (${tools.length} operations)`;
        });
      }

      return element;
    };

    // Helper to determine if a message is final (completed/failed/partial)
    const isFinalMessage = (statusType) => {
      return ["completed", "failed", "partial"].includes(statusType);
    };

    // Helper to add a tool status message and track it
    const addToolStatusMessage = (statusType, toolText, details = {}) => {
      const messageEl = this.chatUI.addMessage("system", "", {
        isMarkdown: false,
        isToolMessage: true,
        customElement: createToolStatusElement(statusType, toolText, details),
      });

      // Track this message
      this.activeToolStatusMessages.push(messageEl);

      // If this is a final message, store it separately
      if (isFinalMessage(statusType)) {
        this.finalToolStatusMessage = messageEl;
      }

      return messageEl;
    };

    if (status === "starting") {
      console.log("🚀 HIT STARTING CONDITION! 🚀🚀", data);
      // Limit display of tool names if there are too many
      let toolList = "Processing";
      if (tools && tools.length > 0) {
        toolList =
          tools.length > 3
            ? `${tools.slice(0, 3).join(", ")} and ${tools.length - 3} more`
            : tools.join(", ");
      }
      console.log("Tool list:", toolList);

      try {
        addToolStatusMessage("starting", toolList, {
          totalCount,
          tools,
        });
        console.log("Starting message added successfully");
      } catch (error) {
        console.error("Error adding starting message:", error);
      }
    } else if (status === "working") {
      console.log("⚙️ HIT WORKING CONDITION");
      // Show the current tool being worked on
      const currentTool = tools && tools.length > 0 ? tools[0] : "Task";
      addToolStatusMessage("working", currentTool, {
        totalCount,
        currentIndex,
        tools,
      });
    } else if (status === "completed") {
      console.log("✅ HIT COMPLETED CONDITION");
      // Show a concise summary for completed tasks
      let toolList = "Task";
      if (tools && tools.length > 0) {
        toolList =
          tools.length > 3 ? `${tools.length} operations` : tools.join(", ");
      }
      addToolStatusMessage("completed", toolList, {
        totalCount,
        successCount,
        failedCount,
        tools,
      });
    } else if (status === "partial") {
      console.log("⚠️ HIT PARTIAL CONDITION");
      // For partial completion, show the success/failure ratio
      let toolList = "Task";
      if (tools && tools.length > 0) {
        toolList =
          tools.length > 3 ? `${tools.length} operations` : tools.join(", ");
      }
      addToolStatusMessage("partial", toolList, {
        totalCount,
        successCount,
        failedCount,
        tools,
      });
    } else if (status === "failed") {
      console.log("❌ HIT FAILED CONDITION");
      let toolList = "Task";
      if (tools && tools.length > 0) {
        toolList =
          tools.length > 3 ? `${tools.length} operations` : tools.join(", ");
      }
      addToolStatusMessage("failed", toolList, {
        totalCount,
        failedCount,
        tools,
      });
    } else {
      console.log("No condition matched. Status:", status);
    }

    // Track final messages for proper lifecycle management
    if (status === "completed" || status === "partial" || status === "failed") {
      this.finalToolStatusMessage = document.querySelector(
        ".message.system:last-child",
      );
    }

    // Track all tool status messages
    const latestMessage = document.querySelector(".message.system:last-child");
    if (latestMessage) {
      this.activeToolStatusMessages.push(latestMessage);
    }

    // Force system messages to be visible
    setTimeout(() => {
      console.log("Applying CSS fixes...");
      document.querySelectorAll(".message.system").forEach((el) => {
        console.log("Found system message:", el);
        el.style.display = "flex";
        el.style.width = "100%";
      });
      document
        .querySelectorAll(".message.system .message-content")
        .forEach((el) => {
          el.style.display = "block";
          el.style.width = "100%";
          el.style.maxWidth = "100%";
        });
    }, 100); // Reduced timeout for faster debugging
  }

  // Remove transient tool status messages (starting/working) when a new one arrives
  removeTransientToolStatusMessages() {
    console.log(
      `Removing transient tool messages. Active count: ${this.activeToolStatusMessages.length}`,
    );

    // Remove all messages except the final one
    if (this.activeToolStatusMessages.length > 0) {
      this.activeToolStatusMessages.forEach((msg) => {
        // Skip the final message (don't remove it)
        if (msg !== this.finalToolStatusMessage) {
          console.log("Removing transient tool status message");
          if (msg && msg.parentNode) {
            msg.remove();
          }
        }
      });

      // Reset the array, keeping only the final message if it exists
      this.activeToolStatusMessages = this.finalToolStatusMessage
        ? [this.finalToolStatusMessage]
        : [];
    }

    // Force system messages to be visible
    setTimeout(() => {
      console.log("Applying CSS fixes...");
      document.querySelectorAll(".message.system").forEach((el) => {
        console.log("Found system message:", el);
        el.style.display = "flex";
        el.style.width = "100%";
      });
      document
        .querySelectorAll(".message.system .message-content")
        .forEach((el) => {
          el.style.display = "block";
          el.style.width = "100%";
          el.style.maxWidth = "100%";
        });
    }, 100); // Reduced timeout for faster debugging
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
    // chatUI.focusInput();
    chatUI.ensureInputWidth();
  }, 100);

  console.log("Chat UI initialized successfully");
});
