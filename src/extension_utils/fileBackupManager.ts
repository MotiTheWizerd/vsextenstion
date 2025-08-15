import * as vscode from 'vscode';
import * as path from 'path';

export class FileBackupManager {
    private fileBackups = new Map<string, string>();

    async backupFileBeforeModification(filePath: string): Promise<void> {
        try {
            const resolvedPath = this.resolveFilePath(filePath);
            if (!resolvedPath) { return; }

            if (!this.fileBackups.has(resolvedPath)) {
                try {
                    const uri = vscode.Uri.file(resolvedPath);
                    const fileContent = await vscode.workspace.fs.readFile(uri);
                    const contentString = Buffer.from(fileContent).toString('utf8');
                    this.fileBackups.set(resolvedPath, contentString);
                    console.log(`[RayDaemon] Backed up file before modification: ${resolvedPath} (${contentString.length} chars)`);
                } catch (readError) {
                    console.log(`[RayDaemon] Could not backup file (might be new): ${resolvedPath}`, readError);
                }
            } else {
                console.log(`[RayDaemon] File already backed up: ${resolvedPath}`);
            }
        } catch (error) {
            console.error(`[RayDaemon] Error backing up file ${filePath}:`, error);
        }
    }

    clearOldBackups(): void {
        if (this.fileBackups.size > 50) {
            const entries = Array.from(this.fileBackups.entries());
            const toDelete = entries.slice(0, entries.length - 50);
            toDelete.forEach(([key]) => {
                this.fileBackups.delete(key);
            });
            console.log(`[RayDaemon] Cleared ${toDelete.length} old file backups`);
        }
    }

    clearAllBackups(): void {
        const count = this.fileBackups.size;
        this.fileBackups.clear();
        console.log(`[RayDaemon] Cleared all ${count} file backups`);
    }

    private resolveFilePath(filePath: string): string | null {
        if (!path.isAbsolute(filePath)) {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                return path.join(workspaceFolders[0].uri.fsPath, filePath);
            }
            return null;
        }
        return filePath;
    }
}
