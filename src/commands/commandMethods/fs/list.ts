import { promises as fs } from 'fs';
import type { Stats } from 'fs';
import * as path from 'path';
import { FileEntry, FileListingOptions } from './types';
import { FileOperationError } from './errors';
import { resolveWorkspacePath } from './pathResolver';

export async function listFiles(
  dirPath: string = '.',
  options: FileListingOptions = {}
): Promise<FileEntry[]> {
  const { showHidden = false } = options;

  try {
    if (typeof dirPath !== 'string') {
      throw new FileOperationError('Invalid directory path', 'EINVAL');
    }

    const resolvedPath = resolveWorkspacePath(dirPath);

    let stats: Stats;
    try {
      stats = await fs.stat(resolvedPath);
      if (!stats.isDirectory()) {
        throw new FileOperationError(`Path is not a directory: ${resolvedPath}`, 'ENOTDIR', resolvedPath);
      }
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        throw new FileOperationError(`Directory not found: ${resolvedPath}`, 'ENOENT', resolvedPath);
      }
      throw new FileOperationError(
        `Failed to access directory: ${error?.message ?? String(error)}`,
        error?.code,
        resolvedPath
      );
    }

    const dirents = await fs.readdir(resolvedPath, { withFileTypes: true });
    const result: FileEntry[] = [];

    for (const entry of dirents) {
      if (!showHidden && entry.name.startsWith('.')) continue;

      const entryPath = path.join(resolvedPath, entry.name);

      const entryType: FileEntry['type'] =
        entry.isFile?.() ? 'file'
        : entry.isDirectory?.() ? 'directory'
        : entry.isSymbolicLink?.() ? 'symbolic-link'
        : 'other';

      let size: number | undefined;
      let modified: Date | undefined;

      try {
        const st: Stats = await fs.stat(entryPath);
        size = entryType === 'file' ? st.size : undefined;
        modified = st.mtime;
      } catch (e) {
        console.warn(`[RayDaemon] Could not get stats for ${entryPath}:`, e);
      }

      result.push({
        name: entry.name,
        path: entryPath,
        type: entryType,
        size,
        modified,
      });
    }

    result.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'directory' ? -1 : 1;
    });

    return result;
  } catch (error) {
    if (error instanceof FileOperationError) throw error;
    throw new FileOperationError(
      `Unexpected error listing files: ${error instanceof Error ? error.message : String(error)}`,
      'EUNKNOWN',
      dirPath
    );
  }
}
