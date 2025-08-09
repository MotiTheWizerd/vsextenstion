import * as vscode from 'vscode';
import * as path from 'path';
import { FileOperationError } from './errors';

export interface SymbolLocation {
  name: string;
  kind: string;
  containerName?: string;
  filePath: string;
  relativePath: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  uri: vscode.Uri;
}

export interface FindSymbolOptions {
  maxResults?: number;
  filterKinds?: vscode.SymbolKind[];
  caseSensitive?: boolean;
  exactMatch?: boolean;
}

/**
 * Locate a symbol by name across the workspace using VS Code's workspace symbol provider
 */
export async function findSymbol(
  symbolName: string,
  options: FindSymbolOptions = {}
): Promise<SymbolLocation[]> {
  const { maxResults = 100, filterKinds, caseSensitive = false, exactMatch = false } = options;

  try {
    if (!symbolName || symbolName.trim().length === 0) {
      throw new FileOperationError('No symbol name provided', 'EINVAL');
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new FileOperationError('No workspace folder open', 'ENOWORKSPACE');
    }

    // Use VS Code's workspace symbol provider
    const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
      'vscode.executeWorkspaceSymbolProvider',
      symbolName
    );

    if (!symbols || symbols.length === 0) {
      return [];
    }

    // Filter and convert symbols
    const results: SymbolLocation[] = [];
    const searchName = caseSensitive ? symbolName : symbolName.toLowerCase();

    for (const symbol of symbols) {
      // Apply name filtering
      const symbolNameToCheck = caseSensitive ? symbol.name : symbol.name.toLowerCase();
      const matches = exactMatch 
        ? symbolNameToCheck === searchName
        : symbolNameToCheck.includes(searchName);

      if (!matches) {
        continue;
      }

      // Apply kind filtering
      if (filterKinds && !filterKinds.includes(symbol.kind)) {
        continue;
      }

      // Convert to our format
      const relativePath = path.relative(workspaceFolder.uri.fsPath, symbol.location.uri.fsPath);
      
      results.push({
        name: symbol.name,
        kind: vscode.SymbolKind[symbol.kind],
        containerName: symbol.containerName,
        filePath: symbol.location.uri.fsPath,
        relativePath,
        range: {
          start: { 
            line: symbol.location.range.start.line, 
            character: symbol.location.range.start.character 
          },
          end: { 
            line: symbol.location.range.end.line, 
            character: symbol.location.range.end.character 
          }
        },
        uri: symbol.location.uri
      });

      // Limit results
      if (results.length >= maxResults) {
        break;
      }
    }

    // Sort by relevance with smart ranking
    results.sort((a, b) => {
      const aName = caseSensitive ? a.name : a.name.toLowerCase();
      const bName = caseSensitive ? b.name : b.name.toLowerCase();
      
      // 1. Exact matches first
      const aExact = aName === searchName;
      const bExact = bName === searchName;
      if (aExact && !bExact) {
        return -1;
      }
      if (!aExact && bExact) {
        return 1;
      }
      
      // 2. Prefix matches
      const aPrefix = aName.startsWith(searchName);
      const bPrefix = bName.startsWith(searchName);
      if (aPrefix && !bPrefix) {
        return -1;
      }
      if (!aPrefix && bPrefix) {
        return 1;
      }
      
      // 3. Word boundary matches (symbol starts with search or after non-alphanumeric)
      const aWordBoundary = aName.startsWith(searchName) || 
        new RegExp(`\\b${searchName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, caseSensitive ? '' : 'i').test(aName);
      const bWordBoundary = bName.startsWith(searchName) || 
        new RegExp(`\\b${searchName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, caseSensitive ? '' : 'i').test(bName);
      if (aWordBoundary && !bWordBoundary) {
        return -1;
      }
      if (!aWordBoundary && bWordBoundary) {
        return 1;
      }
      
      // 4. Tie-break by file path (shorter paths first, then alphabetical)
      const pathCompare = a.relativePath.length - b.relativePath.length;
      if (pathCompare !== 0) {
        return pathCompare;
      }
      
      return a.relativePath.localeCompare(b.relativePath);
    });

    return results;

  } catch (error) {
    if (error instanceof FileOperationError) {
      throw error;
    }
    
    throw new FileOperationError(
      `Unexpected error finding symbol: ${error instanceof Error ? error.message : String(error)}`,
      'EUNKNOWN',
      symbolName
    );
  }
}

/**
 * Format symbol locations for display
 */
export function formatSymbolLocations(symbols: SymbolLocation[], query: string): string {
  if (symbols.length === 0) {
    return `No symbols found matching "${query}"`;
  }

  const lines: string[] = [];
  lines.push(`🔍 **Found ${symbols.length} symbol(s) matching "${query}"**\n`);

  for (const symbol of symbols) {
    const kindIcon = getSymbolIcon(symbol.kind);
    const location = `${symbol.relativePath}:${symbol.range.start.line + 1}:${symbol.range.start.character + 1}`;
    const container = symbol.containerName ? ` in ${symbol.containerName}` : '';
    
    lines.push(`${kindIcon} **${symbol.name}**${container} - ${location}`);
  }

  return lines.join('\n');
}

/**
 * Get icon for symbol kind
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