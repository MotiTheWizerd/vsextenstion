import { logInfo, logError } from "../../../logging";
import { sendCommandResultsToRay, setActiveToolExecution } from "../../../rayLoop";

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
  }
}

