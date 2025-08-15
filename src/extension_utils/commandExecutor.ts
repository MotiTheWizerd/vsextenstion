import * as vscode from 'vscode';
import * as path from 'path';
import { logInfo, logError } from '../logging';
import { createExecuteCommandFactory } from '../commands/execFactory';
import { commandHandlers } from '../commands/commandHandler';
import { sendCommandResultsToRay } from '../rayLoop';
import { FileBackupManager } from './fileBackupManager';

export class CommandExecutor {
    private isExecutingTools = false;
    private fileBackupManager: FileBackupManager;

    constructor() {
        this.fileBackupManager = new FileBackupManager();
    }

    private getCurrentPanel(): any {
        return (global as any).currentPanel;
    }

    async executeCommandCallsAndSendResults(content: string, commandCalls: any[]): Promise<void> {
        console.log("[RayDaemon] *** executeCommandCallsAndSendResults CALLED ***");
        
        if (!Array.isArray(commandCalls) || commandCalls.length === 0) {
            console.log("[RayDaemon] No command calls to execute");
            return;
        }

        if (this.isExecutingTools) {
            console.log("[RayDaemon] Tools already executing, skipping duplicate execution");
            return;
        }

        this.isExecutingTools = true;

        try {
            const toolNames = this.generateToolNames(commandCalls);
            await this.showInitialStatus(toolNames, commandCalls.length);
            
            const results = await this.executeCommands(commandCalls, toolNames);
            
            await this.autoOpenModifiedFiles(results);
            await this.showFinalStatus(toolNames, results);
            
            await this.sendResultsToRay(content, results);

        } catch (err) {
            console.error("[RayDaemon] Error in executeCommandCallsAndSendResults:", err);
            await this.handleExecutionError(content, err);
        } finally {
            this.isExecutingTools = false;
            this.fileBackupManager.clearOldBackups();
        }
    }

    private generateToolNames(commandCalls: any[]): string[] {
        return commandCalls.map(call => {
            const args = call.args || [];
            switch (call.command) {
                case "read":
                    const fileName = args[0] ? args[0].split(/[/\\]/).pop() : "file";
                    return `Reading ${fileName}`;
                case "searchRegex":
                case "searchText":
                    const searchTerm = args[0] || "text";
                    return `Searching "${searchTerm.length > 15 ? searchTerm.substring(0, 15) + "..." : searchTerm}"`;
                // Add other cases as needed
                default:
                    return call.command;
            }
        });
    }

    private async showInitialStatus(toolNames: string[], totalCount: number): Promise<void> {
        const currentPanel = this.getCurrentPanel();
        if (currentPanel) {
            currentPanel.webview.postMessage({
                type: "toolStatus",
                data: {
                    status: "starting",
                    tools: toolNames,
                    totalCount: totalCount,
                    batchMode: true,
                }
            });
        }
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    private async executeCommands(commandCalls: any[], toolNames: string[]): Promise<any[]> {
        const results: any[] = [];
        const { executeOne } = createExecuteCommandFactory(commandHandlers);

        for (let i = 0; i < commandCalls.length; i++) {
            const call = commandCalls[i];
            const toolName = toolNames[i];

            this.updateExecutionProgress(i, toolName, commandCalls.length);

            try {
                const filePath = this.getFilePathFromCommand(call.command, call.args);
                if (filePath) {
                    await this.fileBackupManager.backupFileBeforeModification(filePath);
                }

                const result = await executeOne(call);
                results.push(result);

                if (i < commandCalls.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 150));
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

    private updateExecutionProgress(currentIndex: number, toolName: string, totalCount: number): void {
        const currentPanel = this.getCurrentPanel();
        if (currentPanel) {
            currentPanel.webview.postMessage({
                type: "toolStatus",
                data: {
                    status: "working",
                    tools: [toolName],
                    currentIndex: currentIndex + 1,
                    totalCount: totalCount,
                    batchMode: true,
                }
            });
        }
    }

    private getFilePathFromCommand(command: string, args: any[]): string | null {
        if (!args || args.length === 0) {
            return null;
        }

        switch (command) {
            case "write":
            case "append":
            case "replace":
                return typeof args[0] === "string" ? args[0] : null;
            default:
                return null;
        }
    }

    private async autoOpenModifiedFiles(results: any[]): Promise<void> {
        const autoOpenEnabled = vscode.workspace
            .getConfiguration("raydaemon")
            .get("autoOpenModifiedFiles", true);

        if (!autoOpenEnabled) {
            return;
        }

        const filesToOpen = new Set<string>();
        const fileModifyingCommands = ["write", "append", "replace", "read"];

        for (const result of results) {
            if (!result.ok || !fileModifyingCommands.includes(result.command)) {
                continue;
            }

            const filePath = this.getFilePathFromCommand(result.command, result.args);
            if (filePath && typeof filePath === "string") {
                const resolvedPath = this.resolveFilePath(filePath);
                if (resolvedPath) {
                    filesToOpen.add(resolvedPath);
                }
            }
        }

        await this.openFiles(Array.from(filesToOpen).slice(0, 5));
    }

    private resolveFilePath(filePath: string): string | null {
        if (!path.isAbsolute(filePath)) {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                return path.join(workspaceFolders[0].uri.fsPath, filePath);
            }
        }
        return filePath;
    }

    private async openFiles(filePaths: string[]): Promise<void> {
        for (const filePath of filePaths) {
            try {
                const uri = vscode.Uri.file(filePath);
                await vscode.workspace.fs.stat(uri);
                await vscode.window.showTextDocument(uri, {
                    viewColumn: vscode.ViewColumn.One,
                    preview: false,
                    preserveFocus: false,
                });
                await new Promise(resolve => setTimeout(resolve, 150));
            } catch (error) {
                console.error(`[RayDaemon] Failed to auto-open file: ${filePath}`, error);
            }
        }
    }

    private async showFinalStatus(toolNames: string[], results: any[]): Promise<void> {
        const currentPanel = this.getCurrentPanel();
        if (currentPanel) {
            const successCount = results.filter(r => r.ok).length;
            const failedCount = results.length - successCount;

            currentPanel.webview.postMessage({
                type: "toolStatus",
                data: {
                    status: "completed",
                    tools: toolNames,
                    totalCount: results.length,
                    successCount,
                    failedCount,
                    results: results.map(result => ({
                        command: result.command,
                        args: result.args,
                        ok: result.ok,
                        output: result.output,
                        outputLength: result.output?.length || 0,
                        error: result.error,
                    })),
                    batchMode: true,
                }
            });
        }
    }

    private async sendResultsToRay(content: string, results: any[]): Promise<void> {
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

    private async handleExecutionError(content: string, err: any): Promise<void> {
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
}
