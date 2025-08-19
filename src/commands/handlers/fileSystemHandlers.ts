import { CommandRegistry, CommandError } from "../commandHandler";
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
} from "../commandMethods/fs";

export const fileSystemHandlers: CommandRegistry = {
  read: {
    handler: async (args: string[]): Promise<string> => {
      if (args.length === 0) {
        throw new CommandError("No file path provided", "EINVAL");
      }
      const filePath = args[0];
      let options: {
        encoding?: BufferEncoding;
        startLine?: number;
        endLine?: number;
      } = {};

      // Handle optional second parameter (encoding or JSON options)
      if (args.length > 1) {
        const secondArg = args[1];

        // Try to parse as JSON options first
        if (
          secondArg.startsWith("{") ||
          secondArg.includes("startLine") ||
          secondArg.includes("endLine")
        ) {
          try {
            const parsedOptions = JSON.parse(secondArg);

            if (
              parsedOptions.encoding &&
              ["utf8", "base64", "hex"].includes(
                parsedOptions.encoding.toLowerCase(),
              )
            ) {
              options.encoding =
                parsedOptions.encoding.toLowerCase() as BufferEncoding;
            }
            if (typeof parsedOptions.startLine === "number") {
              options.startLine = parsedOptions.startLine;
            }
            if (typeof parsedOptions.endLine === "number") {
              options.endLine = parsedOptions.endLine;
            }
          } catch (parseError) {
            throw new CommandError(
              `Invalid JSON options format: ${
                parseError instanceof Error
                  ? parseError.message
                  : String(parseError)
              }`,
              "EINVAL",
            );
          }
        } else {
          // Legacy encoding parameter
          const encoding = secondArg.toLowerCase();
          if (["utf8", "base64", "hex"].includes(encoding)) {
            options.encoding = encoding as BufferEncoding;
          }
        }
      }

      return await readFile(filePath, { ...options, autoAnalyze: true });
    },
    description: "Read the contents of a file with optional line range",
    usage:
      'read <filePath> [encoding:utf8|base64|hex] OR read <filePath> \'{"startLine": 1, "endLine": 10}\'',
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
            true,
          );
        }
        // Re-throw with proper typing
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorCode = (error as NodeJS.ErrnoException)?.code || "EINTERNAL";
        throw new CommandError(
          `Unexpected error listing files: ${errorMessage}`,
          errorCode,
          true,
        );
      }
    },
    description: "List files in a directory",
    usage: "ls [directory] [--hidden|-a]",
  },

  write: {
    handler: async ([file, ...rest]) => {
      let content = rest.join(" ");

      // Check if content is base64 encoded
      if (content.startsWith("BASE64:")) {
        const base64Content = content.substring(7); // Remove "BASE64:" prefix
        content = Buffer.from(base64Content, "base64").toString("utf-8");
      }

      await writeFileSafe(file, content);
      return `✅ File written successfully`;
    },
    description:
      "Write (overwrite) a file with content (supports BASE64: prefix for encoded content)",
    usage: "write <relativePath> <content...>",
  },

  append: {
    handler: async ([file, ...rest]) => {
      let content = rest.join(" ");

      // Check if content is base64 encoded
      if (content.startsWith("BASE64:")) {
        const base64Content = content.substring(7); // Remove "BASE64:" prefix
        content = Buffer.from(base64Content, "base64").toString("utf-8");
      }

      await appendToFile(file, content);
      return `✅ Content appended successfully`;
    },
    description:
      "Append content to a file (supports BASE64: prefix for encoded content)",
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
      // Check if replacement is base64 encoded
      if (replacement.startsWith("BASE64:")) {
        const base64Content = replacement.substring(7); // Remove "BASE64:" prefix
        replacement = Buffer.from(base64Content, "base64").toString("utf-8");
      }

      const count = await replaceInFile(file, search, replacement, {
        global: true,
      });
      return `🔁 Replaced ${count} occurrence(s) successfully`;
    },
    description:
      "Find & replace in a file (literal, supports BASE64: prefix for replacement content)",
    usage: "replace <file> <search> <replacement>",
  },
};
