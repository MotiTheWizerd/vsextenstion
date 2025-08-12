import * as vscode from "vscode";
import { CommandRegistry, CommandError } from "../commandHandler";
import {
  FileOperationError,
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
} from "../commandMethods/fs";
import { getSymbolIcon, expandExtensions } from "./utils";

export const symbolHandlers: CommandRegistry = {
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
};
