import { logInfo, logError } from "../../../logging";
import { sendCommandResultsToRay, setActiveToolExecution } from "../../../rayLoop";
import { hideTyping } from "../../../extension_utils/uiNotifier";

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
    setActiveToolExecution(false);
    hideTyping("Server error while reporting failure. Stopped waiting.");
  }
}
