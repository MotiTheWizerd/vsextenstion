import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { FileOperationError } from "./errors";

export interface IndexedSymbol {
  name: string;
  filePath: string;
  line: number;
  character: number;
  kind?: string;
  detail?: string;
}

export interface IndexFile {
  relativePath: string;
  symbols: Array<{
    name: string;
    kind: string;
    detail?: string;
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
  }>;
}

export interface IndexData {
  files: IndexFile[];
  metadata?: {
    created: string;
    totalFiles: number;
    totalSymbols: number;
  };
}

// Global symbol index storage
let symbolIndex: IndexedSymbol[] = [];
let indexMetadata: IndexData['metadata'] | null = null;
let loadedIndexPath: string | null = null;

/**
 * Load a symbol index file into memory for fast lookups
 */
export async function loadIndex(indexPath: string = "./basicindex1.json"): Promise<string> {
  try {
    // Resolve path relative to workspace
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      throw new FileOperationError("No workspace folder open", "ENOWORKSPACE");
    }

    const absPath = path.isAbsolute(indexPath)
      ? indexPath
      : path.join(workspaceRoot, indexPath);

    if (!fs.existsSync(absPath)) {
      throw new FileOperationError(`Index file not found: ${absPath}`, "ENOENT");
    }

    // Read and parse the index file
    const rawData = fs.readFileSync(absPath, "utf8");
    let data: IndexData;
    
    try {
      data = JSON.parse(rawData);
    } catch (parseError) {
      throw new FileOperationError(
        `Invalid JSON in index file: ${(parseError as Error).message}`,
        "EINVAL"
      );
    }

    // Validate structure
    if (!data.files || !Array.isArray(data.files)) {
      throw new FileOperationError("Invalid index format: missing 'files' array", "EINVAL");
    }

    // Transform to flat symbol array for fast searching
    symbolIndex = data.files.flatMap(file =>
      file.symbols.map(sym => ({
        name: sym.name,
        filePath: file.relativePath,
        line: sym.range.start.line,
        character: sym.range.start.character,
        kind: sym.kind,
        detail: sym.detail
      }))
    );

    indexMetadata = data.metadata || null;
    loadedIndexPath = absPath;

    const symbolCount = symbolIndex.length;
    const fileCount = data.files.length;
    const indexName = path.basename(absPath);

    return `✅ **Loaded ${indexName}**\n\n` +
           `📊 **Statistics:**\n` +
           `- Files: ${fileCount}\n` +
           `- Symbols: ${symbolCount}\n` +
           `- Path: \`${absPath}\`\n\n` +
           `🚀 Ready for fast symbol lookups with \`findSymbolFromIndex\``;

  } catch (error) {
    if (error instanceof FileOperationError) {
      throw error;
    }
    throw new FileOperationError(
      `Failed to load index: ${(error as Error).message}`,
      "EINTERNAL"
    );
  }
}

/**
 * Get the currently loaded symbol index
 */
export function getSymbolIndex(): IndexedSymbol[] {
  return symbolIndex;
}

/**
 * Get metadata about the loaded index
 */
export function getIndexMetadata() {
  return {
    metadata: indexMetadata,
    loadedPath: loadedIndexPath,
    symbolCount: symbolIndex.length,
    isLoaded: symbolIndex.length > 0
  };
}

/**
 * Clear the loaded index from memory
 */
export function clearIndex(): string {
  const wasLoaded = symbolIndex.length > 0;
  symbolIndex = [];
  indexMetadata = null;
  loadedIndexPath = null;
  
  return wasLoaded 
    ? "🗑️ Cleared loaded index from memory"
    : "ℹ️ No index was loaded";
}