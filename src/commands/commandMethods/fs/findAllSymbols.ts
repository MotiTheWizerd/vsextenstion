import * as vscode from 'vscode';
import * as path from 'path';
import { FileOperationError } from './errors';
import { findByExtension, EXTENSION_GROUPS } from './findByExtension';
import { findSymbolsInFile, SymbolInfo, formatSymbols } from './findSymbolsInFile';

export interface FileSymbols {
  filePath: string;
  relativePath: string;
  symbols: SymbolInfo[];
  error?: string;
}

export interface FindAllSymbolsOptions {
  extensions?: string | string[];
  includeChildren?: boolean;
  maxDepth?: number;
  filterKinds?: vscode.SymbolKind[];
  maxFiles?: number;
  showProgress?: boolean;
  incremental?: boolean;
}

/**
 * Walk the whole workspace and gather symbols per file
 */
export async function findAllSymbols(
  searchPath: string = '.',
  options: FindAllSymbolsOptions = {}
): Promise<FileSymbols[]> {
  const {
    extensions = 'code',
    includeChildren = true,
    maxDepth = 10,
    filterKinds,
    maxFiles = 1000,
    showProgress = true,
    incremental = false
  } = options;

  try {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new FileOperationError('No workspace folder open', 'ENOWORKSPACE');
    }

    // Find files to analyze
    const files = await findByExtension(extensions, searchPath, {
      showHidden: false,
      maxDepth: 20, // Allow deeper search for files
      caseSensitive: false
    });

    if (files.length === 0) {
      return [];
    }

    // Limit number of files to prevent overwhelming the system
    const filesToProcess = files.slice(0, maxFiles);
    const results: FileSymbols[] = [];

    // Progress tracking
    let processed = 0;
    const total = filesToProcess.length;

    if (showProgress && total > 10) {
      vscode.window.showInformationMessage(`Analyzing symbols in ${total} files...`);
    }

    // Process files in batches to avoid overwhelming VS Code
    const batchSize = incremental ? 5 : 20;
    
    for (let i = 0; i < filesToProcess.length; i += batchSize) {
      const batch = filesToProcess.slice(i, i + batchSize);
      
      // Process batch in parallel
      const batchPromises = batch.map(async (file) => {
        try {
          const symbols = await findSymbolsInFile(file.path, {
            includeChildren,
            maxDepth,
            filterKinds
          });

          const relativePath = path.relative(workspaceFolder.uri.fsPath, file.path);
          
          return {
            filePath: file.path,
            relativePath,
            symbols
          };
        } catch (error) {
          const relativePath = path.relative(workspaceFolder.uri.fsPath, file.path);
          return {
            filePath: file.path,
            relativePath,
            symbols: [],
            error: error instanceof Error ? error.message : String(error)
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      processed += batch.length;
      
      // Show progress for large operations
      if (showProgress && total > 50 && processed % 50 === 0) {
        vscode.window.showInformationMessage(`Processed ${processed}/${total} files...`);
      }

      // For incremental mode, add small delay between batches
      if (incremental && i + batchSize < filesToProcess.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    if (showProgress && total > 10) {
      const symbolCount = results.reduce((sum, file) => sum + file.symbols.length, 0);
      const errorCount = results.filter(file => file.error).length;
      vscode.window.showInformationMessage(
        `Analysis complete: ${symbolCount} symbols found in ${total - errorCount} files`
      );
    }

    return results;

  } catch (error) {
    if (error instanceof FileOperationError) {
      throw error;
    }
    throw new FileOperationError(
      `Unexpected error finding all symbols: ${error instanceof Error ? error.message : String(error)}`,
      'EUNKNOWN',
      searchPath
    );
  }
}

/**
 * Format all symbols for display
 */
export function formatAllSymbols(fileSymbols: FileSymbols[], options: {
  showFilePaths?: boolean;
  showErrors?: boolean;
  maxFilesToShow?: number;
  groupByFile?: boolean;
} = {}): string {
  const {
    showFilePaths = true,
    showErrors = true,
    maxFilesToShow = 50,
    groupByFile = true
  } = options;

  if (fileSymbols.length === 0) {
    return 'No symbols found in workspace.';
  }

  const lines: string[] = [];
  const filesToShow = fileSymbols.slice(0, maxFilesToShow);
  const totalSymbols = fileSymbols.reduce((sum, file) => sum + file.symbols.length, 0);
  const filesWithSymbols = fileSymbols.filter(file => file.symbols.length > 0).length;
  const filesWithErrors = fileSymbols.filter(file => file.error).length;

  // Summary
  lines.push(`📊 **Symbol Analysis Summary**`);
  lines.push(`   Files analyzed: ${fileSymbols.length}`);
  lines.push(`   Files with symbols: ${filesWithSymbols}`);
  lines.push(`   Total symbols found: ${totalSymbols}`);
  if (filesWithErrors > 0) {
    lines.push(`   Files with errors: ${filesWithErrors}`);
  }
  lines.push('');

  if (groupByFile) {
    // Group by file
    for (const fileSymbol of filesToShow) {
      if (fileSymbol.symbols.length > 0 || (showErrors && fileSymbol.error)) {
        if (showFilePaths) {
          lines.push(`📁 **${fileSymbol.relativePath}**`);
        }
        
        if (fileSymbol.error && showErrors) {
          lines.push(`   ❌ Error: ${fileSymbol.error}`);
        } else if (fileSymbol.symbols.length > 0) {
          const formattedSymbols = formatSymbols(fileSymbol.symbols);
          const symbolLines = formattedSymbols.split('\n');
          lines.push(...symbolLines.map(line => `   ${line}`));
        }
        lines.push('');
      }
    }
  } else {
    // Flat list of all symbols
    const allSymbols: Array<SymbolInfo & { filePath: string; relativePath: string }> = [];
    
    for (const fileSymbol of filesToShow) {
      for (const symbol of fileSymbol.symbols) {
        allSymbols.push({
          ...symbol,
          filePath: fileSymbol.filePath,
          relativePath: fileSymbol.relativePath
        });
      }
    }

    // Sort by symbol name
    allSymbols.sort((a, b) => a.name.localeCompare(b.name));

    for (const symbol of allSymbols) {
      const location = showFilePaths ? ` (${symbol.relativePath}:${symbol.range.start.line + 1})` : '';
      const kindIcon = getSymbolIcon(symbol.kind);
      lines.push(`${kindIcon} ${symbol.name}${location}`);
    }
  }

  if (fileSymbols.length > maxFilesToShow) {
    lines.push(`... and ${fileSymbols.length - maxFilesToShow} more files`);
  }

  return lines.join('\n');
}

/**
 * Search for symbols by name across the workspace
 */
export async function searchSymbolsByName(
  query: string,
  searchPath: string = '.',
  options: FindAllSymbolsOptions = {}
): Promise<Array<SymbolInfo & { filePath: string; relativePath: string }>> {
  const fileSymbols = await findAllSymbols(searchPath, options);
  const matchingSymbols: Array<SymbolInfo & { filePath: string; relativePath: string }> = [];

  const queryLower = query.toLowerCase();

  for (const fileSymbol of fileSymbols) {
    const searchInSymbols = (symbols: SymbolInfo[]) => {
      for (const symbol of symbols) {
        if (symbol.name.toLowerCase().includes(queryLower)) {
          matchingSymbols.push({
            ...symbol,
            filePath: fileSymbol.filePath,
            relativePath: fileSymbol.relativePath
          });
        }
        
        if (symbol.children) {
          searchInSymbols(symbol.children);
        }
      }
    };

    searchInSymbols(fileSymbol.symbols);
  }

  return matchingSymbols;
}

/**
 * Get symbol icon (reused from findSymbolsInFile)
 */
function getSymbolIcon(kind: string): string {
  const icons: { [key: string]: string } = {
    'File': '📄',
    'Module': '📦',
    'Namespace': '🏷️',
    'Package': '📦',
    'Class': '🏛️',
    'Method': '⚡',
    'Property': '🔧',
    'Field': '🔧',
    'Constructor': '🏗️',
    'Enum': '📋',
    'Interface': '🔌',
    'Function': '⚡',
    'Variable': '📊',
    'Constant': '🔒',
    'String': '📝',
    'Number': '🔢',
    'Boolean': '✅',
    'Array': '📚',
    'Object': '📦',
    'Key': '🔑',
    'Null': '❌',
    'EnumMember': '📋',
    'Struct': '🏗️',
    'Event': '⚡',
    'Operator': '➕',
    'TypeParameter': '🏷️'
  };
  
  return icons[kind] || '❓';
}