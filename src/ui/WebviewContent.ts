import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Get the URI for a webview resource
 * @param extensionContext - The extension context
 * @param relativePath - Relative path to the resource
 * @returns The URI for the resource
 */
export function getWebviewResourceUri(
  extensionContext: vscode.ExtensionContext,
  relativePath: string
): vscode.Uri {
  const resourcePath = path.join(extensionContext.extensionPath, ...relativePath.split('/'));
  return vscode.Uri.file(resourcePath).with({ scheme: 'vscode-resource' });
}

/**
 * Get a nonce for CSP (Content Security Policy)
 * @returns A random nonce string
 */
export function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

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
  initialStatus: 'Ready',
  title: 'RayDaemon Control Panel',
  showChatInput: true,
  customCSS: '',
  customJS: ''
};

/**
 * Get the content for a webview panel
 * @param extensionContext - The extension context
 * @param config - Configuration for the webview
 * @returns The HTML content for the webview
 */
export function getWebviewContent(
  extensionContext: vscode.ExtensionContext,
  config: WebviewConfig = {}
): string {
  // Merge with defaults
  const mergedConfig: Required<WebviewConfig> = { ...DEFAULT_CONFIG, ...config };
  
  // Get paths to webview assets
  const stylesPath = getWebviewResourceUri(extensionContext, 'src/ui/assets/css/webview.css');
  const scriptPath = getWebviewResourceUri(extensionContext, 'src/ui/assets/js/webview.js');
  
  // Read CSS and JS files
  let cssContent = '';
  let jsContent = '';
  
  try {
    cssContent = fs.readFileSync(stylesPath.fsPath, 'utf8');
  } catch (error) {
    console.error('Failed to load webview CSS:', error);
    cssContent = '/* Error loading styles */';
  }
  
  try {
    jsContent = fs.readFileSync(scriptPath.fsPath, 'utf8');
  } catch (error) {
    console.error('Failed to load webview JS:', error);
    jsContent = 'console.error("Failed to load webview JavaScript");';
  }
  
  // Add custom CSS and JS if provided
  if (mergedConfig.customCSS) {
    cssContent += '\n' + mergedConfig.customCSS;
  }
  
  if (mergedConfig.customJS) {
    jsContent += '\n' + mergedConfig.customJS;
  }
  
  // Generate the HTML content
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(mergedConfig.title)}</title>
    <style>${cssContent}</style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h2>⚔️😈 RayDaemon</h2>
      </div>
      
      <div class="chat-container">
        <div id="chatMessages" class="chat-messages"></div>
        
        <div id="typingIndicator" class="typing-indicator">
          RayDaemon is thinking
          <div class="typing-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
        
        ${mergedConfig.showChatInput ? `
        <div class="chat-input-container">
          <div class="input-wrapper">
            <div class="input-context">
              <div class="context-icon">@</div>
              <span class="context-file">RayDaemon</span>
            </div>
            <div class="input-main">
              <!-- Row 2: Text Input (Full Width) -->
              <div class="input-text-row">
                <textarea 
                  id="chatInput" 
                  placeholder="Plan, search, build anything" 
                  rows="1"
                  ${!mergedConfig.showChatInput ? 'disabled' : ''}
                ></textarea>
              </div>
              
              <!-- Row 3: Controls (Agent, Auto, Icons) -->
              <div class="input-controls-row">
                <div class="input-controls">
                  <button class="control-button">
                    <span>∞ Agent</span>
                    <svg class="dropdown-arrow" viewBox="0 0 12 12" fill="currentColor">
                      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </button>
                  <button class="control-button">
                    <span>Auto</span>
                    <svg class="dropdown-arrow" viewBox="0 0 12 12" fill="currentColor">
                      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </button>
                </div>
                <div class="input-actions">
                  <button class="action-button" title="Attach file">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.64 16.2a2 2 0 0 1-2.83-2.83l8.49-8.49"/>
                    </svg>
                  </button>
                  <button id="sendButton" ${!mergedConfig.showChatInput ? 'disabled' : ''}>
                    <div class="send-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22 2L11 13" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        ` : ''}
      </div>
      
      ${mergedConfig.showStatusBar ? `
      <div class="footer">
        <div id="statusBar" class="status-bar">
          <div class="status-indicator"></div>
          <span>${escapeHtml(mergedConfig.initialStatus)}</span>
        </div>
      </div>
      ` : ''}
      
      <script>
        // Expose VS Code API
        const vscode = acquireVsCodeApi();
        
        // Add the main JavaScript
        ${jsContent}
      </script>
    </body>
  </html>`;
}
