import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

/**
 * Get the JavaScript content for the webview
 * @param extensionContext - The extension context
 * @param customJS - Custom JavaScript to inject
 * @returns The JavaScript content
 */
export function getScripts(extensionContext: vscode.ExtensionContext, customJS: string = "") : string {
  // Get the path to the bundled webview JavaScript file
  const bundledWebviewJsPath = path.join(
    extensionContext.extensionPath,
    "dist/chat-ui.js"
  );

  let jsContent = "";
  try {
    jsContent = fs.readFileSync(bundledWebviewJsPath, "utf8");
  } catch (error) {
    console.error(`Failed to load bundled webview JavaScript: ${bundledWebviewJsPath}`, error);
    jsContent += `
// Error loading bundled webview JavaScript`;
  }

  // Add custom JS if provided
  if (customJS) {
    jsContent += "\n" + customJS;
  }

  return jsContent;
}
