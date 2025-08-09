import * as vscode from "vscode";
import {
  readFile,
  listFiles,
  formatFileList,
  FileOperationError,
  writeFileSafe,
  appendToFile,
  ensureDir,
  removePath,
  movePath,
  replaceInFile,
  getFileInfo,
  globSearch,
  openInEditor,
  openInEditorEnhanced,
  openMultipleInEditor,
  openAndHighlight,
  findByExtension,
  EXTENSION_GROUPS,
  findSymbolsInFile,
  formatSymbols,
  findAllSymbols,
  formatAllSymbols,
  searchSymbolsByName,
  SYMBOL_KINDS,
  findSymbol,
  formatSymbolLocations,
  getSymbolReferences,
  getSymbolReferencesByName,
  formatSymbolReferences,
  gotoSymbol,
  gotoSymbolByName,
  gotoDefinition,
  searchText,
  formatTextSearchResults,
  searchRegex,
  formatRegexSearchResults,
  createIndex,
  saveIndex,
  formatIndexSummary,
  updateIndex,
  formatUpdateResult,
  exportIndex,
  formatExportResult,
  loadIndex,
  getSymbolIndex,
  getIndexMetadata,
  clearIndex,
  findSymbolFromIndex,
  formatSymbolIndexResults,
  gotoSymbolFromIndex,
  gotoSymbolByNameFromIndex,
  showSymbolIndexMenu,
} from "./commandMethods/fs";
import { sendToRayLoop } from "../rayLoop";
import { config } from "../config";

/**
 * Get icon for symbol kind
 */
function getSymbolIcon(kind: string): string {
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

  return icons[kind] || "❓";
}

/**
 * Expand extension groups to actual extensions
 */
export function expandExtensions(
  extensions: string | string[]
): string | string[] {
  if (Array.isArray(extensions)) {
    return extensions;
  }

  // Check if it's a known extension group
  if (extensions in EXTENSION_GROUPS) {
    return EXTENSION_GROUPS[extensions as keyof typeof EXTENSION_GROUPS];
  }

  // Check if it's comma-separated extensions
  if (extensions.includes(",")) {
    return extensions.split(",").map((ext) => ext.trim());
  }

  // Return as-is (single extension)
  return extensions;
}

type CommandHandler = (args: string[]) => Promise<string>;

export interface CommandRegistry {
  [key: string]: {
    handler: CommandHandler;
    description: string;
    usage: string;
  };
}

export class CommandError extends Error {
  constructor(
    message: string,
    public readonly code: string = "EINVAL",
    public readonly showToUser: boolean = true
  ) {
    super(message);
    this.name = "CommandError";
  }
}

// Internal command handlers
export const commandHandlers: CommandRegistry = {
  read: {
    handler: async (args: string[]): Promise<string> => {
      if (args.length === 0) {
        throw new CommandError("No file path provided", "EINVAL");
      }
      const filePath = args[0];
      const options: { encoding?: BufferEncoding } = {};

      // Handle optional encoding parameter
      if (args.length > 1) {
        const encoding = args[1].toLowerCase();
        if (["utf8", "base64", "hex"].includes(encoding)) {
          options.encoding = encoding as BufferEncoding;
        }
      }

      return await readFile(filePath, { ...options, autoAnalyze: true });
    },
    description: "Read the contents of a file",
    usage: "read <filePath> [encoding:utf8|base64|hex]",
  },

  ls: {
    handler: async (args: string[]): Promise<string> => {
      const dirPath = args[0] || ".";
      const showHidden = args.includes("--hidden") || args.includes("-a");

      try {
        const files = await listFiles(dirPath, { showHidden });
        return formatFileList(files);
      } catch (error: unknown) {
        if (error instanceof FileOperationError) {
          throw new CommandError(
            `Failed to list files in ${dirPath}: ${error.message}`,
            error.code || "EUNKNOWN",
            true
          );
        }
        // Re-throw with proper typing
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorCode = (error as NodeJS.ErrnoException)?.code || "EINTERNAL";
        throw new CommandError(
          `Unexpected error listing files: ${errorMessage}`,
          errorCode,
          true
        );
      }
    },
    description: "List files in a directory",
    usage: "ls [directory] [--hidden|-a]",
  },

  help: {
    handler: async (): Promise<string> => {
      const commands = Object.entries(commandHandlers)
        .map(
          ([cmd, { description, usage }]) =>
            `**${cmd}** - ${description}\n     Usage: \`${usage}\``
        )
        .join("\n\n");

      return `## Available Commands\n\n${commands}\n\n**Note:** Any other message will be sent to your Ray API endpoint.`;
    },
    description: "Show this help message",
    usage: "help",
  },

  ping: {
    handler: async (): Promise<string> => {
      return "🏓 **Pong!** RayDaemon is running and ready to receive commands.";
    },
    description: "Test if RayDaemon is responding",
    usage: "ping",
  },

  status: {
    handler: async (): Promise<string> => {
      return `## 🚀 RayDaemon Status

**API Endpoint:** \`${config.apiEndpoint}\`
**Ray Endpoint:** \`${config.rayApiEndpoint}\`
**Webhook Port:** \`${config.webhookPort}\`
**Environment:** \`${config.environment}\`

✅ **Status:** Ready to send messages to your Ray API!`;
    },
    description: "Show RayDaemon status and configuration",
    usage: "status",
  },

  test: {
    handler: async (): Promise<string> => {
      return await sendToRayLoop(
        "Hello Ray! This is a test message from RayDaemon."
      );
    },
    description: "Send a test message to Ray API",
    usage: "test",
  },
  // inside your registry:
  write: {
    handler: async ([file, ...rest]) => {
      const content = rest.join(" ");
      await writeFileSafe(file, content);
      return `✅ Wrote ${file}`;
    },
    description: "Write (overwrite) a file with content",
    usage: "write <relativePath> <content...>",
  },

  append: {
    handler: async ([file, ...rest]) => {
      const content = rest.join(" ");
      await appendToFile(file, content);
      return `✅ Appended to ${file}`;
    },
    description: "Append content to a file",
    usage: "append <relativePath> <content...>",
  },

  mkdir: {
    handler: async ([dir]) => {
      await ensureDir(dir);
      return `✅ Ensured directory ${dir}`;
    },
    description: "Create directory (recursive)",
    usage: "mkdir <relativePath>",
  },

  rm: {
    handler: async ([target, recursiveFlag]) => {
      await removePath(target, {
        recursive: recursiveFlag === "-r" || recursiveFlag === "--recursive",
      });
      return `🗑️ Removed ${target}`;
    },
    description: "Remove file/dir",
    usage: "rm <relativePath> [-r]",
  },

  mv: {
    handler: async ([src, dest]) => {
      await movePath(src, dest, { overwrite: true, createDirs: true });
      return `🚚 Moved ${src} → ${dest}`;
    },
    description: "Move/rename file/dir",
    usage: "mv <src> <dest>",
  },

  replace: {
    handler: async ([file, search, replacement]) => {
      const count = await replaceInFile(file, search, replacement, {
        global: true,
      });
      return `🔁 Replaced ${count} occurrence(s) in ${file}`;
    },
    description: "Find & replace in a file (literal)",
    usage: "replace <file> <search> <replacement>",
  },

  open: {
    handler: async (args: string[]): Promise<string> => {
      if (!args[0]) {
        throw new CommandError("No file path provided", "EINVAL");
      }

      // Normalize the file path (handle double backslashes on Windows)
      let normalizedPath = args[0].replace(/\\\\/g, "\\");

      try {
        let fileUri: vscode.Uri;

        // Check if path is absolute (starts with drive letter on Windows or / on Unix)
        const isAbsolute = /^([a-zA-Z]:[\\/]|[\\/])/.test(normalizedPath);

        if (isAbsolute) {
          // Use absolute path as-is
          fileUri = vscode.Uri.file(normalizedPath);
        } else {
          // Treat as relative to workspace root
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (!workspaceFolder) {
            throw new CommandError("No workspace folder open", "ENOWORKSPACE");
          }
          fileUri = vscode.Uri.joinPath(workspaceFolder.uri, normalizedPath);
        }

        const doc = await vscode.workspace.openTextDocument(fileUri);

        await vscode.window.showTextDocument(doc, {
          viewColumn: vscode.ViewColumn.One, // Force main editor group
          preserveFocus: false, // Bring focus to it
        });

        return `✅ Opened file in main editor: ${fileUri.fsPath}`;
      } catch (error) {
        throw new CommandError(
          `Failed to open file: ${
            error instanceof Error ? error.message : String(error)
          }`,
          "ENOENT"
        );
      }
    },
    description: "Opens a file in the main VS Code editor window",
    usage: "open <filePath>",
  },

  findByExtension: {
    handler: async (args: string[]): Promise<string> => {
      if (args.length === 0) {
        throw new CommandError("No extensions provided", "EINVAL");
      }

      let extensions: string | string[];
      let dirPath = ".";
      let showHidden = false;
      let maxDepth = 10;
      let caseSensitive = false;

      // Parse arguments
      const nonFlagArgs: string[] = [];
      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--hidden" || arg === "-a") {
          showHidden = true;
        } else if (arg === "--case-sensitive" || arg === "-c") {
          caseSensitive = true;
        } else if (arg === "--depth" || arg === "-d") {
          const depthValue = args[++i];
          if (!depthValue || isNaN(Number(depthValue))) {
            throw new CommandError("Invalid depth value", "EINVAL");
          }
          maxDepth = Number(depthValue);
        } else if (!arg.startsWith("-")) {
          nonFlagArgs.push(arg);
        }
      }

      // First arg is extensions, second (optional) is directory
      if (nonFlagArgs.length === 0) {
        throw new CommandError("No extensions provided", "EINVAL");
      }

      const extensionArg = nonFlagArgs[0];
      if (nonFlagArgs.length > 1) {
        dirPath = nonFlagArgs[1];
      }

      // Handle extension groups or comma-separated extensions
      if (extensionArg in EXTENSION_GROUPS) {
        extensions =
          EXTENSION_GROUPS[extensionArg as keyof typeof EXTENSION_GROUPS];
      } else if (extensionArg.includes(",")) {
        extensions = extensionArg.split(",").map((ext) => ext.trim());
      } else {
        extensions = extensionArg;
      }

      try {
        const files = await findByExtension(extensions, dirPath, {
          showHidden,
          maxDepth,
          caseSensitive,
        });

        if (files.length === 0) {
          const extDisplay = Array.isArray(extensions)
            ? extensions.join(", ")
            : extensions;
          return `No files found with extension(s): ${extDisplay} in ${dirPath}`;
        }

        return formatFileList(files);
      } catch (error: unknown) {
        if (error instanceof FileOperationError) {
          throw new CommandError(
            `Failed to find files by extension: ${error.message}`,
            error.code || "EUNKNOWN",
            true
          );
        }
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorCode = (error as NodeJS.ErrnoException)?.code || "EINTERNAL";
        throw new CommandError(
          `Unexpected error finding files by extension: ${errorMessage}`,
          errorCode,
          true
        );
      }
    },
    description:
      "Find files by extension(s) with fast filtering. Supports extension groups: code, web, docs, config, images, media, data",
    usage:
      "findByExtension <extensions|group> [directory] [--hidden|-a] [--case-sensitive|-c] [--depth|-d <number>]",
  },

  findSymbolsInFile: {
    handler: async (args: string[]): Promise<string> => {
      if (args.length === 0) {
        throw new CommandError("No file path provided", "EINVAL");
      }

      const filePath = args[0];
      let includeChildren = true;
      let maxDepth = 10;
      const filterKinds: vscode.SymbolKind[] = [];

      // Parse arguments
      for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--no-children") {
          includeChildren = false;
        } else if (arg === "--depth" || arg === "-d") {
          const depthValue = args[++i];
          if (!depthValue || isNaN(Number(depthValue))) {
            throw new CommandError("Invalid depth value", "EINVAL");
          }
          maxDepth = Number(depthValue);
        } else if (arg === "--kind" || arg === "-k") {
          const kindValue = args[++i];
          if (!kindValue) {
            throw new CommandError("No kind value provided", "EINVAL");
          }
          const kind =
            SYMBOL_KINDS[kindValue.toUpperCase() as keyof typeof SYMBOL_KINDS];
          if (kind !== undefined) {
            filterKinds.push(kind);
          }
        }
      }

      try {
        const symbols = await findSymbolsInFile(filePath, {
          includeChildren,
          maxDepth,
          filterKinds: filterKinds.length > 0 ? filterKinds : undefined,
        });

        return formatSymbols(symbols);
      } catch (error: unknown) {
        if (error instanceof FileOperationError) {
          throw new CommandError(
            `Failed to find symbols in file: ${error.message}`,
            error.code || "EUNKNOWN",
            true
          );
        }
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorCode = (error as NodeJS.ErrnoException)?.code || "EINTERNAL";
        throw new CommandError(
          `Unexpected error finding symbols in file: ${errorMessage}`,
          errorCode,
          true
        );
      }
    },
    description:
      "Extract all top-level and nested symbols from a single file using DocumentSymbol API",
    usage:
      "findSymbolsInFile <filePath> [--no-children] [--depth|-d <number>] [--kind|-k <symbolKind>]",
  },

  findAllSymbols: {
    handler: async (args: string[]): Promise<string> => {
      let searchPath = ".";
      let extensions: string | string[] = "code";
      let includeChildren = true;
      let maxDepth = 10;
      let maxFiles = 1000;
      let showProgress = true;
      let incremental = false;
      let groupByFile = true;
      let maxFilesToShow = 50;
      const filterKinds: vscode.SymbolKind[] = [];

      // Parse arguments
      const nonFlagArgs: string[] = [];
      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--no-children") {
          includeChildren = false;
        } else if (arg === "--no-progress") {
          showProgress = false;
        } else if (arg === "--incremental") {
          incremental = true;
        } else if (arg === "--flat") {
          groupByFile = false;
        } else if (arg === "--depth" || arg === "-d") {
          const depthValue = args[++i];
          if (!depthValue || isNaN(Number(depthValue))) {
            throw new CommandError("Invalid depth value", "EINVAL");
          }
          maxDepth = Number(depthValue);
        } else if (arg === "--max-files") {
          const maxFilesValue = args[++i];
          if (!maxFilesValue || isNaN(Number(maxFilesValue))) {
            throw new CommandError("Invalid max-files value", "EINVAL");
          }
          maxFiles = Number(maxFilesValue);
        } else if (arg === "--max-show") {
          const maxShowValue = args[++i];
          if (!maxShowValue || isNaN(Number(maxShowValue))) {
            throw new CommandError("Invalid max-show value", "EINVAL");
          }
          maxFilesToShow = Number(maxShowValue);
        } else if (arg === "--extensions" || arg === "-e") {
          const extValue = args[++i];
          if (!extValue) {
            throw new CommandError("No extensions value provided", "EINVAL");
          }
          extensions = extValue.includes(",")
            ? extValue.split(",").map((e) => e.trim())
            : extValue;
        } else if (arg === "--kind" || arg === "-k") {
          const kindValue = args[++i];
          if (!kindValue) {
            throw new CommandError("No kind value provided", "EINVAL");
          }
          const kind =
            SYMBOL_KINDS[kindValue.toUpperCase() as keyof typeof SYMBOL_KINDS];
          if (kind !== undefined) {
            filterKinds.push(kind);
          }
        } else if (!arg.startsWith("-")) {
          nonFlagArgs.push(arg);
        }
      }

      // First non-flag arg is search path
      if (nonFlagArgs.length > 0) {
        searchPath = nonFlagArgs[0];
      }

      try {
        // Expand extension groups before passing to findAllSymbols
        const expandedExtensions = expandExtensions(extensions);

        const fileSymbols = await findAllSymbols(searchPath, {
          extensions: expandedExtensions,
          includeChildren,
          maxDepth,
          filterKinds: filterKinds.length > 0 ? filterKinds : undefined,
          maxFiles,
          showProgress,
          incremental,
        });

        return formatAllSymbols(fileSymbols, {
          showFilePaths: true,
          showErrors: true,
          maxFilesToShow,
          groupByFile,
        });
      } catch (error: unknown) {
        if (error instanceof FileOperationError) {
          throw new CommandError(
            `Failed to find all symbols: ${error.message}`,
            error.code || "EUNKNOWN",
            true
          );
        }
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorCode = (error as NodeJS.ErrnoException)?.code || "EINTERNAL";
        throw new CommandError(
          `Unexpected error finding all symbols: ${errorMessage}`,
          errorCode,
          true
        );
      }
    },
    description:
      "Walk the workspace and gather symbols per file with incremental or full scan",
    usage:
      "findAllSymbols [directory] [--extensions|-e <extensions>] [--no-children] [--depth|-d <number>] [--max-files <number>] [--max-show <number>] [--no-progress] [--incremental] [--flat] [--kind|-k <symbolKind>]",
  },

  searchSymbols: {
    handler: async (args: string[]): Promise<string> => {
      if (args.length === 0) {
        throw new CommandError("No search query provided", "EINVAL");
      }

      const query = args[0];
      let searchPath = ".";
      let extensions: string | string[] = "code";
      let includeChildren = true;
      let maxDepth = 10;
      let maxFiles = 1000;
      let showProgress = true;
      const filterKinds: vscode.SymbolKind[] = [];

      // Parse arguments
      const nonFlagArgs = args.slice(1); // Skip query
      for (let i = 0; i < nonFlagArgs.length; i++) {
        const arg = nonFlagArgs[i];
        if (arg === "--no-children") {
          includeChildren = false;
        } else if (arg === "--no-progress") {
          showProgress = false;
        } else if (arg === "--extensions" || arg === "-e") {
          const extValue = nonFlagArgs[++i];
          if (!extValue) {
            throw new CommandError("No extensions value provided", "EINVAL");
          }
          extensions = extValue.includes(",")
            ? extValue.split(",").map((e) => e.trim())
            : extValue;
        } else if (arg === "--kind" || arg === "-k") {
          const kindValue = nonFlagArgs[++i];
          if (!kindValue) {
            throw new CommandError("No kind value provided", "EINVAL");
          }
          const kind =
            SYMBOL_KINDS[kindValue.toUpperCase() as keyof typeof SYMBOL_KINDS];
          if (kind !== undefined) {
            filterKinds.push(kind);
          }
        } else if (!arg.startsWith("-")) {
          searchPath = arg;
          break; // Only take first non-flag arg as path
        }
      }

      try {
        // Expand extension groups before passing to searchSymbolsByName
        const expandedExtensions = expandExtensions(extensions);

        const matchingSymbols = await searchSymbolsByName(query, searchPath, {
          extensions: expandedExtensions,
          includeChildren,
          maxDepth,
          filterKinds: filterKinds.length > 0 ? filterKinds : undefined,
          maxFiles,
          showProgress,
        });

        if (matchingSymbols.length === 0) {
          return `No symbols found matching "${query}"`;
        }

        const lines: string[] = [];
        lines.push(
          `🔍 **Found ${matchingSymbols.length} symbols matching "${query}"**\n`
        );

        for (const symbol of matchingSymbols) {
          const kindIcon = getSymbolIcon(symbol.kind);
          const location = `${symbol.relativePath}:${
            symbol.range.start.line + 1
          }:${symbol.range.start.character + 1}`;
          const detail = symbol.detail ? ` (${symbol.detail})` : "";
          lines.push(`${kindIcon} ${symbol.name}${detail} - ${location}`);
        }

        return lines.join("\n");
      } catch (error: unknown) {
        if (error instanceof FileOperationError) {
          throw new CommandError(
            `Failed to search symbols: ${error.message}`,
            error.code || "EUNKNOWN",
            true
          );
        }
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorCode = (error as NodeJS.ErrnoException)?.code || "EINTERNAL";
        throw new CommandError(
          `Unexpected error searching symbols: ${errorMessage}`,
          errorCode,
          true
        );
      }
    },
    description: "Search for symbols by name across the workspace",
    usage:
      "searchSymbols <query> [directory] [--extensions|-e <extensions>] [--no-children] [--no-progress] [--kind|-k <symbolKind>]",
  },

  findSymbol: {
    handler: async (args: string[]): Promise<string> => {
      if (args.length === 0) {
        throw new CommandError("No symbol name provided", "EINVAL");
      }

      const symbolName = args[0];
      let maxResults = 100;
      let caseSensitive = false;
      let exactMatch = false;
      const filterKinds: vscode.SymbolKind[] = [];

      // Parse arguments
      for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--case-sensitive" || arg === "-c") {
          caseSensitive = true;
        } else if (arg === "--exact" || arg === "-e") {
          exactMatch = true;
        } else if (arg === "--max-results" || arg === "-m") {
          const maxValue = args[++i];
          if (!maxValue || isNaN(Number(maxValue))) {
            throw new CommandError("Invalid max-results value", "EINVAL");
          }
          maxResults = Number(maxValue);
        } else if (arg === "--kind" || arg === "-k") {
          const kindValue = args[++i];
          if (!kindValue) {
            throw new CommandError("No kind value provided", "EINVAL");
          }
          const kind =
            SYMBOL_KINDS[kindValue.toUpperCase() as keyof typeof SYMBOL_KINDS];
          if (kind !== undefined) {
            filterKinds.push(kind);
          }
        }
      }

      try {
        const symbols = await findSymbol(symbolName, {
          maxResults,
          caseSensitive,
          exactMatch,
          filterKinds: filterKinds.length > 0 ? filterKinds : undefined,
        });

        return formatSymbolLocations(symbols, symbolName);
      } catch (error: unknown) {
        if (error instanceof FileOperationError) {
          throw new CommandError(
            `Failed to find symbol: ${error.message}`,
            error.code || "EUNKNOWN",
            true
          );
        }
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorCode = (error as NodeJS.ErrnoException)?.code || "EINTERNAL";
        throw new CommandError(
          `Unexpected error finding symbol: ${errorMessage}`,
          errorCode,
          true
        );
      }
    },
    description:
      "Locate a symbol by name across the workspace, return file + location",
    usage:
      "findSymbol <symbolName> [--case-sensitive|-c] [--exact|-e] [--max-results|-m <number>] [--kind|-k <symbolKind>]",
  },

  getSymbolReferences: {
    handler: async (args: string[]): Promise<string> => {
      if (args.length < 3) {
        throw new CommandError(
          "Usage: getSymbolReferences <filePath> <line> <character> [options] OR getSymbolReferences --name <symbolName> [options]",
          "EINVAL"
        );
      }

      // Check if using --name flag for symbol name lookup
      if (args[0] === "--name" || args[0] === "-n") {
        if (args.length < 2) {
          throw new CommandError("No symbol name provided", "EINVAL");
        }

        const symbolName = args[1];
        let includeDeclaration = true;
        let maxResults = 1000;
        let contextLines = 0;
        let symbolFilePath: string | undefined;

        // Parse arguments
        for (let i = 2; i < args.length; i++) {
          const arg = args[i];
          if (arg === "--no-declaration") {
            includeDeclaration = false;
          } else if (arg === "--context" || arg === "-c") {
            const contextValue = args[++i];
            if (!contextValue || isNaN(Number(contextValue))) {
              throw new CommandError("Invalid context lines value", "EINVAL");
            }
            contextLines = Number(contextValue);
          } else if (arg === "--max-results" || arg === "-m") {
            const maxValue = args[++i];
            if (!maxValue || isNaN(Number(maxValue))) {
              throw new CommandError("Invalid max-results value", "EINVAL");
            }
            maxResults = Number(maxValue);
          } else if (arg === "--file" || arg === "-f") {
            symbolFilePath = args[++i];
            if (!symbolFilePath) {
              throw new CommandError("No file path provided", "EINVAL");
            }
          }
        }

        try {
          const results = await getSymbolReferencesByName(symbolName, {
            includeDeclaration,
            maxResults,
            contextLines,
            symbolFilePath,
          });

          if (results.length === 0) {
            return `No references found for symbol "${symbolName}"`;
          }

          const lines: string[] = [];
          for (const result of results) {
            lines.push(
              formatSymbolReferences(
                result.references,
                `${result.symbol} (${result.location})`,
                {
                  showContext: contextLines > 0,
                  maxContextLength: 100,
                }
              )
            );
            lines.push("");
          }

          return lines.join("\n");
        } catch (error: unknown) {
          if (error instanceof FileOperationError) {
            throw new CommandError(
              `Failed to get symbol references: ${error.message}`,
              error.code || "EUNKNOWN",
              true
            );
          }
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          throw new CommandError(
            `Unexpected error getting symbol references: ${errorMessage}`,
            "EINTERNAL",
            true
          );
        }
      }

      // Direct file/line/character lookup
      const filePath = args[0];
      const line = parseInt(args[1], 10);
      const character = parseInt(args[2], 10);

      if (isNaN(line) || isNaN(character)) {
        throw new CommandError("Invalid line or character number", "EINVAL");
      }

      let includeDeclaration = true;
      let maxResults = 1000;
      let contextLines = 0;

      // Parse remaining arguments
      for (let i = 3; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--no-declaration") {
          includeDeclaration = false;
        } else if (arg === "--context" || arg === "-c") {
          const contextValue = args[++i];
          if (!contextValue || isNaN(Number(contextValue))) {
            throw new CommandError("Invalid context lines value", "EINVAL");
          }
          contextLines = Number(contextValue);
        } else if (arg === "--max-results" || arg === "-m") {
          const maxValue = args[++i];
          if (!maxValue || isNaN(Number(maxValue))) {
            throw new CommandError("Invalid max-results value", "EINVAL");
          }
          maxResults = Number(maxValue);
        }
      }

      try {
        const references = await getSymbolReferences(
          filePath,
          line,
          character,
          {
            includeDeclaration,
            maxResults,
            contextLines,
          }
        );

        return formatSymbolReferences(
          references,
          `${filePath}:${line + 1}:${character + 1}`,
          {
            showContext: contextLines > 0,
            maxContextLength: 100,
          }
        );
      } catch (error: unknown) {
        if (error instanceof FileOperationError) {
          throw new CommandError(
            `Failed to get symbol references: ${error.message}`,
            error.code || "EUNKNOWN",
            true
          );
        }
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorCode = (error as NodeJS.ErrnoException)?.code || "EINTERNAL";
        throw new CommandError(
          `Unexpected error getting symbol references: ${errorMessage}`,
          errorCode,
          true
        );
      }
    },
    description: "List all references to a given symbol",
    usage:
      "getSymbolReferences <filePath> <line> <character> [--no-declaration] [--context|-c <lines>] [--max-results|-m <number>] OR getSymbolReferences --name|-n <symbolName> [--file|-f <filePath>] [options]",
  },

  gotoSymbol: {
    handler: async (args: string[]): Promise<string> => {
      // Check if using --name flag for symbol name lookup
      if (args[0] === "--name" || args[0] === "-n") {
        if (args.length < 2) {
          throw new CommandError("No symbol name provided", "EINVAL");
        }

        const symbolName = args[1];
        let symbolIndex = 0;
        let filePath: string | undefined;
        let exactMatch = false;
        let preserveFocus = false;

        // Parse arguments
        for (let i = 2; i < args.length; i++) {
          const arg = args[i];
          if (arg === "--index" || arg === "-i") {
            const indexValue = args[++i];
            if (!indexValue || isNaN(Number(indexValue))) {
              throw new CommandError("Invalid symbol index value", "EINVAL");
            }
            symbolIndex = Number(indexValue);
          } else if (arg === "--file" || arg === "-f") {
            filePath = args[++i];
            if (!filePath) {
              throw new CommandError("No file path provided", "EINVAL");
            }
          } else if (arg === "--exact" || arg === "-e") {
            exactMatch = true;
          } else if (arg === "--preserve-focus") {
            preserveFocus = true;
          }
        }

        try {
          return await gotoSymbolByName(symbolName, {
            symbolIndex,
            filePath,
            exactMatch,
            preserveFocus,
            viewColumn: vscode.ViewColumn.One,
            selection: true,
            reveal: vscode.TextEditorRevealType.InCenter,
          });
        } catch (error: unknown) {
          if (error instanceof FileOperationError) {
            throw new CommandError(
              `Failed to navigate to symbol: ${error.message}`,
              error.code || "EUNKNOWN",
              true
            );
          }
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          throw new CommandError(
            `Unexpected error navigating to symbol: ${errorMessage}`,
            "EINTERNAL",
            true
          );
        }
      }

      // Direct file/line/character navigation
      if (args.length < 3) {
        throw new CommandError(
          "Usage: gotoSymbol <filePath> <line> <character> [options] OR gotoSymbol --name|-n <symbolName> [options]",
          "EINVAL"
        );
      }

      const filePath = args[0];
      const line = parseInt(args[1], 10);
      const character = parseInt(args[2], 10);

      if (isNaN(line) || isNaN(character)) {
        throw new CommandError("Invalid line or character number", "EINVAL");
      }

      let preserveFocus = false;

      // Parse remaining arguments
      for (let i = 3; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--preserve-focus") {
          preserveFocus = true;
        }
      }

      try {
        return await gotoSymbol(filePath, line, character, {
          preserveFocus,
          viewColumn: vscode.ViewColumn.One,
          selection: true,
          reveal: vscode.TextEditorRevealType.InCenter,
        });
      } catch (error: unknown) {
        if (error instanceof FileOperationError) {
          throw new CommandError(
            `Failed to navigate to symbol: ${error.message}`,
            error.code || "EUNKNOWN",
            true
          );
        }
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorCode = (error as NodeJS.ErrnoException)?.code || "EINTERNAL";
        throw new CommandError(
          `Unexpected error navigating to symbol: ${errorMessage}`,
          errorCode,
          true
        );
      }
    },
    description: "Open a file and jump directly to a symbol definition",
    usage:
      "gotoSymbol <filePath> <line> <character> [--preserve-focus] OR gotoSymbol --name|-n <symbolName> [--index|-i <number>] [--file|-f <filePath>] [--exact|-e] [--preserve-focus]",
  },

  gotoDefinition: {
    handler: async (args: string[]): Promise<string> => {
      if (args.length < 3) {
        throw new CommandError(
          "Usage: gotoDefinition <filePath> <line> <character> [--preserve-focus]",
          "EINVAL"
        );
      }

      const filePath = args[0];
      const line = parseInt(args[1], 10);
      const character = parseInt(args[2], 10);

      if (isNaN(line) || isNaN(character)) {
        throw new CommandError("Invalid line or character number", "EINVAL");
      }

      let preserveFocus = false;

      // Parse remaining arguments
      for (let i = 3; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--preserve-focus") {
          preserveFocus = true;
        }
      }

      try {
        return await gotoDefinition(filePath, line, character, {
          preserveFocus,
          viewColumn: vscode.ViewColumn.One,
          selection: true,
          reveal: vscode.TextEditorRevealType.InCenter,
        });
      } catch (error: unknown) {
        if (error instanceof FileOperationError) {
          throw new CommandError(
            `Failed to navigate to definition: ${error.message}`,
            error.code || "EUNKNOWN",
            true
          );
        }
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorCode = (error as NodeJS.ErrnoException)?.code || "EINTERNAL";
        throw new CommandError(
          `Unexpected error navigating to definition: ${errorMessage}`,
          errorCode,
          true
        );
      }
    },
    description: "Navigate to definition of symbol at current position",
    usage: "gotoDefinition <filePath> <line> <character> [--preserve-focus]",
  },

  searchText: {
    handler: async (args: string[]): Promise<string> => {
      if (args.length === 0) {
        throw new CommandError("No search query provided", "EINVAL");
      }

      const query = args[0];
      let searchPath = ".";
      let extensions: string | string[] = "code";
      let caseSensitive = false;
      let wholeWord = false;
      let maxResults = 1000;
      let maxMatches = 100;
      let contextLines = 1;
      let includeHidden = false;
      let groupByFile = true;

      // Parse arguments
      const nonFlagArgs = args.slice(1); // Skip query
      for (let i = 0; i < nonFlagArgs.length; i++) {
        const arg = nonFlagArgs[i];
        if (arg === "--case-sensitive" || arg === "-c") {
          caseSensitive = true;
        } else if (arg === "--whole-word" || arg === "-w") {
          wholeWord = true;
        } else if (arg === "--hidden" || arg === "-a") {
          includeHidden = true;
        } else if (arg === "--flat") {
          groupByFile = false;
        } else if (arg === "--extensions" || arg === "-e") {
          const extValue = nonFlagArgs[++i];
          if (!extValue) {
            throw new CommandError("No extensions value provided", "EINVAL");
          }
          extensions = extValue.includes(",")
            ? extValue.split(",").map((e) => e.trim())
            : extValue;
        } else if (arg === "--max-results" || arg === "-m") {
          const maxValue = nonFlagArgs[++i];
          if (!maxValue || isNaN(Number(maxValue))) {
            throw new CommandError("Invalid max-results value", "EINVAL");
          }
          maxResults = Number(maxValue);
        } else if (arg === "--max-matches") {
          const maxValue = nonFlagArgs[++i];
          if (!maxValue || isNaN(Number(maxValue))) {
            throw new CommandError("Invalid max-matches value", "EINVAL");
          }
          maxMatches = Number(maxValue);
        } else if (arg === "--context") {
          const contextValue = nonFlagArgs[++i];
          if (!contextValue || isNaN(Number(contextValue))) {
            throw new CommandError("Invalid context value", "EINVAL");
          }
          contextLines = Number(contextValue);
        } else if (!arg.startsWith("-")) {
          searchPath = arg;
          break; // Only take first non-flag arg as path
        }
      }

      try {
        const results = await searchText(query, searchPath, {
          extensions,
          caseSensitive,
          wholeWord,
          maxResults,
          maxMatches,
          contextLines,
          includeHidden,
        });

        return formatTextSearchResults(results, query, {
          showContext: contextLines > 0,
          maxContextLength: 100,
          groupByFile,
        });
      } catch (error: unknown) {
        if (error instanceof FileOperationError) {
          throw new CommandError(
            `Failed to search text: ${error.message}`,
            error.code || "EUNKNOWN",
            true
          );
        }
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        throw new CommandError(
          `Unexpected error searching text: ${errorMessage}`,
          "EINTERNAL",
          true
        );
      }
    },
    description: "Plain text search across the workspace",
    usage:
      "searchText <query> [directory] [--extensions|-e <extensions>] [--case-sensitive|-c] [--whole-word|-w] [--hidden|-a] [--flat] [--max-results|-m <number>] [--max-matches <number>] [--context <lines>]",
  },

  searchRegex: {
    handler: async (args: string[]): Promise<string> => {
      if (args.length === 0) {
        throw new CommandError("No regex pattern provided", "EINVAL");
      }

      const pattern = args[0];
      let searchPath = ".";
      let extensions: string | string[] = "code";
      let flags = "g";
      let maxResults = 1000;
      let maxMatches = 100;
      let contextLines = 1;
      let includeHidden = false;
      let multiline = false;
      let groupByFile = true;
      let showGroups = true;

      // Parse arguments
      const nonFlagArgs = args.slice(1); // Skip pattern
      for (let i = 0; i < nonFlagArgs.length; i++) {
        const arg = nonFlagArgs[i];
        if (arg === "--case-sensitive" || arg === "-c") {
          flags = flags.replace("i", "");
        } else if (arg === "--case-insensitive" || arg === "-i") {
          if (!flags.includes("i")) {
            flags += "i";
          }
        } else if (arg === "--multiline" || arg === "-m") {
          multiline = true;
          if (!flags.includes("m")) {
            flags += "m";
          }
        } else if (arg === "--hidden" || arg === "-a") {
          includeHidden = true;
        } else if (arg === "--flat") {
          groupByFile = false;
        } else if (arg === "--no-groups") {
          showGroups = false;
        } else if (arg === "--flags" || arg === "-f") {
          const flagValue = nonFlagArgs[++i];
          if (!flagValue) {
            throw new CommandError("No flags value provided", "EINVAL");
          }
          flags = flagValue;
        } else if (arg === "--extensions" || arg === "-e") {
          const extValue = nonFlagArgs[++i];
          if (!extValue) {
            throw new CommandError("No extensions value provided", "EINVAL");
          }
          extensions = extValue.includes(",")
            ? extValue.split(",").map((e) => e.trim())
            : extValue;
        } else if (arg === "--max-results") {
          const maxValue = nonFlagArgs[++i];
          if (!maxValue || isNaN(Number(maxValue))) {
            throw new CommandError("Invalid max-results value", "EINVAL");
          }
          maxResults = Number(maxValue);
        } else if (arg === "--max-matches") {
          const maxValue = nonFlagArgs[++i];
          if (!maxValue || isNaN(Number(maxValue))) {
            throw new CommandError("Invalid max-matches value", "EINVAL");
          }
          maxMatches = Number(maxValue);
        } else if (arg === "--context") {
          const contextValue = nonFlagArgs[++i];
          if (!contextValue || isNaN(Number(contextValue))) {
            throw new CommandError("Invalid context value", "EINVAL");
          }
          contextLines = Number(contextValue);
        } else if (!arg.startsWith("-")) {
          searchPath = arg;
          break; // Only take first non-flag arg as path
        }
      }

      try {
        const results = await searchRegex(pattern, searchPath, {
          extensions,
          flags,
          maxResults,
          maxMatches,
          contextLines,
          includeHidden,
          multiline,
        });

        return formatRegexSearchResults(results, pattern, {
          showContext: contextLines > 0,
          showGroups,
          maxContextLength: 100,
          groupByFile,
        });
      } catch (error: unknown) {
        if (error instanceof FileOperationError) {
          throw new CommandError(
            `Failed to search regex: ${error.message}`,
            error.code || "EUNKNOWN",
            true
          );
        }
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        throw new CommandError(
          `Unexpected error searching regex: ${errorMessage}`,
          "EINTERNAL",
          true
        );
      }
    },
    description: "Regex search across files with optional file filters",
    usage:
      "searchRegex <pattern> [directory] [--extensions|-e <extensions>] [--flags|-f <flags>] [--case-sensitive|-c] [--case-insensitive|-i] [--multiline|-m] [--hidden|-a] [--flat] [--no-groups] [--max-results <number>] [--max-matches <number>] [--context <lines>]",
  },

  createIndex: {
    handler: async (args: string[]): Promise<string> => {
      let searchPath = ".";
      let extensions: string | string[] = "code";
      let includeHidden = false;
      let includeSymbols = true;
      let includeFileInfo = true;
      let maxFiles = 5000;
      let maxDepth = 20;
      let outputFile: string | undefined;
      let showProgress = true;

      // Parse arguments
      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--extensions" || arg === "-e") {
          const extValue = args[++i];
          if (!extValue) {
            throw new CommandError("No extensions value provided", "EINVAL");
          }
          extensions = extValue.includes(",")
            ? extValue.split(",").map((e) => e.trim())
            : extValue;
        } else if (arg === "--hidden" || arg === "-a") {
          includeHidden = true;
        } else if (arg === "--no-symbols") {
          includeSymbols = false;
        } else if (arg === "--no-file-info") {
          includeFileInfo = false;
        } else if (arg === "--no-progress") {
          showProgress = false;
        } else if (arg === "--max-files") {
          const maxValue = args[++i];
          if (!maxValue || isNaN(Number(maxValue))) {
            throw new CommandError("Invalid max-files value", "EINVAL");
          }
          maxFiles = Number(maxValue);
        } else if (arg === "--max-depth") {
          const depthValue = args[++i];
          if (!depthValue || isNaN(Number(depthValue))) {
            throw new CommandError("Invalid max-depth value", "EINVAL");
          }
          maxDepth = Number(depthValue);
        } else if (arg === "--output" || arg === "-o") {
          outputFile = args[++i];
          if (!outputFile) {
            throw new CommandError("No output file provided", "EINVAL");
          }
        } else if (!arg.startsWith("-")) {
          searchPath = arg;
        }
      }

      try {
        const index = await createIndex(searchPath, {
          extensions,
          includeHidden,
          includeSymbols,
          includeFileInfo,
          maxFiles,
          maxDepth,
          showProgress,
        });

        let result = formatIndexSummary(index);

        // Save to file if requested
        if (outputFile) {
          const saveResult = await saveIndex(index, outputFile);
          result += `\n\n${saveResult}`;
        }

        return result;
      } catch (error: unknown) {
        if (error instanceof FileOperationError) {
          throw new CommandError(
            `Failed to create index: ${error.message}`,
            error.code || "EUNKNOWN",
            true
          );
        }
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        throw new CommandError(
          `Unexpected error creating index: ${errorMessage}`,
          "EINTERNAL",
          true
        );
      }
    },
    description:
      "Create a structured JSON index combining files, symbols, and metadata",
    usage:
      "createIndex [directory] [--extensions|-e <extensions>] [--hidden|-a] [--no-symbols] [--no-file-info] [--no-progress] [--max-files <number>] [--max-depth <number>] [--output|-o <file>]",
  },

  updateIndex: {
    handler: async (args: string[]): Promise<string> => {
      if (args.length === 0) {
        throw new CommandError("No index file path provided", "EINVAL");
      }

      const indexPath = args[0];
      let watchFiles = false;
      let showProgress = true;
      let refreshAll = false;

      // Parse arguments
      for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--watch" || arg === "-w") {
          watchFiles = true;
        } else if (arg === "--no-progress") {
          showProgress = false;
        } else if (arg === "--refresh-all" || arg === "-f") {
          refreshAll = true;
        }
      }

      try {
        const { index, updateResult } = await updateIndex(indexPath, {
          watchFiles,
          showProgress,
          refreshAll,
        });

        let result = formatUpdateResult(updateResult);

        // Save updated index back to file
        const saveResult = await saveIndex(index, indexPath);
        result += `\n\n${saveResult}`;

        if (watchFiles) {
          result += `\n\n🔍 **File watcher enabled** - Index will auto-update on file changes`;
        }

        return result;
      } catch (error: unknown) {
        if (error instanceof FileOperationError) {
          throw new CommandError(
            `Failed to update index: ${error.message}`,
            error.code || "EUNKNOWN",
            true
          );
        }
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        throw new CommandError(
          `Unexpected error updating index: ${errorMessage}`,
          "EINTERNAL",
          true
        );
      }
    },
    description:
      "Refresh index for changed files only with optional watcher integration",
    usage:
      "updateIndex <indexPath> [--watch|-w] [--no-progress] [--refresh-all|-f]",
  },

  exportIndex: {
    handler: async (args: string[]): Promise<string> => {
      if (args.length < 2) {
        throw new CommandError(
          "Usage: exportIndex <indexPath> <outputPath> [options]",
          "EINVAL"
        );
      }

      const indexPath = args[0];
      const outputPath = args[1];
      let format: "json" | "csv" | "markdown" | "html" = "json";
      let compress = false;
      let includeSymbols = true;
      let includeFileInfo = true;
      let minify = false;
      let splitByExtension = false;

      // Parse arguments
      for (let i = 2; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--format" || arg === "-f") {
          const formatValue = args[++i];
          if (
            !formatValue ||
            !["json", "csv", "markdown", "html"].includes(formatValue)
          ) {
            throw new CommandError(
              "Invalid format. Use: json, csv, markdown, html",
              "EINVAL"
            );
          }
          format = formatValue as "json" | "csv" | "markdown" | "html";
        } else if (arg === "--compress" || arg === "-c") {
          compress = true;
        } else if (arg === "--no-symbols") {
          includeSymbols = false;
        } else if (arg === "--no-file-info") {
          includeFileInfo = false;
        } else if (arg === "--minify" || arg === "-m") {
          minify = true;
        } else if (arg === "--split-by-extension") {
          splitByExtension = true;
        }
      }

      try {
        // Load the index
        const fs = await import("fs/promises");
        const indexContent = await fs.readFile(indexPath, "utf-8");
        const index = JSON.parse(indexContent);

        const result = await exportIndex(index, outputPath, {
          format,
          compress,
          includeSymbols,
          includeFileInfo,
          minify,
          splitByExtension,
        });

        return formatExportResult(result);
      } catch (error: unknown) {
        if (error instanceof FileOperationError) {
          throw new CommandError(
            `Failed to export index: ${error.message}`,
            error.code || "EUNKNOWN",
            true
          );
        }
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        throw new CommandError(
          `Unexpected error exporting index: ${errorMessage}`,
          "EINTERNAL",
          true
        );
      }
    },
    description: "Write index to disk in various formats for reuse",
    usage:
      "exportIndex <indexPath> <outputPath> [--format|-f <json|csv|markdown|html>] [--compress|-c] [--no-symbols] [--no-file-info] [--minify|-m] [--split-by-extension]",
  },

  openInEditorCmd: {
    handler: async (args: string[]): Promise<string> => {
      if (args.length === 0) {
        throw new CommandError("No file path provided", "EINVAL");
      }

      let preserveFocus = false;
      let preview = false;
      let layout = "tabs"; // tabs, split, columns
      const files: Array<{ path: string; line?: number; column?: number }> = [];

      // Check if first arg looks like a file spec (contains : or is a file path)
      const firstArg = args[0];
      let isMultipleFiles = false;

      // Detect multiple file patterns
      if (firstArg.includes(":") || args.some(arg => arg.includes(":") && !arg.startsWith("-"))) {
        isMultipleFiles = true;
      }

      // Parse arguments
      let i = 0;
      let multipleMode = false;
      
      while (i < args.length) {
        const arg = args[i];
        
        if (arg === "--preserve-focus") {
          preserveFocus = true;
          i++;
        } else if (arg === "--preview") {
          preview = true;
          i++;
        } else if (arg === "--layout" || arg === "-L") {
          const layoutValue = args[++i];
          if (!layoutValue || !["tabs", "split", "columns"].includes(layoutValue)) {
            throw new CommandError("Invalid layout. Use: tabs, split, columns", "EINVAL");
          }
          layout = layoutValue;
          i++;
        } else if (arg === "--multiple" || arg === "-m") {
          // Legacy multiple mode - treat all remaining non-flag args as files
          multipleMode = true;
          i++;
        } else if (arg === "--line" || arg === "-l") {
          // Single file mode with line
          if (isMultipleFiles || multipleMode) {
            throw new CommandError("Cannot use --line with multiple files. Use file:line:column format", "EINVAL");
          }
          const lineValue = args[++i];
          if (!lineValue || isNaN(Number(lineValue))) {
            throw new CommandError("Invalid line number", "EINVAL");
          }
          const line = Number(lineValue) - 1; // Convert to 0-based
          
          let column = 0;
          // Check if next arg is --column
          if (args[i + 1] === "--column" || args[i + 1] === "-c") {
            i++; // skip --column
            const columnValue = args[++i];
            if (!columnValue || isNaN(Number(columnValue))) {
              throw new CommandError("Invalid column number", "EINVAL");
            }
            column = Number(columnValue) - 1; // Convert to 0-based
          }
          
          files.push({ path: firstArg, line, column });
          i++;
        } else if (arg === "--column" || arg === "-c") {
          // This should have been handled with --line
          throw new CommandError("--column must be used with --line", "EINVAL");
        } else if (!arg.startsWith("-")) {
          // File specification
          if (multipleMode) {
            // In multiple mode, treat all remaining args as simple file paths
            files.push({ path: arg });
          } else if (arg.includes(":")) {
            // Parse file:line:column format
            const parts = arg.split(":");
            const filePath = parts[0];
            const fileLine = parts[1] ? Number(parts[1]) - 1 : undefined; // Convert to 0-based
            const fileColumn = parts[2] ? Number(parts[2]) - 1 : undefined; // Convert to 0-based
            
            if (parts[1] && isNaN(Number(parts[1]))) {
              throw new CommandError(`Invalid line number in ${arg}`, "EINVAL");
            }
            if (parts[2] && isNaN(Number(parts[2]))) {
              throw new CommandError(`Invalid column number in ${arg}`, "EINVAL");
            }
            
            files.push({ path: filePath, line: fileLine, column: fileColumn });
          } else {
            // Simple file path
            files.push({ path: arg });
          }
          i++;
        } else {
          throw new CommandError(`Unknown option: ${arg}`, "EINVAL");
        }
      }

      if (files.length === 0) {
        throw new CommandError("No files specified", "EINVAL");
      }

      try {
        if (files.length === 1) {
          // Single file - use enhanced single file opener
          const file = files[0];
          return await openInEditorEnhanced(file.path, {
            line: file.line || 0,
            column: file.column || 0,
            preserveFocus,
            preview,
            viewColumn: vscode.ViewColumn.One,
            selection: true,
            reveal: vscode.TextEditorRevealType.InCenter,
          });
        } else {
          // Multiple files - use multiple file opener with layout options
          return await openMultipleInEditor(files, {
            preserveFocus,
            preview,
            viewColumn: vscode.ViewColumn.One, // Always start with main editor
            reveal: vscode.TextEditorRevealType.InCenter,
            layout: layout as 'tabs' | 'split' | 'columns',
          });
        }
      } catch (error: unknown) {
        if (error instanceof FileOperationError) {
          throw new CommandError(
            `Failed to open file(s) in editor: ${error.message}`,
            error.code || "EUNKNOWN",
            true
          );
        }
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        throw new CommandError(
          `Unexpected error opening file(s) in editor: ${errorMessage}`,
          "EINTERNAL",
          true
        );
      }
    },
    description:
      "Open one or multiple files in editor with optional line/column positioning and layout control",
    usage:
      "openInEditorCmd <file1> [file2] [file3:line:column] [--line|-l <number>] [--column|-c <number>] [--preserve-focus] [--preview] [--layout|-L <tabs|split|columns>] OR openInEditorCmd <file1> --multiple|-m <file2> <file3> [options]",
  },

  loadIndex: {
    handler: async (args: string[]): Promise<string> => {
      const indexPath = args[0] || "./basicindex1.json";
      return await loadIndex(indexPath);
    },
    description: "Load a saved symbol index file into memory for fast lookups",
    usage: "loadIndex [indexPath]",
  },

  findSymbolFromIndex: {
    handler: async (args: string[]): Promise<string> => {
      if (args.length === 0) {
        throw new CommandError("No symbol name provided", "EINVAL");
      }

      const symbolName = args[0];
      let caseSensitive = false;
      let exactMatch = false;
      let maxResults = 100;
      const filterKinds: string[] = [];

      // Parse arguments
      for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--case-sensitive" || arg === "-c") {
          caseSensitive = true;
        } else if (arg === "--exact" || arg === "-e") {
          exactMatch = true;
        } else if (arg === "--max-results" || arg === "-m") {
          const maxValue = args[++i];
          if (!maxValue || isNaN(Number(maxValue))) {
            throw new CommandError("Invalid max-results value", "EINVAL");
          }
          maxResults = Number(maxValue);
        } else if (arg === "--kind" || arg === "-k") {
          const kindValue = args[++i];
          if (!kindValue) {
            throw new CommandError("No kind value provided", "EINVAL");
          }
          filterKinds.push(kindValue);
        }
      }

      try {
        const matches = await findSymbolFromIndex(symbolName, {
          caseSensitive,
          exactMatch,
          maxResults,
          filterKinds: filterKinds.length > 0 ? filterKinds : undefined,
        });

        return formatSymbolIndexResults(matches, symbolName, {
          showDetails: true,
          maxResults,
        });
      } catch (error: unknown) {
        if (error instanceof FileOperationError) {
          throw new CommandError(
            `Failed to find symbol from index: ${error.message}`,
            error.code || "EUNKNOWN",
            true
          );
        }
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        throw new CommandError(
          `Unexpected error finding symbol from index: ${errorMessage}`,
          "EINTERNAL",
          true
        );
      }
    },
    description: "Find symbols from the loaded index using fast in-memory search",
    usage: "findSymbolFromIndex <symbolName> [--case-sensitive|-c] [--exact|-e] [--max-results|-m <number>] [--kind|-k <symbolKind>]",
  },

  gotoSymbolFromIndex: {
    handler: async (args: string[]): Promise<string> => {
      if (args.length < 3) {
        throw new CommandError(
          "Usage: gotoSymbolFromIndex <filePath> <line> <character> [options]",
          "EINVAL"
        );
      }

      const filePath = args[0];
      const line = parseInt(args[1], 10);
      const character = parseInt(args[2], 10);

      if (isNaN(line) || isNaN(character)) {
        throw new CommandError("Invalid line or character number", "EINVAL");
      }

      let preview = false;
      let preserveFocus = false;

      // Parse options
      for (let i = 3; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--preview") {
          preview = true;
        } else if (arg === "--preserve-focus") {
          preserveFocus = true;
        }
      }

      try {
        return await gotoSymbolFromIndex(filePath, line, character, {
          preview,
          preserveFocus,
        });
      } catch (error: unknown) {
        if (error instanceof FileOperationError) {
          throw new CommandError(
            `Failed to navigate to symbol: ${error.message}`,
            error.code || "EUNKNOWN",
            true
          );
        }
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        throw new CommandError(
          `Unexpected error navigating to symbol: ${errorMessage}`,
          "EINTERNAL",
          true
        );
      }
    },
    description: "Navigate to a specific symbol position using coordinates from the loaded index",
    usage: "gotoSymbolFromIndex <filePath> <line> <character> [--preview] [--preserve-focus]",
  },

  gotoSymbolByNameFromIndex: {
    handler: async (args: string[]): Promise<string> => {
      if (args.length === 0) {
        throw new CommandError("No symbol name provided", "EINVAL");
      }

      const symbolName = args[0];
      let caseSensitive = false;
      let exactMatch = true;
      let selectMatch = 0;
      let preview = false;
      let preserveFocus = false;

      // Parse arguments
      for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--case-sensitive" || arg === "-c") {
          caseSensitive = true;
        } else if (arg === "--fuzzy" || arg === "-f") {
          exactMatch = false;
        } else if (arg === "--preview") {
          preview = true;
        } else if (arg === "--preserve-focus") {
          preserveFocus = true;
        } else if (arg === "--match" || arg === "-m") {
          const matchValue = args[++i];
          if (!matchValue || isNaN(Number(matchValue))) {
            throw new CommandError("Invalid match index value", "EINVAL");
          }
          selectMatch = Number(matchValue);
        }
      }

      try {
        return await gotoSymbolByNameFromIndex(symbolName, {
          caseSensitive,
          exactMatch,
          selectMatch,
          preview,
          preserveFocus,
        });
      } catch (error: unknown) {
        if (error instanceof FileOperationError) {
          throw new CommandError(
            `Failed to navigate to symbol: ${error.message}`,
            error.code || "EUNKNOWN",
            true
          );
        }
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        throw new CommandError(
          `Unexpected error navigating to symbol: ${errorMessage}`,
          "EINTERNAL",
          true
        );
      }
    },
    description: "Find and navigate to a symbol by name using the loaded index",
    usage: "gotoSymbolByNameFromIndex <symbolName> [--case-sensitive|-c] [--fuzzy|-f] [--match|-m <index>] [--preview] [--preserve-focus]",
  },

  indexStatus: {
    handler: async (): Promise<string> => {
      const metadata = getIndexMetadata();
      
      if (!metadata.isLoaded) {
        return "❌ **No index loaded**\n\nUse `loadIndex [path]` to load a symbol index file.";
      }

      const lines: string[] = [];
      lines.push("✅ **Index Status: Loaded**\n");
      lines.push(`📊 **Statistics:**`);
      lines.push(`- Symbols: ${metadata.symbolCount}`);
      lines.push(`- Path: \`${metadata.loadedPath}\``);
      
      if (metadata.metadata) {
        lines.push(`- Created: ${metadata.metadata.created}`);
        lines.push(`- Total Files: ${metadata.metadata.totalFiles}`);
        lines.push(`- Total Symbols: ${metadata.metadata.totalSymbols}`);
      }

      lines.push("\n🚀 **Available Commands:**");
      lines.push("- `findSymbolFromIndex <name>` - Search symbols");
      lines.push("- `gotoSymbolByNameFromIndex <name>` - Navigate to symbol");
      lines.push("- `clearIndex` - Clear loaded index");

      return lines.join("\n");
    },
    description: "Show status and statistics of the loaded symbol index",
    usage: "indexStatus",
  },

  clearIndex: {
    handler: async (): Promise<string> => {
      return clearIndex();
    },
    description: "Clear the loaded symbol index from memory",
    usage: "clearIndex",
  },

  showSymbolMenu: {
    handler: async (args: string[]): Promise<string> => {
      const searchPattern = args[0];
      let maxResults = 50;

      // Parse arguments
      for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--max-results" || arg === "-m") {
          const maxValue = args[++i];
          if (!maxValue || isNaN(Number(maxValue))) {
            throw new CommandError("Invalid max-results value", "EINVAL");
          }
          maxResults = Number(maxValue);
        }
      }

      try {
        return await showSymbolIndexMenu(searchPattern, { maxResults });
      } catch (error: unknown) {
        if (error instanceof FileOperationError) {
          throw new CommandError(
            `Failed to show symbol menu: ${error.message}`,
            error.code || "EUNKNOWN",
            true
          );
        }
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        throw new CommandError(
          `Unexpected error showing symbol menu: ${errorMessage}`,
          "EINTERNAL",
          true
        );
      }
    },
    description: "Show all symbols in the loaded index that match a pattern",
    usage: "showSymbolMenu [searchPattern] [--max-results|-m <number>]",
  },
};

/**
 * Parse command line into command and arguments
 */
function parseCommand(input: string): { command: string; args: string[] } {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new CommandError("Empty command", "EINVAL");
  }

  const parts = trimmed.split(/\s+/);
  return {
    command: parts[0].toLowerCase(),
    args: parts.slice(1),
  };
}

/**
 * Handle a command from the user
 */
export async function handleCommand(input: string): Promise<string> {
  try {
    // Parse the command
    const { command, args } = parseCommand(input);

    // Check for built-in commands
    if (command === "ray" && args.length > 0) {
      // Forward to Ray loop with the rest of the command
      return await sendToRayLoop(args.join(" "));
    }

    // Check for registered commands
    const handler = commandHandlers[command];
    if (handler) {
      try {
        return await handler.handler(args);
      } catch (error) {
        if (error instanceof CommandError) {
          throw error;
        }
        console.error(
          `[RayDaemon] Error executing command '${command}':`,
          error
        );
        throw new CommandError(
          `Error executing command '${command}': ${
            error instanceof Error ? error.message : String(error)
          }`,
          "EINTERNAL",
          true
        );
      }
    }

    // Default: forward to Ray loop
    return await sendToRayLoop(input);
  } catch (error) {
    if (error instanceof CommandError) {
      if (error.showToUser) {
        vscode.window.showErrorMessage(`Command error: ${error.message}`);
      }
      return `Error: ${error.message}`;
    }

    // Log unexpected errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[RayDaemon] Unexpected error in handleCommand:", error);
    vscode.window.showErrorMessage(`Unexpected error: ${errorMessage}`);
    return `Error: An unexpected error occurred: ${errorMessage}`;
  }
}

/**
 * Register command handlers with VS Code
 */
export function registerCommandHandlers(
  context: vscode.ExtensionContext
): void {
  // Register internal commands
  for (const [command, { handler }] of Object.entries(commandHandlers)) {
    const disposable = vscode.commands.registerCommand(
      `raydaemon.${command}`,
      async (...args: any[]) => {
        try {
          const result = await handler(args.map(String));
          return result;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(`Command failed: ${message}`);
          throw error;
        }
      }
    );
    context.subscriptions.push(disposable);
  }

  // Register the main command handler
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "raydaemon.executeCommand",
      async (input: string) => {
        return handleCommand(input);
      }
    )
  );
}
