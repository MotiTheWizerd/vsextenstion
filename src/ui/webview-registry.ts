import * as vscode from "vscode";

/**
 * Central registry for the active chat WebviewPanel.
 * Single-primary target: only the chat panel is registered.
 */
class WebviewRegistryImpl {
  private panel: vscode.WebviewPanel | undefined;

  register(panel: vscode.WebviewPanel): void {
    this.panel = panel;
    // Clean up on dispose
    panel.onDidDispose(() => {
      if (this.panel === panel) {
        this.panel = undefined;
      }
    });
  }

  unregister(panel?: vscode.WebviewPanel): void {
    if (!panel || this.panel === panel) {
      this.panel = undefined;
    }
  }

  getPreferred(): vscode.WebviewPanel | undefined {
    return this.panel;
  }

  reveal(column: vscode.ViewColumn = vscode.ViewColumn.Two): void {
    this.panel?.reveal(column);
  }

  postMessage(message: any): Thenable<boolean> | undefined {
    return this.panel?.webview.postMessage(message);
  }
}

export const WebviewRegistry = new WebviewRegistryImpl();

