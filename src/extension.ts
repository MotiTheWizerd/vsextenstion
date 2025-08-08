import * as vscode from 'vscode';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';
import { config } from './config';
import { registerCommands } from './commands';
import { handleCommand } from './commands/commandHandler';
import { RayDaemonTreeProvider } from './treeView';
import { logInfo, logError } from './logging';
import { getWebviewContent } from './ui/WebviewContent';

// Global state
let daemonInterval: NodeJS.Timeout | undefined;
let rayWebhookServer: http.Server | undefined;
let currentPanel: vscode.WebviewPanel | undefined;

// Handle responses from Ray
function handleRayPostResponse(rayResponse: any): void {
  if (!rayResponse) {
    logError('Empty response received');
    return;
  }
  
  // Check if this is a status message indicating Ray is starting to work
  if (rayResponse.status === 'start working' || rayResponse.status === 'working') {
    logInfo('Ray is starting to work, showing working message to user');
    
    if (currentPanel) {
      const workingMessage = {
        type: 'rayResponse',
        data: {
          content: '🔄 **Ray is working on your request...** \n\nPlease wait while Ray processes your message. You\'ll receive the response shortly.',
          isFinal: false,
          isWorking: true
        }
      };
      
      currentPanel.webview.postMessage(workingMessage);
    }
    return;
  }
  
  // Extract message content for actual responses
  let content = '';
  if (rayResponse.message) {
    content = rayResponse.message;
  } else if (rayResponse.content) {
    content = rayResponse.content;
  } else {
    logError('No message or content in response:', rayResponse);
    return;
  }

  logInfo('Forwarding Ray response to chat panel:', content);
  
  // Use the currentPanel variable that's set when the panel is created
  if (currentPanel) {
    try {
      logInfo('Sending message to webview:', {
        panelExists: true,
        content: content,
        isFinal: rayResponse.is_final || false
      });
      
      // First, try the command format
      // Send single rayResponse message to avoid duplicates
      const rayResponseMessage = {
        type: 'rayResponse',
        data: {
          content: content,
          isFinal: rayResponse.is_final || false
        }
      };
      
      logInfo('Sending rayResponse message:', rayResponseMessage);
      currentPanel.webview.postMessage(rayResponseMessage);
      
    } catch (error) {
      logError('Error sending message to webview:', error);
    }
  } else {
    logError('No active chat panel to display message');
    vscode.window.showErrorMessage('No active chat panel. Please open the RayDaemon panel first using the command palette (Ctrl+Shift+P > RayDaemon: Open Panel)');
  }
}

// Start webhook server for Ray to POST back to
function startRayWebhookServer(): void {
  if (rayWebhookServer) {
    logInfo('Webhook server already running');
    return;
  }

  const port = config.webhookPort || 3001; // Default to port 3001 if not configured

  rayWebhookServer = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      // Health check endpoint
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
      return;
    }

    if (req.method === 'POST' && req.url === '/ray-response') {
      let body = '';
      
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString();
      });
      
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          handleRayPostResponse(data);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'received' }));
        } catch (error) {
          logError('Error processing webhook:', error);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid request' }));
        }
      });
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  });

  rayWebhookServer.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      const errorMsg = `Port ${port} is already in use. Please free the port and restart the extension.`;
      logError(errorMsg);
      vscode.window.showErrorMessage(errorMsg);
    } else {
      logError('Webhook server error:', error);
    }
  });

  rayWebhookServer.listen(port, '0.0.0.0', () => {
    logInfo(`Webhook server running on port ${port}`);
  });
}

// Start the Ray daemon
function startRayDaemon(): void {
  if (daemonInterval) {
    logInfo('Daemon already running');
    return;
  }
  
  logInfo('Starting Ray daemon...');
  
  // Start the daemon interval
  daemonInterval = setInterval(() => {
    logInfo('Daemon heartbeat');
  }, 60000); // Run every minute
  
  // Start the webhook server
  startRayWebhookServer();
}

// Stop the Ray daemon
function stopRayDaemon(): void {
  if (daemonInterval) {
    clearInterval(daemonInterval);
    daemonInterval = undefined;
    logInfo('Daemon stopped');
  }
  
  if (rayWebhookServer) {
    rayWebhookServer.close();
    rayWebhookServer = undefined;
    logInfo('Webhook server stopped');
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
            case 'chat':
              try {
                const result = await handleCommand(message.content);
                panel.webview.postMessage({ 
                  type: 'chat_response', 
                  content: result 
                });
              } catch (error) {
                logError('Error handling chat command:', error);
                panel.webview.postMessage({
                  command: "chatError",
                  error: error instanceof Error ? error.message : 'Unknown error'
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
                logError('Error handling API call command:', error);
                panel.webview.postMessage({
                  command: "apiCallError",
                  id: message.id,
                  error: error instanceof Error ? error.message : 'Unknown error'
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
          vscode.Uri.file(path.join(context.extensionPath, 'media')),
          vscode.Uri.file(path.join(context.extensionPath, 'out/compiled')),
        ]
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
