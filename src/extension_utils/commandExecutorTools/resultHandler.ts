import { logInfo, logError } from "../../logging";
import { sendCommandResultsToRay, setActiveToolExecution } from "../../rayLoop";

export async function sendResultsToRay(
  content: string,
  results: any[],
): Promise<void> {
  console.log("[RayDaemon] sendResultsToRay called with content and results");
  console.log(
    "[RayDaemon] TIMING: About to send results to Ray and wait for follow-up",
  );

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
    // Setting active tool execution before sending results
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
    // Make sure to reset the active tool execution flag even on error
    setActiveToolExecution(false);
  }
}

export async function handleExecutionError(
  content: string,
  err: any,
): Promise<void> {
  console.log("[RayDaemon] handleExecutionError called with error:", err);

  const errorResults = [
    {
      command: "batch_execution",
      status: "error",
      output: String(err),
      elapsed_ms: 0,
    },
  ];

  try {
    console.log("[RayDaemon] Sending error results back to Ray");
    console.log(
      "[RayDaemon] TIMING: Setting active tool execution for error case",
    );
    setActiveToolExecution(true);
    console.log(
      "[RayDaemon] TIMING: Calling sendCommandResultsToRay for errors",
    );
    await sendCommandResultsToRay(content, errorResults);
    console.log("[RayDaemon] TIMING: Error sendCommandResultsToRay completed");
    logInfo("[Ray][command_calls] Error results sent back to Ray");
  } catch (rayError) {
    logError(
      "[Ray][command_calls] Failed to send error results back to Ray:",
      rayError,
    );
    // Make sure to reset the active tool execution flag even on error
    setActiveToolExecution(false);
  }
}
