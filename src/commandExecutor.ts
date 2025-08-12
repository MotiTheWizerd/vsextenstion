import * as vscode from "vscode";
import { logInfo, logError } from "../logging";
import { currentPanel } from "./globals";
import { commandHandlers } from "../commands/commandHandler";
import { createExecuteCommandFactory } from "../commands/execFactory";
import { sendCommandResultsToRay } from "../rayLoop";

// Track tool execution to prevent duplicate status messages
let isExecutingTools = false;

// Track recent tool completions to prevent duplicate status messages
let lastToolCompletionTime = 0;

export async function executeCommandCallsAndSendResults(
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

    // Show working indicator to user if panel exists
    if (currentPanel) {
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

      currentPanel?.webview.postMessage({
        type: "toolStatus",
        data: {
          status: "working",
          tools: toolNames,
        },
      });
    }

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

    const batch = await executeBatch(processedCalls, {
      stopOnError: false,
    });
    logInfo("[Ray][command_calls] results:", batch);
    logInfo(
      "[Ray][command_calls] Detailed results:",
      JSON.stringify(batch, null, 2)
    );

    // Format command results for Ray API
    const commandResults = batch.results.map((result) => ({
      command: result.command,
      status: result.ok ? "success" : "error",
      output: result.ok ? result.output : result.error,
      args: result.args,
    }));

    // Send tool completion status to user IMMEDIATELY when tools finish
    if (currentPanel && batch.anyExecuted && batch.results.length > 0) {
      const successCount = batch.results.filter((r) => r.ok).length;
      const failedCount = batch.results.length - successCount;

      // Record the completion time to prevent duplicates
      lastToolCompletionTime = Date.now();

      // Show completion status immediately, don't wait for Ray API
      currentPanel?.webview.postMessage({
        type: "toolStatus",
        data: {
          status: "completed",
          successCount,
          failedCount,
          totalCount: batch.results.length,
          tools: commandCalls.map((call) => call.command), // Include tool names for better messaging
          results: batch.results.map((result) => ({
            command: result.command,
            args: result.args,
            ok: result.ok,
            outputLength: result.output?.length || 0,
            error: result.error,
          })),
        },
      });
    }

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

    // Send tool error status to user if panel exists
    if (currentPanel) {
      currentPanel?.webview.postMessage({
        type: "toolStatus",
        data: {
          status: "failed",
          error: String(err),
        },
      });

      currentPanel?.webview.postMessage({
        type: "rayCommandResults",
        data: { anyExecuted: false, results: [], error: String(err) },
      });
    }

    // Tools execution completed with error
  }
}
