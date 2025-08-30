import * as vscode from "vscode";
import { getWebviewContent } from "../ui/WebviewContent";
import { WebviewRegistry } from "../ui/webview-registry";
import { handleCommand } from "./commandHandler";

export function registerCommands(context: vscode.ExtensionContext) {
  console.log(
    "[RayDaemon] registerCommands() in src/commands/index.ts executed."
  );
  // Register hello world command
  context.subscriptions.push(
    vscode.commands.registerCommand("raydaemon.helloWorld", () => {
      vscode.window.showInformationMessage("Hello World from RayDaemon!");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("raydaemon.openWelcomeView", async () => {
      try {
        // Sidebar view is disabled; redirect to chat panel
        await vscode.commands.executeCommand("raydaemon.openChatPanel");
      } catch (error) {
        console.error("[RayDaemon] Failed to open welcome view:", error);
      }
    })
  );

  // Register open panel command
  context.subscriptions.push(
    vscode.commands.registerCommand("raydaemon.openChatPanel", async () => {
      console.log("[RayDaemon] raydaemon.openChatPanel command executed.");

      // Check if a panel already exists
      const existing = WebviewRegistry.getPreferred();
      if (existing) {
        console.log("[RayDaemon] Panel already exists, revealing it.");
        existing.reveal(vscode.ViewColumn.Two);
        return;
      }
      const panel = vscode.window.createWebviewPanel(
        "rayDaemonPanel",
        "RayDaemon Control",
        { viewColumn: vscode.ViewColumn.Two, preserveFocus: false },
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        }
      );
      console.log("[RayDaemon] WebviewPanel created.");

      // Register panel in the central registry
      WebviewRegistry.register(panel);

      panel.onDidDispose(() => {
        WebviewRegistry.unregister(panel);
      });

      // Enable message passing between webview and extension
      panel.webview.onDidReceiveMessage(
        async (message) => {
          console.log("[RayDaemon] WebviewPanel received message:", message);
          switch (message.type || message.command) {
            case "sendMessage":
              console.log(
                "[RayDaemon] Processing sendMessage with content:",
                message.message
              );

              // Add user message to chat history (Ray will provide session info in response)
              try {
                const { SessionManager } = require("../utils/sessionManager");
                const sessionManager = SessionManager.getInstance();

                console.log("[RayDaemon] Adding user message to chat history");
                // Just add the message - Ray will provide session info in the response
                // and we'll sync the session then
                sessionManager.addMessageToHistory("user", message.message);
              } catch (error) {
                console.error(
                  "[RayDaemon] Error adding user message to chat history:",
                  error
                );
              }

              const result = await handleCommand(message.message);
              // Don't send chat_response if Ray is handling the response
              // Assistant messages are now handled in RayResponseHandler
              if (!result.startsWith("__RAY_RESPONSE_HANDLED__")) {
                panel.webview.postMessage({
                  type: "addMessage",
                  role: "assistant",
                  content: result,
                });
              }
              break;
            case "chat":
              const chatResult = await handleCommand(message.content);
              // Don't send chat_response if Ray is handling the response
              if (!chatResult.startsWith("__RAY_RESPONSE_HANDLED__")) {
                panel.webview.postMessage({
                  type: "chat_response",
                  content: chatResult,
                });
              }
              break;
            case "makeApiCall":
              const apiResult = await vscode.commands.executeCommand(
                "raydaemon.makeApiCall",
                message.request
              );
              panel.webview.postMessage({
                command: "apiCallResult",
                id: message.id,
                result: apiResult,
              });
              break;
            case "agentModeSelected":
              try {
                const mode = message.mode || "agent";
                await context.workspaceState.update(
                  "raydaemon.agentMode",
                  mode
                );
                panel.webview.postMessage({
                  type: "statusUpdate",
                  content: `Mode: ${mode}`,
                });
              } catch (e) {
                console.error("[RayDaemon] Failed to set agent mode:", e);
              }
              break;
            case "openFile":
              if (message.filePath) {
                try {
                  const uri = vscode.Uri.file(message.filePath);
                  await vscode.window.showTextDocument(uri, {
                    viewColumn: vscode.ViewColumn.One,
                    preview: false,
                  });
                } catch (error) {
                  console.error("[RayDaemon] Failed to open file:", error);
                  vscode.window.showErrorMessage(
                    `Failed to open file: ${message.filePath}`
                  );
                }
              }
              break;
            case "showDiff":
              if (message.filePath) {
                try {
                  // Use VS Code's built-in diff command
                  await vscode.commands.executeCommand(
                    "vscode.diff",
                    vscode.Uri.file(message.filePath + ".backup"), // Original file (if backup exists)
                    vscode.Uri.file(message.filePath), // Modified file
                    `${message.filePath.split(/[/\\]/).pop()} (Changes)` // Title
                  );
                } catch (error) {
                  console.error("[RayDaemon] Failed to show diff:", error);
                  // Fallback: just open the file
                  try {
                    const uri = vscode.Uri.file(message.filePath);
                    await vscode.window.showTextDocument(uri, {
                      viewColumn: vscode.ViewColumn.One,
                      preview: false,
                    });
                  } catch (fallbackError) {
                    vscode.window.showErrorMessage(
                      `Failed to show diff or open file: ${message.filePath}`
                    );
                  }
                }
              }
              break;
            case "cancelAgent":
              try {
                const { cancelAgent } = require("../api/agent");
                const {
                  CommandExecutorRegistry,
                } = require("../extension_utils/commandExecutorRegistry");

                // Cancel both server-side and local tool execution
                const result = await cancelAgent();
                CommandExecutorRegistry.getInstance().cancelCurrentExecution();

                // Reset UI state
                panel.webview.postMessage({
                  command: "showTyping",
                  typing: false,
                });

                // Show cancellation status if no tools are executing (fallback for regular conversations)
                const { isActiveToolExecution } = require("../rayLoop");
                if (!isActiveToolExecution()) {
                  panel.webview.postMessage({
                    type: "toolStatus",
                    data: {
                      status: "cancelled",
                      tools: ["Request"],
                      totalCount: 1,
                      description: "Request canceled by user",
                      timestamp: new Date().toISOString(),
                      category: "default",
                    },
                  });
                }
              } catch (err) {
                console.error("[RayDaemon] Cancel request failed:", err);
                panel.webview.postMessage({
                  command: "chatError",
                  error: "Failed to send cancel request.",
                });
              }
              break;

            case "getChatHistory":
              console.log("[RayDaemon] Received getChatHistory command");
              try {
                const { SessionManager } = require("../utils/sessionManager");
                const sessionManager = SessionManager.getInstance();
                const chatHistory = sessionManager.getChatHistory();
                console.log("[RayDaemon] Retrieved chat history:", chatHistory);

                panel.webview.postMessage({
                  type: "chatHistory",
                  data: chatHistory,
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
              console.log(
                "[RayDaemon] Received loadChatSession command:",
                message.sessionId
              );
              try {
                const { SessionManager } = require("../utils/sessionManager");
                const session = SessionManager.getInstance().loadChatSession(
                  message.sessionId
                );
                if (session) {
                  panel.webview.postMessage({
                    type: "loadChatSession",
                    data: session,
                  });
                }
              } catch (error) {
                console.error("[RayDaemon] Error loading chat session:", error);
              }
              break;

            case "deleteChatSession":
              console.log(
                "[RayDaemon] Received deleteChatSession command:",
                message.sessionId
              );
              try {
                const { SessionManager } = require("../utils/sessionManager");
                const success = SessionManager.getInstance().deleteChatSession(
                  message.sessionId
                );
                if (success) {
                  console.log("[RayDaemon] Chat session deleted successfully");
                }
              } catch (error) {
                console.error(
                  "[RayDaemon] Error deleting chat session:",
                  error
                );
              }
              break;

            case "startNewChat":
              console.log("[RayDaemon] Received startNewChat command");
              try {
                const { SessionManager } = require("../utils/sessionManager");
                const newChatId = SessionManager.getInstance().startNewChat();
                console.log("[RayDaemon] Started new chat session:", newChatId);
              } catch (error) {
                console.error("[RayDaemon] Error starting new chat:", error);
              }
              break;

            case "webviewReady":
              console.log(
                "[RayDaemon] Webview ready, initializing chat session"
              );
              try {
                const { SessionManager } = require("../utils/sessionManager");
                const sessionManager = SessionManager.getInstance();

                // Ensure we have a project and chat session
                const sessionInfo = sessionManager.getSessionInfo();
                console.log("[RayDaemon] Current session info:", sessionInfo);

                // Send initial state to webview if needed
                panel.webview.postMessage({
                  type: "sessionReady",
                  data: sessionInfo,
                });
              } catch (error) {
                console.error("[RayDaemon] Error initializing session:", error);
              }
              break;
          }
        },
        undefined,
        context.subscriptions
      );

      // Create webview configuration
      const webviewConfig = {
        title: "RayDaemon Control Panel",
        showStatusBar: true,
        initialStatus: "", // No longer used - replaced with action bar
        showChatInput: true,
        customCSS: "",
        customJS: "",
      };

      panel.webview.html = getWebviewContent(
        panel.webview,
        context,
        webviewConfig
      );

      // Lock the chat editor group to avoid other tabs opening into it,
      // then return focus to the first editor group.
      try {
        await vscode.commands.executeCommand(
          "workbench.action.lockEditorGroup"
        );
      } catch (e) {
        console.log("[RayDaemon] lockEditorGroup not available, skipping.");
      }
      try {
        await vscode.commands.executeCommand(
          "workbench.action.focusFirstEditorGroup"
        );
      } catch (e) {
        // ignore if not available
      }
    })
  );

  // Register command to handle tree item clicks
  context.subscriptions.push(
    vscode.commands.registerCommand("raydaemon.openFromSidebar", () => {
      vscode.commands.executeCommand("raydaemon.openChatPanel");
    })
  );
}
