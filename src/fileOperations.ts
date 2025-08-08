import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

// Promisify fs methods
const readFileAsync = promisify(fs.readFile);
const readdirAsync = promisify(fs.readdir);
const statAsync = promisify(fs.stat);
import { shouldAutoAnalyze } from './analysis';

type FileReadOptions = {
  autoAnalyze?: boolean;
  encoding?: BufferEncoding;
};

const DEFAULT_READ_OPTIONS: FileReadOptions = {
  autoAnalyze: true,
  encoding: 'utf-8'
};

export class FileOperationError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly path?: string
  ) {
    super(message);
    this.name = 'FileOperationError';
  }
}

export async function readFile(
  filePath: string,
  options: FileReadOptions = {}
): Promise<string> {
  const { autoAnalyze, encoding } = { ...DEFAULT_READ_OPTIONS, ...options };

  try {
    // Validate input
    if (!filePath || typeof filePath !== 'string') {
      throw new FileOperationError('Invalid file path provided', 'EINVAL');
    }

    // Resolve file path
    let resolvedPath: string;
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new FileOperationError('No workspace folder is open', 'ENOWORKSPACE');
      }

      resolvedPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(workspaceFolders[0].uri.fsPath, filePath);

      // Normalize path to handle . and .. segments
      resolvedPath = path.normalize(resolvedPath);
    } catch (error) {
      throw new FileOperationError(
        `Invalid file path: ${filePath}`,
        'EINVAL',
        filePath
      );
    }

    // Read file content
    let content: string;
    try {
      const buffer = await readFileAsync(resolvedPath);
      content = buffer.toString(encoding);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new FileOperationError(
          `File not found: ${resolvedPath}`,
          'ENOENT',
          resolvedPath
        );
      }
      throw new FileOperationError(
        `Failed to read file: ${error.message}`,
        error.code,
        resolvedPath
      );
    }

    // Auto-analyze if needed
    if (autoAnalyze && shouldAutoAnalyze(resolvedPath, content)) {
      try {
        await vscode.commands.executeCommand('raydaemon.analyzeFile', {
          filePath: resolvedPath,
          content,
        });
      } catch (analysisError) {
        console.warn('[RayDaemon] Auto-analysis failed:', analysisError);
        // Don't fail the read operation if analysis fails
      }
    }

    return content;
  } catch (error) {
    if (error instanceof FileOperationError) {
      throw error;
    }
    throw new FileOperationError(
      `Unexpected error reading file: ${error instanceof Error ? error.message : String(error)}`,
      'EUNKNOWN',
      filePath
    );
  }
}

export interface FileListingOptions {
  showHidden?: boolean;
  recursive?: boolean;
  maxDepth?: number;
}

export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'symbolic-link' | 'other';
  size?: number;
  modified?: Date;
}

export async function listFiles(
  dirPath: string = '.',
  options: FileListingOptions = {}
): Promise<FileEntry[]> {
  const { showHidden = false, recursive = false, maxDepth = 1 } = options;

  try {
    // Validate input
    if (typeof dirPath !== 'string') {
      throw new FileOperationError('Invalid directory path', 'EINVAL');
    }

    // Resolve directory path
    let resolvedPath: string;
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new FileOperationError('No workspace folder is open', 'ENOWORKSPACE');
      }

      resolvedPath = dirPath === '.'
        ? workspaceFolders[0].uri.fsPath
        : path.isAbsolute(dirPath)
          ? dirPath
          : path.join(workspaceFolders[0].uri.fsPath, dirPath);

      resolvedPath = path.normalize(resolvedPath);
    } catch (error) {
      throw new FileOperationError(
        `Invalid directory path: ${dirPath}`,
        'EINVAL',
        dirPath
      );
    }

    // Check if path exists and is a directory
    let stats: fs.Stats;
    try {
      stats = await statAsync(resolvedPath);
      if (!stats.isDirectory()) {
        throw new FileOperationError(
          `Path is not a directory: ${resolvedPath}`,
          'ENOTDIR',
          resolvedPath
        );
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new FileOperationError(
          `Directory not found: ${resolvedPath}`,
          'ENOENT',
          resolvedPath
        );
      }
      throw new FileOperationError(
        `Failed to access directory: ${error.message}`,
        error.code,
        resolvedPath
      );
    }

    // Read directory contents
    let entries: fs.Dirent[];
    try {
      const files = await readdirAsync(resolvedPath, { withFileTypes: true });
      entries = files as fs.Dirent[];
    } catch (error: any) {
      throw new FileOperationError(
        `Failed to read directory: ${error.message}`,
        error.code,
        resolvedPath
      );
    }

    // Process entries
    const result: FileEntry[] = [];

    for (const entry of entries) {
      // Skip hidden files/folders if not showing hidden
      if (!showHidden && entry.name.startsWith('.')) {
        continue;
      }

      const entryPath = path.join(resolvedPath, entry.name);
      
      // Get entry type
      let entryType: FileEntry['type'] = 'other';
      if (entry.isFile()) {
        entryType = 'file';
      } else if (entry.isDirectory()) {
        entryType = 'directory';
      } else if (entry.isSymbolicLink()) {
        entryType = 'symbolic-link';
      }

      // Get file stats for size and modified time
      let size: number | undefined;
      let modified: Date | undefined;
      
      try {
        const entryStats = await statAsync(entryPath);
        size = entryType === 'file' ? entryStats.size : undefined;
        modified = entryStats.mtime;
      } catch (error) {
        // Skip if we can't get stats
        console.warn(`[RayDaemon] Could not get stats for ${entryPath}:`, error);
      }

      result.push({
        name: entry.name,
        path: entryPath,
        type: entryType,
        size,
        modified
      });
    }

    // Sort directories first, then files, both alphabetically
    result.sort((a, b) => {
      if (a.type === b.type) {
        return a.name.localeCompare(b.name);
      }
      return a.type === 'directory' ? -1 : 1;
    });

    return result;
  } catch (error) {
    if (error instanceof FileOperationError) {
      throw error;
    }
    throw new FileOperationError(
      `Unexpected error listing files: ${error instanceof Error ? error.message : String(error)}`,
      'EUNKNOWN',
      dirPath
    );
  }
}

/**
 * Formats file entries as a human-readable string
 */
export function formatFileList(entries: FileEntry[]): string {
  return entries
    .map(entry => {
      const typeIcon = entry.type === 'directory' ? '📁' : '📄';
      const size = entry.size !== undefined ? ` (${formatFileSize(entry.size)})` : '';
      const modified = entry.modified ? ` - ${entry.modified.toLocaleString()}` : '';
      return `${typeIcon} ${entry.name}${size}${modified}`;
    })
    .join('\n');
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
