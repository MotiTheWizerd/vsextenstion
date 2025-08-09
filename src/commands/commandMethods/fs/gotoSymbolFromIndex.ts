import * as path from "path";
import * as vscode from "vscode";
import { FileOperationError } from "./errors";
import {
  findSymbolFromIndex,
  formatSymbolIndexResults,
} from "./findSymbolFromIndex";
import { getSymbolIndex } from "./loadIndex";

export interface GotoOptions {
  preview?: boolean;
  preserveFocus?: boolean;
  viewColumn?: vscode.ViewColumn;
  revealType?: vscode.TextEditorRevealType;
}

/**
 * Navigate to a specific symbol position using coordinates from the loaded index
 */
export async function gotoSymbolFromIndex(
  filePath: string,
  line: number,
  character: number,
  options: GotoOptions = {}
): Promise<string> {
  const {
    preview = false,
    preserveFocus = false,
    viewColumn = vscode.ViewColumn.One,
    revealType = vscode.TextEditorRevealType.InCenter,
  } = options;

  try {
    // Validate inputs
    if (!filePath || filePath.trim().length === 0) {
      throw new FileOperationError("File path cannot be empty", "EINVAL");
    }

    if (line < 0 || character < 0) {
      throw new FileOperationError(
        "Line and character must be non-negative",
        "EINVAL"
      );
    }

    // Resolve file path
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      throw new FileOperationError("No workspace folder open", "ENOWORKSPACE");
    }

    const absPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(workspaceRoot, filePath);

    // Open the document
    const fileUri = vscode.Uri.file(absPath);
    const doc = await vscode.workspace.openTextDocument(fileUri);

    // Validate line/character bounds
    const maxLine = doc.lineCount - 1;
    const actualLine = Math.min(line, maxLine);
    const maxChar = doc.lineAt(actualLine).text.length;
    const actualChar = Math.min(character, maxChar);

    // Show the document
    const editor = await vscode.window.showTextDocument(doc, {
      viewColumn,
      preview,
      preserveFocus,
    });

    // Set cursor position and reveal
    const position = new vscode.Position(actualLine, actualChar);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position), revealType);

    const locationStr = `${filePath}:${actualLine + 1}:${actualChar + 1}`;
    const adjustmentNote =
      actualLine !== line || actualChar !== character
        ? ` (adjusted from ${line + 1}:${character + 1})`
        : "";

    return `✅ **Opened:** ${locationStr}${adjustmentNote}`;
  } catch (error) {
    if (error instanceof FileOperationError) {
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new FileOperationError(
      `Failed to navigate to ${filePath}:${line + 1}:${
        character + 1
      }: ${errorMessage}`,
      "EINTERNAL"
    );
  }
}

/**
 * Find and navigate to a symbol by name using the loaded index
 */
export async function gotoSymbolByNameFromIndex(
  symbolName: string,
  options: GotoOptions & {
    caseSensitive?: boolean;
    exactMatch?: boolean;
    selectMatch?: number; // Which match to select if multiple found (0-based)
  } = {}
): Promise<string> {
  const {
    caseSensitive = false,
    exactMatch = true,
    selectMatch = 0,
    ...gotoOptions
  } = options;

  try {
    // Find symbols matching the name
    const matches = await findSymbolFromIndex(symbolName, {
      caseSensitive,
      exactMatch,
      maxResults: 50,
    });

    if (matches.length === 0) {
      throw new FileOperationError(
        `Symbol "${symbolName}" not found in loaded index`,
        "ENOENT"
      );
    }

    // Handle multiple matches
    if (matches.length > 1 && selectMatch === 0) {
      // Show all matches and go to the first one
      const formattedResults = formatSymbolIndexResults(matches, symbolName, {
        showDetails: true,
        maxResults: 10,
      });

      const selectedMatch = matches[0];
      await gotoSymbolFromIndex(
        selectedMatch.filePath,
        selectedMatch.line,
        selectedMatch.character,
        gotoOptions
      );

      return (
        `🎯 **Found ${matches.length} matches for "${symbolName}"**\n\n` +
        `✅ **Opened first match:** ${selectedMatch.filePath}:${
          selectedMatch.line + 1
        }:${selectedMatch.character + 1}\n\n` +
        `**All matches:**\n${formattedResults}`
      );
    }

    // Select specific match
    const matchIndex = Math.min(selectMatch, matches.length - 1);
    const selectedMatch = matches[matchIndex];

    await gotoSymbolFromIndex(
      selectedMatch.filePath,
      selectedMatch.line,
      selectedMatch.character,
      gotoOptions
    );

    const matchNote =
      matches.length > 1
        ? ` (match ${matchIndex + 1} of ${matches.length})`
        : "";

    return `✅ **Opened:** ${selectedMatch.filePath}:${
      selectedMatch.line + 1
    }:${selectedMatch.character + 1}${matchNote}`;
  } catch (error) {
    if (error instanceof FileOperationError) {
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new FileOperationError(
      `Failed to navigate to symbol "${symbolName}": ${errorMessage}`,
      "EINTERNAL"
    );
  }
}

/**
 * Show all symbols in the loaded index that match a pattern and allow quick navigation
 */
export async function showSymbolIndexMenu(
  searchPattern?: string,
  options: { maxResults?: number } = {}
): Promise<string> {
  const { maxResults = 50 } = options;

  const symbolIndex = getSymbolIndex();

  if (symbolIndex.length === 0) {
    throw new FileOperationError(
      "No index loaded. Use 'loadIndex' command first.",
      "ENOINDEX"
    );
  }

  let symbols = symbolIndex;

  // Filter by pattern if provided
  if (searchPattern) {
    const pattern = searchPattern.toLowerCase();
    symbols = symbols.filter((sym) => sym.name.toLowerCase().includes(pattern));
  }

  if (symbols.length === 0) {
    return searchPattern
      ? `No symbols found matching "${searchPattern}"`
      : "No symbols in loaded index";
  }

  // Limit results
  const displaySymbols = symbols.slice(0, maxResults);

  return formatSymbolIndexResults(displaySymbols, searchPattern || "all", {
    showDetails: true,
    maxResults,
  });
}
