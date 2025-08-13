class MessageHandler {
  constructor(chatUI) {
    this.chatUI = chatUI;
  }

  handleToolStatus(data) {
    const { status, tools, successCount, failedCount, totalCount, error, results } =
      data;

    let content = "";
    let className = "tool-status";

    if (status === "working") {
      // Show working indicator with tool names
      const toolList =
        tools && tools.length > 0 ? tools.join(", ") : "Processing";
      content = `<div class="${className} working" data-tool-id="current-working">
        <div class="tool-icon">⚡</div>
        <div class="tool-text">${toolList}</div>
        <div class="tool-spinner"></div>
      </div>`;

      // Remove only the current working indicator if it exists
      const existingWorking = this.chatUI.chatMessages.querySelector(
        '[data-tool-id="current-working"]'
      );
      if (existingWorking) {
        existingWorking.remove();
      }
    } else if (status === "completed") {
      // Remove the working indicator
      const workingIndicator = this.chatUI.chatMessages.querySelector(
        '[data-tool-id="current-working"]'
      );
      if (workingIndicator) {
        workingIndicator.remove();
      }

      // Check if results contain file paths
      const hasFileResults = this.chatUI.fileUtils.hasFileResults(results);
      const dropdownHtml = hasFileResults ? this.chatUI.fileUtils.createFileDropdown(results, totalCount) : '';

      // Create specific completion message based on tools used
      let completionText = this.getCompletionText(tools, totalCount);

      if (failedCount > 0) {
        content = `<div class="${className} partial">
          <div class="tool-content">
            <div class="tool-icon">⚠️</div>
            <div class="tool-text">${completionText} (${failedCount} error${
          failedCount > 1 ? "s" : ""
        })</div>
          </div>
          <div class="tool-meta">
            <div class="tool-count ${hasFileResults ? 'expandable' : ''}" data-expandable="${hasFileResults}">${successCount}/${totalCount}</div>
          </div>
          ${dropdownHtml}
        </div>`;
      } else {
        content = `<div class="${className} success">
          <div class="tool-content">
            <div class="tool-icon">✅</div>
            <div class="tool-text">${completionText}</div>
          </div>
          <div class="tool-meta">
            <div class="tool-count ${hasFileResults ? 'expandable' : ''}" data-expandable="${hasFileResults}">${totalCount} result${
          totalCount > 1 ? "s" : ""
        }</div>
          </div>
          ${dropdownHtml}
        </div>`;
      }
    } else if (status === "failed") {
      // Remove the working indicator
      const workingIndicator = this.chatUI.chatMessages.querySelector(
        '[data-tool-id="current-working"]'
      );
      if (workingIndicator) {
        workingIndicator.remove();
      }

      content = `<div class="${className} failed">
        <div class="tool-icon">❌</div>
        <div class="tool-text">Tool execution failed</div>
      </div>`;
    }

    if (content) {
      const messageDiv = document.createElement("div");
      messageDiv.className = "message system tool-message";
      messageDiv.innerHTML = content;

      this.chatUI.chatMessages.appendChild(messageDiv);
      
      // Add click handler for expandable tool counts
      const expandableCount = messageDiv.querySelector('.tool-count.expandable');
      if (expandableCount) {
        expandableCount.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.chatUI.fileUtils.toggleToolDropdown(messageDiv);
        });
      }
      
      this.chatUI.scrollToBottom();
    }
  }

  getCompletionText(tools, resultCount) {
    if (!tools || tools.length === 0) {
      return "Completed task";
    }

    // Determine the primary action based on tools used
    const toolTypes = tools.map((tool) => tool.toLowerCase());

    if (toolTypes.some((t) => t.includes("search"))) {
      return "Searched codebase";
    } else if (toolTypes.some((t) => t.includes("read"))) {
      return "Read file(s)";
    } else if (
      toolTypes.some((t) => t.includes("find") || t.includes("symbol"))
    ) {
      return "Found symbols";
    } else if (
      toolTypes.some((t) => t.includes("load") || t.includes("index"))
    ) {
      return "Loaded index";
    } else if (toolTypes.some((t) => t.includes("list"))) {
      return "Listed directory";
    } else if (toolTypes.some((t) => t.includes("open"))) {
      return "Opened file(s)";
    } else if (toolTypes.some((t) => t.includes("write"))) {
      return "Modified file(s)";
    } else {
      return "Analyzed codebase";
    }
  }

  handleIncomingMessage(message) {
    console.log("Received message:", message);

    // Clear typing indicator and timeout for any incoming response
    if (this.chatUI.typingTimeout) {
      clearTimeout(this.chatUI.typingTimeout);
      this.chatUI.typingTimeout = null;
    }
    this.chatUI.showTypingIndicator(false);

    // Handle tool status messages
    if (message.type === "toolStatus" && message.data) {
      this.handleToolStatus(message.data);
      return;
    }

    // Handle different message types
    if (message.type === "chat_response") {
      this.chatUI.addMessage("assistant", message.content, {
        isMarkdown: true,
        showAvatar: true,
      });
      return;
    }

    if (message.type === "rayResponse" && message.data) {
      const { content, isWorking, isFinal, isCommandResult } = message.data;
      if (content && !isCommandResult) {
        // Skip old command result messages
        // If this is a final response and we have a working message, replace it
        if (isFinal !== false && !isWorking) {
          const workingMessage = this.chatUI.chatMessages.querySelector(
            '[data-working="true"]'
          );
          if (workingMessage) {
            workingMessage.remove();
          }
        }

        this.chatUI.addMessage("assistant", content, {
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
          this.chatUI.addMessage(message.sender, message.content, {
            ...message.options,
            showAvatar: true,
          });
          break;
        case "showTyping":
          this.chatUI.showTypingIndicator(message.typing);
          break;
        case "clearChat":
          this.chatUI.clearChat();
          break;
        case "setStatus":
          this.chatUI.setStatus(message.status);
          break;
        case "chatError":
          this.chatUI.addMessage("assistant", `Error: ${message.error}`, {
            isMarkdown: false,
            showAvatar: true,
          });
          break;
      }
    }
  }
}

// MessageHandler is now globally available