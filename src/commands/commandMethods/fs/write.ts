import { promises as fs } from 'fs';
import * as path from 'path';
import { FileOperationError } from './errors';
import { resolveWorkspacePath } from './pathResolver';
import type { WriteOptions } from './types';

export async function writeFileSafe(filePath: string, content: string | Buffer, options: WriteOptions = {}): Promise<void> {
  try {
    const abs = resolveWorkspacePath(filePath);
    const dir = path.dirname(abs);
    const { createDirs = true, encoding = 'utf-8' } = options;

    if (createDirs) {
      await fs.mkdir(dir, { recursive: true });
    }

    await fs.writeFile(abs, content, typeof content === 'string' ? { encoding } : undefined);
  } catch (error) {
    if (error instanceof FileOperationError) throw error;
    throw new FileOperationError(
      `Failed to write file: ${filePath} — ${error instanceof Error ? error.message : String(error)}`,
      'EWRITE',
      filePath
    );
  }
}
