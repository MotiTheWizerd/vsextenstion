import * as vscode from "vscode";
import { getWebviewContent } from "./WebviewContent";

export class RayDaemonViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "rayDaemonDummyView";
  private _context: vscode.ExtensionContext;
  private _view?: vscode.WebviewView;

  private async handleChatMessage(message: string) {
    console.log("[RayDaemon] handleChatMessage called with message:", message);
    if (!this._view) {
      console.log("[RayDaemon] _view is not defined, returning.");
      return;
    }

    try {
      // Show typing indicator
      console.log("[RayDaemon] Posting showTypingIndicator to webview.");
      this._view.webview.postMessage({
        type: "showTypingIndicator",
      });

      // Process the message (you would add your chat logic here)
      console.log("[RayDaemon] Calling processMessage with:", message);
      const response = await this.processMessage(message);

      // Hide typing indicator
      console.log("[RayDaemon] Posting hideTypingIndicator to webview.");
      this._view.webview.postMessage({
        type: "hideTypingIndicator",
      });

      // Only send addMessage if the response wasn't already handled by processRayResponse
      if (response && !response.includes("__RAY_RESPONSE_HANDLED__:")) {
        console.log(
          "[RayDaemon] Posting addMessage to webview with response:",
          response,
        );
        this._view.webview.postMessage({
          type: "addMessage",
          role: "assistant",
          content: response,
        });
      } else {
        console.log(
          "[RayDaemon] Response already handled by processRayResponse, skipping addMessage",
        );
      }
    } catch (error) {
      console.error(
        "[RayDaemon] Error processing message in handleChatMessage:",
        error,
      );

      // Hide typing indicator
      this._view.webview.postMessage({
        type: "hideTypingIndicator",
      });

      // Show error in chat
      this._view.webview.postMessage({
        type: "error",
        message: "Sorry, there was an error processing your message.",
      });
    }
  }

  private async processMessage(message: string): Promise<string> {
    console.log("[RayDaemon] processMessage called with message:", message);
    // Send the message to Ray API via rayLoop
    const { sendToRayLoop } = require("../rayLoop");
    try {
      const response = await sendToRayLoop(message);
      console.log("[RayDaemon] Ray API response:", response);
      return response;
    } catch (error) {
      console.error("[RayDaemon] Error sending message to Ray API:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return `Error: Failed to send message to Ray API. ${errorMessage}`;
    }
  }

  constructor(context: vscode.ExtensionContext) {
    console.log("[RayDaemon] RayDaemonViewProvider constructor called.");
    this._context = context;

    this._context.subscriptions.push(
      vscode.commands.registerCommand(
        "raydaemon.showChatInterface",
        async () => {
          if (this._view) {
            // Make the view visible
            this._view.show(true);

            // Send message to webview to show chat interface
            this._view.webview.postMessage({
              type: "showChatInterface",
              data: { show: true },
            });
          }
        },
      ),
    );
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    console.log("[RayDaemon] Resolving webview view");
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(this._context.extensionPath)],
    };

    const webviewConfig = {
      title: "RayDaemon Control Panel",
      showStatusBar: true,
      initialStatus: "Ready",
      showChatInput: true,
      customCSS: "",
      customJS: "",
    };

    try {
      webviewView.webview.html = getWebviewContent(
        webviewView.webview,
        this._context,
        webviewConfig,
      );
      console.log("[RayDaemon] Webview content set successfully");
    } catch (error) {
      console.error("[RayDaemon] Failed to set webview content:", error);
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
      console.log("[RayDaemon] Received message from webview:", message);

      // Forward messages with 'type' property directly to the webview's message handler
      if (message.type) {
        console.log(
          `[RayDaemon] Forwarding message of type '${message.type}' to webview handler`,
        );
        webviewView.webview.postMessage(message);
        return;
      }

      // Handle command messages
      if (message.command) {
        switch (message.command) {
          case "openFile":
            if (message.filePath) {
              try {
                const uri = vscode.Uri.file(message.filePath);
                const doc = await vscode.workspace.openTextDocument(uri);
                await vscode.window.showTextDocument(doc, {
                  preserveFocus: false,
                  preview: false,
                });
              } catch (error) {
                console.error("Failed to open file:", error);
                vscode.window.showErrorMessage(
                  `Failed to open file: ${message.filePath}`,
                );
              }
            }
            break;

          case "openSettings":
            await vscode.commands.executeCommand(
              "workbench.action.openSettings",
              "@ext:raydaemon",
            );
            break;

          case "showMoreActions":
            // Implement more actions menu
            break;

          case "maximizePanel":
            await vscode.commands.executeCommand(
              "workbench.action.toggleMaximizedPanel",
            );
            break;

          case "closePanel":
            if (this._view) {
              await vscode.commands.executeCommand(
                "workbench.action.closePanel",
              );
            }
            break;

          case "sendMessage":
            console.log(
              "[RayDaemon] Received sendMessage command with message:",
              message.message,
            );
            if (message.message) {
              // Handle chat message from user
              console.log(
                "[RayDaemon] Calling handleChatMessage with:",
                message.message,
              );
              this.handleChatMessage(message.message);
            } else {
              console.log(
                "[RayDaemon] No message content in sendMessage command",
              );
            }
            break;
          default:
            console.log(`[RayDaemon] Unhandled command: ${message.command}`);
            break;
        }
      }
    });

    // Expose a small wrapper so existing code that expects a WebviewPanel-like
    // global `currentPanel` with a `webview.postMessage` API continues to work.
    (global as any).currentPanel = {
      webview: webviewView.webview,
      reveal: async () => {
        // Reveal the activity bar container where this view lives
        await vscode.commands.executeCommand(
          "workbench.view.extension.rayDaemonContainer",
        );
      },
      dispose: () => {
        console.log("disposing current panek ");
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
