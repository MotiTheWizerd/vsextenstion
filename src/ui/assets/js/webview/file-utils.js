class FileUtils {
  constructor(chatUI) {
    this.chatUI = chatUI;
  }

  hasFileResults(results) {
    if (!results || results.length === 0) {
      return false;
    }

    const fileObjects = this.extractFileList(results);
    return fileObjects && fileObjects.length > 0;
  }

  createFileDropdown(results, totalCount) {
    const fileObjects = this.extractFileList(results);
    if (!fileObjects || fileObjects.length === 0) {
      return "";
    }

    // Process all messages and commands
    let messages = [];
    let statusMessages = new Set();

    // First collect all messages
    results.forEach(result => {
      if (result.message) {
        messages.push(result.message);
      }
      if (result.status && !statusMessages.has(result.status)) {
        messages.push(result.status);
        statusMessages.add(result.status);
      }
      if (result.command) {
        if (result.output && typeof result.output === 'string' && result.output.trim()) {
          // Try to parse JSON output and create a nice summary
          try {
            const parsed = JSON.parse(result.output.trim());
            if (parsed.type === 'fileList' && Array.isArray(parsed.files)) {
              // For file lists, show a summary instead of command name and raw JSON
              const fileCount = parsed.files.length;
              const summary = `Found ${fileCount} item${fileCount !== 1 ? 's' : ''} in directory`;
              messages.push(summary);
            } else {
              // For other JSON, show command name and output
              const cmdMsg = result.args 
                ? `${result.command} ${result.args.join(' ')}`
                : result.command;
              messages.push(cmdMsg);
              messages.push(result.output.trim());
            }
          } catch (e) {
            // Not JSON, check if it's a file modification command
            if (['write', 'append', 'replace'].includes(result.command)) {
              // For file modification commands, show a success message instead of the file content
              const fileName = result.args && result.args[0] ? result.args[0].split(/[/\\]/).pop() : 'file';
              const action = result.command === 'write' ? 'Created' : 
                           result.command === 'append' ? 'Appended to' : 'Modified';
              messages.push(`✅ ${action} ${fileName}`);
            } else {
              // For other commands, show command name and output
              const cmdMsg = result.args 
                ? `${result.command} ${result.args.join(' ')}`
                : result.command;
              messages.push(cmdMsg);
              messages.push(result.output.trim());
            }
          }
        } else {
          // No output, just show command name
          const cmdMsg = result.args 
            ? `${result.command} ${result.args.join(' ')}`
            : result.command;
          messages.push(cmdMsg);
        }
      }
    });

    // Show all files
    const displayFiles = fileObjects;
    const hasMore = false;

    // Create the command summary with all messages
    const commandSummary = messages.length > 0
      ? `<div class="tool-command-info">
          ${messages.map(msg => `<div class="tool-message">${msg}</div>`).join('')}
        </div>`
      : "";

    const fileItems = displayFiles
      .map((fileObj) => {
        const fileName = fileObj.name;
        const filePath = fileObj.path;
        const parentPath = filePath !== fileName 
          ? filePath.substring(0, filePath.length - fileName.length - 1)
          : "";

        const diffIcon = fileObj.isModified
          ? `
          <div class="tool-file-diff" data-file-path="${filePath
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

        // Create metadata display
        const metadata = [];
        if (fileObj.matchCount) {
          metadata.push(`${fileObj.matchCount} match${fileObj.matchCount > 1 ? 'es' : ''}`);
        }
        if (fileObj.sizeFormatted) {
          metadata.push(fileObj.sizeFormatted);
        }
        if (fileObj.modifiedFormatted) {
          metadata.push(fileObj.modifiedFormatted);
        }
        const metadataText = metadata.length > 0 ? ` (${metadata.join(', ')})` : '';

        console.log("Creating file item:", {
          fileName,
          filePath,
          parentPath,
          isModified: fileObj.isModified,
          metadata: metadataText
        });

        // Escape HTML attributes and content
        const escapedPath = filePath.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
        const escapedFileName = fileName
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        const escapedParentPath = parentPath
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        const escapedMetadata = metadataText
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");

        return `
        <div class="tool-file-item" data-file-path="${escapedPath}">
          <div class="tool-file-content">
            <div class="tool-file-icon">${FileIconUtils.getFileIcon(fileObj.name)}</div>
            <div class="tool-file-info">
              <div class="tool-file-name">${escapedFileName}${escapedMetadata}</div>
              ${
                parentPath
                  ? `<div class="tool-file-path">${escapedParentPath}</div>`
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
          fileObjects.length - 10
        } more files</div>`
      : "";

    const dropdownHtml = `
      <div class="tool-dropdown">
        ${commandSummary}
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



  extractFileList(results) {
    const fileObjects = [];
    const processedPaths = new Set(); // Track processed paths to avoid duplicates

    if (!Array.isArray(results)) {
      return fileObjects;
    }

    // First pass - collect and process any messages or status updates
    results.forEach(result => {
      if (result && (result.message || result.status)) {
        // Store message/status for display
        fileObjects._messages = fileObjects._messages || [];
        if (result.message) {
          fileObjects._messages.push(result.message);
        }
        if (result.status) {
          fileObjects._messages.push(result.status);
        }
      }
    });

    // Second pass - process files and commands
    results.forEach((result) => {
      if (!result) { return; }

      // For file modification commands, extract file path from arguments
      if (result.ok && ["write", "append", "replace"].includes(result.command)) {
        const args = result.args || [];
        if (args.length > 0 && typeof args[0] === "string") {
          let filePath = args[0].trim();
          // Clean the file path
          filePath = filePath.replace(/^["']|["']$/g, "");
          filePath = filePath.replace(/^\*\*|\*\*$/g, "");
          filePath = filePath.replace(/^`|`$/g, "");

          if (this.isValidFilePath(filePath) && !processedPaths.has(filePath)) {
            fileObjects.push({
              name: filePath.split(/[/\\]/).pop() || filePath,
              path: filePath,
              type: 'file',
              icon: '📄',
              isModified: true
            });
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
        // Try to parse as JSON first (new structured format)
        try {
          const parsed = JSON.parse(output);
          if (parsed.type === 'fileList' && Array.isArray(parsed.files)) {
            // Handle file list format
            parsed.files.forEach((fileObj) => {
              if (fileObj.path && !processedPaths.has(fileObj.path)) {
                fileObjects.push({
                  name: fileObj.name || fileObj.path.split(/[/\\]/).pop() || fileObj.path,
                  path: fileObj.path,
                  type: fileObj.type || 'file',
                  size: fileObj.size,
                  sizeFormatted: fileObj.sizeFormatted,
                  modified: fileObj.modified,
                  modifiedFormatted: fileObj.modifiedFormatted,
                  icon: fileObj.icon || (fileObj.type === 'directory' ? '📁' : '📄'),
                  isModified: false
                });
                processedPaths.add(fileObj.path);
              }
            });
            return; // Skip the old string parsing for this result
          } else if (parsed.type === 'searchResults' && Array.isArray(parsed.files)) {
            // Handle search results format
            parsed.files.forEach((fileObj) => {
              if (fileObj.path && !processedPaths.has(fileObj.path)) {
                fileObjects.push({
                  name: fileObj.name || fileObj.path.split(/[/\\]/).pop() || fileObj.path,
                  path: fileObj.path,
                  type: 'file',
                  matchCount: fileObj.matchCount,
                  icon: fileObj.icon || '📄',
                  isModified: false,
                  searchResult: true,
                  matches: fileObj.matches
                });
                processedPaths.add(fileObj.path);
              }
            });
            return; // Skip the old string parsing for this result
          }
        } catch (e) {
          // Not JSON, continue with old string parsing
        }

        // Fallback to old string parsing for backward compatibility
        const lines = output
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line);
        
        lines.forEach((line) => {
          const cleanPath = this.cleanAndValidateFilePath(line);
          if (cleanPath && !processedPaths.has(cleanPath)) {
            fileObjects.push({
              name: cleanPath.split(/[/\\]/).pop() || cleanPath,
              path: cleanPath,
              type: 'file',
              icon: '📄',
              isModified: false
            });
            processedPaths.add(cleanPath);
          }
        });
      } else if (Array.isArray(output)) {
        output.forEach((item) => {
          if (typeof item === "string") {
            const cleanPath = this.cleanAndValidateFilePath(item);
            if (cleanPath && !processedPaths.has(cleanPath)) {
              fileObjects.push({
                name: cleanPath.split(/[/\\]/).pop() || cleanPath,
                path: cleanPath,
                type: 'file',
                icon: '📄',
                isModified: false
              });
              processedPaths.add(cleanPath);
            }
          }
        });
      }
    });

    // Sort by path and return
    return fileObjects.sort((a, b) => a.path.localeCompare(b.path));
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
    const extension = filePath.split('.').pop()?.toLowerCase();
    const fileName = filePath.split(/[/\\]/).pop()?.toLowerCase();

    // Map extensions to VS Code Codicon names
    const iconMap = {
      // Programming Languages
      js: 'javascript',
      jsx: 'react',
      ts: 'typescript',
      tsx: 'react',
      py: 'symbol-misc', // Python
      java: 'symbol-misc',
      cpp: 'symbol-misc',
      c: 'symbol-misc',
      cs: 'symbol-misc',
      go: 'symbol-misc',
      rs: 'symbol-misc',
      rb: 'symbol-misc',
      php: 'symbol-misc',
      
      // Web Technologies
      html: 'html',
      css: 'symbol-color',
      scss: 'symbol-color',
      sass: 'symbol-color',
      less: 'symbol-color',
      json: 'json',
      xml: 'code',
      md: 'markdown',
      
      // Config Files
      env: 'settings-gear',
      yml: 'symbol-misc',
      yaml: 'symbol-misc',
      toml: 'settings-gear',
      ini: 'settings-gear',
      conf: 'settings-gear',
      config: 'settings-gear',
      
      // Documentation
      pdf: 'file-pdf',
      doc: 'file-word',
      docx: 'file-word',
      txt: 'file-text',
      
      // Images
      png: 'file-media',
      jpg: 'file-media',
      jpeg: 'file-media',
      gif: 'file-media',
      svg: 'file-media',
      
      // Archives
      zip: 'file-zip',
      rar: 'file-zip',
      tar: 'file-zip',
      gz: 'file-zip'
    };

    // Special cases based on filename
    if (fileName === 'package.json') { return 'codicon-package'; }
    if (fileName === '.gitignore') { return 'codicon-git'; }
    if (fileName === 'readme.md') { return 'codicon-book'; }
    if (fileName === 'license') { return 'codicon-law'; }
    if (fileName === 'dockerfile') { return 'codicon-docker'; }
    
    // Check if it's a directory
    if (!extension || filePath.endsWith('/') || filePath.endsWith('\\')) {
      return 'codicon-folder';
    }
    
    // Default to file icon if no match
    return `codicon-${iconMap[extension] || 'file'}`;
    

    // Check if it's a directory (no extension or ends with /)
    if (!extension || filePath.endsWith("/") || filePath.endsWith("\\")) {
      return 'codicon-folder';
    }

    return `codicon-${iconMap[extension] || 'file'}`;
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
              dataset: item.dataset
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

    console.log("FileUtils.openFile - Original path:", filePath);

    // Clean the file path - remove any extra whitespace or formatting
    let cleanPath = this.cleanFilePath(filePath);

    console.log("FileUtils.openFile - Cleaned path:", cleanPath);
    console.log("FileUtils.openFile - Path type:", typeof cleanPath);
    console.log("FileUtils.openFile - Path length:", cleanPath.length);

    // Send message to extension to open the file
    this.chatUI.postMessage({
      type: "openFile",
      filePath: cleanPath,
    });
  }

  cleanFilePath(filePath) {
    if (!filePath || typeof filePath !== "string") {
      return filePath;
    }

    let cleanPath = filePath.trim();

    // Remove emojis (Unicode emoji characters)
    cleanPath = cleanPath.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
    
    // Remove any markdown-style formatting or extra characters
    cleanPath = cleanPath.replace(/^\*\*|\*\*$/g, ""); // Remove bold markdown
    cleanPath = cleanPath.replace(/^`|`$/g, ""); // Remove code backticks
    cleanPath = cleanPath.replace(/\s+\([^)]*\)$/, ""); // Remove size info like "(0 KB)"
    
    // Remove date/time information at the end (like "- 8/13\2025, 5:03:03 PM")
    cleanPath = cleanPath.replace(/\s*-\s*\d{1,2}\/\d{1,2}\\?\d{4}[,\s]+\d{1,2}:\d{2}:\d{2}\s+(AM|PM)\s*$/i, "");
    
    // Remove any remaining extra whitespace
    cleanPath = cleanPath.trim();
    
    // Handle duplicate path segments
    // Example: "c:\Users\Moti\text-generation-webui\Moti\text-generation-webui\file.js"
    // Should become: "c:\Users\Moti\text-generation-webui\file.js"
    cleanPath = this.removeDuplicatePathSegments(cleanPath);

    return cleanPath;
  }

  isValidClickableFilePath(filePath) {
    if (!filePath || typeof filePath !== "string") {
      return false;
    }

    // Clean the path first
    const cleanPath = this.cleanFilePath(filePath);
    
    // Must be a valid file path
    if (!this.isValidFilePath(cleanPath)) {
      return false;
    }

    // Must not be empty after cleaning
    if (!cleanPath || cleanPath.trim().length === 0) {
      return false;
    }

    // Must contain actual path separators or file extension
    const hasPathSeparator = cleanPath.includes('/') || cleanPath.includes('\\');
    const hasFileExtension = /\.[a-zA-Z0-9]{1,10}$/.test(cleanPath);
    
    if (!hasPathSeparator && !hasFileExtension) {
      return false;
    }

    // Must not be just a directory separator
    if (/^[/\\]+$/.test(cleanPath)) {
      return false;
    }

    // Must have reasonable length (not too short or too long)
    if (cleanPath.length < 2 || cleanPath.length > 500) {
      return false;
    }

    return true;
  }

  removeDuplicatePathSegments(path) {
    if (!path || typeof path !== "string") {
      return path;
    }

    const isWindows = path.includes('\\');
    const separator = isWindows ? '\\' : '/';
    const parts = path.split(/[/\\]/);
    
    if (parts.length <= 3) {
      return path; // Too short to have meaningful duplicates
    }

    // Look for duplicate sequences in the path
    // For example: ["c:", "Users", "Moti", "text-generation-webui", "Moti", "text-generation-webui", "file.js"]
    // Should become: ["c:", "Users", "Moti", "text-generation-webui", "file.js"]
    
    const cleanedParts = [parts[0]]; // Always keep the first part (drive/root)
    
    for (let i = 1; i < parts.length; i++) {
      const currentPart = parts[i];
      
      // Look for the pattern where we have a sequence that repeats
      // Check if this part starts a duplicate sequence
      let isDuplicate = false;
      
      // Look backwards to see if we can find this same part earlier
      for (let j = cleanedParts.length - 1; j >= 1; j--) {
        if (cleanedParts[j] === currentPart) {
          // Found a potential duplicate, check if the following parts also match
          let sequenceLength = 0;
          let allMatch = true;
          
          // Check how many consecutive parts match
          for (let k = 0; k < Math.min(cleanedParts.length - j, parts.length - i); k++) {
            if (cleanedParts[j + k] === parts[i + k]) {
              sequenceLength++;
            } else {
              allMatch = false;
              break;
            }
          }
          
          // If we found a sequence of at least 2 matching parts, it's likely a duplicate
          if (sequenceLength >= 2 && allMatch) {
            // Skip ahead past the duplicate sequence
            i += sequenceLength - 1;
            isDuplicate = true;
            break;
          }
        }
      }
      
      if (!isDuplicate) {
        cleanedParts.push(currentPart);
      }
    }
    
    return cleanedParts.join(separator);
  }

  showFileDiff(filePath) {
    // Validate and clean the file path
    if (!filePath || typeof filePath !== "string") {
      console.error("Invalid file path for diff:", filePath);
      return;
    }

    // Clean the file path using the same logic as openFile
    let cleanPath = this.cleanFilePath(filePath);

    console.log("Showing diff for file:", cleanPath);

    // Send message to extension to show the file diff
    this.chatUI.postMessage({
      type: "showFileDiff",
      filePath: cleanPath,
    });
  }
}

// FileUtils is now globally available
