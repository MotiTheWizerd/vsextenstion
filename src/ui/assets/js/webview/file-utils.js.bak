class FileUtils {
  constructor(chatUI) {
    this.chatUI = chatUI;
  }

  hasFileResults(results) {
    if (!results || results.length === 0) {
      return false;
    }

    // Extract actual file list and check if we have meaningful files
    const fileObjects = this.extractFileList(results);
    
    // Only return true if we have at least one valid file
    return fileObjects.length > 0;
  }

  createFileDropdown(results, totalCount) {
    const fileObjects = this.extractFileList(results);
    if (fileObjects.length === 0) {
      return "";
    }

    const displayFiles = fileObjects.slice(0, 10); // Show max 10 files
    const hasMore = fileObjects.length > 10;

    const fileItems = displayFiles
      .map((fileObj) => {
        const fileName = fileObj.name;
        const filePath = fileObj.path;
        const parentPath = filePath !== fileName 
          ? filePath.substring(0, filePath.length - fileName.length - 1)
          : "";

        // Add metadata if available
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

        // Get the file icon class
        const iconClass = FileIconUtils.getFileIcon(fileName);

        // HTML escape all text content
        const escapedPath = filePath.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        const escapedFileName = fileName.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const escapedParentPath = parentPath.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const escapedMetadata = metadataText.replace(/</g, '&lt;').replace(/>/g, '&gt;');

        return `
          <div class="tool-file-item" data-file-path="${escapedPath}">
            <div class="tool-file-content">
              <div class="tool-file-icon ${iconClass}"></div>
              <div class="tool-file-info">
                <div class="tool-file-name">${escapedFileName}${escapedMetadata}</div>
                ${parentPath ? `<div class="tool-file-path">${escapedParentPath}</div>` : ''}
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    const moreIndicator = hasMore
      ? `<div class="tool-more-indicator">... and ${fileObjects.length - 10} more files</div>`
      : '';

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
    const fileObjects = [];
    const processedPaths = new Set();

    results.forEach(result => {
      if (!result.ok || !result.output) { return; }
      
      const output = result.output;
      
      if (typeof output === 'string') {
        try {
          const parsed = JSON.parse(output);
          if (parsed.files && Array.isArray(parsed.files)) {
            parsed.files.forEach(file => {
              if (typeof file === 'string' && !processedPaths.has(file)) {
                const name = file.split(/[/\\]/).pop() || file;
                fileObjects.push({
                  name,
                  path: file,
                  type: 'file'
                });
                processedPaths.add(file);
              }
            });
          }
        } catch (e) {
          // Not JSON, try line-by-line parsing
          const lines = output.split('\n')
            .map(line => line.trim())
            .filter(line => line && (line.includes('/') || line.includes('\\')));
          
          lines.forEach(line => {
            if (!processedPaths.has(line)) {
              const name = line.split(/[/\\]/).pop() || line;
              fileObjects.push({
                name,
                path: line,
                type: 'file'
              });
              processedPaths.add(line);
            }
          });
        }
      }
    });

    return fileObjects.sort((a, b) => a.path.localeCompare(b.path));
  }

  toggleToolDropdown(messageDiv) {
    const dropdown = messageDiv.querySelector('.tool-dropdown');
    const countElement = messageDiv.querySelector('.tool-count.expandable');

    if (!dropdown || !countElement) { return; }

    const isExpanded = dropdown.classList.contains('expanded');

    if (isExpanded) {
      dropdown.classList.remove('expanded');
      countElement.classList.remove('expanded');
    } else {
      dropdown.classList.add('expanded');
      countElement.classList.add('expanded');

      // Add click handlers to file items
      const fileItems = dropdown.querySelectorAll('.tool-file-item');
      fileItems.forEach(item => {
        const filePath = item.dataset.filePath;
        if (this.isValidClickableFilePath(filePath)) {
          item.classList.add('clickable');
          item.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.openFile(filePath);
          });
        }
      });
    }

    setTimeout(() => {
      this.chatUI.scrollToBottom();
    }, 100);
  }

  openFile(filePath) {
    if (!this.isValidClickableFilePath(filePath)) { return; }

    this.chatUI.postMessage({
      type: 'openFile',
      filePath: filePath
    });
  }

  isValidClickableFilePath(filePath) {
    return filePath && typeof filePath === 'string' && 
           (filePath.includes('/') || filePath.includes('\\'));
  }
}
