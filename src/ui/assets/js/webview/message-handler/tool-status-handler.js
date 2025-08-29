import { logToolStatusElements } from "./dom-utils.js";
import {
  categorizeCommands,
  getStartingIcon,
  getCommandIcon,
  shouldHaveFileResults,
  getBatchDescription,
  getDetailedCompletionMessage,
  getCompletionText,
} from "./text-utils.js";

export default class ToolStatusHandler {
  constructor(chatUI) {
    this.chatUI = chatUI;
    this.currentExecutionId = null;
  }

  handleToolStatus(data) {
    const timestamp = new Date().toISOString();
    console.group(`[${timestamp}] [Webview] handleToolStatus`);
    console.log("Status:", data.status);
    console.log("Tools:", data.tools);
    console.log("Current Index:", data.currentIndex);
    console.log("Total Count:", data.totalCount);
    console.log("Batch Mode:", data.batchMode);
    console.log("Success Count:", data.successCount);
    console.log("Failed Count:", data.failedCount);

    console.log("=== DOM State Before Update ===");
    logToolStatusElements(this.chatUI);

    const {
      status,
      tools = [],
      currentIndex = 0,
      totalCount = 1,
      successCount = 0,
      failedCount = 0,
      results = [],
      error = null,
      batchMode = false,
    } = data;

    if (!this.currentExecutionId || status === "starting") {
      this.currentExecutionId = `execution-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;
    }

    console.group(`[Webview] handleToolStatus - Status: ${status}`);
    console.log("Tools:", tools);
    console.log("Current Index:", currentIndex);
    console.log("Total Count:", totalCount);
    console.log("Success Count:", successCount);
    console.log("Failed Count:", failedCount);
    console.log("Batch Mode:", batchMode);
    if (error) console.error("Error:", error);

    let content = "";
    const className = "tool-status";

    if (status === "starting") {
      console.group("[Webview] Processing STARTING status");
      console.log("Batch Mode:", batchMode);
      console.log("Tools to execute:", tools);
      console.log("Current tool status elements in DOM:");
      logToolStatusElements(this.chatUI);
      if (batchMode) {
        const taskDescription = getBatchDescription(tools, totalCount);
        const startingCategories = categorizeCommands(tools, []);
        const primaryStartingCategory = Object.entries(startingCategories)
          .filter(([_, value]) => value.count > 0)
          .sort(([, a], [, b]) => b.count - a.count)[0];
        const startingIcon = primaryStartingCategory
          ? getStartingIcon(primaryStartingCategory[0])
          : "🚀";
        content = `<div class="${className} starting" data-tool-id="batch-starting-${this.currentExecutionId}">
          <div class="tool-status-main">
            <div class="tool-icon">${startingIcon}</div>
            <div class="tool-content">
              <div class="tool-text">Initializing: ${taskDescription}</div>
            </div>
            <div class="tool-meta">
              <div class="tool-badge">Starting</div>
            </div>
          </div>
        </div>`;
      } else {
        const toolList = tools && tools.length > 0 ? tools.join(", ") : "Processing";
        const progressText = currentIndex && totalCount ? ` (${currentIndex}/${totalCount})` : "";
        const individualStartingCategories = categorizeCommands(tools, []);
        const primaryIndividualStartingCategory = Object.entries(
          individualStartingCategories,
        )
          .filter(([_, value]) => value.count > 0)
          .sort(([, a], [, b]) => b.count - a.count)[0];
        const individualStartingIcon = primaryIndividualStartingCategory
          ? getStartingIcon(primaryIndividualStartingCategory[0])
          : "🚀";
        content = `<div class="${className} starting" data-tool-id="current-starting-${this.currentExecutionId}">
          <div class="tool-status-main">
            <div class="tool-icon">${individualStartingIcon}</div>
            <div class="tool-content">
              <div class="tool-text">Initializing: ${toolList}${progressText}</div>
            </div>
            <div class="tool-meta">
              <div class="tool-badge">Starting</div>
            </div>
          </div>
        </div>`;
      }
      console.groupEnd();
    } else if (status === "working") {
      console.group("[Webview] Processing WORKING status");
      console.log("Current Tool:", tools && tools[0]);
      console.log(`Progress: ${currentIndex || 1}/${totalCount || 1}`);
      console.log("Batch Mode:", batchMode);
      console.log("Current tool status elements in DOM before update:");
      logToolStatusElements(this.chatUI);
      if (batchMode) {
        const taskDescription = getBatchDescription(tools, totalCount);
        const progressText = currentIndex && totalCount ? ` (${currentIndex}/${totalCount})` : "";
        content = `<div class="${className} working" data-tool-id="batch-working-${this.currentExecutionId}">
          <div class="tool-status-main">
            <div class="tool-icon">⚡</div>
            <div class="tool-content">
              <div class="tool-text">${taskDescription}${progressText}</div>
            </div>
            <div class="tool-meta">
              <div class="tool-badge">Processing</div>
              <div class="tool-spinner"></div>
            </div>
          </div>
          <div class="tool-progress"></div>
        </div>`;
        const existingStarting = this.chatUI.chatMessages.querySelector(
          `[data-tool-id="batch-starting-${this.currentExecutionId}"]`,
        );
        if (existingStarting) existingStarting.remove();
        const existingWorking = this.chatUI.chatMessages.querySelector(
          `[data-tool-id="batch-working-${this.currentExecutionId}"]`,
        );
        if (existingWorking) {
          const textElement = existingWorking.querySelector(".tool-text");
          if (textElement) textElement.textContent = `${taskDescription}${progressText}`;
          return; // update only
        }
      } else {
        const toolList = tools && tools.length > 0 ? tools.join(", ") : "Processing";
        const progressText = currentIndex && totalCount ? ` (${currentIndex}/${totalCount})` : "";
        content = `<div class="${className} working" data-tool-id="current-working-${this.currentExecutionId}">
          <div class="tool-status-main">
            <div class="tool-icon">⚡</div>
            <div class="tool-content">
              <div class="tool-text">${toolList}${progressText}</div>
            </div>
            <div class="tool-meta">
              <div class="tool-badge">Processing</div>
              <div class="tool-spinner"></div>
            </div>
          </div>
          <div class="tool-progress"></div>
        </div>`;
        const existingStarting = this.chatUI.chatMessages.querySelector(
          `[data-tool-id="current-starting-${this.currentExecutionId}"]`,
        );
        if (existingStarting) existingStarting.remove();
        const existingWorking = this.chatUI.chatMessages.querySelector(
          `[data-tool-id="current-working-${this.currentExecutionId}"]`,
        );
        if (existingWorking) existingWorking.remove();
      }
      console.groupEnd();
    } else if (status === "completed") {
      console.group("[Webview] Processing COMPLETED status");
      console.log("Success Count:", successCount);
      console.log("Failed Count:", failedCount);
      console.log("Total Tools:", totalCount);
      console.log("Results Available:", !!results);
      console.log("Batch Mode:", batchMode);
      console.log("Current tool status elements in DOM before update:");
      logToolStatusElements(this.chatUI);

      if (batchMode) {
        const startingIndicator = this.chatUI.chatMessages.querySelector(
          `[data-tool-id="batch-starting-${this.currentExecutionId}"]`,
        );
        if (startingIndicator) startingIndicator.remove();
        const workingIndicator = this.chatUI.chatMessages.querySelector(
          `[data-tool-id="batch-working-${this.currentExecutionId}"]`,
        );
        if (workingIndicator) workingIndicator.remove();

        const hasFileResults = this.chatUI.fileUtils.hasFileResults(results);
        const extractedFiles = this.chatUI.fileUtils.extractFileList(results);
        const shouldHaveFiles = shouldHaveFileResults(tools, results);
        const finalHasFileResults = hasFileResults || shouldHaveFiles;
        const dropdownHtml = finalHasFileResults
          ? this.chatUI.fileUtils.createFileDropdown(results, totalCount)
          : "";
        const fileCount = finalHasFileResults ? Math.max(extractedFiles.length, 1) : 0;
        const shouldShowFileCount = finalHasFileResults && extractedFiles.length > 0;
        const displayCount = shouldShowFileCount ? fileCount : totalCount;
        const displayLabel = shouldShowFileCount
          ? fileCount === 1
            ? "file"
            : "files"
          : totalCount === 1
            ? "result"
            : "results";
        const shouldBeExpandable = finalHasFileResults && dropdownHtml && extractedFiles.length > 0;
        const taskDescription = getDetailedCompletionMessage(tools, results, totalCount);
        const primaryCategory = Object.entries(categorizeCommands(tools, results))
          .filter(([_, value]) => value.count > 0)
          .sort(([, a], [, b]) => b.count - a.count)[0];
        const commandIcon = primaryCategory ? getCommandIcon(primaryCategory[0], primaryCategory[1]) : "⚙️";
        if (failedCount > 0) {
          content = `<div class="${className} partial" data-tool-id="batch-completed-${this.currentExecutionId}">
            <div class="tool-status-main">
              <div class="tool-icon">⚠️</div>
              <div class="tool-content">
                <div class="tool-text">${taskDescription} (${failedCount} error${failedCount > 1 ? "s" : ""})</div>
              </div>
              <div class="tool-meta">
                <div class="tool-badge">Partial</div>
                <div class="tool-count ${shouldBeExpandable ? "expandable" : ""}" data-expandable="${shouldBeExpandable}">${successCount}/${totalCount}</div>
              </div>
            </div>
            ${dropdownHtml}
          </div>`;
        } else {
          content = `<div class="${className} success" data-tool-id="batch-completed-${this.currentExecutionId}">
            <div class="tool-status-main">
              <div class="tool-icon">${commandIcon}</div>
              <div class="tool-content">
                <div class="tool-text">${taskDescription}</div>
              </div>
              <div class="tool-meta">
                <div class="tool-badge">Completed</div>
                <div class="tool-count ${shouldBeExpandable ? "expandable" : ""}" data-expandable="${shouldBeExpandable}">${displayCount} ${displayLabel}</div>
              </div>
            </div>
            ${dropdownHtml}
          </div>`;
        }
      } else {
        const startingIndicator = this.chatUI.chatMessages.querySelector(
          `[data-tool-id="current-starting-${this.currentExecutionId}"]`,
        );
        if (startingIndicator) startingIndicator.remove();
        const workingIndicator = this.chatUI.chatMessages.querySelector(
          `[data-tool-id="current-working-${this.currentExecutionId}"]`,
        );
        if (workingIndicator) workingIndicator.remove();
        const hasFileResults = this.chatUI.fileUtils.hasFileResults(results);
        const dropdownHtml = hasFileResults
          ? this.chatUI.fileUtils.createFileDropdown(results, totalCount || 1)
          : "";
        const extractedFiles = hasFileResults ? this.chatUI.fileUtils.extractFileList(results) : [];
        const fileCount = extractedFiles.length;
        const shouldShowFileCount = hasFileResults && fileCount > 0;
        const displayCount = shouldShowFileCount ? fileCount : 1;
        const displayLabel = shouldShowFileCount ? (fileCount === 1 ? "file" : "files") : "result";
        const shouldBeExpandable = hasFileResults && dropdownHtml && fileCount > 0;
        let completionText = getCompletionText(tools, 1);
        const progressText = currentIndex && totalCount ? ` (${currentIndex}/${totalCount})` : "";
        const individualCategory = Object.entries(categorizeCommands(tools, results))
          .filter(([_, value]) => value.count > 0)
          .sort(([, a], [, b]) => b.count - a.count)[0];
        const individualIcon = individualCategory ? getCommandIcon(individualCategory[0], individualCategory[1]) : "⚙️";
        if (failedCount > 0) {
          content = `<div class="${className} partial" data-tool-id="completed-${this.currentExecutionId}">
            <div class="tool-status-main">
              <div class="tool-icon">⚠️</div>
              <div class="tool-content">
                <div class="tool-text">${completionText}${progressText} (error)</div>
              </div>
              <div class="tool-meta">
                <div class="tool-badge">Error</div>
                <div class="tool-count ${hasFileResults && dropdownHtml ? "expandable" : ""}" data-expandable="${!!(hasFileResults && dropdownHtml)}">Error</div>
              </div>
            </div>
            ${dropdownHtml}
          </div>`;
        } else {
          content = `<div class="tool-status success" data-tool-id="completed-${this.currentExecutionId}">
            <div class="tool-status-main">
              <div class="tool-icon">${individualIcon}</div>
              <div class="tool-content">
                <div class="tool-text">${completionText}${progressText}</div>
              </div>
              <div class="tool-meta">
                <div class="tool-badge">Completed</div>
                <div class="tool-count ${hasFileResults && dropdownHtml ? "expandable" : ""}" data-expandable="${!!(hasFileResults && dropdownHtml)}">${displayCount} ${displayLabel}</div>
              </div>
            </div>
            ${dropdownHtml}
          </div>`;
        }
      }
    } else if (status === "error") {
      console.group("[Webview] Processing ERROR status");
      console.error("Error Details:", error);
      console.log("Failed Tool:", tools && tools[0]);
      console.log("Current tool status elements in DOM before update:");
      logToolStatusElements(this.chatUI);
      console.log("Batch Mode:", batchMode);
      console.log("Current Index:", currentIndex);
      console.log("Total Count:", totalCount);
      console.groupEnd();
      const startingIndicator = this.chatUI.chatMessages.querySelector(
        `[data-tool-id="current-starting-${this.currentExecutionId}"]`,
      );
      if (startingIndicator) startingIndicator.remove();
      const workingIndicator = this.chatUI.chatMessages.querySelector(
        `[data-tool-id="current-working-${this.currentExecutionId}"]`,
      );
      if (workingIndicator) workingIndicator.remove();
      const toolList = tools && tools.length > 0 ? tools.join(", ") : "Tool";
      const progressText = currentIndex && totalCount ? ` (${currentIndex}/${totalCount})` : "";
      content = `<div class="${className} failed" data-tool-id="failed-${this.currentExecutionId}">
        <div class="tool-status-main">
          <div class="tool-icon">❌</div>
          <div class="tool-content">
            <div class="tool-text">Failed: ${toolList}${progressText}</div>
          </div>
          <div class="tool-meta">
            <div class="tool-badge">Failed</div>
          </div>
        </div>
      </div>`;
    }

    if (content) {
      console.group("=== Tool Status Update ===");
      console.log("Status:", status);
      console.log("Tools:", tools);
      console.log("Content length:", content.length);

      const messageDiv = document.createElement("div");
      messageDiv.className = `tool-status ${status}`;
      messageDiv.setAttribute("data-status", status);
      if (tools && tools.length > 0) messageDiv.setAttribute("data-tool", tools[0]);

      if (status === "completed") {
        messageDiv.innerHTML = content;
        const existingCompleted = this.chatUI.chatMessages.querySelector(
          `[data-tool-id^="completed-"]`,
        );
        if (existingCompleted) {
          // preserve history; append another completed message
        }
      } else {
        messageDiv.innerHTML = content;
        const existingSameStatus = this.chatUI.chatMessages.querySelector(
          `.tool-status.${status}`,
        );
        if (existingSameStatus && status !== "working") {
          existingSameStatus.remove();
        }
      }

      this.chatUI.addMessage("system", "", {
        isMarkdown: false,
        isToolMessage: true,
        customElement: messageDiv.firstElementChild || messageDiv,
      });

      // file item click handlers
      const fileItems = messageDiv.querySelectorAll(".tool-file-item.clickable");
      fileItems.forEach((fileItem) => {
        fileItem.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const filePath = fileItem.getAttribute("data-file-path");
          if (filePath) this.chatUI.postMessage({ command: "openFile", filePath });
        });
      });

      const diffIcons = messageDiv.querySelectorAll(".tool-file-diff");
      diffIcons.forEach((diffIcon) => {
        diffIcon.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const filePath = diffIcon.getAttribute("data-file-path");
          if (filePath) this.chatUI.postMessage({ command: "showDiff", filePath });
        });
      });

      this.chatUI.scrollToBottom();
    }
  }
}

