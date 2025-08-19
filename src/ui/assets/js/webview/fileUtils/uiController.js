export class UIController {
  constructor(chatUI, resultParser) {
    this.chatUI = chatUI;
    this.resultParser = resultParser;
  }

  toggleToolDropdown(messageDiv) {
    console.log("toggleToolDropdown called");

    const dropdown = messageDiv.querySelector(".tool-dropdown");
    const countElement = messageDiv.querySelector(".tool-count.expandable");

    console.log("dropdown:", dropdown, "countElement:", countElement);

    if (!dropdown || !countElement) {
      console.log("Missing dropdown or countElement");
      return;
    }

    const isExpanded = dropdown.classList.contains("expanded");
    console.log("isExpanded:", isExpanded);

    // Close all other open dropdowns first
    if (!isExpanded) {
      this.closeAllDropdowns();
    }

    if (isExpanded) {
      dropdown.classList.remove("expanded");
      countElement.classList.remove("expanded");
      countElement.setAttribute("aria-expanded", "false");
      console.log("Collapsed dropdown");
    } else {
      dropdown.classList.add("expanded");
      countElement.classList.add("expanded");
      countElement.setAttribute("aria-expanded", "true");
      console.log("Expanded dropdown");

      // Add click handlers to file items
      const fileItems = dropdown.querySelectorAll(".tool-file-item");
      fileItems.forEach((item) => {
        const filePath = item.dataset.filePath;

        // Validate the file path before making it clickable
        const isValidPath = this.isValidClickableFilePath(filePath);

        if (isValidPath) {
          // Add visual indication that it's clickable
          item.style.cursor = "pointer";
          item.classList.add("clickable");

          // Handle diff icon clicks
          const diffIcon = item.querySelector(".tool-file-diff");
          if (diffIcon) {
            diffIcon.style.cursor = "pointer";
            diffIcon.addEventListener("click", (e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log("Diff icon clicked:", { filePath });
              this.showFileDiff(filePath);
            });
          }

          // Handle file item clicks (but not when clicking on diff icon)
          item.addEventListener("click", (e) => {
            // Don't handle click if it was on the diff icon
            if (e.target.closest(".tool-file-diff")) {
              return;
            }

            e.preventDefault();
            e.stopPropagation();
            console.log("File item clicked:", {
              filePath,
              item,
              dataset: item.dataset,
            });
            this.openFile(filePath);
          });
        } else {
          // Make it clear this item is not clickable
          item.style.cursor = "default";
          item.classList.add("non-clickable");
          item.style.opacity = "0.6";
          console.log("File item not clickable due to invalid path:", filePath);
        }
      });
    }

    // Scroll to keep the dropdown in view
    setTimeout(() => {
      this.chatUI.scrollToBottom();
    }, 300);
  }

  openFile(filePath) {
    // Validate and clean the file path
    if (!filePath || typeof filePath !== "string") {
      console.error("Invalid file path:", filePath);
      return;
    }

    console.log("UIController.openFile - Original path:", filePath);

    // Clean the file path - remove any extra whitespace or formatting
    let cleanPath = this.resultParser.cleanFilePath(filePath);

    console.log("UIController.openFile - Cleaned path:", cleanPath);

    // Send message to extension to open the file
    this.chatUI.postMessage({
      type: "openFile",
      filePath: cleanPath,
    });
  }

  showFileDiff(filePath) {
    // Validate and clean the file path
    if (!filePath || typeof filePath !== "string") {
      console.error("Invalid file path for diff:", filePath);
      return;
    }

    // Clean the file path using the same logic as openFile
    let cleanPath = this.resultParser.cleanFilePath(filePath);

    console.log("Showing diff for file:", cleanPath);

    // Send message to extension to show the file diff
    this.chatUI.postMessage({
      type: "showFileDiff",
      filePath: cleanPath,
    });
  }

  isValidClickableFilePath(filePath) {
    if (!filePath || typeof filePath !== "string") {
      return false;
    }

    // Clean the path first
    const cleanPath = this.resultParser.cleanFilePath(filePath);

    // Must be a valid file path
    if (!this.resultParser.isValidFilePath(cleanPath)) {
      return false;
    }

    // Must not be empty after cleaning
    if (!cleanPath || cleanPath.trim().length === 0) {
      return false;
    }

    // Must contain actual path separators or file extension
    const hasPathSeparator = /[\/\\]/.test(cleanPath);
    const hasFileExtension = /\.[a-zA-Z0-9]{1,10}$/.test(cleanPath);

    if (!hasPathSeparator && !hasFileExtension) {
      return false;
    }

    // Must not be just a directory separator
    if (/^[\\/]+$/.test(cleanPath)) {
      return false;
    }

    // Must have reasonable length (not too short or too long)
    if (cleanPath.length < 2 || cleanPath.length > 500) {
      return false;
    }

    return true;
  }

  closeAllDropdowns() {
    console.log("Closing all open dropdowns");

    // Find all expanded dropdowns in the chat
    const chatMessages = this.chatUI.chatMessages;
    if (!chatMessages) {
      console.log("No chat messages container found");
      return;
    }

    const expandedDropdowns = chatMessages.querySelectorAll(
      ".tool-dropdown.expanded",
    );
    const expandedCounts = chatMessages.querySelectorAll(
      ".tool-count.expandable.expanded",
    );

    console.log(
      `Found ${expandedDropdowns.length} expanded dropdowns and ${expandedCounts.length} expanded counts`,
    );

    // Close all expanded dropdowns
    expandedDropdowns.forEach((dropdown) => {
      dropdown.classList.remove("expanded");
      console.log("Closed dropdown");
    });

    // Update all expanded count elements
    expandedCounts.forEach((countElement) => {
      countElement.classList.remove("expanded");
      countElement.setAttribute("aria-expanded", "false");
      console.log("Updated count element aria-expanded to false");
    });
  }
}
