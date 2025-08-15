import * as vscode from "vscode";
import * as path from "path";

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Get the URI for a webview resource
 * @param extensionContext - The extension context
 * @param relativePath - Relative path to the resource
 * @returns The URI for the resource
 */
export function getWebviewResourceUri(
  webview: vscode.Webview,
  extensionContext: vscode.ExtensionContext,
  relativePath: string
): vscode.Uri {
  const resourcePath = path.join(
    extensionContext.extensionPath,
    ...relativePath.split("/")
  );
  return webview.asWebviewUri(vscode.Uri.file(resourcePath));
}

/**
 * Get a nonce for CSP (Content Security Policy)
 * @returns A random nonce string
 */
export function getNonce(): string {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}