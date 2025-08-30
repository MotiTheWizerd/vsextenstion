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
      // Reset cancellation state for new user message
      const { CommandExecutorRegistry } = require("../extension_utils/commandExecutorRegistry");
      const executor = CommandExecutorRegistry.getInstance().getCommandExecutor();
      if (executor) {
        executor.resetCancellationForNewMessage();
      }
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
        
        // Add assistant response to history
        const { SessionManager } = require("../utils/sessionManager");
        SessionManager.getInstance().addMessageToHistory("assistant", response);
        
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
              // Ensure we have an active chat session
              const { SessionManager } = require("../utils/sessionManager");
              const sessionManager = SessionManager.getInstance();
              const sessionInfo = sessionManager.getSessionInfo();
              
              console.log("[RayDaemon] Current session info:", sessionInfo);
              
              // Check if this session exists in history
              const existingSession = sessionManager.loadChatSession(sessionInfo.chatId);
              console.log("[RayDaemon] Existing session found:", !!existingSession);
              
              if (!existingSession) {
                console.log("[RayDaemon] Creating new chat session with first message");
                sessionManager.startNewChat(message.message);
              } else {
                console.log("[RayDaemon] Using existing session, adding message to history");
                // Add message to history
                sessionManager.addMessageToHistory("user", message.message);
              }
              
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

          case "getChatHistory":
            console.log("[RayDaemon] Received getChatHistory command");
            try {
              const { SessionManager } = require("../utils/sessionManager");
              const sessionManager = SessionManager.getInstance();
              const chatHistory = sessionManager.getChatHistory();
              console.log("[RayDaemon] Retrieved chat history:", chatHistory);
              
              this._view?.webview.postMessage({
                type: "chatHistory",
                data: chatHistory
              });
              console.log("[RayDaemon] Sent chat history to webview");
            } catch (error) {
              console.error("[RayDaemon] Error getting chat history:", error);
              if (error instanceof Error) {
                console.error("[RayDaemon] Error stack:", error.stack);
              }
            }
            break;

          case "loadChatSession":
            const sessionId = message.sessionId || message.chatId;
            console.log("[RayDaemon] Received loadChatSession command with sessionId:", sessionId);
            console.log("[RayDaemon] Full message object:", message);
            try {
              const { SessionManager } = require("../utils/sessionManager");
              const sessionManager = SessionManager.getInstance();
              console.log("[RayDaemon] Calling sessionManager.loadChatSession with:", sessionId);
              const session = sessionManager.loadChatSession(sessionId);
              console.log("[RayDaemon] SessionManager returned:", session);
              
              if (session) {
                console.log(`[RayDaemon] Loaded session with ${session.messages ? session.messages.length : 0} messages`);
                console.log("[RayDaemon] Session structure:", {
                  id: session.id,
                  name: session.name,
                  messageCount: session.messages ? session.messages.length : 0,
                  hasMessages: !!session.messages
                });
                
                // Set this as the current active session
                console.log("[RayDaemon] Setting loaded session as current active session");
                
                this._view?.webview.postMessage({
                  type: "loadChatSession",
                  data: session
                });
                
                console.log("[RayDaemon] Sent session data to webview");
              } else {
                console.log("[RayDaemon] Session not found:", sessionId);
                console.log("[RayDaemon] Available sessions:", sessionManager.getChatHistory().map((s: any) => s.id));
              }
            } catch (error) {
              console.error("[RayDaemon] Error loading chat session:", error);
              if (error instanceof Error) {
                console.error("[RayDaemon] Error stack:", error.stack);
              }
            }
            break;

          case "deleteChatSession":
            console.log("[RayDaemon] Received deleteChatSession command:", message.sessionId);
            try {
              const { SessionManager } = require("../utils/sessionManager");
              const success = SessionManager.getInstance().deleteChatSession(message.sessionId);
              if (success) {
                console.log("[RayDaemon] Chat session deleted successfully");
              }
            } catch (error) {
              console.error("[RayDaemon] Error deleting chat session:", error);
            }
            break;

          case "startNewChat":
            console.log("[RayDaemon] Received startNewChat command");
            try {
              const { SessionManager } = require("../utils/sessionManager");
              const newChatId = SessionManager.getInstance().startNewChat();
              console.log("[RayDaemon] Started new chat session:", newChatId);
              
              // Clear the UI
              this._view?.webview.postMessage({
                command: "clearChat"
              });
              
              console.log("[RayDaemon] Sent clearChat command to webview");
            } catch (error) {
              console.error("[RayDaemon] Error starting new chat:", error);
            }
            break;

          case "webviewReady":
            console.log("[RayDaemon] Webview ready, initializing chat session");
            try {
              const { SessionManager } = require("../utils/sessionManager");
              const sessionManager = SessionManager.getInstance();
              
              // Ensure we have a project and chat session
              const sessionInfo = sessionManager.getSessionInfo();
              console.log("[RayDaemon] Current session info:", sessionInfo);
              
              // Send initial state to webview if needed
              this._view?.webview.postMessage({
                type: "sessionReady",
                data: sessionInfo
              });
            } catch (error) {
              console.error("[RayDaemon] Error initializing session:", error);
            }
            break;
          case "cancelAgent":
            try {
              const { cancelAgent } = require("../api/agent");
              const { CommandExecutorRegistry } = require("../extension_utils/commandExecutorRegistry");
              
              // Cancel both server-side and local tool execution
              const result = await cancelAgent();
              CommandExecutorRegistry.getInstance().cancelCurrentExecution();
              
              // Reset UI state
              this._view?.webview.postMessage({ command: "showTyping", typing: false });
              
              // Show cancellation status if no tools are executing (fallback for regular conversations)
              const { isActiveToolExecution } = require("../rayLoop");
              if (!isActiveToolExecution()) {
                this._view?.webview.postMessage({
                  type: "toolStatus",
                  data: {
                    status: "cancelled",
                    tools: ["Request"],
                    totalCount: 1,
                    description: "Request canceled by user",
                    timestamp: new Date().toISOString(),
                    category: "default"
                  }
                });
              }
            } catch (err) {
              console.error("[RayDaemon] Cancel request failed:", err);
              this._view?.webview.postMessage({
                command: "chatError",
                error: "Failed to send cancel request.",
              });
            }
            break;
          default:
            console.log(`[RayDaemon] Unhandled command: ${message.command}`);
            break;
        }
      }
    });

    // No longer setting global currentPanel; sidebar view is deprecated.
  }
}
