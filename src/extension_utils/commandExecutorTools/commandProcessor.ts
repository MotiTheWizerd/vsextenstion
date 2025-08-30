
import { createExecuteCommandFactory } from '../../commands/execFactory';
import { commandHandlers } from '../../commands/commandHandler';
import { updateExecutionProgress } from './toolStatusNotifier';
import { FileManager } from './fileManager';

export async function executeCommands(
    commandCalls: any[], 
    toolNames: string[], 
    fileManager: FileManager,
    isCancelled?: () => boolean
): Promise<any[]> {
    const results: any[] = [];
    const { executeOne } = createExecuteCommandFactory(commandHandlers);

    for (let i = 0; i < commandCalls.length; i++) {
        // Check for cancellation before each command
        if (isCancelled && isCancelled()) {
            console.log(`[RayDaemon] Command execution cancelled at step ${i + 1}/${commandCalls.length}`);
            // Add cancelled status for remaining commands
            for (let j = i; j < commandCalls.length; j++) {
                results.push({
                    command: commandCalls[j].command,
                    args: commandCalls[j].args || [],
                    ok: false,
                    error: 'Execution cancelled by user',
                    cancelled: true
                });
            }
            break;
        }

        const call = commandCalls[i];
        const toolName = toolNames[i];

        await updateExecutionProgress(i, toolName, commandCalls.length);

        try {
            const filePath = fileManager.getFilePathFromCommand(call.command, call.args);
            if (filePath) {
                await fileManager.backupFileBeforeModification(filePath);
            }

            const result = await executeOne(call);
            results.push(result);

            if (i < commandCalls.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        } catch (error) {
            results.push({
                command: call.command,
                args: call.args || [],
                ok: false,
                error: String(error)
            });
        }
    }

    return results;
}
