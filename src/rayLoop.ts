import { config } from "./config";
import { ApiClient } from "./apiClient";

// Forward declaration to avoid circular import
let processRayResponse: ((rayResponse: any) => Promise<void>) | null = null;

// Function to set the processRayResponse callback from extension.ts
export function setProcessRayResponseCallback(
  callback: (rayResponse: any) => Promise<void>,
) {
  processRayResponse = callback;
}

export async function sendToRayLoop(prompt: string): Promise<string> {
  try {
    console.log(`[RayDaemon] Sending message to Ray API: ${prompt}`);

    // Format the message using the config formatter
    const messageData = config.formatMessage(prompt);

    console.log(`[RayDaemon] Config apiEndpoint: ${config.apiEndpoint}`);
    console.log(`[RayDaemon] Sending to ${config.apiEndpoint}:`, messageData);

    // Send to the configured API endpoint
    const response = await ApiClient.post(
      config.apiEndpoint,
      messageData,
      config.apiHeaders,
    );

    console.log(`[RayDaemon] API Response Status: ${response.status}`);
    console.log(`[RayDaemon] API Response Data:`, response.data);

    // Process the response through the same logic as handleRayPostResponse
    // This will handle both direct responses and tool execution
    if (processRayResponse) {
      await processRayResponse(response.data);
    }

    // Handle different response formats for immediate return
    if (response.status >= 200 && response.status < 300) {
      // Check if this is a "start working" status response
      if (
        response.data?.status === "start working" ||
        response.data?.status === "working" ||
        response.data?.message === "start working"
      ) {
        return "🔄 **Ray is working on your request...** \n\nPlease wait while Ray processes your message. You'll receive the response shortly.";
      }

      // Check if response contains command_calls - if so, the processRayResponse will handle everything
      const commandCalls = response.data?.command_calls;
      if (Array.isArray(commandCalls) && commandCalls.length > 0) {
        // Response with tools - processRayResponse will handle the flow
        return "__RAY_RESPONSE_HANDLED__:Tools are being executed, response will be handled by processRayResponse";
      }

      // Extract the response message for normal responses (no tools)
      let responseMessage = "";

      if (typeof response.data === "string") {
        responseMessage = response.data;
      } else if (response.data?.response) {
        responseMessage = response.data.response;
      } else if (response.data?.message) {
        responseMessage = response.data.message;
      } else if (response.data?.content) {
        responseMessage = response.data.content;
      } else if (response.data?.text) {
        responseMessage = response.data.text;
      } else {
        responseMessage = JSON.stringify(response.data, null, 2);
      }

      // Return a special marker to indicate that the response has already been handled
      return `__RAY_RESPONSE_HANDLED__:${responseMessage || "Response received but no content found."}`;
    } else {
      throw new Error(
        `API returned status ${response.status}: ${JSON.stringify(response.data)}`,
      );
    }
  } catch (error) {
    console.error("[RayDaemon] Error sending to Ray API:", error);

    // Provide helpful error messages
    if (error instanceof Error) {
      if (error.message.includes("ECONNREFUSED")) {
        return `❌ **Connection Error**: Cannot connect to Ray API at ${config.apiEndpoint}. Please make sure your Ray server is running.`;
      } else if (error.message.includes("ENOTFOUND")) {
        return `❌ **DNS Error**: Cannot resolve hostname. Please check your API endpoint configuration.`;
      } else if (error.message.includes("timeout")) {
        return `❌ **Timeout Error**: Ray API is not responding. Please check if the server is running properly.`;
      } else {
        return `❌ **API Error**: ${error.message}`;
      }
    }

    return `❌ **Unknown Error**: Failed to process request`;
  }
}

// Track pending command result sends to prevent duplicates
const pendingCommandResults = new Set<string>();

// Track active tool executions to prevent recursive status messages
let activeToolExecution = false;

export function setActiveToolExecution(active: boolean) {
  console.log(`[RayDaemon] Setting activeToolExecution to ${active}`);
  activeToolExecution = active;
}

export function isActiveToolExecution(): boolean {
  return activeToolExecution;
}

export async function sendCommandResultsToRay(
  originalMessage: string,
  commandResults: any[],
): Promise<void> {
  console.log("=== SEND COMMAND RESULTS TO RAY START ===");
  console.log(`[RayDaemon] *** sendCommandResultsToRay CALLED ***`);
  console.log(`[RayDaemon] Original message: "${originalMessage}"`);
  console.log(`[RayDaemon] Command results count: ${commandResults.length}`);
  console.log(
    `[RayDaemon] Command results:`,
    JSON.stringify(commandResults, null, 2),
  );

  // Create a unique key for this command result send
  const commandKey = `${originalMessage}-${JSON.stringify(commandResults)}-${Date.now()}`;

  // If we're already sending these command results, skip
  if (pendingCommandResults.has(commandKey)) {
    console.log(
      `[RayDaemon] Skipping duplicate command results send for key: ${commandKey}`,
    );
    return;
  }

  // Mark as pending
  pendingCommandResults.add(commandKey);

  // Set active tool execution flag
  setActiveToolExecution(true);

  try {
    console.log(
      `[RayDaemon] Sending command results back to Ray:`,
      commandResults,
    );

    // Send command results immediately after execution
    console.log(`[RayDaemon] Sending command results immediately...`);

    // Format message with populated command results - Ray should continue the conversation
    const messageData = config.formatMessageWithResults(
      originalMessage,
      commandResults,
    );

    console.log(`[RayDaemon] Sending command results to ${config.apiEndpoint}`);
    console.log(
      `[RayDaemon] Message data being sent:`,
      JSON.stringify(messageData, null, 2),
    );

    // Send to main API endpoint with populated command results (same as user messages)
    const response = await ApiClient.post(
      config.apiEndpoint,
      messageData,
      config.apiHeaders,
    );

    console.log(
      `[RayDaemon] Command results sent successfully to Ray. Response status: ${response.status}`,
    );
    console.log(
      `[RayDaemon] Command results API response data:`,
      JSON.stringify(response.data, null, 2),
    );

    // IMPORTANT: Process Ray's response to the command results
    if (response.data && response.status >= 200 && response.status < 300) {
      console.log(
        `[RayDaemon] Ray responded to command results with status ${response.status}, processing response...`,
      );
      console.log(
        `[RayDaemon] Ray's follow-up response:`,
        JSON.stringify(response.data, null, 2),
      );

      // Use a more flexible content detection approach
      const content =
        response.data.message ||
        response.data.content ||
        response.data.response ||
        response.data.text;
      const hasCommandCalls =
        Array.isArray(response.data.command_calls) &&
        response.data.command_calls.length > 0;

      console.log(
        `[RayDaemon] Ray follow-up has content: ${!!content}, has command calls: ${hasCommandCalls}`,
      );

      // Always process the response, regardless of content, to ensure command_calls are processed
      if (processRayResponse) {
        console.log("=== RAY FOLLOW-UP RESPONSE RECEIVED ===");
        console.log(`[RayDaemon] Calling processRayResponse for follow-up...`);
        console.log(
          `[RayDaemon] Ray's follow-up response data:`,
          JSON.stringify(response.data, null, 2),
        );

        // Important: Don't set activeToolExecution to false before processing the response
        // This ensures that the next round of command calls can be processed
        await processRayResponse(response.data);

        // Reset the active tool execution flag after successful follow-up response processing
        // This is critical to allow subsequent user messages to work properly
        if (!hasCommandCalls) {
          console.log(
            `[RayDaemon] Resetting activeToolExecution flag after successful completion`,
          );
          setActiveToolExecution(false);
        }

        console.log(`[RayDaemon] Follow-up response processed successfully`);
        console.log("=== SEND COMMAND RESULTS TO RAY END ===");
      } else {
        console.warn(
          `[RayDaemon] processRayResponse callback not set, cannot process Ray's follow-up response`,
        );

        // If the callback isn't set, show a default completion message
        const globalAny = global as any;
        if (globalAny.currentPanel) {
          globalAny.currentPanel.webview.postMessage({
            type: "rayResponse",
            data: {
              content:
                "✅ **Task completed, but unable to process follow-up.**\n\nPlease reload the extension if issues persist.",
              isFinal: true,
              isWorking: false,
            },
          });
        }
      }
    } else {
      console.log(
        `[RayDaemon] Ray did not provide a valid follow-up response. Status: ${response.status}, Data: ${JSON.stringify(response.data)}`,
      );

      // If Ray doesn't respond properly, we should still show something to the user
      if (processRayResponse) {
        await processRayResponse({
          message:
            "✅ **Task completed!**\n\nCommand results were sent successfully.",
          is_final: true,
        });
      }
    }
  } catch (error) {
    console.error("[RayDaemon] Error sending command results to Ray:", error);
    console.error("[RayDaemon] Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  } finally {
    // Remove from pending set
    pendingCommandResults.delete(commandKey);
  }
}
