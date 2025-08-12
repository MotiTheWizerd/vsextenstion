import { CommandRegistry, CommandError } from "../commandHandler";
import {
  FileOperationError,
  findByExtension,
  formatFileList,
  searchText,
  formatTextSearchResults,
  searchRegex,
  formatRegexSearchResults,
  EXTENSION_GROUPS,
} from "../commandMethods/fs";
import { expandExtensions } from "./utils";

export const searchHandlers: CommandRegistry = {
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
};
