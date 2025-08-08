import { promises as fs } from 'fs';
import * as path from 'path';
import { resolveWorkspacePath } from './pathResolver';
import { FileOperationError } from './errors';
import type { RemoveOptions } from './types';
export async function removePath(targetPath: string, options: RemoveOptions = {}): Promise<void> {
  const { recursive = false } = options;
  try {
    const abs = resolveWorkspacePath(targetPath);
    const stat = await fs.lstat(abs).catch(() => null);
    if (!stat) return;

    if (stat.isDirectory()) {
      if (recursive) {
        // Node 18+ has fs.rm with recursive; keep it compatible
        await fs.rm(abs, { recursive: true, force: true });
      } else {
        await fs.rmdir(abs);
      }
    } else {
      await fs.unlink(abs);
    }
  } catch (error) {
    if (error instanceof FileOperationError) throw error;
    throw new FileOperationError(
      `Failed to remove: ${targetPath} — ${error instanceof Error ? error.message : String(error)}`,
      'EREMOVE',
      targetPath
    );
  }
}
