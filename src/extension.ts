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
import { RayDaemonViewProvider } from "./ui/RayDaemonViewProvider";
import {
  createExecuteCommandFactory,
  RayResponsePayload,
} from "./commands/execFactory";
import { commandHandlers } from "./commands/commandHandler"; // ensure it's exported
import {
  sendCommandResultsToRay,
  setProcessRayResponseCallback,
} from "./rayLoop";
import { disposeGlobalDiagnosticWatcher } from "./commands/commandMethods/diagnostics";

// Global state
let daemonInterval: NodeJS.Timeout | undefined;
let rayWebhookServer: http.Server | undefined;
let currentPanel: vscode.WebviewPanel | undefined;

// Track processed webhook requests to prevent duplicates
const processedWebhookRequests = new Set<string>();

// Store file contents before Ray modifies them for diff purposes
const fileBackups = new Map<string, string>();

/**
 * Backup file content before Ray modifies it
 */
async function backupFileBeforeModification(filePath: string): Promise<void> {
  try {
    // Resolve relative paths
    let resolvedPath = filePath;
    if (!path.isAbsolute(filePath)) {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (workspaceFolders && workspaceFolders.length > 0) {
        resolvedPath = path.join(workspaceFolders[0].uri.fsPath, filePath);
      }
    }

    // Only backup if we don't already have a backup for this file
    if (!fileBackups.has(resolvedPath)) {
      try {
        const uri = vscode.Uri.file(resolvedPath);
        const fileContent = await vscode.workspace.fs.readFile(uri);
        const contentString = Buffer.from(fileContent).toString("utf8");
        fileBackups.set(resolvedPath, contentString);
        console.log(
          `[RayDaemon] Backed up file before modification: ${resolvedPath} (${contentString.length} chars)`
        );
      } catch (readError) {
        // File might not exist yet (for new files), that's okay
        console.log(
          `[RayDaemon] Could not backup file (might be new): ${resolvedPath}`,
          readError
        );
      }
    } else {
      console.log(`[RayDaemon] File already backed up: ${resolvedPath}`);
    }
  } catch (error) {
    console.error(`[RayDaemon] Error backing up file ${filePath}:`, error);
  }
}

/**
 * Get the file path from command arguments for file-modifying commands
 */
function getFilePathFromCommand(command: string, args: any[]): string | null {
  if (!args || args.length === 0) {
    return null;
  }

  switch (command) {
    case "write":
    case "append":
    case "replace":
      // First argument is the file path for these commands
      return typeof args[0] === "string" ? args[0] : null;
    default:
      return null;
  }
}

/**
 * Clear old file backups to prevent memory leaks
 * Keep only the most recent 50 backups
 */
function clearOldBackups(): void {
  if (fileBackups.size > 50) {
    const entries = Array.from(fileBackups.entries());
    const toDelete = entries.slice(0, entries.length - 50);
    toDelete.forEach(([key]) => {
      fileBackups.delete(key);
    });
    console.log(`[RayDaemon] Cleared ${toDelete.length} old file backups`);
  }
}

/**
 * Clear all file backups (useful for testing or manual cleanup)
 */
function clearAllBackups(): void {
  const count = fileBackups.size;
  fileBackups.clear();
  console.log(`[RayDaemon] Cleared all ${count} file backups`);
}

// Handle responses from Ray
function handleRayPostResponse(rayResponse: any): void {
  console.log("[RayDaemon] *** handleRayPostResponse CALLED ***");
  console.log(
    "[RayDaemon] Ray response:",
    JSON.stringify(rayResponse, null, 2)
  );

  // Create a unique key for this webhook request
  const requestKey = JSON.stringify(rayResponse);
  if (processedWebhookRequests.has(requestKey)) {
    console.log("[RayDaemon] Skipping duplicate webhook request processing");
    return;
  }

  // Mark as processed
  processedWebhookRequests.add(requestKey);

  // Clean up old entries to prevent memory leaks (keep last 100)
  if (processedWebhookRequests.size > 100) {
    const firstKey = processedWebhookRequests.values().next().value;
    if (firstKey) {
      processedWebhookRequests.delete(firstKey);
    }
  }

  console.log(
    "[RayDaemon] Processing webhook request, calling processRayResponse..."
  );
  processRayResponse(rayResponse);
}

// Auto-open files that were modified by commands
async function autoOpenModifiedFiles(results: any[]): Promise<void> {
  // Check if auto-open is enabled (VS Code setting takes precedence)
  const autoOpenEnabled = vscode.workspace
    .getConfiguration("raydaemon")
    .get("autoOpenModifiedFiles", config.autoOpenModifiedFiles);
  if (!autoOpenEnabled) {
    console.log("[RayDaemon] Auto-open disabled by user setting");
    return;
  }

  const filesToOpen = new Set<string>();

  // Commands that modify files and should trigger auto-open
  const fileModifyingCommands = ["write", "append", "replace", "read"];

  results.forEach((result) => {
    if (!result.ok || !fileModifyingCommands.includes(result.command)) {
      return;
    }

    // Extract file path from command arguments based on command type
    const args = result.args || [];
    let filePath: string | null = null;

    switch (result.command) {
      case "write":
      case "append":
      case "read":
        // First argument is the file path
        filePath = args[0];
        break;
      case "replace":
        // First argument is the file path for replace command
        filePath = args[0];
        break;
      default:
        // For other commands, try first argument
        filePath = args[0];
        break;
    }

    if (filePath && typeof filePath === "string") {
      // Clean the file path
      filePath = filePath.trim();

      // Skip if it doesn't look like a file path
      if (!filePath || (!filePath.includes("/") && !filePath.includes("\\"))) {
        return;
      }

      // Resolve relative paths to absolute paths
      if (!path.isAbsolute(filePath)) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
          filePath = path.join(workspaceFolders[0].uri.fsPath, filePath);
        }
      }

      console.log(
        `[RayDaemon] Marking file for auto-open: ${filePath} (from ${result.command} command)`
      );
      filesToOpen.add(filePath);
    }
  });

  // Open each modified file (limit to avoid overwhelming the user)
  const filesToOpenArray = Array.from(filesToOpen).slice(0, 5); // Max 5 files

  if (filesToOpenArray.length > 0) {
    console.log(
      `[RayDaemon] Auto-opening ${filesToOpenArray.length} modified file(s)`
    );
  }

  for (const filePath of filesToOpenArray) {
    try {
      console.log(`[RayDaemon] Auto-opening modified file: ${filePath}`);
      const uri = vscode.Uri.file(filePath);

      // Check if file exists before trying to open it
      try {
        await vscode.workspace.fs.stat(uri);
      } catch (statError) {
        console.log(
          `[RayDaemon] File does not exist, skipping auto-open: ${filePath}`
        );
        continue;
      }

      await vscode.window.showTextDocument(uri, {
        viewColumn: vscode.ViewColumn.One,
        preview: false, // Don't open in preview mode
        preserveFocus: false, // Give focus to the opened file
      });

      // Small delay between opening multiple files
      await new Promise((resolve) => setTimeout(resolve, 150));
    } catch (error) {
      console.error(`[RayDaemon] Failed to auto-open file: ${filePath}`, error);
      // Don't show error messages for auto-open failures to avoid spam
    }
  }

  // If we had to limit the files, log how many were skipped
  if (filesToOpen.size > filesToOpenArray.length) {
    console.log(
      `[RayDaemon] Skipped auto-opening ${
        filesToOpen.size - filesToOpenArray.length
      } additional files to avoid overwhelming the editor`
    );
  }
}

// Execute command calls and send results back to Ray
// Track tool execution to prevent duplicate status messages
let isExecutingTools = false;

async function executeCommandCallsAndSendResults(
  content: string,
  commandCalls: any[]
): Promise<void> {
  console.log("[RayDaemon] *** executeCommandCallsAndSendResults CALLED ***");
  console.log("[RayDaemon] Content:", content);
  console.log(
    "[RayDaemon] Command calls:",
    JSON.stringify(commandCalls, null, 2)
  );

  if (!Array.isArray(commandCalls) || commandCalls.length === 0) {
    console.log("[RayDaemon] No command calls to execute");
    return;
  }

  // Prevent concurrent executions
  console.log("[RayDaemon] Checking isExecutingTools flag:", isExecutingTools);
  if (isExecutingTools) {
    console.log(
      "[RayDaemon] Tools already executing, skipping duplicate execution"
    );
    return;
  }

  console.log("[RayDaemon] Setting isExecutingTools = true");
  isExecutingTools = true;

  logInfo(`[Ray][command_calls] executing ${commandCalls.length} call(s)…`);
  logInfo(
    `[Ray][command_calls] available commands:`,
    Object.keys(commandHandlers)
  );
  logInfo(`[Ray][command_calls] received calls:`, commandCalls);

  // Debug: Log the raw JSON to see if underscores are preserved
  console.log(
    "[Ray][command_calls] Raw JSON payload:",
    JSON.stringify(commandCalls, null, 2)
  );

  // Create the executor factory here to ensure commandHandlers is fully loaded
  const { executeBatch } = createExecuteCommandFactory(commandHandlers);

  // Execute immediately with proper error handling
  try {
    logInfo("[Ray][command_calls] Starting execution...");
    logInfo(
      "[Ray][command_calls] Raw command calls:",
      JSON.stringify(commandCalls, null, 2)
    );

    // Generate tool names for display
    const toolNames = commandCalls.map((call) => {
      const args = call.args || [];
      switch (call.command) {
        case "read":
          const fileName = args[0] ? args[0].split(/[/\\]/).pop() : "file";
          return `Reading ${fileName}`;
        case "searchRegex":
        case "searchText":
          const searchTerm = args[0] || "text";
          return `Searching "${
            searchTerm.length > 15
              ? searchTerm.substring(0, 15) + "..."
              : searchTerm
          }"`;
        case "findSymbol":
        case "findSymbolFromIndex":
          const symbolName = args[0] || "symbol";
          return `Finding ${symbolName}`;
        case "loadIndex":
          return "Loading index";
        case "createIndex":
          return "Creating index";
        case "updateIndex":
          return "Updating index";
        case "ls":
          const dirName = args[0]
            ? args[0].split(/[/\\]/).pop() || args[0]
            : "directory";
          return `Listing ${dirName}`;
        case "open":
          const openFile = args[0] ? args[0].split(/[/\\]/).pop() : "file";
          return `Opening ${openFile}`;
        case "write":
          const writeFile = args[0] ? args[0].split(/[/\\]/).pop() : "file";
          return `Writing ${writeFile}`;
        case "findByExtension":
          const ext = args[0] || "files";
          return `Finding ${ext} files`;
        case "getAllDiagnostics":
          return "Analyzing diagnostics";
        case "getFileDiagnostics":
          const diagFile = args[0] ? args[0].split(/[/\\]/).pop() : "file";
          return `Checking ${diagFile}`;
        default:
          return call.command;
      }
    });

    // Add a small delay to ensure the "working" status is visible before tools start executing
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Preprocess command calls to handle special placeholders
    const processedCalls = commandCalls.map((call) => {
      if (call.args && Array.isArray(call.args)) {
        const processedArgs = call.args.map((arg: any) => {
          if (
            typeof arg === "string" &&
            arg === "/absolute/path/from/active/editor"
          ) {
            // Get the active editor file path
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
              return activeEditor.document.uri.fsPath;
            } else {
              throw new Error("No active editor file found");
            }
          }
          return arg;
        });
        return { ...call, args: processedArgs };
      }
      return call;
    });

    logInfo(
      "[Ray][command_calls] Processed command calls:",
      JSON.stringify(processedCalls, null, 2)
    );

    // Show initial batch starting status
    if (currentPanel) {
      currentPanel?.webview.postMessage({
        type: "toolStatus",
        data: {
          status: "starting",
          tools: toolNames,
          totalCount: processedCalls.length,
          batchMode: true,
        },
      });
    }

    // Small delay to show starting status
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Execute commands individually but group the results
    const results: any[] = [];
    let anyExecuted = false;
    let completedCount = 0;

    for (let i = 0; i < processedCalls.length; i++) {
      const call = processedCalls[i];
      const toolName = toolNames[i];

      // Send working status with current progress
      if (currentPanel) {
        currentPanel?.webview.postMessage({
          type: "toolStatus",
          data: {
            status: "working",
            tools: [toolName],
            currentIndex: i + 1,
            totalCount: processedCalls.length,
            batchMode: true,
          },
        });
      }

      try {
        // Backup file before modification if this is a file-modifying command
        const filePath = getFilePathFromCommand(call.command, call.args);
        if (filePath) {
          await backupFileBeforeModification(filePath);
        }

        // Execute single command
        const { executeOne } = createExecuteCommandFactory(commandHandlers);
        const result = await executeOne(call);
        results.push(result);
        anyExecuted = true;
        completedCount++;

        // Small delay between commands
        if (i < processedCalls.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
      } catch (error) {
        const errorResult = {
          command: call.command,
          args: call.args || [],
          ok: false,
          error: String(error),
        };
        results.push(errorResult);
        completedCount++;
      }
    }

    // Auto-open files that were modified by commands
    await autoOpenModifiedFiles(results);

    // Send final batch completion status
    if (currentPanel && anyExecuted) {
      const successCount = results.filter((r) => r.ok).length;
      const failedCount = results.length - successCount;

      currentPanel?.webview.postMessage({
        type: "toolStatus",
        data: {
          status: "completed",
          tools: toolNames,
          totalCount: processedCalls.length,
          successCount,
          failedCount,
          results: results.map((result) => ({
            command: result.command,
            args: result.args,
            ok: result.ok,
            output: result.output,
            outputLength: result.output?.length || 0,
            error: result.error,
          })),
          batchMode: true,
        },
      });
    }

    const batch = { anyExecuted, results };
    logInfo("[Ray][command_calls] results:", batch);
    logInfo(
      "[Ray][command_calls] Detailed results:",
      JSON.stringify(batch, null, 2)
    );

    // Format command results for Ray API
    const commandResults = results.map((result) => ({
      command: result.command,
      status: result.ok ? "success" : "error",
      output: result.ok ? result.output : result.error,
      args: result.args,
    }));

    console.log(
      "[RayDaemon] Sending command results back to Ray:",
      commandResults
    );

    // Clear the execution flag BEFORE sending results to Ray
    // This prevents Ray's follow-up response from being blocked
    console.log(
      "[RayDaemon] Clearing isExecutingTools flag before sending to Ray"
    );
    isExecutingTools = false;

    // Clear old backups to prevent memory leaks
    clearOldBackups();

    // Send command results back to Ray automatically (in background, don't wait)
    try {
      await sendCommandResultsToRay(content, commandResults);
      logInfo(
        "[Ray][command_calls] Command results sent back to Ray successfully"
      );
      console.log("[RayDaemon] Command results sent back to Ray successfully");
    } catch (rayError) {
      logError(
        "[Ray][command_calls] Failed to send results back to Ray:",
        rayError
      );
      console.error(
        "[RayDaemon] Failed to send command results back to Ray:",
        rayError
      );
    }

    // Also forward raw results to UI for debugging if panel exists
    if (currentPanel) {
      currentPanel?.webview.postMessage({
        type: "rayCommandResults",
        data: batch,
      });
    }

    // Tools execution completed successfully
  } catch (err) {
    console.error(
      "[RayDaemon] Error in executeCommandCallsAndSendResults:",
      err
    );
    logError("[Ray][command_calls] batch error:", err);

    // Format error results for Ray API
    const errorResults = [
      {
        command: "batch_execution",
        status: "error",
        output: String(err),
      },
    ];

    // Clear the execution flag BEFORE sending error results to Ray
    console.log(
      "[RayDaemon] Clearing isExecutingTools flag before sending error to Ray"
    );
    isExecutingTools = false;

    // Clear old backups to prevent memory leaks
    clearOldBackups();

    // Send error results back to Ray
    try {
      await sendCommandResultsToRay(content, errorResults);
      logInfo("[Ray][command_calls] Error results sent back to Ray");
      console.log("[RayDaemon] Error results sent back to Ray");
    } catch (rayError) {
      logError(
        "[Ray][command_calls] Failed to send error results back to Ray:",
        rayError
      );
      console.error(
        "[RayDaemon] Failed to send error results back to Ray:",
        rayError
      );
    }

    // Tools execution completed with error
  }
}

// Track processed responses to prevent duplicates
const processedResponses = new Set<string>();

// Track recent tool completions to prevent duplicate status messages
let lastToolCompletionTime = 0;

// Track command execution to prevent infinite loops
const executedCommandSets = new Set<string>();

// Process Ray response with common functionality
export async function processRayResponse(rayResponse: any): Promise<void> {
  console.log("=== PROCESS RAY RESPONSE START ===");
  console.log(
    "[RayDaemon] processRayResponse called with:",
    JSON.stringify(rayResponse, null, 2)
  );
  console.log(
    "[RayDaemon] processRayResponse - Current panel exists:",
    !!currentPanel
  );
  console.log(
    "[RayDaemon] processRayResponse - lastToolCompletionTime:",
    lastToolCompletionTime
  );
  console.log(
    "[RayDaemon] processRayResponse - Time since last completion:",
    Date.now() - lastToolCompletionTime,
    "ms"
  );

  if (!rayResponse) {
    logError("Empty response received");
    return;
  }

  // Create a unique key for this response to prevent duplicates
  const responseKey = JSON.stringify(rayResponse);
  if (processedResponses.has(responseKey)) {
    console.log("[RayDaemon] Skipping duplicate response processing");
    return;
  }

  // Mark as processed
  processedResponses.add(responseKey);

  // Clean up old entries to prevent memory leaks (keep last 100)
  if (processedResponses.size > 100) {
    const firstKey = processedResponses.values().next().value;
    if (firstKey) {
      processedResponses.delete(firstKey);
    }
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
    // Check for command_calls first before sending any UI response
    const commandCalls = payload.command_calls || rayResponse.command_calls;
    console.log("=== COMMAND CALLS CHECK ===");
    console.log("[RayDaemon] Checking for command calls in payload:", {
      hasCommandCalls: "command_calls" in payload,
      commandCallsType: typeof payload.command_calls,
      commandCallsValue: payload.command_calls,
      isArray: Array.isArray(commandCalls),
      length: commandCalls?.length,
    });
    console.log("[RayDaemon] Full payload keys:", Object.keys(payload));
    console.log("[RayDaemon] Content preview:", content?.substring(0, 100));

    if (Array.isArray(commandCalls) && commandCalls.length > 0) {
      console.log("=== FOUND COMMAND CALLS - EXECUTING TOOLS ===");
      // CRITICAL FIX: If there are command calls, first show Ray's message explaining what she's doing
      console.log(
        "[RayDaemon] Found command calls, showing Ray's message first then executing tools..."
      );
      console.log(
        "[RayDaemon] Command calls to execute:",
        JSON.stringify(commandCalls, null, 2)
      );

      // First, send Ray's actual message explaining what she's doing
      if (currentPanel && content) {
        currentPanel.webview.postMessage({
          type: "rayResponse",
          data: {
            content: content,
            isFinal: false,
            isWorking: false,
          },
        });
      }

      console.log("=== EXECUTING TOOLS ===");
      // Execute tools and wait for completion - this will automatically send results back to Ray
      await executeCommandCallsAndSendResults(content, commandCalls);

      // Do NOT send the original chat response to UI again - the tool execution flow will handle the conversation continuation
      console.log("=== TOOLS COMPLETED ===");
      console.log(
        "[RayDaemon] Tools completed, conversation will continue via command results feedback"
      );
      console.log("=== PROCESS RAY RESPONSE END (TOOLS) ===");
    } else {
      // No command calls - send the chat response normally
      console.log("=== NO COMMAND CALLS - NORMAL RESPONSE ===");
      console.log(
        "[RayDaemon] No command calls found, sending normal chat response"
      );
      const rayResponseMessage = {
        type: "rayResponse",
        data: { content, isFinal },
      };
      logInfo("Sending rayResponse message:", rayResponseMessage);
      currentPanel.webview.postMessage(rayResponseMessage);
      console.log("=== PROCESS RAY RESPONSE END (NORMAL) ===");
    }
  } catch (error) {
    logError("Error processing Ray response:", error);

    // Send error to UI
    if (currentPanel) {
      currentPanel.webview.postMessage({
        type: "rayResponse",
        data: {
          content: `❌ **Error processing response:** ${
            error instanceof Error ? error.message : String(error)
          }`,
          isFinal: true,
          isWorking: false,
        },
      });
    }
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
          console.log("[RayDaemon] Webhook received POST request:", {
            url: req.url,
            method: req.method,
            headers: req.headers,
            body: data,
            timestamp: new Date().toISOString(),
          });
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

  // Set up the callback for processing Ray responses in rayLoop.ts
  setProcessRayResponseCallback(processRayResponse);

  startRayDaemon();

  // Register the WebviewView provider for the activity bar view so the UI
  // appears in the activity bar (no editor tab chrome)
  const provider = new RayDaemonViewProvider(context as vscode.ExtensionContext);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(RayDaemonViewProvider.viewType, provider)
  );

  // Auto-open the chat panel on startup (reveal activity bar view)
  setTimeout(() => {
    vscode.commands.executeCommand('workbench.view.extension.rayDaemonContainer');
    // Also try to focus the specific view inside the container
    vscode.commands.executeCommand('workbench.action.openView', 'rayDaemonDummyView');
  }, 2000); // Longer delay to ensure VS Code is fully loaded

  context.subscriptions.push(
    vscode.commands.registerCommand("raydaemon.helloWorld", () => {
      vscode.window.showInformationMessage("Hello World from RayDaemon!");
    })
  );

  // Replace the openPanel command to reveal the activity bar view instead
  context.subscriptions.push(
    vscode.commands.registerCommand('raydaemon.openPanel', async () => {
      await vscode.commands.executeCommand('workbench.view.extension.rayDaemonContainer');
      // Focus the specific view inside the container
      try {
        await vscode.commands.executeCommand('workbench.action.openView', 'rayDaemonDummyView');
      } catch (_) {
        // older VS Code versions may not support openView; container reveal is usually enough
      }
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
  disposeGlobalDiagnosticWatcher();
}
