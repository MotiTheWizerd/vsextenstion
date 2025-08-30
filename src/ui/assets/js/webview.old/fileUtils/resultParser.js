export class ResultParser {
  extractFileList(results) {
    const fileObjects = [];
    const processedPaths = new Set(); // Track processed paths to avoid duplicates

    if (!Array.isArray(results)) {
      return fileObjects;
    }

    // First pass - collect and process any messages or status updates
    results.forEach((result) => {
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
      if (!result) {
        return;
      }

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
            const fileName = filePath.split(/[\/\\]/).pop() || filePath;

            fileObjects.push({
              name: fileName,
              path: filePath,
              type: "file",
              icon: "📄",
              isModified: true,
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
          if (parsed.type === "fileList" && Array.isArray(parsed.files)) {
            // Handle file list format
            parsed.files.forEach((fileObj) => {
              if (fileObj.path && !processedPaths.has(fileObj.path)) {
                const extractedName =
                  fileObj.name ||
                  fileObj.path.split(/[\/\\]/).pop() ||
                  fileObj.path;

                fileObjects.push({
                  name: extractedName,
                  path: fileObj.path,
                  type: fileObj.type || "file",
                  size: fileObj.size,
                  sizeFormatted: fileObj.sizeFormatted,
                  modified: fileObj.modified,
                  modifiedFormatted: fileObj.modifiedFormatted,
                  icon:
                    fileObj.icon ||
                    (fileObj.type === "directory" ? "📁" : "📄"),
                  isModified: false,
                });
                processedPaths.add(fileObj.path);
              }
            });
            return; // Skip the old string parsing for this result
          } else if (
            parsed.type === "searchResults" &&
            Array.isArray(parsed.files)
          ) {
            // Handle search results format
            parsed.files.forEach((fileObj) => {
              if (fileObj.path && !processedPaths.has(fileObj.path)) {
                const extractedName =
                  fileObj.name ||
                  fileObj.path.split(/[\/\\]/).pop() ||
                  fileObj.path;

                fileObjects.push({
                  name: extractedName,
                  path: fileObj.path,
                  type: "file",
                  matchCount: fileObj.matchCount,
                  icon: fileObj.icon || "📄",
                  isModified: false,
                  searchResult: true,
                  matches: fileObj.matches,
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
            const fileName = cleanPath.split(/[\/\\]/).pop() || cleanPath;

            fileObjects.push({
              name: fileName,
              path: cleanPath,
              type: "file",
              icon: "📄",
              isModified: false,
            });
            processedPaths.add(cleanPath);
          }
        });
      } else if (Array.isArray(output)) {
        output.forEach((item) => {
          if (typeof item === "string") {
            const cleanPath = this.cleanAndValidateFilePath(item);
            if (cleanPath && !processedPaths.has(cleanPath)) {
              const fileName = cleanPath.split(/[\/\\]/).pop() || cleanPath;

              fileObjects.push({
                name: fileName,
                path: cleanPath,
                type: "file",
                icon: "📄",
                isModified: false,
              });
              processedPaths.add(cleanPath);
            }
          }
        });
      }
    });

    // Sort by path and return
    const sortedResults = fileObjects.sort((a, b) =>
      a.path.localeCompare(b.path),
    );

    return sortedResults;
  }

  cleanAndValidateFilePath(line) {
    if (!line || typeof line !== "string") {
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
    cleanPath = cleanPath.replace(
      /^\d{1,4}[,\s]+\d{1,2}:\d{2}:\d{2}\s+(AM|PM)\s*/i,
      "",
    );
    cleanPath = cleanPath.replace(
      /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s*/,
      "",
    );

    // Final cleanup
    cleanPath = cleanPath.trim();

    return this.isValidFilePath(cleanPath) ? cleanPath : null;
  }

  shouldSkipLine(line) {
    const skipPatterns = [
      /^Created:\s*\d/i, // "Created: 8/14" without filename
      /^\d{1,4}[,\s]+\d{1,2}:\d{2}:\d{2}\s+(AM|PM)\s*$/i, // Just timestamps
      /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s*$/, // Just ISO timestamps
      /^(AM|PM)\s*$/i, // Just AM/PM
      /^\d+\s*$/, // Just numbers
      /^(bytes?|kb|mb|gb)\s*$/i, // Just size units
      /^(error|warning|info|debug):/i, // Log levels
      /^(true|false|null|undefined)\s*$/i, // Boolean/null values
      /^\s*[{}[\\\]()]\s*$/, // Just brackets/braces
      /^\s*[,;.]\s*$/, // Just punctuation
      /^<\/?[a-zA-Z][a-zA-Z0-9]*>$/, // HTML tags
      /^[a-zA-Z][a-zA-Z0-9]*>$/, // HTML tag endings like "body>"
      /^<[a-zA-Z]/, // Lines starting with HTML tags
      /welcome\s+to/i, // Welcome messages
      /this\s+is\s+a/i, // Description text
      /landing\s+page/i, // Landing page text
      /basic\s+html/i, // HTML description text
    ];

    return skipPatterns.some((pattern) => pattern.test(line));
  }

  isValidFilePath(filePath) {
    if (!filePath || typeof filePath !== "string") {
      return false;
    }

    const trimmed = filePath.trim();

    // Must have reasonable length
    if (trimmed.length < 3 || trimmed.length > 500) {
      return false;
    }

    // Must not be just separators
    if (/^[\/\\]+$/.test(trimmed)) {
      return false;
    }

    // Must not be just dots and separators
    if (/^[.\/\\]+$/.test(trimmed)) {
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
    const hasPathSeparator = trimmed.includes("/") || trimmed.includes("\\");
    const hasFileExtension = /\.[a-zA-Z0-9]{1,10}$/.test(trimmed);

    if (!hasPathSeparator && !hasFileExtension) {
      return false;
    }

    // Should not start with common non-path prefixes
    const invalidPrefixes = [
      "http://",
      "https://",
      "ftp://",
      "file://",
      "Created:",
      "Modified:",
      "Deleted:",
      "Error:",
      "Warning:",
      "Info:",
      "Debug:",
    ];

    const lowerTrimmed = trimmed.toLowerCase();
    if (
      invalidPrefixes.some((prefix) =>
        lowerTrimmed.startsWith(prefix.toLowerCase()),
      )
    ) {
      return false;
    }

    return true;
  }

  isHtmlContent(content) {
    const trimmed = content.trim();

    // HTML tags (opening or closing)
    if (/^<\/?[a-zA-Z][a-zA-Z0-9]*>?$/.test(trimmed)) {
      return true;
    }

    // HTML tag with content
    if (
      /^<[a-zA-Z][a-zA-Z0-9]*[^>]*>.*<\/[a-zA-Z][a-zA-Z0-9]*>$/.test(trimmed)
    ) {
      return true;
    }

    // Common HTML tags
    const htmlTags = [
      "html",
      "head",
      "body",
      "title",
      "meta",
      "link",
      "script",
      "style",
      "div",
      "span",
      "p",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "a",
      "img",
      "ul",
      "ol",
      "li",
      "table",
      "tr",
      "td",
      "th",
      "form",
      "input",
      "button",
      "textarea",
      "select",
      "option",
    ];

    const lowerTrimmed = trimmed.toLowerCase();

    // Check for bare HTML tag names
    if (htmlTags.includes(lowerTrimmed)) {
      return true;
    }

    // Check for HTML tag with closing bracket
    if (htmlTags.some((tag) => lowerTrimmed === tag + ">")) {
      return true;
    }

    // Check for HTML content patterns
    if (lowerTrimmed.includes("<") && lowerTrimmed.includes(">")) {
      return true;
    }

    return false;
  }

  isNonFileContent(content) {
    const trimmed = content.trim();
    const lowerTrimmed = trimmed.toLowerCase();

    // Common non-file patterns
    const nonFilePatterns = [
      /^(true|false|null|undefined)$/i,
      /^\d+$/, // Just numbers
      /^[{}[\\\]()]+$/, // Just brackets
      /^[,;.!?]+$/, // Just punctuation
      /^(error|warning|info|debug|success)$/i, // Log levels
      /^(yes|no|ok|done|failed)$/i, // Status words
      /^(am|pm)$/i, // Time indicators
      /^\d{1,2}:\d{2}(:\d{2})?$/, // Time formats
      /^\d{4}-\d{2}-\d{2}$/, // Date formats
      /^welcome\s+to\s+/i, // Welcome messages
      /^this\s+is\s+/i, // Description text
    ];

    if (nonFilePatterns.some((pattern) => pattern.test(trimmed))) {
      return true;
    }

    // Content that's clearly text/HTML content, not file paths
    const textContentPatterns = [
      "welcome to",
      "this is a",
      "landing page",
      "basic html",
      "my landing page",
    ];

    if (textContentPatterns.some((pattern) => lowerTrimmed.includes(pattern))) {
      return true;
    }

    return false;
  }

  cleanFilePath(filePath) {
    if (!filePath || typeof filePath !== "string") {
      return filePath;
    }

    let cleanPath = filePath.trim();

    // Remove emojis (Unicode emoji characters)
    cleanPath = cleanPath.replace(
      /[F600}-F64F]|[F300}-F5FF]|[F680}-F6FF]|[F1E0}-F1FF]|[☀}-⛿]|[✀}-➿]/gu,
      "",
    );

    // Remove any markdown-style formatting or extra characters
    cleanPath = cleanPath.replace(/^\*\*|\*\*$/g, ""); // Remove bold markdown
    cleanPath = cleanPath.replace(/^`|`$/g, ""); // Remove code backticks
    cleanPath = cleanPath.replace(/\s+\([^)]*\)$/, ""); // Remove size info like "(0 KB)"

    // Remove date/time information at the end (like "- 8/13\2025, 5:03:03 PM")
    cleanPath = cleanPath.replace(
      /\s*-\s*\d{1,2}\/\d{1,2}\\\d{4}[,\s]+\d{1,2}:\d{2}:\d{2}\s+(AM|PM)\s*$/i,
      "",
    );

    // Remove any remaining extra whitespace
    cleanPath = cleanPath.trim();

    // Handle duplicate path segments
    // Example: "c:\Users\Moti\text-generation-webui\Moti\text-generation-webui\file.js"
    // Should become: "c:\Users\Moti\text-generation-webui\file.js"
    cleanPath = this.removeDuplicatePathSegments(cleanPath);

    return cleanPath;
  }

  removeDuplicatePathSegments(path) {
    if (!path || typeof path !== "string") {
      return path;
    }

    const isWindows = path.includes("\\");
    const separator = isWindows ? "\\" : "/";
    const parts = path.split(/[\/\\]/);

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
          for (
            let k = 0;
            k < Math.min(cleanedParts.length - j, parts.length - i);
            k++
          ) {
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
}
