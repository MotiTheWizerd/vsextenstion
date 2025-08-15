import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

/**
 * Get the JavaScript content for the webview
 * @param extensionContext - The extension context
 * @param customJS - Custom JavaScript to inject
 * @returns The JavaScript content
 */
export function getScripts(extensionContext: vscode.ExtensionContext, customJS: string = ""): string {
  // Get file system paths for reading content
  const markdownParserPath = path.join(
    extensionContext.extensionPath,
    "src/ui/assets/js/webview/markdown-parser.js"
  );
  const fileIconsPath = path.join(
    extensionContext.extensionPath,
    "src/ui/assets/js/webview/file-icons.js"
  );
  const fileUtilsPath = path.join(
    extensionContext.extensionPath,
    "src/ui/assets/js/webview/file-utils.js"
  );
  const chatUIPath = path.join(
    extensionContext.extensionPath,
    "src/ui/assets/js/webview/chat-ui.js"
  );
  const messageHandlerPath = path.join(
    extensionContext.extensionPath,
    "src/ui/assets/js/webview/message-handler.js"
  );
  const mainScriptPath = path.join(
    extensionContext.extensionPath,
    "src/ui/assets/js/webview.js"
  );
  const panelControlsPath = path.join(
    extensionContext.extensionPath,
    "src/ui/assets/js/panel-controls.js"
  );

  // Load all JS files in order (dependencies first)
  const jsFiles = [
    markdownParserPath,
    fileIconsPath,
    fileUtilsPath,
    chatUIPath,
    messageHandlerPath,
    panelControlsPath,
    mainScriptPath,
  ];

  let jsContent = "";
  for (const jsPath of jsFiles) {
    try {
      const fileContent = fs.readFileSync(jsPath, "utf8");
      // Remove any import/export statements
      const cleanContent = fileContent
        .replace(/^import\s+.*?from\s+['"].*?['"]?;\s*$/gm, "")
        .replace(/^export\s+default\s+/gm, "")
        .replace(/^export\s+\{[^}]*\}\s*;?\s*$/gm, "");
      jsContent += "\n" + cleanContent;
    } catch (error) {
      console.error(`Failed to load ${jsPath}:`, error);
      jsContent += `
// Error loading ${jsPath}`;
    }
  }

  // Add custom JS if provided
  if (customJS) {
    jsContent += "\n" + customJS;
  }

  return jsContent;
}
