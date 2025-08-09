import * as vscode from "vscode";
import * as http from "http";
import * as https from "https";
import * as path from "path";
import { config } from "./config";
import { registerCommands } from "./commands";
import { handleCommand } from "./commands/commandHandler";
import { RayDaemonTreeProvider } from "./treeView";
import { logInfo, logError } from "./logging";
import { getWebviewContent } from "./ui/WebviewContent";
import {
  createExecuteCommandFactory,
  RayResponsePayload,
} from "./commands/execFactory";
import { commandHandlers } from "./commands/commandHandler"; // ensure it's exported
// Global state
let daemonInterval: NodeJS.Timeout | undefined;
let rayWebhookServer: http.Server | undefined;
let currentPanel: vscode.WebviewPanel | undefined;

// Handle responses from Ray
function handleRayPostResponse(rayResponse: any): void {
  console.log(
    "[RayDaemon] handleRayPostResponse called with:",
    JSON.stringify(rayResponse, null, 2)
  );

  if (!rayResponse) {
    logError("Empty response received");
    return;
  }

  // Treat payload as RayResponsePayload for clarity
  const payload = rayResponse as RayResponsePayload;

  // 1) Working status passthrough (unchanged)
  if (payload.status === "start working" || payload.status === "working") {
    logInfo("Ray is starting to work, showing working message to user");
    if (currentPanel) {
      currentPanel.webview.postMessage({
        type: "rayResponse",
        data: {
          content:
            "🔄 **Ray is working on your request...** \n\nPlease wait while Ray processes your message. You'll receive the response shortly.",
          isFinal: false,
          isWorking: true,
        },
      });
    }
    return;
  }

  // 2) Extract text content (unchanged)
  let content = "";
  if (payload.message) {
    content = payload.message;
  } else if (payload.content) {
    content = payload.content;
  } else {
    logError("No message or content in response:", payload);
    return;
  }

  const isFinal =
    typeof payload.is_final === "string"
      ? payload.is_final === "true"
      : !!payload.is_final;

  logInfo("Forwarding Ray response to chat panel:", content);

  if (!currentPanel) {
    logError("No active chat panel to display message");
    vscode.window.showErrorMessage(
      "No active chat panel. Please open the RayDaemon panel first using the command palette (Ctrl+Shift+P > RayDaemon: Open Panel)"
    );
    return;
  }

  try {
    // 3) Send the chat text to the webview (unchanged)
    const rayResponseMessage = {
      type: "rayResponse",
      data: { content, isFinal },
    };
    logInfo("Sending rayResponse message:", rayResponseMessage);
    currentPanel.webview.postMessage(rayResponseMessage);

    // 4) NEW: Execute tool calls if provided
    if (
      Array.isArray(payload.command_calls) &&
      payload.command_calls.length > 0
    ) {
      logInfo(
        `[Ray][command_calls] executing ${payload.command_calls.length} call(s)…`
      );
      logInfo(
        `[Ray][command_calls] available commands:`,
        Object.keys(commandHandlers)
      );
      logInfo(`[Ray][command_calls] received calls:`, payload.command_calls);

      // Debug: Log the raw JSON to see if underscores are preserved
      console.log(
        "[Ray][command_calls] Raw JSON payload:",
        JSON.stringify(payload.command_calls, null, 2)
      );

      // Create the executor factory here to ensure commandHandlers is fully loaded
      const { executeBatch } = createExecuteCommandFactory(commandHandlers);

      // Execute immediately with proper error handling
      (async () => {
        try {
          logInfo("[Ray][command_calls] Starting execution...");
          const batch = await executeBatch(payload.command_calls, {
            stopOnError: false,
          });
          logInfo("[Ray][command_calls] results:", batch);

          // Format and send command results to chat
          if (batch.anyExecuted && batch.results.length > 0) {
            const resultMessages = batch.results.map((result) => {
              // Debug: Log the actual args to see if underscores are preserved
              console.log("[Ray][command_calls] Result args:", result.args);

              // Use code blocks to preserve exact formatting including underscores
              const argsText = result.args.join(" ");

              if (result.ok) {
                return `✅ **${result.command}** \`${argsText}\`\n${
                  result.output || "Command executed successfully"
                }`;
              } else {
                return `❌ **${result.command}** \`${argsText}\`\n**Error:** ${result.error}`;
              }
            });

            const commandResultsMessage = `\n---\n**🔧 Command Execution Results:**\n\n${resultMessages.join(
              "\n\n"
            )}`;

            // Send command results as a separate chat message
            currentPanel?.webview.postMessage({
              type: "rayResponse",
              data: {
                content: commandResultsMessage,
                isFinal: false,
                isCommandResult: true,
              },
            });
          }

          // Also forward raw results to UI for debugging
          currentPanel?.webview.postMessage({
            type: "rayCommandResults",
            data: batch,
          });
        } catch (err) {
          logError("[Ray][command_calls] batch error:", err);

          // Send error message to chat
          const errorMessage = `\n---\n**❌ Command Execution Error:**\n\n${String(
            err
          )}`;
          currentPanel?.webview.postMessage({
            type: "rayResponse",
            data: {
              content: errorMessage,
              isFinal: false,
              isCommandResult: true,
            },
          });

          currentPanel?.webview.postMessage({
            type: "rayCommandResults",
            data: { anyExecuted: false, results: [], error: String(err) },
          });
        }
      })();
    }
  } catch (error) {
    logError("Error sending message to webview:", error);
  }
}

// Start webhook server for Ray to POST back to
function startRayWebhookServer(): void {
  if (rayWebhookServer) {
    logInfo("Webhook server already running");
    return;
  }

  const port = config.webhookPort || 3001; // Default to port 3001 if not configured

  rayWebhookServer = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      // Health check endpoint
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ status: "ok", timestamp: new Date().toISOString() })
      );
      return;
    }

    if (req.method === "POST" && req.url === "/ray-response") {
      let body = "";

      req.on("data", (chunk: Buffer) => {
        body += chunk.toString();
      });

      req.on("end", () => {
        try {
          const data = JSON.parse(body);
          handleRayPostResponse(data);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "received" }));
        } catch (error) {
          logError("Error processing webhook:", error);
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid request" }));
        }
      });
    } else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    }
  });

  rayWebhookServer.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      const errorMsg = `Port ${port} is already in use. Please free the port and restart the extension.`;
      logError(errorMsg);
      vscode.window.showErrorMessage(errorMsg);
    } else {
      logError("Webhook server error:", error);
    }
  });

  rayWebhookServer.listen(port, "0.0.0.0", () => {
    logInfo(`Webhook server running on port ${port}`);
  });
}

// Start the Ray daemon
function startRayDaemon(): void {
  if (daemonInterval) {
    logInfo("Daemon already running");
    return;
  }

  logInfo("Starting Ray daemon...");

  // Start the daemon interval
  daemonInterval = setInterval(() => {
    logInfo("Daemon heartbeat");
  }, 60000); // Run every minute

  // Start the webhook server
  startRayWebhookServer();
}

// Stop the Ray daemon
function stopRayDaemon(): void {
  if (daemonInterval) {
    clearInterval(daemonInterval);
    daemonInterval = undefined;
    logInfo("Daemon stopped");
  }

  if (rayWebhookServer) {
    rayWebhookServer.close();
    rayWebhookServer = undefined;
    logInfo("Webhook server stopped");
  }

  // Clear the global panel reference
  (global as any).currentPanel = undefined;
}

// API Client for making web requests
class ApiClient {
  static async makeRequest(
    url: string,
    method: string = "GET",
    headers: Record<string, string> = {},
    body?: string
  ): Promise<{ status: number; data: any; headers: any }> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === "https:";
      const client = isHttps ? https : http;

      const requestHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "RayDaemon-VSCode-Extension/1.0.0",
        ...headers,
      };

      if (body && method.toUpperCase() !== "GET") {
        requestHeaders["Content-Length"] = Buffer.byteLength(body).toString();
      }

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: method.toUpperCase(),
        headers: requestHeaders,
      };

      const req = client.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          try {
            const parsedData = data ? JSON.parse(data) : {};
            resolve({
              status: res.statusCode || 0,
              data: parsedData,
              headers: res.headers,
            });
          } catch (error) {
            resolve({
              status: res.statusCode || 0,
              data: data,
              headers: res.headers,
            });
          }
        });
      });

      req.on("error", (error) => {
        reject(error);
      });

      if (body && method.toUpperCase() !== "GET") {
        req.write(body);
      }

      req.end();
    });
  }

  static async get(url: string, headers?: Record<string, string>) {
    return this.makeRequest(url, "GET", headers);
  }

  static async post(url: string, data?: any, headers?: Record<string, string>) {
    const body = data ? JSON.stringify(data) : undefined;
    return this.makeRequest(url, "POST", headers, body);
  }

  static async put(url: string, data?: any, headers?: Record<string, string>) {
    const body = data ? JSON.stringify(data) : undefined;
    return this.makeRequest(url, "PUT", headers, body);
  }

  static async delete(url: string, headers?: Record<string, string>) {
    return this.makeRequest(url, "DELETE", headers);
  }
}

class RayDaemonItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly tooltip: string,
    commandId?: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.tooltip = tooltip;
    if (commandId) {
      this.command = {
        command: commandId,
        title: "Open Panel",
        arguments: [],
      };
    }
  }
}

// This file is the main entry point for the RayDaemon VS Code extension.
// It handles the extension's activation and deactivation, and sets up the
// necessary commands and webview panels for the UI.

export function activate(context: vscode.ExtensionContext) {
  console.log("[RayDaemon] Extension activated.");
  startRayDaemon();

  context.subscriptions.push(
    vscode.commands.registerCommand("raydaemon.helloWorld", () => {
      vscode.window.showInformationMessage("Hello World from RayDaemon!");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("raydaemon.openPanel", () => {
      const panel = vscode.window.createWebviewPanel(
        "rayDaemonPanel",
        "RayDaemon Control",
        vscode.ViewColumn.Two,
        { enableScripts: true }
      );

      // Store panel reference for autonomous messaging
      currentPanel = panel;

      // Handle panel disposal
      panel.onDidDispose(
        () => {
          currentPanel = undefined;
        },
        null,
        context.subscriptions
      );

      // Enable message passing between webview and extension
      panel.webview.onDidReceiveMessage(
        async (message) => {
          switch (message.type || message.command) {
            case "chat":
              try {
                const result = await handleCommand(message.content);
                panel.webview.postMessage({
                  type: "chat_response",
                  content: result,
                });
              } catch (error) {
                logError("Error handling chat command:", error);
                panel.webview.postMessage({
                  command: "chatError",
                  error:
                    error instanceof Error ? error.message : "Unknown error",
                });
              }
              break;
            case "makeApiCall":
              try {
                const apiResult = await vscode.commands.executeCommand(
                  "raydaemon.makeApiCall",
                  message.request
                );
                panel.webview.postMessage({
                  command: "apiCallResult",
                  id: message.id,
                  result: apiResult,
                });
              } catch (error) {
                logError("Error handling API call command:", error);
                panel.webview.postMessage({
                  command: "apiCallError",
                  id: message.id,
                  error:
                    error instanceof Error ? error.message : "Unknown error",
                });
              }
              break;
          }
        },
        undefined,
        context.subscriptions
      );

      // Create webview configuration
      const webviewConfig = {
        showStatusBar: true,
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(context.extensionPath, "media")),
          vscode.Uri.file(path.join(context.extensionPath, "out/compiled")),
        ],
      };

      panel.webview.html = getWebviewContent(context, webviewConfig);
    })
  );

  // Create a tree data provider for the sidebar view
  const treeDataProvider = new RayDaemonTreeProvider();
  vscode.window.registerTreeDataProvider(
    "rayDaemonDummyView",
    treeDataProvider
  );

  // Register command to handle tree item clicks
  context.subscriptions.push(
    vscode.commands.registerCommand("raydaemon.openFromSidebar", () => {
      vscode.commands.executeCommand("raydaemon.openPanel");
    })
  );

  // Register API call command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "raydaemon.makeApiCall",
      async (request) => {
        try {
          const { url, method, headers, body } = request;
          console.log(`[RayDaemon] Making API call: ${method} ${url}`);

          const response = await ApiClient.makeRequest(
            url,
            method,
            headers,
            body
          );

          console.log(`[RayDaemon] API Response: ${response.status}`);
          return {
            success: true,
            response: response,
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          console.error(`[RayDaemon] API call failed:`, error);
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
          };
        }
      }
    )
  );

  context.subscriptions.push({ dispose: () => stopRayDaemon() });
}

export function deactivate() {
  stopRayDaemon();
}
