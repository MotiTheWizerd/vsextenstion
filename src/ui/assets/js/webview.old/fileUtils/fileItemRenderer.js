import { IconProvider } from "./iconProvider.js";

export class FileItemRenderer {
  static render(fileObj) {
    const fileName = fileObj.name;
    const filePath = fileObj.path;

    // Ensure fileName is actually just the filename, not the full path
    const actualFileName =
      fileName.includes("/") || fileName.includes("\\")
        ? fileName.split(/[\/\\]/).pop()
        : fileName;

    const parentPath =
      filePath !== actualFileName
        ? filePath.substring(0, filePath.length - actualFileName.length - 1)
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
      metadata.push(
        `${fileObj.matchCount} match${fileObj.matchCount > 1 ? "es" : ""}`,
      );
    }
    if (fileObj.sizeFormatted) {
      metadata.push(fileObj.sizeFormatted);
    }
    if (fileObj.modifiedFormatted) {
      metadata.push(fileObj.modifiedFormatted);
    }
    const metadataText = metadata.length > 0 ? ` (${metadata.join(", ")})` : "";

    // Escape HTML attributes and content
    const escapedPath = filePath.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const escapedFileName = actualFileName
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const escapedParentPath = parentPath
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const escapedMetadata = metadataText
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const result = `
        <div class="tool-file-item" data-file-path="${escapedPath}">
          <div class="tool-file-content">
            <div class="tool-file-icon">${IconProvider.getFileIcon(actualFileName)}</div>
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

    return result;
  }
}
