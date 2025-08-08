import * as path from 'path';
import { promises as fs } from 'fs';
import { FileOperationError } from './errors';
import { resolveWorkspacePath } from './pathResolver';
import type { GlobOptions } from './types';

export async function globSearch(patterns: string[], options: GlobOptions = {}): Promise<string[]> {
  try {
    const { ignore = [], limit = 500, includeDirs = false } = options;
    const regexes = patterns.map(p => globToRegex(p));
    const ignoreRegexes = ignore.map(p => globToRegex(p));
    const root = resolveWorkspacePath('.');

    const out: string[] = [];
    await walk(root, async (abs, rel, isDir) => {
      if (!includeDirs && isDir) return;
      if (regexes.some(r => r.test(rel)) && !ignoreRegexes.some(r => r.test(rel))) {
        out.push(rel);
      }
      return out.length < limit;
    });

    return out;
  } catch (error) {
    if (error instanceof FileOperationError) throw error;
    throw new FileOperationError(
      `Glob search failed — ${error instanceof Error ? error.message : String(error)}`,
      'EGLOB'
    );
  }
}

function globToRegex(glob: string): RegExp {
  // Very small glob subset: **, *, ?, and path separators
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\*\\\*/g, '§DOUBLESTAR§')
    .replace(/\\\*/g, '[^/]*')
    .replace(/\\\?/g, '[^/]')
    .replace(/§DOUBLESTAR§/g, '.*');
  return new RegExp('^' + escaped + '$');
}

async function walk(root: string, visitor: (abs: string, rel: string, isDir: boolean) => Promise<boolean | void>) {
  const stack: string[] = [root];
  while (stack.length) {
    const cur = stack.pop()!;
    const entries = await fs.readdir(cur, { withFileTypes: true });
    for (const e of entries) {
      const abs = path.join(cur, e.name);
      const rel = path.relative(root, abs).replace(/\\/g, '/');
      const isDir = e.isDirectory();
      const cont = await visitor(abs, rel, isDir);
      if (cont === false) return;
      if (isDir) stack.push(abs);
    }
  }
}
