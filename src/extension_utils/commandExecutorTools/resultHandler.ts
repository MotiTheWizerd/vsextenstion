import { logInfo, logError } from "../../logging";
import { sendCommandResultsToRay, setActiveToolExecution } from "../../rayLoop";

export async function sendResultsToRay(
  content: string,
  results: any[],
): Promise<void> {
  console.log("[RayDaemon] sendResultsToRay called with content and results");

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
    // Setting active tool execution before sending results
    setActiveToolExecution(true);
    await sendCommandResultsToRay(content, commandResults);
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
    setActiveToolExecution(true);
    await sendCommandResultsToRay(content, errorResults);
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
