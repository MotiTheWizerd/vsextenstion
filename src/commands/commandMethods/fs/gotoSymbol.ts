import * as vscode from 'vscode';
import * as path from 'path';
import { FileOperationError } from './errors';
import { resolveWorkspacePath } from './pathResolver';

export interface GotoSymbolOptions {
  preserveFocus?: boolean;
  viewColumn?: vscode.ViewColumn;
  selection?: boolean; // Whether to select the symbol
  reveal?: vscode.TextEditorRevealType;
}

/**
 * Open a file and jump directly to a symbol definition at specific coordinates
 */
export async function gotoSymbol(
  filePath: string,
  line: number,
  character: number,
  options: GotoSymbolOptions = {}
): Promise<string> {
  const { 
    preserveFocus = false, 
    viewColumn = vscode.ViewColumn.One,
    selection = true,
    reveal = vscode.TextEditorRevealType.InCenter
  } = options;

  try {
    if (!filePath) {
      throw new FileOperationError('No file path provided', 'EINVAL');
    }

    if (line < 0 || character < 0) {
      throw new FileOperationError('Invalid line or character position', 'EINVAL');
    }

    const resolvedPath = resolveWorkspacePath(filePath);
    
    // Check if file exists using VS Code FileSystemError
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
    const fileUri = vscode.Uri.file(resolvedPath);
    const document = await vscode.workspace.openTextDocument(fileUri);

    // Validate and clamp position using VS Code's built-in validation
    const requestedPosition = new vscode.Position(line, character);
    const position = document.validatePosition(requestedPosition);
    
    // Check if position was clamped (indicates out of bounds)
    if (!position.isEqual(requestedPosition)) {
      const actualLine = position.line;
      const actualChar = position.character;
      console.warn(`[RayDaemon] Position ${line}:${character} was clamped to ${actualLine}:${actualChar}`);
    }
    const range = selection ? new vscode.Range(position, position) : undefined;

    // Show the document
    const editor = await vscode.window.showTextDocument(document, {
      viewColumn,
      preserveFocus,
      selection: range
    });

    // Reveal the position
    if (reveal !== vscode.TextEditorRevealType.Default) {
      editor.revealRange(new vscode.Range(position, position), reveal);
    }

    // Get some context around the symbol for confirmation
    const contextStart = Math.max(0, line - 2);
    const contextEnd = Math.min(document.lineCount - 1, line + 2);
    const contextRange = new vscode.Range(contextStart, 0, contextEnd, document.lineAt(contextEnd).text.length);
    const context = document.getText(contextRange);

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const relativePath = workspaceFolder 
      ? path.relative(workspaceFolder.uri.fsPath, resolvedPath)
      : path.basename(resolvedPath);

    return `✅ **Opened and navigated to ${relativePath}:${line + 1}:${character + 1}**\n\n` +
           `**Context:**\n\`\`\`\n${context}\n\`\`\``;

  } catch (error) {
    if (error instanceof FileOperationError) {
      throw error;
    }
    
    throw new FileOperationError(
      `Unexpected error navigating to symbol: ${error instanceof Error ? error.message : String(error)}`,
      'EUNKNOWN',
      filePath
    );
  }
}

/**
 * Find a symbol by name and navigate to it
 */
export async function gotoSymbolByName(
  symbolName: string,
  options: GotoSymbolOptions & { 
    symbolIndex?: number; 
    filePath?: string;
    exactMatch?: boolean;
  } = {}
): Promise<string> {
  const { symbolIndex = 0, filePath, exactMatch = false, ...gotoOptions } = options;

  try {
    if (!symbolName || symbolName.trim().length === 0) {
      throw new FileOperationError('No symbol name provided', 'EINVAL');
    }

    // Find the symbol
    const { findSymbol } = await import('./findSymbol.js');
    const symbols = await findSymbol(symbolName, { 
      exactMatch,
      maxResults: 50
    });

    if (symbols.length === 0) {
      throw new FileOperationError(`Symbol "${symbolName}" not found`, 'ENOENT', symbolName);
    }

    // Filter by file path if specified with smart matching
    let filteredSymbols = symbols;
    if (filePath) {
      const normalizedFilter = path.normalize(filePath).toLowerCase();
      
      filteredSymbols = symbols.filter((s: any) => {
        const normalizedRelative = s.relativePath.toLowerCase();
        const normalizedBasename = path.basename(s.filePath).toLowerCase();
        
        // Priority order: exact basename match, starts with filter, contains filter
        return normalizedBasename === normalizedFilter ||
               normalizedRelative.startsWith(normalizedFilter) ||
               normalizedBasename.startsWith(normalizedFilter) ||
               normalizedRelative.includes(normalizedFilter);
      });
      
      // Sort filtered results by relevance
      filteredSymbols.sort((a: any, b: any) => {
        const aBasename = path.basename(a.filePath).toLowerCase();
        const bBasename = path.basename(b.filePath).toLowerCase();
        const aRelative = a.relativePath.toLowerCase();
        const bRelative = b.relativePath.toLowerCase();
        
        // Exact basename match first
        if (aBasename === normalizedFilter && bBasename !== normalizedFilter) {
          return -1;
        }
        if (aBasename !== normalizedFilter && bBasename === normalizedFilter) {
          return 1;
        }
        
        // Then basename starts with
        if (aBasename.startsWith(normalizedFilter) && !bBasename.startsWith(normalizedFilter)) {
          return -1;
        }
        if (!aBasename.startsWith(normalizedFilter) && bBasename.startsWith(normalizedFilter)) {
          return 1;
        }
        
        // Then relative path starts with
        if (aRelative.startsWith(normalizedFilter) && !bRelative.startsWith(normalizedFilter)) {
          return -1;
        }
        if (!aRelative.startsWith(normalizedFilter) && bRelative.startsWith(normalizedFilter)) {
          return 1;
        }
        
        // Finally by path length and alphabetical
        const pathLengthDiff = a.relativePath.length - b.relativePath.length;
        return pathLengthDiff !== 0 ? pathLengthDiff : a.relativePath.localeCompare(b.relativePath);
      });
      
      if (filteredSymbols.length === 0) {
        throw new FileOperationError(
          `Symbol "${symbolName}" not found in file matching "${filePath}"`,
          'ENOENT',
          symbolName
        );
      }
    }

    // Validate symbol index
    if (symbolIndex >= filteredSymbols.length) {
      throw new FileOperationError(
        `Symbol index ${symbolIndex} is out of range (found ${filteredSymbols.length} symbols)`,
        'ERANGE',
        symbolName
      );
    }

    const targetSymbol = filteredSymbols[symbolIndex];

    // Navigate to the symbol
    const result = await gotoSymbol(
      targetSymbol.filePath,
      targetSymbol.range.start.line,
      targetSymbol.range.start.character,
      gotoOptions
    );

    // Add symbol information to the result
    const kindIcon = getSymbolIcon(targetSymbol.kind);
    const container = targetSymbol.containerName ? ` in ${targetSymbol.containerName}` : '';
    const symbolInfo = `${kindIcon} **${targetSymbol.name}** (${targetSymbol.kind})${container}`;

    if (filteredSymbols.length > 1) {
      return `${symbolInfo}\n\n${result}\n\n*Note: Found ${filteredSymbols.length} symbols with this name. Use symbolIndex parameter to select others.*`;
    }

    return `${symbolInfo}\n\n${result}`;

  } catch (error) {
    if (error instanceof FileOperationError) {
      throw error;
    }
    
    throw new FileOperationError(
      `Unexpected error navigating to symbol by name: ${error instanceof Error ? error.message : String(error)}`,
      'EUNKNOWN',
      symbolName
    );
  }
}

/**
 * Navigate to definition of symbol at current position
 */
export async function gotoDefinition(
  filePath: string,
  line: number,
  character: number,
  options: GotoSymbolOptions = {}
): Promise<string> {
  try {
    if (!filePath) {
      throw new FileOperationError('No file path provided', 'EINVAL');
    }

    if (line < 0 || character < 0) {
      throw new FileOperationError('Invalid line or character position', 'EINVAL');
    }

    const resolvedPath = resolveWorkspacePath(filePath);
    const fileUri = vscode.Uri.file(resolvedPath);
    const position = new vscode.Position(line, character);

    // Use VS Code's definition provider - can return Location[] or LocationLink[]
    const definitions = await vscode.commands.executeCommand<(vscode.Location | vscode.LocationLink)[]>(
      'vscode.executeDefinitionProvider',
      fileUri,
      position
    );

    if (!definitions || definitions.length === 0) {
      throw new FileOperationError(
        `No definition found for symbol at ${filePath}:${line + 1}:${character + 1}`,
        'ENOENT',
        filePath
      );
    }

    // Handle both Location and LocationLink
    const firstDefinition = definitions[0];
    let targetUri: vscode.Uri;
    let targetRange: vscode.Range;

    if ('targetUri' in firstDefinition) {
      // LocationLink
      targetUri = firstDefinition.targetUri;
      targetRange = firstDefinition.targetRange;
    } else {
      // Location
      targetUri = firstDefinition.uri;
      targetRange = firstDefinition.range;
    }

    const result = await gotoSymbol(
      targetUri.fsPath,
      targetRange.start.line,
      targetRange.start.character,
      options
    );

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const sourceRelativePath = workspaceFolder 
      ? path.relative(workspaceFolder.uri.fsPath, resolvedPath)
      : path.basename(resolvedPath);

    if (definitions.length > 1) {
      return `🎯 **Definition found** (from ${sourceRelativePath}:${line + 1}:${character + 1})\n\n${result}\n\n*Note: Found ${definitions.length} definitions. Navigated to the first one.*`;
    }

    return `🎯 **Definition found** (from ${sourceRelativePath}:${line + 1}:${character + 1})\n\n${result}`;

  } catch (error) {
    if (error instanceof FileOperationError) {
      throw error;
    }
    
    throw new FileOperationError(
      `Unexpected error navigating to definition: ${error instanceof Error ? error.message : String(error)}`,
      'EUNKNOWN',
      filePath
    );
  }
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