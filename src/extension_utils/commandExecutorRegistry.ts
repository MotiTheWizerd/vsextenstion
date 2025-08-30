import { CommandExecutor } from './commandExecutor';

/**
 * Global registry for the CommandExecutor instance to enable cancellation
 */
class CommandExecutorRegistry {
  private static instance: CommandExecutorRegistry;
  private commandExecutor: CommandExecutor | null = null;

  private constructor() {}

  public static getInstance(): CommandExecutorRegistry {
    if (!CommandExecutorRegistry.instance) {
      CommandExecutorRegistry.instance = new CommandExecutorRegistry();
    }
    return CommandExecutorRegistry.instance;
  }

  public setCommandExecutor(executor: CommandExecutor): void {
    this.commandExecutor = executor;
  }

  public getCommandExecutor(): CommandExecutor | null {
    return this.commandExecutor;
  }

  public cancelCurrentExecution(): void {
    if (this.commandExecutor) {
      console.log('[RayDaemon] Cancelling current tool execution via registry');
      this.commandExecutor.cancelExecution();
    } else {
      console.log('[RayDaemon] No CommandExecutor available to cancel');
    }
  }
}

export { CommandExecutorRegistry };