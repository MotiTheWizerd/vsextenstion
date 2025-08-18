import { WebviewConfig } from "../WebviewContent";
import { escapeHtml } from "./utils";

/**
 * Get the HTML content for the webview
 * @param config - Configuration for the webview
 * @param cssContent - The CSS content
 * @param jsContent - The JavaScript content
 * @returns The HTML content
 */
export function getHtml(config: Required<WebviewConfig>, cssContent: string, jsContent: string): string {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(config.title)}</title>
  <style>${cssContent}</style>
  </head>
  <body>
    <div class="container">
      <div class="custom-panel-header">
        <div class="custom-panel-title">
          <span>Agent Tab</span>
        </div>
        <div class="custom-panel-actions">
          <button class="custom-panel-action codicon-gear" title="Settings"></button>
          <button class="custom-panel-action codicon-ellipsis" title="More Actions"></button>
        
        </div>
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
        
        ${
          config.showChatInput
            ? `
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
                  ${!config.showChatInput ? "disabled" : ""}
                ></textarea>
              </div>
              
              <!-- Row 3: Controls (Agent, Auto, Icons) -->
              <div class="input-controls-row">
                <div class="input-controls">
                  <div class="dropdown">
                    <button class="control-button dropdown-toggle" id="agentDropdown" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                      <span>∞ Agent</span>
                      <svg class="dropdown-arrow" viewBox="0 0 12 12" fill="currentColor">
                        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </button>
                    <div class="dropdown-menu" aria-labelledby="agentDropdown">
                      <button class="dropdown-item" data-value="agent">
                        <span>Agent</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                          <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                      </button>
                      <button class="dropdown-item" data-value="chat">
                        <span>Chat</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
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
                  <button id="sendButton" ${
                    !config.showChatInput ? "disabled" : ""
                  }>
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
        `
            : ""
        }
      </div>
      
      ${
        config.showStatusBar
          ? `
      <div class="footer">
        <div id="statusBar" class="status-bar">
          <div class="status-indicator"></div>
          <span>${escapeHtml(config.initialStatus)}</span>
        </div>
      </div>
      `
          : ""
      }
      
      <script>
        // Expose VS Code API
        const vscode = acquireVsCodeApi();
        
        // Add the main JavaScript
        ${jsContent}
      </script>
    </body>
  </html>`;
}
