import * as vscode from 'vscode';
import * as path from 'path';
import { FileOperationError } from './errors';
import { resolveWorkspacePath } from './pathResolver';

export interface SymbolReference {
  filePath: string;
  relativePath: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  context: string; // Line content around the reference
  uri: vscode.Uri;
}

export interface GetReferencesOptions {
  includeDeclaration?: boolean;
  maxResults?: number;
  contextLines?: number;
}

/**
 * List all references to a given symbol at a specific location
 */
export async function getSymbolReferences(
  filePath: string,
  line: number,
  character: number,
  options: GetReferencesOptions = {}
): Promise<SymbolReference[]> {
  const { includeDeclaration = true, maxResults = 1000, contextLines = 0 } = options;

  try {
    if (!filePath) {
      throw new FileOperationError('No file path provided', 'EINVAL');
    }

    if (line < 0 || character < 0) {
      throw new FileOperationError('Invalid line or character position', 'EINVAL');
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new FileOperationError('No workspace folder open', 'ENOWORKSPACE');
    }

    const resolvedPath = resolveWorkspacePath(filePath);
    const fileUri = vscode.Uri.file(resolvedPath);

    // Open the document to ensure it's available for reference search
    const document = await vscode.workspace.openTextDocument(fileUri);
    const position = new vscode.Position(line, character);

    // Use VS Code's reference provider
    const references = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeReferenceProvider',
      fileUri,
      position,
      includeDeclaration
    );

    if (!references || references.length === 0) {
      return [];
    }

    // Convert to our format and add context
    const results: SymbolReference[] = [];

    for (const reference of references) {
      if (results.length >= maxResults) {
        break;
      }

      try {
        // Get the document for context
        const refDocument = await vscode.workspace.openTextDocument(reference.uri);
        const refLine = reference.range.start.line;
        
        // Extract context around the reference
        let context = '';
        if (contextLines > 0) {
          const startLine = Math.max(0, refLine - contextLines);
          const endLine = Math.min(refDocument.lineCount - 1, refLine + contextLines);
          const contextRange = new vscode.Range(startLine, 0, endLine, refDocument.lineAt(endLine).text.length);
          context = refDocument.getText(contextRange);
        } else {
          // Just get the line containing the reference
          context = refDocument.lineAt(refLine).text;
        }

        const relativePath = path.relative(workspaceFolder.uri.fsPath, reference.uri.fsPath);

        results.push({
          filePath: reference.uri.fsPath,
          relativePath,
          range: {
            start: {
              line: reference.range.start.line,
              character: reference.range.start.character
            },
            end: {
              line: reference.range.end.line,
              character: reference.range.end.character
            }
          },
          context: context.trim(),
          uri: reference.uri
        });

      } catch (error) {
        // Log but don't fail for individual reference errors
        console.warn(`[RayDaemon] Could not get context for reference in ${reference.uri.fsPath}:`, error);
        
        // Add without context
        const relativePath = path.relative(workspaceFolder.uri.fsPath, reference.uri.fsPath);
        results.push({
          filePath: reference.uri.fsPath,
          relativePath,
          range: {
            start: {
              line: reference.range.start.line,
              character: reference.range.start.character
            },
            end: {
              line: reference.range.end.line,
              character: reference.range.end.character
            }
          },
          context: '<context unavailable>',
          uri: reference.uri
        });
      }
    }

    // Sort by file path and then by line number
    results.sort((a, b) => {
      const pathCompare = a.relativePath.localeCompare(b.relativePath);
      if (pathCompare !== 0) {
        return pathCompare;
      }
      return a.range.start.line - b.range.start.line;
    });

    return results;

  } catch (error) {
    if (error instanceof FileOperationError) {
      throw error;
    }

    // Handle VS Code specific errors
    if (error instanceof Error) {
      if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
        throw new FileOperationError(`File not found: ${filePath}`, 'ENOENT', filePath);
      }
      if (error.message.includes('No reference provider') || error.message.includes('no provider')) {
        throw new FileOperationError(
          `No reference provider available for file type: ${path.extname(filePath)}`,
          'ENOREFERENCEPROVIDER',
          filePath
        );
      }
    }

    throw new FileOperationError(
      `Unexpected error getting symbol references: ${error instanceof Error ? error.message : String(error)}`,
      'EUNKNOWN',
      filePath
    );
  }
}

/**
 * Get references for a symbol by name (finds the symbol first, then gets references)
 */
export async function getSymbolReferencesByName(
  symbolName: string,
  options: GetReferencesOptions & { symbolFilePath?: string } = {}
): Promise<{ symbol: string; location: string; references: SymbolReference[] }[]> {
  const { symbolFilePath, ...refOptions } = options;

  try {
    // First, find the symbol(s)
    const { findSymbol } = await import('./findSymbol.js');
    const symbols = await findSymbol(symbolName, { exactMatch: true, maxResults: 10 });

    if (symbols.length === 0) {
      return [];
    }

    // Filter by file if specified with smart matching
    let filteredSymbols = symbols;
    if (symbolFilePath) {
      const normalizedFilter = path.normalize(symbolFilePath).toLowerCase();
      
      filteredSymbols = symbols.filter((s: any) => {
        const normalizedRelative = s.relativePath.toLowerCase();
        const normalizedBasename = path.basename(s.filePath).toLowerCase();
        
        // Priority order: exact basename match, starts with filter, contains filter
        return normalizedBasename === normalizedFilter ||
               normalizedRelative.startsWith(normalizedFilter) ||
               normalizedBasename.startsWith(normalizedFilter) ||
               normalizedRelative.includes(normalizedFilter);
      });
    }

    if (filteredSymbols.length === 0) {
      return [];
    }

    // Get references for each symbol
    const results: { symbol: string; location: string; references: SymbolReference[] }[] = [];

    for (const symbol of filteredSymbols) {
      try {
        const references = await getSymbolReferences(
          symbol.filePath,
          symbol.range.start.line,
          symbol.range.start.character,
          refOptions
        );

        results.push({
          symbol: symbol.name,
          location: `${symbol.relativePath}:${symbol.range.start.line + 1}:${symbol.range.start.character + 1}`,
          references
        });

      } catch (error) {
        console.warn(`[RayDaemon] Could not get references for symbol ${symbol.name} in ${symbol.relativePath}:`, error);
      }
    }

    return results;

  } catch (error) {
    if (error instanceof FileOperationError) {
      throw error;
    }
    
    throw new FileOperationError(
      `Unexpected error getting symbol references by name: ${error instanceof Error ? error.message : String(error)}`,
      'EUNKNOWN',
      symbolName
    );
  }
}

/**
 * Format symbol references for display
 */
export function formatSymbolReferences(
  references: SymbolReference[], 
  symbolInfo?: string,
  options: { showContext?: boolean; maxContextLength?: number } = {}
): string {
  const { showContext = true, maxContextLength = 100 } = options;

  if (references.length === 0) {
    const symbol = symbolInfo ? ` for ${symbolInfo}` : '';
    return `No references found${symbol}`;
  }

  const lines: string[] = [];
  const symbol = symbolInfo ? ` for **${symbolInfo}**` : '';
  lines.push(`📍 **Found ${references.length} reference(s)${symbol}**\n`);

  // Group by file
  const fileGroups = new Map<string, SymbolReference[]>();
  for (const ref of references) {
    if (!fileGroups.has(ref.relativePath)) {
      fileGroups.set(ref.relativePath, []);
    }
    fileGroups.get(ref.relativePath)!.push(ref);
  }

  for (const [filePath, fileRefs] of fileGroups) {
    lines.push(`📁 **${filePath}**`);
    
    for (const ref of fileRefs) {
      const location = `${ref.range.start.line + 1}:${ref.range.start.character + 1}`;
      let contextDisplay = '';
      
      if (showContext && ref.context && ref.context !== '<context unavailable>') {
        let context = ref.context.replace(/\n/g, ' ').trim();
        if (context.length > maxContextLength) {
          context = context.substring(0, maxContextLength) + '...';
        }
        contextDisplay = ` - \`${context}\``;
      }
      
      lines.push(`   Line ${location}${contextDisplay}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}