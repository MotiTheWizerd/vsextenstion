import { promises as fs } from 'fs';
import { resolveWorkspacePath } from './pathResolver';
import { FileOperationError } from './errors';

export async function ensureDir(dirPath: string): Promise<void> {
  try {
    const abs = resolveWorkspacePath(dirPath);
    await fs.mkdir(abs, { recursive: true });
  } catch (error) {
    if (error instanceof FileOperationError) {throw error;}
    throw new FileOperationError(
      `Failed to create directory: ${dirPath} — ${error instanceof Error ? error.message : String(error)}`,
      'EMKDIR',
      dirPath
    );
  }
}
