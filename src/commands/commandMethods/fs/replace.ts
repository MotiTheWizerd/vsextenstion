import { promises as fs } from 'fs';
import { FileOperationError } from './errors';
import { resolveWorkspacePath } from './pathResolver';
import type { ReplaceOptions } from './types';

export async function replaceInFile(
  filePath: string,
  search: string,
  replacement: string,
  opts: ReplaceOptions = {}
): Promise<number> {
  const {
    encoding = 'utf-8',
    isRegex = false,
    multiline = false,
    caseInsensitive = false,
    global = true,
  } = opts;

  try {
    const abs = resolveWorkspacePath(filePath);
    const original = await fs.readFile(abs, { encoding });

    const flags = `${global ? 'g' : ''}${multiline ? 'm' : ''}${caseInsensitive ? 'i' : ''}`;
    const regex = isRegex ? new RegExp(search, flags) : new RegExp(escapeRegex(search), flags);

    let count = 0;
    const replaced = original.replace(regex, (m) => {
      count += 1;
      return replacement;
    });

    if (count > 0) {
      await fs.writeFile(abs, replaced, { encoding });
    }
    return count;
  } catch (error) {
    if (error instanceof FileOperationError) {throw error;}
    throw new FileOperationError(
      `Failed to replace in file: ${filePath} — ${error instanceof Error ? error.message : String(error)}`,
      'EREPLACE',
      filePath
    );
  }
}
function escapeRegex(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }