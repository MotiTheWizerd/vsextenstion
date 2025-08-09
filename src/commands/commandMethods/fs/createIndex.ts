import * as vscode from 'vscode';
import * as path from 'path';
import { promises as fs } from 'fs';
import { FileOperationError } from './errors';
import { findByExtension } from './findByExtension';
import { findSymbolsInFile, SymbolInfo } from './findSymbolsInFile';
import { getFileInfo } from './stat';
import { expandExtensions } from '../../commandHandler';
import { resolveWorkspacePath } from './pathResolver';

export interface WorkspaceIndex {
  metadata: IndexMetadata;
  files: FileIndex[];
  summary: IndexSummary;
}

export interface IndexMetadata {
  version: string;
  createdAt: string;
  updatedAt?: string; // Add optional updatedAt field
  workspacePath: string;
  workspaceName: string;
  totalFiles: number;
  totalSymbols: number;
  indexOptions: CreateIndexOptions;
}

export interface FileIndex {
  filePath: string;
  relativePath: string;
  fileInfo: {
    size: number;
    modified: string;
    extension: string;
    basename: string;
    directory: string;
  };
  symbols: SymbolInfo[];
  symbolCount: number;
  errors?: string[];
}

export interface IndexSummary {
  filesByExtension: { [extension: string]: number };
  symbolsByKind: { [kind: string]: number };
  largestFiles: Array<{ path: string; size: number }>;
  mostSymbols: Array<{ path: string; count: number }>;
  recentFiles: Array<{ path: string; modified: string }>;
  errorFiles: Array<{ path: string; errors: string[] }>;
}

export interface CreateIndexOptions {
  extensions?: string | string[];
  includeHidden?: boolean;
  includeSymbols?: boolean;
  includeFileInfo?: boolean;
  maxFiles?: number;
  maxDepth?: number;
  excludePatterns?: string[];
  outputFile?: string;
  showProgress?: boolean;
}

/**
 * Create a structured JSON index combining listFiles, findSymbolsInFile, and getFileInfo
 */
export async function createIndex(
  searchPath: string = '.',
  options: CreateIndexOptions = {}
): Promise<WorkspaceIndex> {
  const {
    extensions = 'code',
    includeHidden = false,
    includeSymbols = true,
    includeFileInfo = true,
    maxFiles = 5000,
    maxDepth = 20,
    excludePatterns = ['node_modules', '.git', 'dist', 'build', '.next', '.nuxt'],
    showProgress = true
  } = options;

  try {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new FileOperationError('No workspace folder open', 'ENOWORKSPACE');
    }

    const workspacePath = workspaceFolder.uri.fsPath;
    const workspaceName = path.basename(workspacePath);

    if (showProgress) {
      vscode.window.showInformationMessage('Creating workspace index...');
    }

    // Expand extension groups
    const expandedExtensions = expandExtensions(extensions);

    // Find files to index
    const files = await findByExtension(expandedExtensions, searchPath, {
      showHidden: includeHidden,
      maxDepth,
      caseSensitive: false
    });

    if (files.length === 0) {
      throw new FileOperationError('No files found to index', 'ENOENT', searchPath);
    }

    // Filter out excluded patterns
    const filteredFiles = files.filter(file => {
      const relativePath = path.relative(workspacePath, file.path);
      return !excludePatterns.some(pattern => 
        relativePath.includes(pattern) || 
        path.basename(file.path).includes(pattern)
      );
    }).slice(0, maxFiles);

    if (showProgress && filteredFiles.length > 50) {
      vscode.window.showInformationMessage(`Indexing ${filteredFiles.length} files...`);
    }

    const fileIndexes: FileIndex[] = [];
    let totalSymbols = 0;
    let processed = 0;

    // Process files in batches
    const batchSize = 10;
    for (let i = 0; i < filteredFiles.length; i += batchSize) {
      const batch = filteredFiles.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (file) => {
        const relativePath = path.relative(workspacePath, file.path);
        const errors: string[] = [];
        let symbols: SymbolInfo[] = [];
        let fileInfo: any = {};

        try {
          // Get file info if requested
          if (includeFileInfo) {
            try {
              const info = await getFileInfo(file.path);
              fileInfo = {
                size: info.size || 0,
                modified: info.modified?.toISOString() || new Date().toISOString(),
                extension: normalizeExtension(path.extname(file.path)),
                basename: path.basename(file.path),
                directory: path.dirname(relativePath).replace(/\\/g, '/')
              };
            } catch (error) {
              errors.push(`Failed to get file info: ${error instanceof Error ? error.message : String(error)}`);
              // Provide basic file info
              fileInfo = {
                size: 0,
                modified: new Date().toISOString(),
                extension: normalizeExtension(path.extname(file.path)),
                basename: path.basename(file.path),
                directory: path.dirname(relativePath).replace(/\\/g, '/')
              };
            }
          }

          // Get symbols if requested
          if (includeSymbols) {
            try {
              symbols = await findSymbolsInFile(file.path, {
                includeChildren: true,
                maxDepth: 10
              });
            } catch (error) {
              errors.push(`Failed to extract symbols: ${error instanceof Error ? error.message : String(error)}`);
            }
          }

          const fileIndex: FileIndex = {
            filePath: file.path,
            relativePath,
            fileInfo,
            symbols,
            symbolCount: symbols.length,
            ...(errors.length > 0 && { errors })
          };

          return fileIndex;
        } catch (error) {
          // Create minimal index entry for failed files
          return {
            filePath: file.path,
            relativePath,
            fileInfo: {
              size: 0,
              modified: new Date().toISOString(),
              extension: normalizeExtension(path.extname(file.path)),
              basename: path.basename(file.path),
              directory: path.dirname(relativePath).replace(/\\/g, '/')
            },
            symbols: [],
            symbolCount: 0,
            errors: [`Failed to process file: ${error instanceof Error ? error.message : String(error)}`]
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      fileIndexes.push(...batchResults);
      
      // Update totals
      for (const fileIndex of batchResults) {
        totalSymbols += fileIndex.symbolCount;
      }
      
      processed += batch.length;
      
      // Show progress for large operations
      if (showProgress && filteredFiles.length > 100 && processed % 100 === 0) {
        vscode.window.showInformationMessage(`Processed ${processed}/${filteredFiles.length} files...`);
      }

      // Add small delay between batches
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Create summary statistics
    const summary = createIndexSummary(fileIndexes);

    // Create metadata
    const metadata: IndexMetadata = {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      workspacePath,
      workspaceName,
      totalFiles: fileIndexes.length,
      totalSymbols,
      indexOptions: options
    };

    const index: WorkspaceIndex = {
      metadata,
      files: fileIndexes,
      summary
    };

    if (showProgress) {
      const errorCount = fileIndexes.filter(f => f.errors && f.errors.length > 0).length;
      vscode.window.showInformationMessage(
        `Index created: ${fileIndexes.length} files, ${totalSymbols} symbols${errorCount > 0 ? `, ${errorCount} errors` : ''}`
      );
    }

    return index;

  } catch (error) {
    if (error instanceof FileOperationError) {
      throw error;
    }
    throw new FileOperationError(
      `Unexpected error creating index: ${error instanceof Error ? error.message : String(error)}`,
      'EUNKNOWN',
      searchPath
    );
  }
}

/**
 * Create summary statistics from file indexes
 */
function createIndexSummary(fileIndexes: FileIndex[]): IndexSummary {
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
 * Normalize file extension (remove dot, lowercase)
 */
function normalizeExtension(ext: string): string {
  return ext.toLowerCase().replace(/^\./, '');
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

/**
 * Save index to file
 */
export async function saveIndex(index: WorkspaceIndex, outputPath: string): Promise<string> {
  try {
    // Resolve the output path relative to the workspace folder
    const resolvedPath = resolveWorkspacePath(outputPath);
    const jsonContent = JSON.stringify(index, null, 2);
    await fs.writeFile(resolvedPath, jsonContent, 'utf-8');
    
    const sizeKB = Math.round(jsonContent.length / 1024);
    return `✅ Index saved to ${outputPath} (${sizeKB} KB)`;
  } catch (error) {
    throw new FileOperationError(
      `Failed to save index: ${error instanceof Error ? error.message : String(error)}`,
      'EWRITE',
      outputPath
    );
  }
}

/**
 * Format index summary for display
 */
export function formatIndexSummary(index: WorkspaceIndex): string {
  const { metadata, summary } = index;
  const lines: string[] = [];

  lines.push(`📊 **Workspace Index Summary**`);
  lines.push(`   Workspace: ${metadata.workspaceName}`);
  lines.push(`   Created: ${new Date(metadata.createdAt).toLocaleString()}`);
  lines.push(`   Files: ${metadata.totalFiles}`);
  lines.push(`   Symbols: ${metadata.totalSymbols}`);
  lines.push('');

  // Files by extension
  lines.push(`📁 **Files by Extension**`);
  const sortedExtensions = Object.entries(summary.filesByExtension)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10);
  for (const [ext, count] of sortedExtensions) {
    lines.push(`   ${ext}: ${count}`);
  }
  lines.push('');

  // Symbols by kind
  lines.push(`🔧 **Symbols by Kind**`);
  const sortedSymbols = Object.entries(summary.symbolsByKind)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10);
  for (const [kind, count] of sortedSymbols) {
    lines.push(`   ${kind}: ${count}`);
  }
  lines.push('');

  // Largest files
  if (summary.largestFiles.length > 0) {
    lines.push(`📈 **Largest Files**`);
    for (const file of summary.largestFiles.slice(0, 5)) {
      const sizeKB = Math.round(file.size / 1024);
      lines.push(`   ${file.path} (${sizeKB} KB)`);
    }
    lines.push('');
  }

  // Files with most symbols
  if (summary.mostSymbols.length > 0) {
    lines.push(`🎯 **Most Symbols**`);
    for (const file of summary.mostSymbols.slice(0, 5)) {
      lines.push(`   ${file.path} (${file.count} symbols)`);
    }
    lines.push('');
  }

  // Errors
  if (summary.errorFiles.length > 0) {
    lines.push(`⚠️ **Files with Errors: ${summary.errorFiles.length}**`);
    for (const file of summary.errorFiles.slice(0, 3)) {
      lines.push(`   ${file.path}: ${file.errors[0]}`);
    }
    if (summary.errorFiles.length > 3) {
      lines.push(`   ... and ${summary.errorFiles.length - 3} more`);
    }
  }

  return lines.join('\n');
}