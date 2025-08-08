import { promises as fs } from 'fs';
import * as path from 'path';
import { resolveWorkspacePath } from './pathResolver';
import { FileOperationError } from './errors';
import type { MoveOptions } from './types';

export async function movePath(src: string, dest: string, opts: MoveOptions = {}): Promise<void> {
  const { overwrite = false, createDirs = true } = opts;

  try {
    const absSrc = resolveWorkspacePath(src);
    const absDest = resolveWorkspacePath(dest);

    if (createDirs) {
      await fs.mkdir(path.dirname(absDest), { recursive: true });
    }

    if (!overwrite) {
      const exists = await fs.stat(absDest).then(() => true).catch(() => false);
      if (exists) throw new FileOperationError(`Destination exists: ${dest}`, 'EEXIST', dest);
    } else {
      // best-effort: remove existing
      await fs.rm(absDest, { force: true, recursive: true }).catch(() => {});
    }

    await fs.rename(absSrc, absDest);
  } catch (error) {
    if (error instanceof FileOperationError) throw error;
    throw new FileOperationError(
      `Failed to move: ${src} → ${dest} — ${error instanceof Error ? error.message : String(error)}`,
      'EMOVE',
      dest
    );
  }
}
