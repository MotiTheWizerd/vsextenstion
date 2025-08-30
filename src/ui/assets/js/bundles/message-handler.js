// Extracted from webview-bundle.js
import FileUtils from "./file-utils.js";

export default class MessageHandler {
  constructor(chatUI) {
    this.chatUI = chatUI;
    this.activeToolStatusMessages = [];
    this.finalToolStatusMessage = null;
  }

  removeTransientToolStatusMessages() {
    if (this.activeToolStatusMessages.length > 0) {
      this.activeToolStatusMessages.forEach((msg) => {
        if (msg !== this.finalToolStatusMessage) {
          if (msg && msg.parentNode) {
            msg.remove();
          }
        }
      });
      this.activeToolStatusMessages = this.finalToolStatusMessage
        ? [this.finalToolStatusMessage]
        : [];
    }
  }

  handleIncomingMessage(data) {
    if (!data || !data.type) {
      return;
    }
    switch (data.type) {
      case "addMessage":
        this.handleAddMessage(data);
        break;
      case "rayResponse":
        break;
      case "error":
        this.handleError(data);
        break;
      case "toolStatus":
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
        } catch (e) {}
        this.handleToolStatus(data);
        break;
      case "clearChat":
        this.chatUI.clearChat();
        break;
      case "statusUpdate":
        this.chatUI.setStatus(data.content);
        break;
      case "chatHistory":
        console.log("Received chat history response:", data.data);
        this.chatUI.displayChatHistoryModal(data.data);
        break;
      default:
        break;
    }

    if (data.type === "rayResponse" && data.data) {
      const { content, isWorking, isFinal, isCommandResult, command_calls } = data.data;
      if (content) {
        if (isCommandResult && !isFinal) {
          return;
        }
        const hasCommandCalls = command_calls && command_calls.length > 0;
        if (isFinal !== false && !isWorking && !hasCommandCalls) {
          const workingMessage = this.chatUI.chatMessages.querySelector('[data-working="true"]');
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

  handleError(data) {
    this.chatUI.addMessage("assistant", `Error: ${data.message}`, {
      isMarkdown: false,
      showAvatar: true,
    });
  }

  handleToolStatus(data) {
    const {
      status,
      tools,
      totalCount,
      currentIndex,
      successCount,
      failedCount,
      results,
    } = data.data;

    this.removeTransientToolStatusMessages();

    const getToolIcon = (toolName) => {
      if (!toolName) return "tool-default-icon";
      const toolNameLower = toolName.toLowerCase();
      if (toolNameLower === "fetch") return "tool-fetch-icon";
      if (toolNameLower === "read_file") return "tool-read-icon";
      if (toolNameLower === "edit_file") return "tool-edit-file-icon";
      if (toolNameLower === "write_file") return "tool-write-icon";
      if (toolNameLower === "web_search") return "tool-web-search-icon";
      if (toolNameLower === "terminal") return "tool-terminal-icon";
      if (toolNameLower === "grep") return "tool-grep-icon";
      if (toolNameLower === "find_path") return "tool-find-path-icon";
      if (toolNameLower === "list_directory") return "tool-list-directory-icon";
      if (toolNameLower === "create_directory") return "tool-create-directory-icon";
      if (toolNameLower === "diagnostics") return "tool-diagnostics-icon";
      if (toolNameLower === "delete_path") return "tool-delete-path-icon";
      if (toolNameLower === "copy_path") return "tool-copy-path-icon";
      if (toolNameLower === "move_path") return "tool-move-path-icon";
      if (toolNameLower === "thinking") return "tool-thinking-icon";
      if (toolNameLower === "now") return "tool-now-icon";
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

    const createToolStatusElement = (statusType, toolList, details = {}) => {
      const element = document.createElement("div");
      element.className = `tool-status ${statusType}`;
      const mainTool = tools && tools.length > 0 ? tools[0] : "";
      const mainIcon = getToolIcon(mainTool);
      let shouldBeExpandable = false;
      let actualFileCount = 0;
      if (results && results.length > 0) {
        const fileUtils = new FileUtils();
        const extractedFiles = fileUtils.extractFileList(results);
        actualFileCount = extractedFiles.length;
        shouldBeExpandable = extractedFiles.length > 0;
      }
      let title = "";
      if (statusType === "starting") title = `Starting: ${toolList}`;
      else if (statusType === "working") title = `Working: ${toolList}`;
      else if (statusType === "completed") title = `Completed: ${toolList}`;
      else if (statusType === "partial") title = `Partially Completed: ${toolList}`;
      else if (statusType === "failed") title = `Failed: ${toolList}`;
      let progressHTML = "";
      if (statusType === "working") {
        progressHTML = `<div class="tool-progress"></div>`;
      }
      let badgeHTML = "";
      const { totalCount, currentIndex, successCount, failedCount } = details.totalCount ? details : data.data;
      if (totalCount) {
        const isFileListingOperation =
          tools && tools.some((tool) =>
            tool.toLowerCase().includes("list") ||
            tool.toLowerCase().includes("directory") ||
            tool.toLowerCase().includes("ls"));
        if (statusType === "starting" || statusType === "working") {
          badgeHTML = `<span class=\"tool-status-badge\">${currentIndex || 1}/${totalCount}</span>`;
        } else if (statusType === "completed" && successCount !== undefined) {
          const displayCount = isFileListingOperation && actualFileCount > 0 ? actualFileCount : successCount;
          const displayTotal = isFileListingOperation && actualFileCount > 0 ? actualFileCount : totalCount;
          badgeHTML = shouldBeExpandable
            ? `<span class=\"tool-status-badge tool-count expandable\" data-expandable=\"true\">${displayCount}</span>`
            : `<span class=\"tool-status-badge\">${displayCount}/${displayTotal}</span>`;
        } else if (statusType === "partial") {
          const displayCount = isFileListingOperation && actualFileCount > 0 ? actualFileCount : successCount;
          const displayTotal = isFileListingOperation && actualFileCount > 0 ? actualFileCount : totalCount;
          badgeHTML = shouldBeExpandable
            ? `<span class=\"tool-status-badge tool-count expandable\" data-expandable=\"true\">${displayCount}</span>`
            : `<span class=\"tool-status-badge\">${displayCount}/${displayTotal}</span>`;
        } else if (statusType === "failed") {
          badgeHTML = `<span class=\"tool-status-badge\">${failedCount || totalCount}/${totalCount}</span>`;
        }
      }
      let description = "";
      if (statusType === "starting") {
        description = "Initializing operation...";
      } else if (statusType === "working") {
        description = `Processing ${currentIndex}/${totalCount}`;
      } else if (statusType === "failed") {
        description = "Operation failed";
      }
      let dropdownHTML = "";
      if (results && results.length > 0 && shouldBeExpandable) {
        const fileUtils = new FileUtils();
        dropdownHTML = fileUtils.createFileDropdown(results, totalCount);
      }
      element.innerHTML = `
        <div class=\"tool-status-header\">
          <div class=\"tool-status-icon ${mainIcon}\"></div>
          <div class=\"tool-status-content\">
            <div class=\"tool-status-title\">${title}</div>
            <div class=\"tool-status-description\">${description}</div>
          </div>
          ${badgeHTML ? `<div class=\"tool-status-meta\">${badgeHTML}</div>` : ""}
        </div>
        ${dropdownHTML}
      `;
      const expandableBadge = element.querySelector(".tool-count.expandable");
      if (expandableBadge) {
        expandableBadge.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const fileUtils = new FileUtils();
          fileUtils.toggleToolDropdown(element);
        });
      }
      const fileItems = element.querySelectorAll(".tool-file-item.clickable");
      fileItems.forEach((fileItem) => {
        fileItem.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const filePath = fileItem.getAttribute("data-file-path");
          if (filePath) {
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

    const isFinalMessage = (statusType) => {
      return ["completed", "failed", "partial"].includes(statusType);
    };

    const addToolStatusMessage = (statusType, toolText, details = {}) => {
      const messageEl = this.chatUI.addMessage("system", "", {
        isMarkdown: false,
        isToolMessage: true,
        customElement: createToolStatusElement(statusType, toolText, details),
      });
      this.activeToolStatusMessages.push(messageEl);
      if (isFinalMessage(statusType)) {
        this.finalToolStatusMessage = messageEl;
      }
      return messageEl;
    };

    if (status === "starting") {
      let toolList = "Processing";
      if (tools && tools.length > 0) {
        toolList = tools.length > 3
          ? `${tools.slice(0, 3).join(", ")} and ${tools.length - 3} more`
          : tools.join(", ");
      }
      try {
        addToolStatusMessage("starting", toolList, { totalCount, tools });
      } catch (error) {}
    } else if (status === "working") {
      const currentTool = tools && tools.length > 0 ? tools[0] : "Task";
      addToolStatusMessage("working", currentTool, { totalCount, currentIndex, tools });
    } else if (status === "completed") {
      let toolList = "Task";
      if (tools && tools.length > 0) {
        toolList = tools.length > 3 ? `${tools.length} operations` : tools.join(", ");
      }
      addToolStatusMessage("completed", toolList, { totalCount, successCount, failedCount, tools });
    } else if (status === "partial") {
      let toolList = "Task";
      if (tools && tools.length > 0) {
        toolList = tools.length > 3 ? `${tools.length} operations` : tools.join(", ");
      }
      addToolStatusMessage("partial", toolList, { totalCount, successCount, failedCount, tools });
    } else if (status === "failed") {
      let toolList = "Task";
      if (tools && tools.length > 0) {
        toolList = tools.length > 3 ? `${tools.length} operations` : tools.join(", ");
      }
      addToolStatusMessage("failed", toolList, { totalCount, failedCount, tools });
    }

    if (status === "completed" || status === "partial" || status === "failed") {
      this.finalToolStatusMessage = document.querySelector(
        ".message.system:last-child",
      );
    }

    const latestMessage = document.querySelector(".message.system:last-child");
    if (latestMessage) {
      this.activeToolStatusMessages.push(latestMessage);
    }

    setTimeout(() => {
      document.querySelectorAll(".message.system").forEach((el) => {
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
    }, 100);
  }
}

