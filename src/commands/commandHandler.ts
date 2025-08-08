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
  openInEditor
} from "./commandMethods/fs";
import { sendToRayLoop } from "../rayLoop";
import { config } from "../config";

type CommandHandler = (args: string[]) => Promise<string>;

interface CommandRegistry {
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
const commandHandlers: CommandRegistry = {
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
    const content = rest.join(' ');
    await writeFileSafe(file, content);
    return `✅ Wrote ${file}`;
  },
  description: 'Write (overwrite) a file with content',
  usage: 'write <relativePath> <content...>',
},

append: {
  handler: async ([file, ...rest]) => {
    const content = rest.join(' ');
    await appendToFile(file, content);
    return `✅ Appended to ${file}`;
  },
  description: 'Append content to a file',
  usage: 'append <relativePath> <content...>',
},

mkdir: {
  handler: async ([dir]) => {
    await ensureDir(dir);
    return `✅ Ensured directory ${dir}`;
  },
  description: 'Create directory (recursive)',
  usage: 'mkdir <relativePath>',
},

rm: {
  handler: async ([target, recursiveFlag]) => {
    await removePath(target, { recursive: recursiveFlag === '-r' || recursiveFlag === '--recursive' });
    return `🗑️ Removed ${target}`;
  },
  description: 'Remove file/dir',
  usage: 'rm <relativePath> [-r]',
},

mv: {
  handler: async ([src, dest]) => {
    await movePath(src, dest, { overwrite: true, createDirs: true });
    return `🚚 Moved ${src} → ${dest}`;
  },
  description: 'Move/rename file/dir',
  usage: 'mv <src> <dest>',
},

replace: {
  handler: async ([file, search, replacement]) => {
    const count = await replaceInFile(file, search, replacement, { global: true });
    return `🔁 Replaced ${count} occurrence(s) in ${file}`;
  },
  description: 'Find & replace in a file (literal)',
  usage: 'replace <file> <search> <replacement>',
},

open: {
  handler: async ([file]) => {
    await openInEditor(file);
    return `📝 Opened ${file}`;
  },
  description: 'Open file in editor',
  usage: 'open <relativePath>',
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