import * as vscode from "vscode";
import { getWebviewContent } from "../ui/WebviewContent";
import { handleCommand } from "./commandHandler";
import { config } from "../config";

export function registerCommands(context: vscode.ExtensionContext) {
  // Register hello world command
  context.subscriptions.push(
    vscode.commands.registerCommand("raydaemon.helloWorld", () => {
      vscode.window.showInformationMessage("Hello World from RayDaemon!");
    })
  );

  // Register open panel command
  context.subscriptions.push(
    vscode.commands.registerCommand("raydaemon.openPanel", () => {
      const panel = vscode.window.createWebviewPanel(
        "rayDaemonPanel",
        "RayDaemon Control",
        vscode.ViewColumn.Two,
        { enableScripts: true }
      );

      // Store panel reference for autonomous messaging
      (global as any).currentPanel = panel;

      // Enable message passing between webview and extension
      panel.webview.onDidReceiveMessage(
        async (message) => {
          switch (message.type || message.command) {
            case "chat":
              const result = await handleCommand(message.content);
              panel.webview.postMessage({
                type: "chat_response",
                content: result,
              });
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
          }
        },
        undefined,
        context.subscriptions
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

      panel.webview.html = getWebviewContent(context, webviewConfig);
    })
  );

  // Register command to handle tree item clicks
  context.subscriptions.push(
    vscode.commands.registerCommand("raydaemon.openFromSidebar", () => {
      vscode.commands.executeCommand("raydaemon.openPanel");
    })
  );
}
