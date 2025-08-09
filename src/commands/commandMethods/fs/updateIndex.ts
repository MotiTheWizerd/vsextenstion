import * as vscode from 'vscode';
import * as path from 'path';
import { promises as fs } from 'fs';
import { FileOperationError } from './errors';
import { WorkspaceIndex, FileIndex, createIndex, IndexMetadata } from './createIndex';
import { findSymbolsInFile, SymbolInfo } from './findSymbolsInFile';
import { getFileInfo } from './stat';

export interface UpdateIndexOptions {
  watchFiles?: boolean;
  showProgress?: boolean;
  refreshAll?: boolean; // Renamed from forceRefresh for clarity
  batchSize?: number;
}

export interface IndexUpdateResult {
  updated: FileIndex[];
  added: FileIndex[];
  removed: string[];
  unchanged: number;
  errors: Array<{ path: string; error: string }>; // Consistent error shape
}

/**
 * Refresh index for changed files only with optional watcher integration
 */
// Global mutex to prevent concurrent updates
let updateInProgress = false;

export async function updateIndex(
  indexPath: string,
  options: UpdateIndexOptions = {}
): Promise<{ index: WorkspaceIndex; updateResult: IndexUpdateResult }> {
  const { watchFiles = false, showProgress = true, refreshAll = false, batchSize = 10 } = options;

  // Prevent concurrent updates
  if (updateInProgress) {
    throw new FileOperationError('Index update already in progress', 'EBUSY');
  }
  updateInProgress = true;

  try {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new FileOperationError('No workspace folder open', 'ENOWORKSPACE');
    }

    // Load existing index
    let existingIndex: WorkspaceIndex;
    try {
      const indexContent = await fs.readFile(indexPath, 'utf-8');
      existingIndex = JSON.parse(indexContent);
    } catch (error) {
      throw new FileOperationError(
        `Failed to load existing index: ${error instanceof Error ? error.message : String(error)}`,
        'ENOENT',
        indexPath
      );
    }

    if (showProgress) {
      vscode.window.showInformationMessage('Updating workspace index...');
    }

    const updateResult: IndexUpdateResult = {
      updated: [],
      added: [],
      removed: [],
      unchanged: 0,
      errors: []
    };

    // Create a map of existing files for quick lookup
    const existingFiles = new Map<string, FileIndex>();
    for (const fileIndex of existingIndex.files) {
      existingFiles.set(fileIndex.relativePath, fileIndex);
    }

    // Get current files using the same options as the original index
    const currentIndex = await createIndex('.', {
      ...existingIndex.metadata.indexOptions,
      showProgress: false
    });

    const currentFiles = new Map<string, FileIndex>();
    for (const fileIndex of currentIndex.files) {
      currentFiles.set(fileIndex.relativePath, fileIndex);
    }

    // Find files that need updating
    const filesToUpdate: string[] = [];
    const filesToAdd: string[] = [];

    for (const [relativePath, currentFile] of currentFiles) {
      const existingFile = existingFiles.get(relativePath);
      
      if (!existingFile) {
        // New file
        filesToAdd.push(relativePath);
      } else if (refreshAll || hasFileChanged(existingFile, currentFile)) {
        // File has changed or refresh all requested
        filesToUpdate.push(relativePath);
      } else {
        // File unchanged
        updateResult.unchanged++;
      }
    }

    // Find removed files
    for (const [relativePath] of existingFiles) {
      if (!currentFiles.has(relativePath)) {
        updateResult.removed.push(relativePath);
      }
    }

    // Process updates and additions
    const allFilesToProcess = [...filesToUpdate, ...filesToAdd];
    
    if (allFilesToProcess.length > 0) {
      if (showProgress) {
        vscode.window.showInformationMessage(
          `Processing ${allFilesToProcess.length} changed files...`
        );
      }

      // Process in batches
      for (let i = 0; i < allFilesToProcess.length; i += batchSize) {
        const batch = allFilesToProcess.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (relativePath) => {
          try {
            const currentFile = currentFiles.get(relativePath)!;
            const fullPath = path.join(workspaceFolder.uri.fsPath, relativePath);

            // Re-extract symbols and file info for changed files
            let symbols: SymbolInfo[] = [];
            let fileInfo = currentFile.fileInfo;
            const errors: string[] = [];

            // Get fresh file info
            try {
              const info = await getFileInfo(fullPath);
              fileInfo = {
                size: info.size || 0,
                modified: info.modified?.toISOString() || new Date().toISOString(),
                extension: normalizeExtension(path.extname(fullPath)), // Normalize extension
                basename: path.basename(fullPath),
                directory: path.dirname(relativePath).replace(/\\/g, '/') // Normalize path separators
              };
            } catch (error) {
              errors.push(`Failed to get file info: ${error instanceof Error ? error.message : String(error)}`);
            }

            // Get fresh symbols
            if (existingIndex.metadata.indexOptions.includeSymbols !== false) {
              try {
                symbols = await findSymbolsInFile(fullPath, {
                  includeChildren: true,
                  maxDepth: 10
                });
              } catch (error) {
                errors.push(`Failed to extract symbols: ${error instanceof Error ? error.message : String(error)}`);
              }
            }

            const updatedFileIndex: FileIndex = {
              filePath: fullPath,
              relativePath,
              fileInfo,
              symbols,
              symbolCount: symbols.length,
              ...(errors.length > 0 && { errors })
            };

            return { relativePath, fileIndex: updatedFileIndex, isNew: filesToAdd.includes(relativePath) };
          } catch (error) {
            updateResult.errors.push({
              path: relativePath,
              error: error instanceof Error ? error.message : String(error)
            });
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        
        for (const result of batchResults) {
          if (result) {
            if (result.isNew) {
              updateResult.added.push(result.fileIndex);
            } else {
              updateResult.updated.push(result.fileIndex);
            }
          }
        }

        // Add small delay between batches
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    // Build updated index
    const updatedFiles = new Map<string, FileIndex>();
    
    // Start with existing files
    for (const [relativePath, fileIndex] of existingFiles) {
      if (!updateResult.removed.includes(relativePath)) {
        updatedFiles.set(relativePath, fileIndex);
      }
    }

    // Apply updates
    for (const updatedFile of updateResult.updated) {
      updatedFiles.set(updatedFile.relativePath, updatedFile);
    }

    // Add new files
    for (const newFile of updateResult.added) {
      updatedFiles.set(newFile.relativePath, newFile);
    }

    // Create updated index (preserve original createdAt)
    const updatedIndex: WorkspaceIndex = {
      metadata: {
        ...existingIndex.metadata,
        updatedAt: new Date().toISOString(), // Add updatedAt, keep original createdAt
        totalFiles: updatedFiles.size,
        totalSymbols: Array.from(updatedFiles.values()).reduce((sum, file) => sum + file.symbolCount, 0)
      },
      files: Array.from(updatedFiles.values()),
      summary: createIndexSummary(Array.from(updatedFiles.values()))
    };

    if (showProgress) {
      const totalChanges = updateResult.updated.length + updateResult.added.length + updateResult.removed.length;
      vscode.window.showInformationMessage(
        `Index updated: ${totalChanges} changes (${updateResult.updated.length} updated, ${updateResult.added.length} added, ${updateResult.removed.length} removed)`
      );
    }

    // Set up file watcher if requested
    if (watchFiles) {
      setupFileWatcher(indexPath, updatedIndex.metadata.indexOptions);
    }

    return { index: updatedIndex, updateResult };

  } catch (error) {
    if (error instanceof FileOperationError) {
      throw error;
    }
    throw new FileOperationError(
      `Unexpected error updating index: ${error instanceof Error ? error.message : String(error)}`,
      'EUNKNOWN',
      indexPath
    );
  } finally {
    updateInProgress = false; // Always release mutex
  }
}

/**
 * Check if a file has changed by comparing metadata
 */
function hasFileChanged(existingFile: FileIndex, currentFile: FileIndex): boolean {
  // Compare modification times using numeric comparison for precision
  const existingTime = new Date(existingFile.fileInfo.modified).getTime();
  const currentTime = new Date(currentFile.fileInfo.modified).getTime();
  
  if (Math.abs(existingTime - currentTime) > 1000) { // Allow 1 second tolerance
    return true;
  }

  // Compare file sizes
  if (existingFile.fileInfo.size !== currentFile.fileInfo.size) {
    return true;
  }

  return false;
}

/**
 * Normalize file extension (remove dot, lowercase)
 */
function normalizeExtension(ext: string): string {
  return ext.toLowerCase().replace(/^\./, '');
}

/**
 * Create summary statistics (simplified version from createIndex)
 */
function createIndexSummary(fileIndexes: FileIndex[]): any {
  const filesByExtension: { [extension: string]: number } = {};
  const symbolsByKind: { [kind: string]: number } = {};
  const largestFiles: Array<{ path: string; size: number }> = [];
  const mostSymbols: Array<{ path: string; count: number }> = [];
  const recentFiles: Array<{ path: string; modified: string }> = [];
  const errorFiles: Array<{ path: string; errors: string[] }> = [];

  for (const fileIndex of fileIndexes) {
    // Count files by extension
    const ext = fileIndex.fileInfo.extension || 'no-extension';
    filesByExtension[ext] = (filesByExtension[ext] || 0) + 1;

    // Count symbols by kind
    for (const symbol of fileIndex.symbols) {
      countSymbolsByKind(symbol, symbolsByKind);
    }

    // Track largest files
    if (fileIndex.fileInfo.size > 0) {
      largestFiles.push({
        path: fileIndex.relativePath,
        size: fileIndex.fileInfo.size
      });
    }

    // Track files with most symbols
    if (fileIndex.symbolCount > 0) {
      mostSymbols.push({
        path: fileIndex.relativePath,
        count: fileIndex.symbolCount
      });
    }

    // Track recent files
    recentFiles.push({
      path: fileIndex.relativePath,
      modified: fileIndex.fileInfo.modified
    });

    // Track error files
    if (fileIndex.errors && fileIndex.errors.length > 0) {
      errorFiles.push({
        path: fileIndex.relativePath,
        errors: fileIndex.errors
      });
    }
  }

  // Sort and limit arrays
  largestFiles.sort((a, b) => b.size - a.size);
  mostSymbols.sort((a, b) => b.count - a.count);
  recentFiles.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());

  return {
    filesByExtension,
    symbolsByKind,
    largestFiles: largestFiles.slice(0, 10),
    mostSymbols: mostSymbols.slice(0, 10),
    recentFiles: recentFiles.slice(0, 10),
    errorFiles
  };
}

/**
 * Recursively count symbols by kind (normalize to string labels)
 */
function countSymbolsByKind(symbol: SymbolInfo, counts: { [kind: string]: number }): void {
  // Normalize symbol kind to string (handle both string and numeric VS Code SymbolKind)
  const kindLabel = typeof symbol.kind === 'string' ? symbol.kind : String(symbol.kind);
  counts[kindLabel] = (counts[kindLabel] || 0) + 1;
  
  if (symbol.children) {
    for (const child of symbol.children) {
      countSymbolsByKind(child, counts);
    }
  }
}

// Global watcher to prevent multiple instances
let globalWatcher: vscode.Disposable | undefined;

/**
 * Set up file system watcher for automatic index updates
 */
function setupFileWatcher(indexPath: string, indexOptions: any): vscode.Disposable {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    throw new Error('No workspace folder available for file watching');
  }

  // Dispose existing watcher to prevent leaks
  if (globalWatcher) {
    globalWatcher.dispose();
  }

  // Expand extension groups properly
  const { expandExtensions } = require('../../commandHandler');
  const expandedExtensions = expandExtensions(indexOptions.extensions || 'code');
  
  // Create file watcher pattern for expanded extensions
  let pattern: string;
  if (Array.isArray(expandedExtensions)) {
    const extList = expandedExtensions.map(ext => ext.replace(/^\./, '')).join(',');
    pattern = `**/*.{${extList}}`;
  } else if (expandedExtensions.startsWith('.')) {
    pattern = `**/*${expandedExtensions}`;
  } else {
    pattern = '**/*'; // Fallback
  }

  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(workspaceFolder, pattern)
  );

  let updateTimeout: NodeJS.Timeout | undefined;

  const scheduleUpdate = () => {
    if (updateTimeout) {
      clearTimeout(updateTimeout);
    }
    
    // Debounce updates to avoid excessive processing
    updateTimeout = setTimeout(async () => {
      try {
        console.log('[RayDaemon] Auto-updating index due to file changes...');
        await updateIndex(indexPath, { showProgress: false });
        console.log('[RayDaemon] Index auto-update completed');
      } catch (error) {
        if (error instanceof FileOperationError && error.code === 'EBUSY') {
          console.log('[RayDaemon] Index update skipped - already in progress');
        } else {
          console.error('[RayDaemon] Failed to auto-update index:', error);
        }
      }
    }, 2000); // 2 second debounce
  };

  watcher.onDidCreate(scheduleUpdate);
  watcher.onDidChange(scheduleUpdate);
  watcher.onDidDelete(scheduleUpdate);

  console.log(`[RayDaemon] File watcher set up for pattern: ${pattern}`);

  // Store global reference
  globalWatcher = watcher;
  return watcher;
}

/**
 * Format update result for display
 */
export function formatUpdateResult(updateResult: IndexUpdateResult): string {
  const lines: string[] = [];
  
  const totalChanges = updateResult.updated.length + updateResult.added.length + updateResult.removed.length;
  
  lines.push(`🔄 **Index Update Summary**`);
  lines.push(`   Total changes: ${totalChanges}`);
  lines.push(`   Updated files: ${updateResult.updated.length}`);
  lines.push(`   Added files: ${updateResult.added.length}`);
  lines.push(`   Removed files: ${updateResult.removed.length}`);
  lines.push(`   Unchanged files: ${updateResult.unchanged}`);
  
  if (updateResult.errors.length > 0) {
    lines.push(`   Errors: ${updateResult.errors.length}`);
  }
  
  lines.push('');

  // Show some updated files
  if (updateResult.updated.length > 0) {
    lines.push(`📝 **Updated Files** (showing first 5)`);
    for (const file of updateResult.updated.slice(0, 5)) {
      lines.push(`   ${file.relativePath} (${file.symbolCount} symbols)`);
    }
    if (updateResult.updated.length > 5) {
      lines.push(`   ... and ${updateResult.updated.length - 5} more`);
    }
    lines.push('');
  }

  // Show some added files
  if (updateResult.added.length > 0) {
    lines.push(`➕ **Added Files** (showing first 5)`);
    for (const file of updateResult.added.slice(0, 5)) {
      lines.push(`   ${file.relativePath} (${file.symbolCount} symbols)`);
    }
    if (updateResult.added.length > 5) {
      lines.push(`   ... and ${updateResult.added.length - 5} more`);
    }
    lines.push('');
  }

  // Show removed files
  if (updateResult.removed.length > 0) {
    lines.push(`➖ **Removed Files** (showing first 5)`);
    for (const path of updateResult.removed.slice(0, 5)) {
      lines.push(`   ${path}`);
    }
    if (updateResult.removed.length > 5) {
      lines.push(`   ... and ${updateResult.removed.length - 5} more`);
    }
    lines.push('');
  }

  // Show errors
  if (updateResult.errors.length > 0) {
    lines.push(`⚠️ **Errors** (showing first 3)`);
    for (const error of updateResult.errors.slice(0, 3)) {
      lines.push(`   ${error.path}: ${error.error}`);
    }
    if (updateResult.errors.length > 3) {
      lines.push(`   ... and ${updateResult.errors.length - 3} more`);
    }
  }

  return lines.join('\n');
}