import * as vscode from 'vscode';
import * as path from 'path';
import { FileOperationError } from  "./errors";

export function ensureWorkspace(): vscode.WorkspaceFolder {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    throw new FileOperationError('No workspace folder is open', 'ENOWORKSPACE');
  }
  return workspaceFolders[0];
}

/**
 * Resolve a user-provided path (absolute or workspace-relative) to an absolute FS path.
 * Normalizes ".", "..", and separators.
 */
export function resolveWorkspacePath(userPath: string): string {
  if (!userPath || typeof userPath !== 'string') {
    throw new FileOperationError('Invalid path provided', 'EINVAL', userPath as any);
  }

  const workspace = ensureWorkspace();

  const abs = path.isAbsolute(userPath)
    ? userPath
    : path.join(workspace.uri.fsPath, userPath);

  return path.normalize(abs);
}
