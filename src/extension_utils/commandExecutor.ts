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

  constructor() {
    this.fileManager = new FileManager();
  }

  async executeCommandCallsAndSendResults(
    content: string,
    commandCalls: any[],
  ): Promise<void> {
    console.log("[RayDaemon] *** executeCommandCallsAndSendResults CALLED ***");

    if (!Array.isArray(commandCalls) || commandCalls.length === 0) {
      console.log("[RayDaemon] No command calls to execute");
      return;
    }

    if (this.isExecutingTools) {
      console.log(
        "[RayDaemon] Tools already executing, skipping duplicate execution",
      );
      return;
    }

    this.isExecutingTools = true;
    setActiveToolExecution(true);
    logInfo(
      "[RayDaemon] Starting tool execution for " +
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
      );

      await this.fileManager.autoOpenModifiedFiles(results);
      await showFinalStatus(toolNames, results);

      console.log(
        "[RayDaemon] Tool execution completed, sending results to Ray",
      );
      await sendResultsToRay(content, results);
      logInfo("[RayDaemon] Results sent to Ray successfully");
    } catch (err) {
      console.error(
        "[RayDaemon] Error in executeCommandCallsAndSendResults:",
        err,
      );
      await handleExecutionError(content, err);
    } finally {
      this.isExecutingTools = false;
      // Note: We don't reset the activeToolExecution flag here because
      // it needs to stay active until Ray's follow-up response is processed
      this.fileManager.clearOldBackups();
    }
  }
}
