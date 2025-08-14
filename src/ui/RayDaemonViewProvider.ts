import * as vscode from 'vscode';
import { getWebviewContent } from './WebviewContent';

export class RayDaemonViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'rayDaemonDummyView';
  private _context: vscode.ExtensionContext;
  private _view?: vscode.WebviewView;

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
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

    webviewView.webview.html = getWebviewContent(this._context, webviewConfig);

    // Optional: handle messages from the webview if needed
    webviewView.webview.onDidReceiveMessage((message) => {
      // forward to extension-level handlers if implemented
      // ...existing message handling can be reused by referencing global handlers
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
