import { CommandRegistry, CommandError } from "../commandHandler";
import {
  FileOperationError,
  createIndex,
  saveIndex,
  formatIndexSummary,
  updateIndex,
  formatUpdateResult,
  exportIndex,
  formatExportResult,
  loadIndex,
  findSymbolFromIndex,
  formatSymbolIndexResults,
  getIndexMetadata,
  clearIndex,
  showSymbolIndexMenu,
} from "../commandMethods/fs";

export const indexHandlers: CommandRegistry = {
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
    description:
      "Find symbols from the loaded index using fast in-memory search",
    usage:
      "findSymbolFromIndex <symbolName> [--case-sensitive|-c] [--exact|-e] [--max-results|-m <number>] [--kind|-k <symbolKind>]",
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
