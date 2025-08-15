
import { logInfo, logError } from '../../logging';
import { sendCommandResultsToRay } from '../../rayLoop';

export async function sendResultsToRay(content: string, results: any[]): Promise<void> {
    const commandResults = results.map(result => ({
        command: result.command,
        status: result.ok ? "success" : "error",
        output: result.ok ? result.output : result.error,
        args: result.args,
    }));

    try {
        await sendCommandResultsToRay(content, commandResults);
        logInfo("[Ray][command_calls] Command results sent back to Ray successfully");
    } catch (rayError) {
        logError("[Ray][command_calls] Failed to send results back to Ray:", rayError);
    }
}

export async function handleExecutionError(content: string, err: any): Promise<void> {
    const errorResults = [{
        command: "batch_execution",
        status: "error",
        output: String(err),
    }];

    try {
        await sendCommandResultsToRay(content, errorResults);
        logInfo("[Ray][command_calls] Error results sent back to Ray");
    } catch (rayError) {
        logError("[Ray][command_calls] Failed to send error results back to Ray:", rayError);
    }
}
