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
    // Use extractFileList for accurate file detection
    const files = this.extractFileList(results);
    return files && files.length > 0;
  }

  extractFileList(results) {
    if (!results || results.length === 0) {
      return [];
    }

    const files = [];
    const processedPaths = new Set();

    results.forEach((result) => {
      if (result && typeof result === "object") {
        // For file modification commands, extract file path from arguments
        if (
          result.ok &&
          ["write", "append", "replace", "edit_file", "create_file"].includes(
            result.command,
          )
        ) {
          const args = result.args || [];
          if (args.length > 0 && typeof args[0] === "string") {
            let filePath = args[0].trim();
            // Clean the file path
            filePath = filePath.replace(/^["']|["']$/g, "");
            filePath = filePath.replace(/^\*\*|\*\*$/g, "");
            filePath = filePath.replace(/^`|`$/g, "");

            if (
              this.isValidFilePath(filePath) &&
              !processedPaths.has(filePath)
            ) {
              const absolutePath = this.getAbsolutePath(filePath);
              files.push({
                name: filePath.split(/[\/\\]/).pop() || filePath,
                path: filePath,
                absolutePath: absolutePath,
                type: "file",
                icon: "📄",
                isModified: true,
              });
              processedPaths.add(filePath);
            }
          }
        }

        // Handle direct file path properties
        if (result.filePath) {
          if (!processedPaths.has(result.filePath)) {
            const absolutePath = this.getAbsolutePath(result.filePath);
            files.push({
              path: result.filePath,
              absolutePath: absolutePath,
              name: result.filePath.split(/[\/\\]/).pop() || result.filePath,
              type: "file",
              icon: "📄",
            });
            processedPaths.add(result.filePath);
          }
        } else if (result.path) {
          if (!processedPaths.has(result.path)) {
            const absolutePath = this.getAbsolutePath(result.path);
            files.push({
              path: result.path,
              absolutePath: absolutePath,
              name: result.path.split(/[\/\\]/).pop() || result.path,
              type: "file",
              icon: "📄",
            });
            processedPaths.add(result.path);
          }
        } else if (result.file) {
          if (!processedPaths.has(result.file)) {
            const absolutePath = this.getAbsolutePath(result.file);
            files.push({
              path: result.file,
              absolutePath: absolutePath,
              name: result.file.split(/[\/\\]/).pop() || result.file,
              type: "file",
              icon: "📄",
            });
            processedPaths.add(result.file);
          }
        }

        // Handle JSON string output (e.g., from list_directory)
        if (result.output && typeof result.output === "string") {
          try {
            const parsed = JSON.parse(result.output);
            if (
              parsed.type === "fileList" &&
              parsed.files &&
              Array.isArray(parsed.files)
            ) {
              // Extract files from list_directory output
              parsed.files.forEach((file) => {
                if (file.path) {
                  if (!processedPaths.has(file.path)) {
                    const absolutePath = this.getAbsolutePath(file.path);
                    files.push({
                      path: file.path,
                      absolutePath: absolutePath,
                      name:
                        file.name ||
                        file.path.split(/[\/\\]/).pop() ||
                        file.path,
                      type: file.type || "file",
                      icon:
                        file.icon || (file.type === "directory" ? "📁" : "📄"),
                    });
                    processedPaths.add(file.path);
                  }
                }
              });
            }
          } catch (e) {
            // Not JSON or invalid format, ignore
          }
        }
      }
    });

    return files;
  }

  getAbsolutePath(relativePath) {
    // If already absolute, return as is
    if (relativePath.match(/^[A-Z]:\\/i) || relativePath.startsWith("/")) {
      return relativePath;
    }

    // Get workspace root from VS Code (this will be set by the extension)
    const workspaceRoot =
      window.workspaceRoot || "C:\\Users\\Moti Elmakyes\\raydaemon";

    // Combine workspace root with relative path
    const separator = workspaceRoot.includes("\\") ? "\\" : "/";
    return (
      workspaceRoot + separator + relativePath.replace(/[\/\\]/g, separator)
    );
  }

  isValidFilePath(path) {
    if (!path || typeof path !== "string") {
      return false;
    }

    // Clean the path
    path = path.trim();

    // Skip empty paths
    if (!path) {
      return false;
    }

    // Skip obvious non-file content
    if (this.isNonFileContent(path)) {
      return false;
    }

    // Skip HTML content
    if (this.isHtmlContent(path)) {
      return false;
    }

    // Basic file path validation
    if (path.length > 500) {
      return false; // Too long to be a reasonable file path
    }

    // Must contain at least one valid path character
    if (!/[a-zA-Z0-9._\-\/\\]/.test(path)) {
      return false;
    }

    // Skip lines that are clearly not file paths
    if (this.shouldSkipLine(path)) {
      return false;
    }

    return true;
  }

  cleanAndValidateFilePath(input) {
    if (!input || typeof input !== "string") {
      return null;
    }

    let path = input.trim();

    // Remove common prefixes and suffixes
    path = path.replace(/^["']|["']$/g, ""); // Remove quotes
    path = path.replace(/^\*\*|\*\*$/g, ""); // Remove markdown bold
    path = path.replace(/^`|`$/g, ""); // Remove backticks
    path = path.replace(/^File:\s*/i, ""); // Remove "File:" prefix
    path = path.replace(/^Path:\s*/i, ""); // Remove "Path:" prefix

    if (this.isValidFilePath(path)) {
      return path;
    }

    return null;
  }

  shouldSkipLine(line) {
    const skipPatterns = [
      /^(reading|writing|creating|updating|processing|analyzing)/i,
      /^(file|directory|folder|path):/i,
      /^(success|error|warning|info):/i,
      /^\d+\s+(file|directory|folder)/i,
      /^(total|found|showing|displaying)/i,
      /^(modified|created|updated|deleted)\s+at/i,
      /^(bytes|kb|mb|gb)/i,
      /^(last modified|size|type):/i,
      /^-{3,}/, // Separator lines
      /^={3,}/, // Separator lines
      /^\s*$/, // Empty lines
    ];

    return skipPatterns.some((pattern) => pattern.test(line));
  }

  isHtmlContent(text) {
    // Check for HTML tags
    const htmlTagPattern = /<[^>]+>/;
    if (htmlTagPattern.test(text)) {
      return true;
    }

    // Check for HTML entities
    const htmlEntityPattern = /&[a-zA-Z]+;|&#\d+;/;
    if (htmlEntityPattern.test(text)) {
      return true;
    }

    // Check for DOCTYPE declarations
    if (/<!DOCTYPE/i.test(text)) {
      return true;
    }

    // Check for common HTML structures
    const htmlStructures = [
      /<html/i,
      /<head/i,
      /<body/i,
      /<div/i,
      /<span/i,
      /<script/i,
      /<style/i,
    ];

    return htmlStructures.some((pattern) => pattern.test(text));
  }

  isNonFileContent(text) {
    // Check for URLs
    if (/^https?:\/\//.test(text) || /^ftp:\/\//.test(text)) {
      return true;
    }

    // Check for email addresses
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
      return true;
    }

    // Check for obvious log entries
    if (/^\d{4}-\d{2}-\d{2}/.test(text) || /^\[\d{4}-\d{2}-\d{2}/.test(text)) {
      return true;
    }

    // Check for command output patterns
    const commandPatterns = [
      /^npm (install|run|start|build)/,
      /^node /,
      /^git (add|commit|push|pull)/,
      /^(sudo|chmod|chown|ls|cd|mkdir)/,
      /^(echo|cat|grep|find|which)/,
    ];

    if (commandPatterns.some((pattern) => pattern.test(text))) {
      return true;
    }

    // Check for error messages
    const errorPatterns = [
      /error:/i,
      /exception:/i,
      /failed:/i,
      /cannot find/i,
      /permission denied/i,
      /no such file/i,
    ];

    if (errorPatterns.some((pattern) => pattern.test(text))) {
      return true;
    }

    return false;
  }

  createFileDropdown(results, totalCount) {
    const files = this.extractFileList(results);
    if (files.length === 0) {
      return "";
    }

    let html = '<div class="tool-dropdown">';
    html += '<div class="tool-file-list">';
    files.forEach((file) => {
      const fileName =
        file.name || (file.path ? file.path.split(/[\/\\]/).pop() : "Unknown");
      const displayPath = file.path || ""; // Relative path for display
      const absolutePath = file.absolutePath || file.path || ""; // Absolute path for opening
      const fileIcon = file.icon || "📄";

      html += `
        <div class="tool-file-item clickable" data-file-path="${absolutePath || file.path}">
          <div class="tool-file-content">
            <div class="tool-file-icon">${fileIcon}</div>
            <div class="tool-file-info">
              <div class="tool-file-name">${fileName}</div>
              <div class="tool-file-path">${displayPath}</div>
            </div>
          </div>
        </div>`;
    });
    html += "</div>";
    html += "</div>";

    return html;
  }

  toggleToolDropdown(messageDiv) {
    const dropdown = messageDiv.querySelector(".tool-dropdown");
    const expandableBadge = messageDiv.querySelector(".tool-count.expandable");

    if (dropdown) {
      const isExpanded = dropdown.classList.contains("expanded");

      if (isExpanded) {
        dropdown.classList.remove("expanded");
        if (expandableBadge) {
          expandableBadge.classList.remove("expanded");
        }
      } else {
        dropdown.classList.add("expanded");
        if (expandableBadge) {
          expandableBadge.classList.add("expanded");
        }
      }
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
        // Handled below with rayResponse-specific logic
        break;
      case "error":
        this.handleError(data);
        break;
      case "toolStatus":
        console.log("�o. Tool Status:", data);
        try {
          const status = data && data.data ? data.data.status : undefined;
          if (status === "starting" || status === "working") {
            this.chatUI.showTypingIndicator(true);
            try {
              const elm = this.chatUI.chatMessages.querySelector('[data-working="true"]');
              if (!elm) {
                this.chatUI.addMessage("assistant", "RayDaemon is thinking", {
                  isMarkdown: false,
                  showAvatar: true,
                  isWorking: true,
                });
              }
            } catch (_) {}
          } else if (
            status === "completed" ||
            status === "failed" ||
            status === "partial"
          ) {
            try {
              const elm = this.chatUI.chatMessages.querySelector('[data-working="true"]');
              if (elm) { elm.remove(); }
            } catch (_) {}
          }
        } catch (e) {
          // ignore typing toggle errors
        }
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
      const { content, isWorking, isFinal, isCommandResult, command_calls } = data.data;

      if (content) {
        // Skip old command result messages only if they're not final responses
        if (isCommandResult && !isFinal) {
          console.log("Skipping command result message (not final)");
          return;
        }

        const hasCommandCalls = command_calls && command_calls.length > 0;

        // If this is a final response with no more commands, hide indicators
        if (isFinal !== false && !isWorking && !hasCommandCalls) {
          const workingMessage = this.chatUI.chatMessages.querySelector(
            '[data-working="true"]',
          );
          if (workingMessage) {
            workingMessage.remove();
          }
          this.chatUI.showTypingIndicator(false);
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

  // handleResponse removed; rayResponse handled inline in handleIncomingMessage

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

      // Status emoji removed - using CSS-based tool icons only

      // Check file count first for expandable logic
      let shouldBeExpandable = false;
      let actualFileCount = 0;
      if (results && results.length > 0) {
        const fileUtils = new FileUtils();
        const extractedFiles = fileUtils.extractFileList(results);
        actualFileCount = extractedFiles.length;
        shouldBeExpandable = extractedFiles.length > 0; // Always expandable if any files to show (even 1 file)
      }

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
        // For file listing operations, show actual file count instead of command count
        const isFileListingOperation =
          tools &&
          tools.some(
            (tool) =>
              tool.toLowerCase().includes("list") ||
              tool.toLowerCase().includes("directory") ||
              tool.toLowerCase().includes("ls"),
          );

        if (statusType === "starting" || statusType === "working") {
          badgeHTML = `<span class="tool-status-badge">${currentIndex || 1}/${totalCount}</span>`;
        } else if (statusType === "completed" && successCount !== undefined) {
          const displayCount =
            isFileListingOperation && actualFileCount > 0
              ? actualFileCount
              : successCount;
          const displayTotal =
            isFileListingOperation && actualFileCount > 0
              ? actualFileCount
              : totalCount;
          badgeHTML = shouldBeExpandable
            ? `<span class="tool-status-badge tool-count expandable" data-expandable="true">${displayCount}</span>`
            : `<span class="tool-status-badge">${displayCount}/${displayTotal}</span>`;
        } else if (statusType === "partial") {
          const displayCount =
            isFileListingOperation && actualFileCount > 0
              ? actualFileCount
              : successCount;
          const displayTotal =
            isFileListingOperation && actualFileCount > 0
              ? actualFileCount
              : totalCount;
          badgeHTML = shouldBeExpandable
            ? `<span class="tool-status-badge tool-count expandable" data-expandable="true">${displayCount}</span>`
            : `<span class="tool-status-badge">${displayCount}/${displayTotal}</span>`;
        } else if (statusType === "failed") {
          badgeHTML = `<span class="tool-status-badge">${failedCount || totalCount}/${totalCount}</span>`;
        }
      }

      // Build description based on status
      let description = "";
      if (statusType === "starting") {
        description = "Initializing operation...";
      } else if (statusType === "working") {
        description = `Processing ${currentIndex}/${totalCount}`;
      } else if (statusType === "completed") {
        description = "";
      } else if (statusType === "partial") {
        description = "";
      } else if (statusType === "failed") {
        description = "Operation failed";
      }

      // Create dropdown HTML if we have results
      let dropdownHTML = "";
      if (results && results.length > 0 && shouldBeExpandable) {
        const fileUtils = new FileUtils();
        dropdownHTML = fileUtils.createFileDropdown(results, totalCount);
      }

      // Assemble the HTML - One-line layout with dropdown
      element.innerHTML = `
        <div class="tool-status-header">
          <div class="tool-status-icon ${mainIcon}"></div>
          <div class="tool-status-content">
            <div class="tool-status-title">${title}</div>
            <div class="tool-status-description">${description}</div>
          </div>
          ${badgeHTML ? `<div class="tool-status-meta">${badgeHTML}</div>` : ""}
        </div>
        ${dropdownHTML}
      `;

      // Add click handler for expandable badges (dropdown toggle)
      const expandableBadge = element.querySelector(".tool-count.expandable");
      if (expandableBadge) {
        expandableBadge.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const fileUtils = new FileUtils();
          fileUtils.toggleToolDropdown(element);
        });
      }

      // Add click handlers for file items to open in editor
      const fileItems = element.querySelectorAll(".tool-file-item.clickable");
      fileItems.forEach((fileItem) => {
        fileItem.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const filePath = fileItem.getAttribute("data-file-path");
          if (filePath) {
            console.log("[RayDaemon] Opening file:", filePath);
            // Send message to extension to open the file
            if (this.chatUI && this.chatUI.postMessage) {
              this.chatUI.postMessage({
                command: "openFile",
                filePath: filePath,
              });
            }
          }
        });
      });

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
