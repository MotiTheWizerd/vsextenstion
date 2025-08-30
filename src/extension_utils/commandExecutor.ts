import { logError, logInfo } from "../logging";
import { generateToolNames } from "./commandExecutorTools/toolNameGenerator";
import {
  showInitialStatus,
  showFinalStatus,
} from "./commandExecutorTools/toolStatusNotifier";
import { executeCommands } from "./commandExecutorTools/commandProcessor";
import { FileManager } from "./commandExecutorTools/fileManager";
import {
  sendResultsToRay,
  handleExecutionError,
} from "./commandExecutorTools/resultHandler";
import { setActiveToolExecution } from "../rayLoop";

export class CommandExecutor {
  private isExecutingTools = false;
  private fileManager: FileManager;
  private isCancelled = false;

  constructor() {
    this.fileManager = new FileManager();
  }

  public cancelExecution(): void {
    console.log('[RayDaemon] CommandExecutor: Cancellation requested');
    this.isCancelled = true;
  }

  private resetCancellation(): void {
    this.isCancelled = false;
  }

  async executeCommandCallsAndSendResults(
    content: string,
    commandCalls: any[],
  ): Promise<void> {
    const executionId = Date.now().toString().slice(-6);
    console.log(
      `[RayDaemon] *** executeCommandCallsAndSendResults CALLED [${executionId}] ***`,
    );
    console.log(
      `[RayDaemon] [${executionId}] Current isExecutingTools state: ${this.isExecutingTools}`,
    );
    console.log(
      `[RayDaemon] [${executionId}] CommandCalls to execute: ${commandCalls.length}`,
    );

    if (!Array.isArray(commandCalls) || commandCalls.length === 0) {
      console.log(`[RayDaemon] [${executionId}] No command calls to execute`);
      return;
    }

    if (this.isExecutingTools) {
      console.log(
        `[RayDaemon] [${executionId}] RACE CONDITION: Tools already executing, skipping duplicate execution`,
      );
      console.log(
        `[RayDaemon] [${executionId}] CRITICAL: This blocks follow-up commands - should be false here!`,
      );
      return;
    }

    console.log(
      `[RayDaemon] [${executionId}] Setting isExecutingTools = true and starting execution`,
    );
    this.isExecutingTools = true;
    this.resetCancellation(); // Reset cancellation state for new execution
    setActiveToolExecution(true);
    logInfo(
      `[RayDaemon] [${executionId}] Starting tool execution for ` +
        commandCalls.length +
        " commands",
    );

    try {
      const toolNames = generateToolNames(commandCalls);
      await showInitialStatus(toolNames, commandCalls.length);

      const results = await executeCommands(
        commandCalls,
        toolNames,
        this.fileManager,
        () => this.isCancelled, // Pass cancellation check function
      );

      // Check if execution was cancelled
      if (this.isCancelled) {
        console.log(
          `[RayDaemon] [${executionId}] Execution was cancelled, skipping result processing`,
        );
        await showFinalStatus(toolNames, results, true); // Show cancelled status
        this.isExecutingTools = false;
        setActiveToolExecution(false);
        
        // Notify UI about cancellation - hideTyping will reset the UI state
        const { hideTyping } = require("../extension_utils/uiNotifier");
        hideTyping(); // Don't show duplicate message here since cancel handler already shows it
        
        logInfo(`[RayDaemon] [${executionId}] Tool execution cancelled by user`);
        return;
      }

      await this.fileManager.autoOpenModifiedFiles(results);
      await showFinalStatus(toolNames, results);

      console.log(
        `[RayDaemon] [${executionId}] Tool execution completed, resetting isExecutingTools BEFORE sending results to Ray`,
      );

      // Reset isExecutingTools BEFORE sending results to prevent race condition
      // This is critical because sendResultsToRay() may trigger follow-up responses
      // that contain more command_calls, which need to be able to execute
      this.isExecutingTools = false;
      console.log(
        `[RayDaemon] [${executionId}] isExecutingTools reset to false, now sending results to Ray`,
      );

      await sendResultsToRay(content, results);
      console.log(
        `[RayDaemon] [${executionId}] sendResultsToRay completed - any follow-ups should have been processed`,
      );
      logInfo(`[RayDaemon] [${executionId}] Results sent to Ray successfully`);
    } catch (err) {
      console.error(
        "[RayDaemon] Error in executeCommandCallsAndSendResults:",
        err,
      );

      // Reset isExecutingTools on error to prevent deadlock
      console.log(
        `[RayDaemon] [${executionId}] Resetting isExecutingTools on error to prevent deadlock`,
      );
      this.isExecutingTools = false;

      await handleExecutionError(content, err);
    } finally {
      console.log(
        `[RayDaemon] [${executionId}] FINALLY BLOCK: Ensuring isExecutingTools = false`,
      );
      // Ensure isExecutingTools is false (should already be false from success/error paths)
      this.isExecutingTools = false;
      console.log(
        `[RayDaemon] [${executionId}] FINALLY BLOCK: isExecutingTools is now: ${this.isExecutingTools}`,
      );
      // Note: We don't reset the activeToolExecution flag here because
      // it needs to stay active until Ray's follow-up response is processed
      this.fileManager.clearOldBackups();
    }
  }
}
