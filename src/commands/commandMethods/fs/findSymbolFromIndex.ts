import { getSymbolIndex, IndexedSymbol } from "./loadIndex";
import { FileOperationError } from "./errors";

export interface SymbolSearchOptions {
  caseSensitive?: boolean;
  exactMatch?: boolean;
  maxResults?: number;
  filterKinds?: string[];
}

/**
 * Find symbols from the loaded index using fast in-memory search
 */
export async function findSymbolFromIndex(
  symbolName: string,
  options: SymbolSearchOptions = {}
): Promise<IndexedSymbol[]> {
  const {
    caseSensitive = false,
    exactMatch = false,
    maxResults = 100,
    filterKinds = []
  } = options;

  const symbolIndex = getSymbolIndex();
  
  if (symbolIndex.length === 0) {
    throw new FileOperationError(
      "No index loaded. Use 'loadIndex' command first to load a symbol index.",
      "ENOINDEX"
    );
  }

  if (!symbolName || symbolName.trim().length === 0) {
    throw new FileOperationError("Symbol name cannot be empty", "EINVAL");
  }

  const searchName = caseSensitive ? symbolName : symbolName.toLowerCase();
  
  let matches = symbolIndex.filter(sym => {
    // Apply kind filter if specified
    if (filterKinds.length > 0 && sym.kind && !filterKinds.includes(sym.kind)) {
      return false;
    }

    const symName = caseSensitive ? sym.name : sym.name.toLowerCase();
    
    if (exactMatch) {
      return symName === searchName;
    } else {
      return symName.includes(searchName);
    }
  });

  // Limit results
  if (matches.length > maxResults) {
    matches = matches.slice(0, maxResults);
  }

  return matches;
}

/**
 * Format symbol search results for display
 */
export function formatSymbolIndexResults(
  matches: IndexedSymbol[],
  searchTerm: string,
  options: { showDetails?: boolean; maxResults?: number } = {}
): string {
  const { showDetails = true, maxResults = 100 } = options;

  if (matches.length === 0) {
    return `❌ No symbols found matching "${searchTerm}" in loaded index`;
  }

  const displayMatches = matches.slice(0, maxResults);
  const hasMore = matches.length > maxResults;

  const lines: string[] = [];
  lines.push(`🔍 **Found ${matches.length} symbols matching "${searchTerm}"**\n`);

  // Group by file for better readability
  const byFile = new Map<string, IndexedSymbol[]>();
  for (const match of displayMatches) {
    if (!byFile.has(match.filePath)) {
      byFile.set(match.filePath, []);
    }
    byFile.get(match.filePath)!.push(match);
  }

  for (const [filePath, symbols] of byFile) {
    lines.push(`📄 **${filePath}**`);
    
    for (const symbol of symbols) {
      const kindIcon = getSymbolKindIcon(symbol.kind);
      const location = `${symbol.line + 1}:${symbol.character + 1}`;
      const detail = showDetails && symbol.detail ? ` (${symbol.detail})` : "";
      
      lines.push(`  ${kindIcon} ${symbol.name}${detail} - Line ${location}`);
    }
    lines.push("");
  }

  if (hasMore) {
    lines.push(`... and ${matches.length - maxResults} more results`);
  }

  return lines.join("\n");
}

/**
 * Get icon for symbol kind
 */
function getSymbolKindIcon(kind?: string): string {
  const icons: { [key: string]: string } = {
    File: "📄",
    Module: "📦",
    Namespace: "🏷️",
    Package: "📦",
    Class: "🏛️",
    Method: "⚡",
    Property: "🔧",
    Field: "🔧",
    Constructor: "🏗️",
    Enum: "📋",
    Interface: "🔌",
    Function: "⚡",
    Variable: "📊",
    Constant: "🔒",
    String: "📝",
    Number: "🔢",
    Boolean: "✅",
    Array: "📚",
    Object: "📦",
    Key: "🔑",
    Null: "❌",
    EnumMember: "📋",
    Struct: "🏗️",
    Event: "⚡",
    Operator: "➕",
    TypeParameter: "🏷️",
  };

  return icons[kind || ""] || "❓";
}