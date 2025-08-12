import * as vscode from "vscode";
import { logInfo, logError } from "../logging";
import { currentPanel } from "./globals";
import { executeCommandCallsAndSendResults } from "./commandExecutor";
import { RayResponsePayload } from "../commands/execFactory";

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
