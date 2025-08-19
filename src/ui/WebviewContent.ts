import * as vscode from "vscode";
import { getScripts } from "./webViewContentUtils/scripts";
import { getStyles } from "./webViewContentUtils/styles";
import { getHtml } from "./webViewContentUtils/html";
import { getNonce, getWebviewResourceUri } from "./webViewContentUtils/utils";

/**
 * Configuration for the webview
 */
export interface WebviewConfig {
  /**
   * Whether to show the status bar
   * @default true
   */
  showStatusBar?: boolean;

  /**
   * Initial status message
   * @default 'Ready'
   */
  initialStatus?: string;

  /**
   * Title of the webview
   * @default 'RayDaemon Control Panel'
   */
  title?: string;

  /**
   * Whether to show the chat input
   * @default true
   */
  showChatInput?: boolean;

  /**
   * Custom CSS to inject into the webview
   */
  customCSS?: string;

  /**
   * Custom JavaScript to inject into the webview
   */
  customJS?: string;
}

/**
 * Default webview configuration
 */
const DEFAULT_CONFIG: Required<WebviewConfig> = {
  showStatusBar: true,
  initialStatus: "Ready",
  title: "RayDaemon Control Panel",
  showChatInput: true,
  customCSS: "",
  customJS: "",
};

/**
 * Get the content for a webview panel
 * @param extensionContext - The extension context
 * @param config - Configuration for the webview
 * @returns The HTML content for the webview
 */
export function getWebviewContent(
  webview: vscode.Webview,
  extensionContext: vscode.ExtensionContext,
  config: WebviewConfig = {},
): string {
  // Merge with defaults
  const mergedConfig: Required<WebviewConfig> = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  // Get workspace root
  const workspaceRoot =
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";

  const cssContent = getStyles(extensionContext, mergedConfig.customCSS);
  const jsContent = getScripts(extensionContext, mergedConfig.customJS);

  return getHtml(mergedConfig, cssContent, jsContent, workspaceRoot);
}

export { getNonce, getWebviewResourceUri };
