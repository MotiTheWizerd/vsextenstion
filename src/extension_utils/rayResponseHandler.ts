import * as vscode from "vscode";
import { logInfo, logError } from "../logging";
import type { RayResponse } from "../types/messages";
import { SessionManager } from "../utils/sessionManager";
import { sendCommandResultsToRay } from "../rayLoop";
import { CommandExecutor } from ".";
import { WebviewRegistry } from "../ui/webview-registry";
import { showFinalStatus } from "./commandExecutorTools/toolStatusNotifier";

export class RayResponseHandler {
  private processedResponses = new Set<string>();
  private lastToolCompletionTime = 0;
  private debugMode = false; // Set to true to enable more verbose logging

  constructor(private commandExecutor: CommandExecutor) {}

  private getCurrentPanel(): any {
    return WebviewRegistry.getPreferred();
  }

  handleRayPostResponse(rayResponse: RayResponse): void {
    console.log("[RayDaemon] *** handleRayPostResponse CALLED ***");

    // Safety check for null responses
    if (!rayResponse) {
      console.error(
        "[RayDaemon] Received null/undefined response in handleRayPostResponse",
      );
      return;
    }

    // Log full response in debug mode only to avoid excessive logging
    if (this.debugMode) {
      console.log(
        "[RayDaemon] Ray response:",
        JSON.stringify(rayResponse, null, 2),
      );
    } else {
      // Log a compact summary for regular mode
      const hasCalls =
        Array.isArray(rayResponse.command_calls) &&
        rayResponse.command_calls.length > 0;
      const contentLength =
        rayResponse.content?.length || rayResponse.message?.length || 0;
      console.log(
        `[RayDaemon] Response summary: content_length=${contentLength}, has_commands=${hasCalls}, is_final=${!!rayResponse.is_final}`,
      );
    }

    // Create a hash key for deduplication
    const requestKey = JSON.stringify(rayResponse);
    if (this.processedResponses.has(requestKey)) {
      console.log("[RayDaemon] Skipping duplicate webhook request processing");
      return;
    }

    this.processedResponses.add(requestKey);
    this.cleanupProcessedResponses();

    console.log(
      "[RayDaemon] Processing webhook request, calling processRayResponse...",
    );
    this.processRayResponse(rayResponse);
  }

  async processRayResponse(rayResponse: RayResponse): Promise<void> {
    if (!rayResponse) {
      logError("Empty response received");
      return;
    }

    const payload = rayResponse as RayResponse;
    // Track task_id for cancellation
    if (payload.task_id) {
      SessionManager.getInstance().setLastTaskId(payload.task_id);
    }
    
    // Sync session information from Ray API with local chat history
    console.log("[RayDaemon] Starting chat history sync...");
    try {
      const sessionManager = SessionManager.getInstance();
      
      // Check if Ray provided session info
      console.log("[RayDaemon] Checking for Ray session info...");
      console.log("[RayDaemon] payload.session_info:", payload.session_info);
      console.log("[RayDaemon] payload.chat_id:", payload.chat_id);
      console.log("[RayDaemon] payload.project_id:", payload.project_id);
      
      if (payload.session_info || (payload.chat_id && payload.project_id)) {
        const raySessionInfo = payload.session_info || {
          chat_id: payload.chat_id,
          project_id: payload.project_id,
          user_id: payload.user_id
        };
        
        console.log("[RayDaemon] Syncing Ray session info:", raySessionInfo);
        
        // Update our session manager with Ray's session IDs
        if (raySessionInfo.chat_id) {
          console.log("[RayDaemon] Checking if session exists:", raySessionInfo.chat_id);
          
          // Ensure we have valid chat_id and project_id
          if (raySessionInfo.chat_id && raySessionInfo.project_id) {
            // Check if we have this session in our history
            const existingSession = sessionManager.loadChatSession(raySessionInfo.chat_id);
            console.log("[RayDaemon] Existing session found:", !!existingSession);
            
            if (!existingSession) {
              console.log("[RayDaemon] Creating new chat session from Ray session info");
              // Create a new session using Ray's chat_id
              sessionManager.createChatSessionFromRay(raySessionInfo.chat_id, raySessionInfo.project_id);
            } else {
              console.log("[RayDaemon] Using existing Ray session");
            }
          } else {
            console.log("[RayDaemon] Invalid Ray session info - missing chat_id or project_id");
          }
        }
      } else {
        console.log("[RayDaemon] No Ray session info found in payload");
      }
      
      // Add assistant response to chat history if we have content
      const content = this.extractContent(payload);
      console.log("[RayDaemon] Extracted content length:", content?.length || 0);
      if (content && content.trim().length > 0) {
        console.log("[RayDaemon] Adding assistant response to chat history");
        sessionManager.addMessageToHistory("assistant", content);
      } else {
        console.log("[RayDaemon] No content to add to chat history");
      }
    } catch (error) {
      console.error("[RayDaemon] Error syncing chat history:", error);
      if (error instanceof Error) {
        console.error("[RayDaemon] Error stack:", error.stack);
      }
    }
    console.log("[RayDaemon] Chat history sync completed");
    
    console.log(
      "[RayDaemon] Processing ray response, payload keys:",
      Object.keys(payload),
    );

    // Handle working status
    if (payload.status === "start working" || payload.status === "working") {
      this.handleWorkingStatus();
      return;
    }

    // Extract content
    const content = this.extractContent(payload);
    if (!content) {
      console.log(
        "[RayDaemon] No content found in response, checking for command_calls",
      );
      // Continue processing even without content - there could be tool calls
    }

    // Determine if this is a final response
    const isFinalBoolean: boolean =
      typeof payload.is_final === "string"
        ? payload.is_final === "true"
        : !!payload.is_final;

    // Check if this is a completion message after tool execution
    // If we don't have command_calls and we have content, it's likely a completion message
    const hasCommandCalls =
      Array.isArray(payload.command_calls) && payload.command_calls.length > 0;
    const isCompletionMessage =
      !hasCommandCalls && !!content && content.length > 0;

    console.log(
      `[RayDaemon] processRayResponse - hasCommandCalls: ${hasCommandCalls}, isCompletionMessage: ${isCompletionMessage}, isFinal: ${isFinalBoolean}`,
    );
    if (content) {
      console.log(
        `[RayDaemon] processRayResponse - content preview: "${content.substring(0, 100)}${content.length > 100 ? "..." : ""}"`,
      );
    }

    // Get current panel reference
    const currentPanel = this.getCurrentPanel();
    if (!currentPanel) {
      this.handleNoPanelError();
      return;
    }

    try {
      // Determine the final flag based on explicit is_final or inferred completion message
      const finalFlag: boolean = isFinalBoolean || isCompletionMessage;

      // Important: log the final decision so we can trace the flow
      console.log(
        `[RayDaemon] Final decision - processing payload with isFinal=${finalFlag}`,
      );

      // Process the payload - this handles both tool calls and normal responses
      await this.processPayload(
        payload,
        content || "",
        finalFlag,
        currentPanel,
      );
    } catch (error) {
      this.handleProcessingError(error);
    }
  }

  private cleanupProcessedResponses(): void {
    if (this.processedResponses.size > 100) {
      const firstKey = this.processedResponses.values().next().value;
      if (firstKey) {
        this.processedResponses.delete(firstKey);
      }
    }
  }

  private handleWorkingStatus(): void {
    logInfo("Ray is starting to work, showing working message to user");
    const currentPanel = this.getCurrentPanel();
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
  }

  private extractContent(payload: RayResponse): string {
    // Check all common content fields in order of preference
    if (payload.message) {
      return payload.message;
    } else if (payload.content) {
      return payload.content;
    } else if (payload.response) {
      return payload.response;
    } else if (payload.text) {
      return payload.text;
    } else {
      // Only log error if there are no command calls
      const hasCommandCalls =
        Array.isArray(payload.command_calls) &&
        payload.command_calls.length > 0;
      if (!hasCommandCalls) {
        logError("No message, content, response or text in payload:", payload);
      } else {
        console.log(
          "[RayDaemon] No content found, but command_calls are present - continuing with execution",
        );
      }
      return "";
    }
  }

  private handleNoPanelError(): void {
    logError("No active chat panel to display message");
    vscode.window.showErrorMessage(
      "No active chat panel. Please open the RayDaemon panel first using the command palette (Ctrl+Shift+P > RayDaemon: Open Panel)",
    );
  }

  private async processPayload(
    payload: RayResponse,
    content: string,
    isFinal: boolean,
    currentPanel: any,
  ): Promise<void> {
    console.log(
      `[RayDaemon] Processing payload - content length: ${content?.length || 0}, isFinal: ${isFinal}`,
    );

    // Check for command calls in either command_calls (preferred) or commandCalls (legacy) property
    const commandCalls = payload.command_calls || payload.commandCalls;

    if (Array.isArray(commandCalls) && commandCalls.length > 0) {
      console.log("=== FOUND COMMAND CALLS - EXECUTING TOOLS ===");
      console.log(
        `[RayDaemon] Found ${commandCalls.length} command calls to execute`,
      );

      // Always show the initial message from Ray before executing tools
      if (currentPanel && content) {
        console.log(
          `[RayDaemon] Sending non-final response to webview before tool execution`,
        );
        currentPanel.webview.postMessage({
          type: "rayResponse",
          data: {
            content: content,
            isFinal: false,
            isWorking: false,
          },
        });
      }

      try {
        // Execute the commands and let the commandExecutor handle sending results back to Ray
        console.log(`[RayDaemon] Executing command calls and sending results`);
        await this.commandExecutor.executeCommandCallsAndSendResults(
          content,
          commandCalls,
        );
        console.log(`[RayDaemon] Command execution completed successfully`);
      } catch (error) {
        console.error(`[RayDaemon] Error executing commands:`, error);

        // Still show something to the user if command execution fails
        if (currentPanel) {
          currentPanel.webview.postMessage({
            type: "rayResponse",
            data: {
              content: `❌ **Error executing tools:** ${error instanceof Error ? error.message : String(error)}`,
              isFinal: true,
              isWorking: false,
            },
          });
        }
      }
    } else {
      // Visible fallback when only command_results arrive without content
      if (
        (!content || content.trim().length === 0) &&
        Array.isArray(payload.command_results) &&
        payload.command_results.length > 0
      ) {
        try {
          const toolNames = payload.command_results.map((r) => r.command);
          await showFinalStatus(toolNames, payload.command_results as any);
        } catch (e) {
          console.log("[RayDaemon] Failed to send toolStatus fallback:", e);
        }

        const successCount = payload.command_results.filter((r) => r.ok).length;
        const total = payload.command_results.length;
        const failCount = total - successCount;
        const summary = `dY"? **Command results received: ${successCount}/${total} successful**${failCount ? ` (failed: ${failCount})` : ""}`;

        currentPanel.webview.postMessage({
          type: "rayResponse",
          data: {
            content: summary,
            isFinal: isFinal,
            isWorking: false,
          },
        });
        return;
      }

      console.log("=== NO COMMAND CALLS - NORMAL RESPONSE ===");
      console.log(
        `[RayDaemon] Sending completion message to webview - content: "${content}", isFinal: ${isFinal}`,
      );

      // This is either a final response after tools or a direct response with no tools
      if (currentPanel) {
        currentPanel.webview.postMessage({
          type: "rayResponse",
          data: {
            content,
            isFinal,
            isWorking: false,
          },
        });
      }
    }
  }

  private handleProcessingError(error: any): void {
    logError("Error processing Ray response:", error);

    const currentPanel = this.getCurrentPanel();
    if (currentPanel) {
      currentPanel.webview.postMessage({
        type: "rayResponse",
        data: {
          content: `❌ **Error processing response:** ${error instanceof Error ? error.message : String(error)}`,
          isFinal: true,
          isWorking: false,
        },
      });
    }
  }
}
