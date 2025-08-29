import * as vscode from "vscode";
import { getWebviewContent } from "../ui/WebviewContent";
import { WebviewRegistry } from "../ui/webview-registry";
import { handleCommand } from "./commandHandler";

export function registerCommands(context: vscode.ExtensionContext) {
  console.log(
    "[RayDaemon] registerCommands() in src/commands/index.ts executed.",
  );
  // Register hello world command
  context.subscriptions.push(
    vscode.commands.registerCommand("raydaemon.helloWorld", () => {
      vscode.window.showInformationMessage("Hello World from RayDaemon!");
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("raydaemon.openWelcomeView", async () => {
      try {
        // Sidebar view is disabled; redirect to chat panel
        await vscode.commands.executeCommand("raydaemon.openChatPanel");
      } catch (error) {
        console.error("[RayDaemon] Failed to open welcome view:", error);
      }
    }),
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
        },
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
                message.message,
              );
              const result = await handleCommand(message.message);
              // Don't send chat_response if Ray is handling the response
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
                message.request,
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
                await context.workspaceState.update("raydaemon.agentMode", mode);
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
                    `Failed to open file: ${message.filePath}`,
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
                    `${message.filePath.split(/[/\\]/).pop()} (Changes)`, // Title
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
                      `Failed to show diff or open file: ${message.filePath}`,
                    );
                  }
                }
              }
              break;
          }
        },
        undefined,
        context.subscriptions,
      );

      // Create webview configuration
      const webviewConfig = {
        title: "RayDaemon Control Panel",
        showStatusBar: true,
        initialStatus: "Connected to RayDaemon",
        showChatInput: true,
        customCSS: "",
        customJS: "",
      };

      panel.webview.html = getWebviewContent(
        panel.webview,
        context,
        webviewConfig,
      );

      // Lock the chat editor group to avoid other tabs opening into it,
      // then return focus to the first editor group.
      try {
        await vscode.commands.executeCommand("workbench.action.lockEditorGroup");
      } catch (e) {
        console.log("[RayDaemon] lockEditorGroup not available, skipping.");
      }
      try {
        await vscode.commands.executeCommand("workbench.action.focusFirstEditorGroup");
      } catch (e) {
        // ignore if not available
      }
    }),
  );

  // Register command to handle tree item clicks
  context.subscriptions.push(
    vscode.commands.registerCommand("raydaemon.openFromSidebar", () => {
      vscode.commands.executeCommand("raydaemon.openChatPanel");
    }),
  );
}

