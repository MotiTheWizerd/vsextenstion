import * as vscode from 'vscode';
import * as path from 'path';
import { FileOperationError } from './errors';
import { resolveWorkspacePath } from './pathResolver';

export type EditorOpenOptions = {
  preserveFocus?: boolean;
  preview?: boolean;
  selection?: { start: { line: number; character: number }, end?: { line: number; character: number } };
};

/**
 * Escape markdown code fences in content to prevent breaking the fence
 */
function escapeFencesInContext(content: string): string {
  // Replace triple backticks with escaped version
  return content.replace(/```/g, '\\`\\`\\`');
}

export interface OpenInEditorOptions {
  line?: number;
  column?: number;
  preserveFocus?: boolean;
  viewColumn?: vscode.ViewColumn;
  selection?: boolean;
  reveal?: vscode.TextEditorRevealType;
  preview?: boolean;
}

// Legacy function for backward compatibility
export async function openInEditor(filePath: string, options: EditorOpenOptions = {}): Promise<void> {
  const abs = resolveWorkspacePath(filePath);
  const uri = vscode.Uri.file(abs);

  const doc = await vscode.workspace.openTextDocument(uri);
  const editor = await vscode.window.showTextDocument(doc, {
    preserveFocus: options.preserveFocus ?? false,
    preview: options.preview ?? true,
  });

  if (options.selection) {
    const start = new vscode.Position(options.selection.start.line, options.selection.start.character);
    const end = options.selection.end
      ? new vscode.Position(options.selection.end.line, options.selection.end.character)
      : start;
    editor.selection = new vscode.Selection(start, end);
    editor.revealRange(new vscode.Range(start, end), vscode.TextEditorRevealType.InCenter);
  }
}

/**
 * Enhanced version: Open a file in the main VS Code editor at a specific line/column
 */
export async function openInEditorEnhanced(
  filePath: string,
  options: OpenInEditorOptions = {}
): Promise<string> {
  const {
    line = 0,
    column = 0,
    preserveFocus = false,
    viewColumn = vscode.ViewColumn.One,
    selection = true,
    reveal = vscode.TextEditorRevealType.InCenter,
    preview = false
  } = options;

  try {
    if (!filePath) {
      throw new FileOperationError('No file path provided', 'EINVAL');
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
    const requestedPosition = new vscode.Position(line, column);
    const position = document.validatePosition(requestedPosition);
    
    // Check if position was clamped (indicates out of bounds)
    if (!position.isEqual(requestedPosition)) {
      const actualLine = position.line;
      const actualChar = position.character;
      console.warn(`[RayDaemon] Position ${line}:${column} was clamped to ${actualLine}:${actualChar}`);
    }

    // Create selection range if requested
    const range = selection ? new vscode.Range(position, position) : undefined;

    // Show the document
    const editor = await vscode.window.showTextDocument(document, {
      viewColumn,
      preserveFocus,
      selection: range,
      preview
    });

    // Reveal the position
    if (reveal !== vscode.TextEditorRevealType.Default) {
      editor.revealRange(new vscode.Range(position, position), reveal);
    }

    // Get some context around the position for confirmation
    const contextStart = Math.max(0, position.line - 2);
    const contextEnd = Math.min(document.lineCount - 1, position.line + 2);
    const contextRange = new vscode.Range(contextStart, 0, contextEnd, document.lineAt(contextEnd).text.length);
    let context = document.getText(contextRange);
    
    // Clamp context length to prevent UI issues with huge lines
    const maxContextLength = 4000;
    if (context.length > maxContextLength) {
      context = context.substring(0, maxContextLength) + '\n... [truncated]';
    }
    
    // Escape markdown fences in context
    context = escapeFencesInContext(context);

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const relativePath = workspaceFolder 
      ? path.relative(workspaceFolder.uri.fsPath, resolvedPath).replace(/\\/g, '/') // Normalize separators
      : path.basename(resolvedPath);

    return `✅ **Opened ${relativePath}:${position.line + 1}:${position.character + 1}**\n\n` +
           `**Context:**\n\`\`\`\n${context}\n\`\`\``;

  } catch (error) {
    if (error instanceof FileOperationError) {
      throw error;
    }
    
    // Handle workspace resolution errors specifically
    if (error instanceof Error && error.message.includes('workspace')) {
      throw new FileOperationError(
        `Workspace error: ${error.message}`,
        'ENOWORKSPACE',
        filePath
      );
    }
    
    throw new FileOperationError(
      `Unexpected error opening file in editor: ${error instanceof Error ? error.message : String(error)}`,
      'EUNKNOWN',
      filePath
    );
  }
}

/**
 * Open multiple files in editor with optional positioning and layout control
 */
export async function openMultipleInEditor(
  files: Array<{ path: string; line?: number; column?: number }>,
  options: Omit<OpenInEditorOptions, 'line' | 'column'> & { layout?: 'tabs' | 'split' | 'columns' } = {}
): Promise<string> {
  try {
    if (!files || files.length === 0) {
      throw new FileOperationError('No files provided', 'EINVAL');
    }

    const { layout = 'tabs', ...baseOptions } = options;
    const results: string[] = [];
    const successfulFiles: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        let viewColumn: vscode.ViewColumn;
        
        // Determine view column based on layout and file index
        switch (layout) {
          case 'split':
            // Split: first file in column 1, rest in beside (creates splits)
            viewColumn = i === 0 ? vscode.ViewColumn.One : vscode.ViewColumn.Beside;
            break;
          case 'columns':
            // Columns: distribute across specific columns
            viewColumn = (i % 3) + 1 as vscode.ViewColumn; // Cycle through columns 1, 2, 3
            break;
          case 'tabs':
          default:
            // Tabs: all in the same column (creates tabs)
            viewColumn = baseOptions.viewColumn || vscode.ViewColumn.One;
            break;
        }

        const fileOptions: OpenInEditorOptions = {
          ...baseOptions,
          line: file.line || 0,
          column: file.column || 0,
          viewColumn,
          preserveFocus: i < files.length - 1 || baseOptions.preserveFocus // Only focus the last file unless preserveFocus is set
        };

        const result = await openInEditorEnhanced(file.path, fileOptions);
        results.push(`✅ ${file.path}${file.line !== undefined ? `:${file.line + 1}` : ''}${file.column !== undefined ? `:${file.column + 1}` : ''}`);
        successfulFiles.push(file.path);

        // Small delay between opening files to avoid overwhelming VS Code
        if (i < files.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        const errorMsg = `❌ Failed to open ${file.path}: ${error instanceof Error ? error.message : String(error)}`;
        results.push(errorMsg);
        console.warn(`[RayDaemon] ${errorMsg}`);
      }
    }

    const successCount = successfulFiles.length;
    const failCount = files.length - successCount;
    
    let summary = `📁 **Opened ${successCount}/${files.length} files`;
    if (layout !== 'tabs') {
      summary += ` (${layout} layout)`;
    }
    summary += '**';
    
    if (failCount > 0) {
      summary += ` - ${failCount} failed`;
    }

    return `${summary}\n\n${results.join('\n')}`;

  } catch (error) {
    if (error instanceof FileOperationError) {
      throw error;
    }
    
    throw new FileOperationError(
      `Unexpected error opening multiple files: ${error instanceof Error ? error.message : String(error)}`,
      'EUNKNOWN'
    );
  }
}

/**
 * Open file and highlight a specific range
 */
export async function openAndHighlight(
  filePath: string,
  startLine: number,
  startColumn: number,
  endLine: number,
  endColumn: number,
  options: Omit<OpenInEditorOptions, 'line' | 'column' | 'selection'> = {}
): Promise<string> {
  try {
    const resolvedPath = resolveWorkspacePath(filePath);
    const fileUri = vscode.Uri.file(resolvedPath);
    const document = await vscode.workspace.openTextDocument(fileUri);

    // Validate positions and ensure correct order
    let startPos = document.validatePosition(new vscode.Position(startLine, startColumn));
    let endPos = document.validatePosition(new vscode.Position(endLine, endColumn));
    
    // Swap if start comes after end
    if (startPos.isAfter(endPos)) {
      [startPos, endPos] = [endPos, startPos];
    }
    
    const highlightRange = new vscode.Range(startPos, endPos);

    // Show the document with selection
    const editor = await vscode.window.showTextDocument(document, {
      viewColumn: options.viewColumn || vscode.ViewColumn.One,
      preserveFocus: options.preserveFocus || false,
      selection: highlightRange,
      preview: options.preview || false
    });

    // Reveal the range
    editor.revealRange(highlightRange, options.reveal || vscode.TextEditorRevealType.InCenter);

    // Get the highlighted text with length limit
    let highlightedText = document.getText(highlightRange);
    const maxHighlightLength = 2000;
    if (highlightedText.length > maxHighlightLength) {
      highlightedText = highlightedText.substring(0, maxHighlightLength) + '\n... [truncated]';
    }
    
    // Escape markdown fences
    highlightedText = escapeFencesInContext(highlightedText);
    
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const relativePath = workspaceFolder 
      ? path.relative(workspaceFolder.uri.fsPath, resolvedPath).replace(/\\/g, '/') // Normalize separators
      : path.basename(resolvedPath);

    return `✅ **Opened and highlighted in ${relativePath}**\n\n` +
           `**Range:** ${startPos.line + 1}:${startPos.character + 1} - ${endPos.line + 1}:${endPos.character + 1}\n\n` +
           `**Highlighted text:**\n\`\`\`\n${highlightedText}\n\`\`\``;

  } catch (error) {
    if (error instanceof FileOperationError) {
      throw error;
    }
    
    throw new FileOperationError(
      `Unexpected error opening and highlighting: ${error instanceof Error ? error.message : String(error)}`,
      'EUNKNOWN',
      filePath
    );
  }
}
