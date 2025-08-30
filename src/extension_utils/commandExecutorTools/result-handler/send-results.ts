import { logInfo, logError } from "../../../logging";
import { sendCommandResultsToRay, setActiveToolExecution } from "../../../rayLoop";
import { hideTyping } from "../../../extension_utils/uiNotifier";

export async function sendResultsToRay(
  content: string,
  results: any[],
): Promise<void> {
  console.log("[RayDaemon] sendResultsToRay called with content and results");
  console.log(
    "[RayDaemon] TIMING: About to send results to Ray and wait for follow-up",
  );

  // Check if execution was cancelled
  const hasCancelledResults = results.some(result => result.cancelled);
  if (hasCancelledResults) {
    console.log("[RayDaemon] Execution was cancelled, not sending results to Ray");
    setActiveToolExecution(false);
    hideTyping(); // Don't show message here since cancel handler already shows it
    return;
  }

  const commandResults = results.map((result) => ({
    command: result.command,
    status: result.ok ? "success" : "error",
    output: result.ok ? result.output : result.error,
    args: result.args,
    elapsed_ms: result.elapsed_ms || 0,
    id: result.id || null,
  }));

  try {
    console.log(
      `[RayDaemon] Sending ${commandResults.length} command results back to Ray`,
    );
    console.log(
      "[RayDaemon] TIMING: Setting active tool execution before sending results",
    );
    setActiveToolExecution(true);
    console.log(
      "[RayDaemon] TIMING: Calling sendCommandResultsToRay - this may trigger follow-up",
    );
    await sendCommandResultsToRay(content, commandResults);
    console.log(
      "[RayDaemon] TIMING: sendCommandResultsToRay completed - follow-up should be processed",
    );
    logInfo(
      "[Ray][command_calls] Command results sent back to Ray successfully",
    );
  } catch (rayError) {
    logError(
      "[Ray][command_calls] Failed to send results back to Ray:",
      rayError,
    );
    setActiveToolExecution(false);
    hideTyping("Server error while sending results. Stopped waiting.");
  }
}
