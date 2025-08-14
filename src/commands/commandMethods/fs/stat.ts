import { promises as fs } from 'fs';
import * as path from 'path';
import { resolveWorkspacePath } from './pathResolver';
import { FileOperationError } from './errors';
import { FileEntry } from './types';

export async function getFileInfo(filePath: string): Promise<FileEntry> {
  try {
    const abs = resolveWorkspacePath(filePath);
    const st = await fs.lstat(abs);
    const type =
      st.isDirectory() ? 'directory' :
      st.isSymbolicLink() ? 'symbolic-link' :
      st.isFile() ? 'file' : 'other';

    return {
      name: path.basename(abs),
      path: filePath,
      type,
      size: st.isFile() ? st.size : undefined,
      modified: st.mtime,
    };
  } catch (error) {
    if (error instanceof FileOperationError) {throw error;}
    throw new FileOperationError(
      `Failed to stat: ${filePath} — ${error instanceof Error ? error.message : String(error)}`,
      'ESTAT',
      filePath
    );
  }
}
