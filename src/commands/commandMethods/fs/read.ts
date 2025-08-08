import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import { DEFAULT_READ_OPTIONS, FileReadOptions } from './types';
import { resolveWorkspacePath } from './pathResolver';
import { FileOperationError } from './errors';
import { shouldAutoAnalyze } from '../../../analysis'; // same import you had

export async function readFile(
  filePath: string,
  options: FileReadOptions = {}
): Promise<string> {
  const { autoAnalyze, encoding } = { ...DEFAULT_READ_OPTIONS, ...options };

  try {
    if (!filePath || typeof filePath !== 'string') {
      throw new FileOperationError('Invalid file path provided', 'EINVAL');
    }

    const resolvedPath = resolveWorkspacePath(filePath);

    let content: string;
    try {
      const buffer = await fs.readFile(resolvedPath);
      content = buffer.toString(encoding);
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        throw new FileOperationError(`File not found: ${resolvedPath}`, 'ENOENT', resolvedPath);
      }
      throw new FileOperationError(
        `Failed to read file: ${error?.message ?? String(error)}`,
        error?.code,
        resolvedPath
      );
    }

    if (autoAnalyze && shouldAutoAnalyze(resolvedPath, content)) {
      try {
        await vscode.commands.executeCommand('raydaemon.analyzeFile', {
          filePath: resolvedPath,
          content,
        });
      } catch (analysisError) {
        console.warn('[RayDaemon] Auto-analysis failed:', analysisError);
        // swallow analysis failures
      }
    }

    return content;
  } catch (error) {
    if (error instanceof FileOperationError) throw error;
    throw new FileOperationError(
      `Unexpected error reading file: ${error instanceof Error ? error.message : String(error)}`,
      'EUNKNOWN',
      filePath
    );
  }
}
