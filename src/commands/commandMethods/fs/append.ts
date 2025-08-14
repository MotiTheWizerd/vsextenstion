import { promises as fs } from 'fs';
import * as path from 'path';
import { FileOperationError } from './errors';
import { resolveWorkspacePath } from './pathResolver';

export async function appendToFile(filePath: string, content: string, encoding: BufferEncoding = 'utf-8'): Promise<void> {
  try {
    const abs = resolveWorkspacePath(filePath);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.appendFile(abs, content, { encoding });
  } catch (error) {
    if (error instanceof FileOperationError) {throw error;}
    throw new FileOperationError(
      `Failed to append file: ${filePath} — ${error instanceof Error ? error.message : String(error)}`,
      'EAPPEND',
      filePath
    );
  }
}
