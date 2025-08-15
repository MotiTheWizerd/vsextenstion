import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

class FileBackupManager {
    private backupDir: string;

    constructor() {
        this.backupDir = path.join(os.tmpdir(), 'raydaemon-backups');
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir);
        }
    }

    async backupFileBeforeModification(filePath: string): Promise<void> {
        try {
            const backupPath = path.join(this.backupDir, `${path.basename(filePath)}.${Date.now()}.bak`);
            await vscode.workspace.fs.copy(vscode.Uri.file(filePath), vscode.Uri.file(backupPath));
        } catch (error) {
            console.error(`[RayDaemon] Failed to backup file: ${filePath}`, error);
        }
    }

    clearOldBackups(): void {
        // Implement logic to clear old backups if needed
    }
}

export class FileManager {
    private fileBackupManager: FileBackupManager;

    constructor() {
        this.fileBackupManager = new FileBackupManager();
    }

    public getFilePathFromCommand(command: string, args: any[]): string | null {
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

    public async backupFileBeforeModification(filePath: string): Promise<void> {
        await this.fileBackupManager.backupFileBeforeModification(filePath);
    }

    public clearOldBackups(): void {
        this.fileBackupManager.clearOldBackups();
    }

    public async autoOpenModifiedFiles(results: any[]): Promise<void> {
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
}