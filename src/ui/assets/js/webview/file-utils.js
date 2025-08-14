class FileUtils {
  constructor(chatUI) {
    this.chatUI = chatUI;
  }

  hasFileResults(results) {
    console.log('[RayDaemon] hasFileResults called with:', results);
    
    if (!results || results.length === 0) {
      console.log('[RayDaemon] hasFileResults: No results or empty array');
      return false;
    }

    // Extract actual file list and check if we have meaningful files
    const fileList = this.extractFileList(results);
    console.log('[RayDaemon] hasFileResults: extracted file list:', fileList);
    
    // Only return true if we have at least one valid file
    const hasFiles = fileList.length > 0;
    console.log('[RayDaemon] hasFileResults: returning', hasFiles);
    return hasFiles;
  }

  createFileDropdown(results, totalCount) {
    const files = this.extractFileList(results);
    if (files.length === 0) {
      return "";
    }

    // Identify which files were modified by write/append/replace commands
    const modifiedFiles = this.getModifiedFiles(results);

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

        const isModified = modifiedFiles.has(file);
        const diffIcon = isModified
          ? `
          <div class="tool-file-diff" data-file-path="${file
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;")}" title="Show diff">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2.5 1.5a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 .5.5v13a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5v-13zM3 2v12h10V2H3z"/>
              <path d="M5 4.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5z"/>
              <path d="M4.5 8.5a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1h-7zm0 2a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1h-7z"/>
              <circle cx="4" cy="5" r="0.5" fill="#22c55e"/>
              <circle cx="4" cy="7" r="0.5" fill="#22c55e"/>
              <circle cx="4" cy="9" r="0.5" fill="#ef4444"/>
              <circle cx="4" cy="11" r="0.5" fill="#ef4444"/>
            </svg>
          </div>
        `
          : "";

        console.log("Creating file item:", {
          file,
          fileName,
          filePath,
          isModified,
        });

        // Escape HTML attributes to prevent issues with special characters
        const escapedFile = file.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
        const escapedFileName = fileName
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        const escapedFilePath = filePath
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");

        return `
        <div class="tool-file-item" data-file-path="${escapedFile}">
          <div class="tool-file-content">
            <div class="tool-file-icon">${icon}</div>
            <div class="tool-file-info">
              <div class="tool-file-name">${escapedFileName}</div>
              ${
                filePath
                  ? `<div class="tool-file-path">${escapedFilePath}</div>`
                  : ""
              }
            </div>
          </div>
          ${diffIcon}
        </div>
      `;
      })
      .join("");

    const moreIndicator = hasMore
      ? `<div class="tool-more-indicator">... and ${
          files.length - 10
        } more files</div>`
      : "";

    const dropdownHtml = `
      <div class="tool-dropdown">
        <div class="tool-file-list">
          ${fileItems}
          ${moreIndicator}
        </div>
      </div>
    `;

    console.log(
      "Generated dropdown HTML (first 500 chars):",
      dropdownHtml.substring(0, 500)
    );
    return dropdownHtml;
  }

  getModifiedFiles(results) {
    const modifiedFiles = new Set();
    const fileModifyingCommands = ["write", "append", "replace"];

    results.forEach((result) => {
      if (result.ok && fileModifyingCommands.includes(result.command)) {
        const args = result.args || [];
        if (args.length > 0 && typeof args[0] === "string") {
          let filePath = args[0].trim();
          // Clean the file path similar to how we do in extractFileList
          filePath = filePath.replace(/^["']|["']$/g, "");
          filePath = filePath.replace(/^\*\*|\*\*$/g, "");
          filePath = filePath.replace(/^`|`$/g, "");
          filePath = filePath.replace(/\s+\([^)]*\)$/, "");
          filePath = filePath.replace(/^\s*[-*+]\s*/, "");
          filePath = filePath.replace(/:\s*$/, "");

          if (filePath && (filePath.includes("/") || filePath.includes("\\"))) {
            modifiedFiles.add(filePath);
          }
        }
      }
    });

    return modifiedFiles;
  }

  extractFileList(results) {
    const files = new Set();
    const processedPaths = new Set(); // Track processed paths to avoid duplicates

    results.forEach((result) => {
      // For file modification commands, extract file path from arguments
      if (
        result.ok &&
        ["write", "append", "replace"].includes(result.command)
      ) {
        const args = result.args || [];
        if (args.length > 0 && typeof args[0] === "string") {
          let filePath = args[0].trim();
          // Clean the file path
          filePath = filePath.replace(/^["']|["']$/g, "");
          filePath = filePath.replace(/^\*\*|\*\*$/g, "");
          filePath = filePath.replace(/^`|`$/g, "");

          if (this.isValidFilePath(filePath) && !processedPaths.has(filePath)) {
            files.add(filePath);
            processedPaths.add(filePath);
          }
        }
      }

      // For other commands, extract from output
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
          const cleanPath = this.cleanAndValidateFilePath(line);
          if (cleanPath && !processedPaths.has(cleanPath)) {
            files.add(cleanPath);
            processedPaths.add(cleanPath);
          }
        });
      } else if (Array.isArray(output)) {
        output.forEach((item) => {
          if (typeof item === "string") {
            const cleanPath = this.cleanAndValidateFilePath(item);
            if (cleanPath && !processedPaths.has(cleanPath)) {
              files.add(cleanPath);
              processedPaths.add(cleanPath);
            }
          }
        });
      }
    });

    // Filter out any remaining invalid entries and sort
    return Array.from(files)
      .filter(file => this.isValidFilePath(file))
      .sort();
  }

  /**
   * Clean and validate a potential file path
   */
  cleanAndValidateFilePath(line) {
    if (!line || typeof line !== 'string') {
      return null;
    }

    let cleanPath = line.trim();

    // Skip lines that are clearly not file paths
    if (this.shouldSkipLine(cleanPath)) {
      return null;
    }

    // Remove common prefixes and suffixes
    cleanPath = cleanPath.replace(/^["']|["']$/g, ""); // Remove quotes
    cleanPath = cleanPath.replace(/^\*\*|\*\*$/g, ""); // Remove bold markdown
    cleanPath = cleanPath.replace(/^`|`$/g, ""); // Remove code backticks
    cleanPath = cleanPath.replace(/\s+\([^)]*\)$/, ""); // Remove size info like "(0 KB)"
    cleanPath = cleanPath.replace(/^\s*[-*+]\s*/, ""); // Remove list markers
    cleanPath = cleanPath.replace(/:\s*$/, ""); // Remove trailing colons
    cleanPath = cleanPath.replace(/^\d+:\s*/, ""); // Remove line numbers like "123: "
    
    // Remove timestamps and "Created:" prefixes
    cleanPath = cleanPath.replace(/^Created:\s*/i, "");
    cleanPath = cleanPath.replace(/^\d{1,4}[,\s]+\d{1,2}:\d{2}:\d{2}\s+(AM|PM)\s*/i, "");
    cleanPath = cleanPath.replace(/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s*/, "");

    // Final cleanup
    cleanPath = cleanPath.trim();

    return this.isValidFilePath(cleanPath) ? cleanPath : null;
  }

  /**
   * Check if a line should be skipped entirely
   */
  shouldSkipLine(line) {
    const skipPatterns = [
      /^Created:\s*\d/i,                    // "Created: 8/14" without filename
      /^\d{1,4}[,\s]+\d{1,2}:\d{2}:\d{2}\s+(AM|PM)\s*$/i, // Just timestamps
      /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s*$/,       // Just ISO timestamps
      /^(AM|PM)\s*$/i,                      // Just AM/PM
      /^\d+\s*$/,                           // Just numbers
      /^(bytes?|kb|mb|gb)\s*$/i,           // Just size units
      /^(error|warning|info|debug):/i,      // Log levels
      /^(true|false|null|undefined)\s*$/i,  // Boolean/null values
      /^\s*[{}[\]()]\s*$/,                  // Just brackets/braces
      /^\s*[,;.]\s*$/,                      // Just punctuation
      /^<\/?[a-zA-Z][a-zA-Z0-9]*>?$/,      // HTML tags
      /^[a-zA-Z][a-zA-Z0-9]*>$/,           // HTML tag endings like "body>"
      /^<[a-zA-Z]/,                        // Lines starting with HTML tags
      /welcome\s+to/i,                     // Welcome messages
      /this\s+is\s+a/i,                    // Description text
      /landing\s+page/i,                   // Landing page text
      /basic\s+html/i,                     // HTML description text
    ];

    return skipPatterns.some(pattern => pattern.test(line));
  }

  /**
   * Validate if a string is a meaningful file path
   */
  isValidFilePath(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      return false;
    }

    const trimmed = filePath.trim();
    
    // Must have reasonable length
    if (trimmed.length < 3 || trimmed.length > 500) {
      return false;
    }

    // Must not be just separators
    if (/^[/\\]+$/.test(trimmed)) {
      return false;
    }

    // Must not be just dots and separators
    if (/^[./\\]+$/.test(trimmed)) {
      return false;
    }

    // Must contain at least one alphanumeric character
    if (!/[a-zA-Z0-9]/.test(trimmed)) {
      return false;
    }

    // REJECT HTML tags and fragments
    if (this.isHtmlContent(trimmed)) {
      return false;
    }

    // REJECT common non-file content
    if (this.isNonFileContent(trimmed)) {
      return false;
    }

    // Must look like a file path (contain path separators OR file extension)
    const hasPathSeparator = trimmed.includes('/') || trimmed.includes('\\');
    const hasFileExtension = /\.[a-zA-Z0-9]{1,10}$/.test(trimmed);
    
    if (!hasPathSeparator && !hasFileExtension) {
      return false;
    }

    // Should not start with common non-path prefixes
    const invalidPrefixes = [
      'http://', 'https://', 'ftp://', 'file://',
      'Created:', 'Modified:', 'Deleted:', 'Error:',
      'Warning:', 'Info:', 'Debug:'
    ];
    
    const lowerTrimmed = trimmed.toLowerCase();
    if (invalidPrefixes.some(prefix => lowerTrimmed.startsWith(prefix.toLowerCase()))) {
      return false;
    }

    return true;
  }

  /**
   * Check if content looks like HTML
   */
  isHtmlContent(content) {
    const trimmed = content.trim();
    
    // HTML tags (opening or closing)
    if (/^<\/?[a-zA-Z][a-zA-Z0-9]*>?$/.test(trimmed)) {
      return true;
    }
    
    // HTML tag with content
    if (/^<[a-zA-Z][a-zA-Z0-9]*[^>]*>.*<\/[a-zA-Z][a-zA-Z0-9]*>$/.test(trimmed)) {
      return true;
    }
    
    // Common HTML tags
    const htmlTags = [
      'html', 'head', 'body', 'title', 'meta', 'link', 'script', 'style',
      'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'a', 'img', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th',
      'form', 'input', 'button', 'textarea', 'select', 'option'
    ];
    
    const lowerTrimmed = trimmed.toLowerCase();
    
    // Check for bare HTML tag names
    if (htmlTags.includes(lowerTrimmed)) {
      return true;
    }
    
    // Check for HTML tag with closing bracket
    if (htmlTags.some(tag => lowerTrimmed === tag + '>')) {
      return true;
    }
    
    // Check for HTML content patterns
    if (lowerTrimmed.includes('<') && lowerTrimmed.includes('>')) {
      return true;
    }
    
    return false;
  }

  /**
   * Check if content is clearly not a file path
   */
  isNonFileContent(content) {
    const trimmed = content.trim();
    const lowerTrimmed = trimmed.toLowerCase();
    
    // Common non-file patterns
    const nonFilePatterns = [
      /^(true|false|null|undefined)$/i,
      /^\d+$/,                                    // Just numbers
      /^[{}[\]()]+$/,                            // Just brackets
      /^[,;.!?]+$/,                              // Just punctuation
      /^(error|warning|info|debug|success)$/i,   // Log levels
      /^(yes|no|ok|done|failed)$/i,             // Status words
      /^(am|pm)$/i,                             // Time indicators
      /^\d{1,2}:\d{2}(:\d{2})?$/,               // Time formats
      /^\d{4}-\d{2}-\d{2}$/,                    // Date formats
      /^welcome\s+to\s+/i,                      // Welcome messages
      /^this\s+is\s+/i,                         // Description text
    ];
    
    if (nonFilePatterns.some(pattern => pattern.test(trimmed))) {
      return true;
    }
    
    // Content that's clearly text/HTML content, not file paths
    const textContentPatterns = [
      'welcome to',
      'this is a',
      'landing page',
      'basic html',
      'my landing page'
    ];
    
    if (textContentPatterns.some(pattern => lowerTrimmed.includes(pattern))) {
      return true;
    }
    
    return false;
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
        // Handle diff icon clicks
        const diffIcon = item.querySelector(".tool-file-diff");
        if (diffIcon) {
          diffIcon.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const filePath = diffIcon.dataset.filePath;
            console.log("Diff icon clicked:", { filePath });
            if (filePath) {
              this.showFileDiff(filePath);
            }
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
          const filePath = item.dataset.filePath;
          console.log("File item clicked:", {
            filePath,
            item,
            dataset: item.dataset,
            innerHTML: item.innerHTML.substring(0, 200) + "...",
          });
          if (filePath) {
            this.openFile(filePath);
          } else {
            console.error("No file path found in dataset:", item.dataset);
            console.error("Item HTML:", item.outerHTML);
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
    // Validate and clean the file path
    if (!filePath || typeof filePath !== "string") {
      console.error("Invalid file path:", filePath);
      return;
    }

    // Clean the file path - remove any extra whitespace or formatting
    let cleanPath = filePath.trim();

    // Remove any markdown-style formatting or extra characters
    cleanPath = cleanPath.replace(/^\*\*|\*\*$/g, ""); // Remove bold markdown
    cleanPath = cleanPath.replace(/^`|`$/g, ""); // Remove code backticks
    cleanPath = cleanPath.replace(/\s+\([^)]*\)$/, ""); // Remove size info like "(0 KB)"

    console.log("FileUtils.openFile - Original path:", filePath);
    console.log("FileUtils.openFile - Cleaned path:", cleanPath);
    console.log("FileUtils.openFile - Path type:", typeof cleanPath);
    console.log("FileUtils.openFile - Path length:", cleanPath.length);

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

    // Clean the file path - remove any extra whitespace or formatting
    let cleanPath = filePath.trim();

    // Remove any markdown-style formatting or extra characters
    cleanPath = cleanPath.replace(/^\*\*|\*\*$/g, ""); // Remove bold markdown
    cleanPath = cleanPath.replace(/^`|`$/g, ""); // Remove code backticks
    cleanPath = cleanPath.replace(/\s+\([^)]*\)$/, ""); // Remove size info like "(0 KB)"

    console.log("Showing diff for file:", cleanPath);

    // Send message to extension to show the file diff
    this.chatUI.postMessage({
      type: "showFileDiff",
      filePath: cleanPath,
    });
  }
}

// FileUtils is now globally available
