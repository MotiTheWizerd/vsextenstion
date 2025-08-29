// Extracted from webview-bundle.js
export default class FileUtils {
  constructor(chatUI) {
    this.chatUI = chatUI;
  }

  hasFileResults(results) {
    if (!results || results.length === 0) {
      return false;
    }
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
        if (
          result.ok &&
          ["write", "append", "replace", "edit_file", "create_file"].includes(
            result.command,
          )
        ) {
          const args = result.args || [];
          if (args.length > 0 && typeof args[0] === "string") {
            let filePath = args[0].trim();
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
                icon: "dY",
                isModified: true,
              });
              processedPaths.add(filePath);
            }
          }
        }

        if (result.filePath) {
          if (!processedPaths.has(result.filePath)) {
            const absolutePath = this.getAbsolutePath(result.filePath);
            files.push({
              path: result.filePath,
              absolutePath: absolutePath,
              name: result.filePath.split(/[\/\\]/).pop() || result.filePath,
              type: "file",
              icon: "dY",
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
              icon: "dY",
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
              icon: "dY",
            });
            processedPaths.add(result.file);
          }
        }

        if (result.output && typeof result.output === "string") {
          try {
            const parsed = JSON.parse(result.output);
            if (
              parsed.type === "fileList" &&
              parsed.files &&
              Array.isArray(parsed.files)
            ) {
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
                        file.icon || (file.type === "directory" ? "dY" : "dY"),
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
    if (relativePath.match(/^[A-Z]:\\/i) || relativePath.startsWith("/")) {
      return relativePath;
    }
    const workspaceRoot =
      window.workspaceRoot || "C:\\Users\\Moti Elmakyes\\raydaemon";
    const separator = workspaceRoot.includes("\\") ? "\\" : "/";
    return (
      workspaceRoot + separator + relativePath.replace(/[\/\\]/g, separator)
    );
  }

  isValidFilePath(path) {
    if (!path || typeof path !== "string") {
      return false;
    }
    path = path.trim();
    if (!path) {
      return false;
    }
    if (this.isNonFileContent(path)) {
      return false;
    }
    if (this.isHtmlContent(path)) {
      return false;
    }
    if (path.length > 500) {
      return false;
    }
    if (!/[a-zA-Z0-9._\-\/\\]/.test(path)) {
      return false;
    }
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
    path = path.replace(/^["']|["']$/g, "");
    path = path.replace(/^\*\*|\*\*$/g, "");
    path = path.replace(/^`|`$/g, "");
    path = path.replace(/^File:\s*/i, "");
    path = path.replace(/^Path:\s*/i, "");
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
      /^-{3,}/,
      /^={3,}/,
      /^\s*$/,
    ];
    return skipPatterns.some((pattern) => pattern.test(line));
  }

  isHtmlContent(text) {
    const htmlTagPattern = /<[^>]+>/;
    if (htmlTagPattern.test(text)) {
      return true;
    }
    const htmlEntityPattern = /&[a-zA-Z]+;|&#\d+;/;
    if (htmlEntityPattern.test(text)) {
      return true;
    }
    if (/<!DOCTYPE/i.test(text)) {
      return true;
    }
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
    if (/^https?:\/\//.test(text) || /^ftp:\/\//.test(text)) {
      return true;
    }
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
      return true;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(text) || /^\[\d{4}-\d{2}-\d{2}/.test(text)) {
      return true;
    }
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
      const displayPath = file.path || "";
      const absolutePath = file.absolutePath || file.path || "";
      const fileIcon = file.icon || "dY"
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

