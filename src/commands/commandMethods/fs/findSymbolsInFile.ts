import * as vscode from 'vscode';
import * as path from 'path';
import { FileOperationError } from './errors';
import { resolveWorkspacePath } from './pathResolver';

export interface SymbolInfo {
  name: string;
  kind: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  selectionRange: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  detail?: string;
  children?: SymbolInfo[];
  level: number;
}

export interface FindSymbolsOptions {
  includeChildren?: boolean;
  maxDepth?: number;
  filterKinds?: vscode.SymbolKind[];
}

/**
 * Extract all top-level and nested symbols from a single file using VS Code's DocumentSymbol API
 */
export async function findSymbolsInFile(
  filePath: string,
  options: FindSymbolsOptions = {}
): Promise<SymbolInfo[]> {
  const { includeChildren = true, maxDepth = 10, filterKinds } = options;

  try {
    if (!filePath) {
      throw new FileOperationError('No file path provided', 'EINVAL');
    }

    const resolvedPath = resolveWorkspacePath(filePath);
    
    // Check if file exists and is a file using VS Code FileSystemError
    try {
      const stats = await vscode.workspace.fs.stat(vscode.Uri.file(resolvedPath));
      if (stats.type !== vscode.FileType.File) {
        throw new FileOperationError(`Path is not a file: ${resolvedPath}`, 'ENOTFILE', resolvedPath);
      }
    } catch (error: any) {
      if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
        throw new FileOperationError(`File not found: ${resolvedPath}`, 'ENOENT', resolvedPath);
      }
      throw error;
    }

    // Open the document
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(resolvedPath));
    
    // Get document symbols
    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      'vscode.executeDocumentSymbolProvider',
      document.uri
    );

    if (!symbols || symbols.length === 0) {
      return [];
    }

    // Convert VS Code symbols to our format
    const convertSymbol = (symbol: vscode.DocumentSymbol, level: number = 0): SymbolInfo => {
      const symbolInfo: SymbolInfo = {
        name: symbol.name,
        kind: vscode.SymbolKind[symbol.kind],
        range: {
          start: { line: symbol.range.start.line, character: symbol.range.start.character },
          end: { line: symbol.range.end.line, character: symbol.range.end.character }
        },
        selectionRange: {
          start: { line: symbol.selectionRange.start.line, character: symbol.selectionRange.start.character },
          end: { line: symbol.selectionRange.end.line, character: symbol.selectionRange.end.character }
        },
        detail: symbol.detail,
        level
      };

      // Add children if requested and within depth limit
      if (includeChildren && symbol.children && symbol.children.length > 0 && level < maxDepth) {
        symbolInfo.children = symbol.children
          .filter(child => !filterKinds || filterKinds.includes(child.kind))
          .map(child => convertSymbol(child, level + 1));
      }

      return symbolInfo;
    };

    // Filter and convert symbols
    const filteredSymbols = symbols.filter(symbol => 
      !filterKinds || filterKinds.includes(symbol.kind)
    );

    return filteredSymbols.map(symbol => convertSymbol(symbol));

  } catch (error) {
    if (error instanceof FileOperationError) {
      throw error;
    }
    
    // Handle VS Code specific errors
    if (error instanceof Error) {
      if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
        throw new FileOperationError(`File not found: ${filePath}`, 'ENOENT', filePath);
      }
      if (error.message.includes('No symbol provider') || error.message.includes('no provider')) {
        throw new FileOperationError(
          `No symbol provider available for file type: ${path.extname(filePath)}`,
          'ENOSYMBOLPROVIDER',
          filePath
        );
      }
    }

    throw new FileOperationError(
      `Unexpected error finding symbols: ${error instanceof Error ? error.message : String(error)}`,
      'EUNKNOWN',
      filePath
    );
  }
}

/**
 * Format symbols for display
 */
export function formatSymbols(symbols: SymbolInfo[]): string {
  if (symbols.length === 0) {
    return 'No symbols found in file.';
  }

  const formatSymbol = (symbol: SymbolInfo, indent: string = ''): string[] => {
    const lines: string[] = [];
    const kindIcon = getSymbolIcon(symbol.kind);
    const location = `${symbol.range.start.line + 1}:${symbol.range.start.character + 1}`;
    const detail = symbol.detail ? ` (${symbol.detail})` : '';
    
    lines.push(`${indent}${kindIcon} ${symbol.name}${detail} - Line ${location}`);
    
    if (symbol.children && symbol.children.length > 0) {
      for (const child of symbol.children) {
        lines.push(...formatSymbol(child, indent + '  '));
      }
    }
    
    return lines;
  };

  const lines: string[] = [];
  for (const symbol of symbols) {
    lines.push(...formatSymbol(symbol));
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

// Symbol kind constants for filtering
export const SYMBOL_KINDS = {
  FILE: vscode.SymbolKind.File,
  MODULE: vscode.SymbolKind.Module,
  NAMESPACE: vscode.SymbolKind.Namespace,
  PACKAGE: vscode.SymbolKind.Package,
  CLASS: vscode.SymbolKind.Class,
  METHOD: vscode.SymbolKind.Method,
  PROPERTY: vscode.SymbolKind.Property,
  FIELD: vscode.SymbolKind.Field,
  CONSTRUCTOR: vscode.SymbolKind.Constructor,
  ENUM: vscode.SymbolKind.Enum,
  INTERFACE: vscode.SymbolKind.Interface,
  FUNCTION: vscode.SymbolKind.Function,
  VARIABLE: vscode.SymbolKind.Variable,
  CONSTANT: vscode.SymbolKind.Constant,
  STRING: vscode.SymbolKind.String,
  NUMBER: vscode.SymbolKind.Number,
  BOOLEAN: vscode.SymbolKind.Boolean,
  ARRAY: vscode.SymbolKind.Array,
  OBJECT: vscode.SymbolKind.Object,
  KEY: vscode.SymbolKind.Key,
  NULL: vscode.SymbolKind.Null,
  ENUM_MEMBER: vscode.SymbolKind.EnumMember,
  STRUCT: vscode.SymbolKind.Struct,
  EVENT: vscode.SymbolKind.Event,
  OPERATOR: vscode.SymbolKind.Operator,
  TYPE_PARAMETER: vscode.SymbolKind.TypeParameter
};