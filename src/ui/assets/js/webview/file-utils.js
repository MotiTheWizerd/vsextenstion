class FileUtils {
  constructor(chatUI) {
    this.chatUI = chatUI;
  }

  hasFileResults(results) {
    if (!results || results.length === 0) {
      return false;
    }

    // Check if any result contains file paths or file-related output
    return results.some((result) => {
      if (!result.ok || !result.output) {
        return false;
      }

      const command = result.command;
      const output = result.output;

      // Commands that typically return file paths
      if (
        [
          "findByExtension",
          "ls",
          "searchText",
          "searchRegex",
          "findSymbol",
          "findSymbolFromIndex",
        ].includes(command)
      ) {
        return true;
      }

      // Check if output contains file paths (simple heuristic)
      if (
        typeof output === "string" &&
        (output.includes("/") || output.includes("\\"))
      ) {
        return true;
      }

      // Check if output is an array of file paths
      if (Array.isArray(output) && output.length > 0) {
        return output.some(
          (item) =>
            typeof item === "string" &&
            (item.includes("/") || item.includes("\\"))
        );
      }

      return false;
    });
  }

  createFileDropdown(results, totalCount) {
    const files = this.extractFileList(results);
    if (files.length === 0) {
      return "";
    }

    const displayFiles = files.slice(0, 10); // Show max 10 files
    const hasMore = files.length > 10;

    const fileItems = displayFiles
      .map((file) => {
        const icon = this.getFileIcon(file);
        const fileName = file.split(/[/\\]/).pop() || file;
        const filePath =
          file.length > fileName.length
            ? file.substring(0, file.length - fileName.length - 1)
            : "";

        return `
        <div class="tool-file-item" data-file-path="${file}">
          <div class="tool-file-icon">${icon}</div>
          <div class="tool-file-name">${fileName}</div>
          ${filePath ? `<div class="tool-file-path">${filePath}</div>` : ""}
        </div>
      `;
      })
      .join("");

    const moreIndicator = hasMore
      ? `<div class="tool-more-indicator">... and ${files.length - 10} more files</div>`
      : "";

    return `
      <div class="tool-dropdown">
        <div class="tool-file-list">
          ${fileItems}
          ${moreIndicator}
        </div>
      </div>
    `;
  }

  extractFileList(results) {
    const files = new Set();

    results.forEach((result) => {
      if (!result.ok || !result.output) {
        return;
      }

      const output = result.output;

      if (typeof output === "string") {
        // Split by newlines and filter for file paths
        const lines = output
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line);
        lines.forEach((line) => {
          if (line.includes("/") || line.includes("\\")) {
            // Remove any leading/trailing quotes or whitespace
            const cleanPath = line.replace(/^["']|["']$/g, "").trim();
            if (cleanPath) {
              files.add(cleanPath);
            }
          }
        });
      } else if (Array.isArray(output)) {
        output.forEach((item) => {
          if (
            typeof item === "string" &&
            (item.includes("/") || item.includes("\\"))
          ) {
            files.add(item);
          }
        });
      }
    });

    return Array.from(files).sort();
  }

  getFileIcon(filePath) {
    const fileName = filePath.split(/[/\\]/).pop() || "";
    const extension = fileName.split(".").pop()?.toLowerCase() || "";

    // File type icons
    const iconMap = {
      js: "📄",
      ts: "📘",
      jsx: "⚛️",
      tsx: "⚛️",
      html: "🌐",
      css: "🎨",
      scss: "🎨",
      sass: "🎨",
      json: "📋",
      md: "📝",
      txt: "📄",
      py: "🐍",
      java: "☕",
      cpp: "⚙️",
      c: "⚙️",
      php: "🐘",
      rb: "💎",
      go: "🐹",
      rs: "🦀",
      vue: "💚",
      xml: "📄",
      yml: "⚙️",
      yaml: "⚙️",
      png: "🖼️",
      jpg: "🖼️",
      jpeg: "🖼️",
      gif: "🖼️",
      svg: "🎨",
      pdf: "📕",
      zip: "📦",
      tar: "📦",
      gz: "📦",
    };

    // Check if it's a directory (no extension or ends with /)
    if (!extension || filePath.endsWith("/") || filePath.endsWith("\\")) {
      return "📁";
    }

    return iconMap[extension] || "📄";
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

    if (isExpanded) {
      dropdown.classList.remove("expanded");
      countElement.classList.remove("expanded");
      console.log("Collapsed dropdown");
    } else {
      dropdown.classList.add("expanded");
      countElement.classList.add("expanded");
      console.log("Expanded dropdown");

      // Add click handlers to file items
      const fileItems = dropdown.querySelectorAll(".tool-file-item");
      fileItems.forEach((item) => {
        item.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const filePath = item.dataset.filePath;
          if (filePath) {
            this.openFile(filePath);
          }
        });
      });
    }

    // Scroll to keep the dropdown in view
    setTimeout(() => {
      this.chatUI.scrollToBottom();
    }, 300);
  }

  openFile(filePath) {
    // Send message to extension to open the file
    this.chatUI.postMessage({
      type: "openFile",
      filePath: filePath,
    });
  }
}

// FileUtils is now globally available