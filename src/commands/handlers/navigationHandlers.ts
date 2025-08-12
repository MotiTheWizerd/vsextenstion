import * as vscode from "vscode";
import { CommandRegistry, CommandError } from "../commandHandler";
import {
  FileOperationError,
  openInEditorEnhanced,
  openMultipleInEditor,
  gotoSymbol,
  gotoSymbolByName,
  gotoDefinition,
  gotoSymbolFromIndex,
  gotoSymbolByNameFromIndex,
} from "../commandMethods/fs";

export const navigationHandlers: CommandRegistry = {
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
      if (
        firstArg.includes(":") ||
        args.some((arg) => arg.includes(":") && !arg.startsWith("-"))
      ) {
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
          if (
            !layoutValue ||
            !["tabs", "split", "columns"].includes(layoutValue)
          ) {
            throw new CommandError(
              "Invalid layout. Use: tabs, split, columns",
              "EINVAL"
            );
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
            throw new CommandError(
              "Cannot use --line with multiple files. Use file:line:column format",
              "EINVAL"
            );
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
              throw new CommandError(
                `Invalid column number in ${arg}`,
                "EINVAL"
              );
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
            layout: layout as "tabs" | "split" | "columns",
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
    description:
      "Navigate to a specific symbol position using coordinates from the loaded index",
    usage:
      "gotoSymbolFromIndex <filePath> <line> <character> [--preview] [--preserve-focus]",
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
    usage:
      "gotoSymbolByNameFromIndex <symbolName> [--case-sensitive|-c] [--fuzzy|-f] [--match|-m <index>] [--preview] [--preserve-focus]",
  },
};
