import * as vscode from 'vscode';
import { getWebviewContent } from './WebviewContent';

export class RayDaemonViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'rayDaemonDummyView';
  private _context: vscode.ExtensionContext;
  private _view?: vscode.WebviewView;
  
  private async handleChatMessage(message: string) {
    if (!this._view) {
      return;
    }
    
    try {
      // Show typing indicator
      this._view.webview.postMessage({
        type: 'showTypingIndicator'
      });
      
      // Process the message (you would add your chat logic here)
      const response = await this.processMessage(message);
      
      // Hide typing indicator
      this._view.webview.postMessage({
        type: 'hideTypingIndicator'
      });
      
      // Send response to webview
      this._view.webview.postMessage({
        type: 'addMessage',
        role: 'assistant',
        content: response
      });
      
    } catch (error) {
      console.error('Error processing message:', error);
      
      // Hide typing indicator
      this._view.webview.postMessage({
        type: 'hideTypingIndicator'
      });
      
      // Show error in chat
      this._view.webview.postMessage({
        type: 'error',
        message: 'Sorry, there was an error processing your message.'
      });
    }
  }
  
  private async processMessage(message: string): Promise<string> {
    // Here you would implement your chat processing logic
    // For now, just echo back the message
    return `You said: ${message}`;
  }

  constructor(context: vscode.ExtensionContext) {
    this._context = context;

    this._context.subscriptions.push(
      vscode.commands.registerCommand('raydaemon.showChatInterface', async () => {
        if (this._view) {
          // Make the view visible
          this._view.show(true);
          
          // Send message to webview to show chat interface
          this._view.webview.postMessage({ 
            type: 'showChatInterface',
            data: { show: true }
          });
        }
      })
    );
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    console.log('[RayDaemon] Resolving webview view');
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(this._context.extensionPath),
      ],
    };

    const webviewConfig = {
      title: 'RayDaemon Control Panel',
      showStatusBar: true,
      initialStatus: 'Ready',
      showChatInput: true,
      customCSS: '',
      customJS: '',
    };

    try {
      webviewView.webview.html = getWebviewContent(webviewView.webview, this._context, webviewConfig);
      console.log('[RayDaemon] Webview content set successfully');
    } catch (error) {
      console.error('[RayDaemon] Failed to set webview content:', error);
      webviewView.webview.html = `
        <html>
          <body>
            <h1>RayDaemon</h1>
            <p>Error loading webview content: ${error}</p>
            <button onclick="vscode.postMessage({command: 'openChatPanel'})">Open Chat Panel</button>
            <script>const vscode = acquireVsCodeApi();</script>
          </body>
        </html>
      `;
    }

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'openFile':
          if (message.filePath) {
            try {
              const uri = vscode.Uri.file(message.filePath);
              const doc = await vscode.workspace.openTextDocument(uri);
              await vscode.window.showTextDocument(doc, {
                preserveFocus: false,
                preview: false
              });
            } catch (error) {
              console.error('Failed to open file:', error);
              vscode.window.showErrorMessage(`Failed to open file: ${message.filePath}`);
            }
          }
          break;

        case 'openSettings':
          await vscode.commands.executeCommand('workbench.action.openSettings', '@ext:raydaemon');
          break;

        case 'showMoreActions':
          // Implement more actions menu
          break;

        case 'maximizePanel':
          await vscode.commands.executeCommand('workbench.action.toggleMaximizedPanel');
          break;

        case 'closePanel':
          if (this._view) {
            await vscode.commands.executeCommand('workbench.action.closePanel');
          }
          break;
          
        case 'openChatPanel':
          await vscode.commands.executeCommand('raydaemon.openChatPanel');
          break;
          
        case 'sendMessage':
          if (message.message) {
            // Handle chat message from user
            this.handleChatMessage(message.message);
          }
          break;
      }
    });

    // Expose a small wrapper so existing code that expects a WebviewPanel-like
    // global `currentPanel` with a `webview.postMessage` API continues to work.
    (global as any).currentPanel = {
      webview: webviewView.webview,
      reveal: async () => {
        // Reveal the activity bar container where this view lives
        await vscode.commands.executeCommand('workbench.view.extension.rayDaemonContainer');
      },
      dispose: () => {
        // No-op: WebviewViews are managed by VS Code. We clear the ref instead.
        (global as any).currentPanel = undefined;
      },
    };
    // When the view is disposed or hidden, clear the global reference
    try {
      webviewView.onDidDispose?.(() => {
        (global as any).currentPanel = undefined;
      });
    } catch (_) {
      // older hosts may not have onDidDispose
    }
  }
}
