import * as vscode from "vscode";
import { sendToRayLoop } from "../rayLoop";
import {
  FileOperationError,
} from "./commandMethods/fs";
import { generalHandlers } from "./handlers/generalHandlers";
import { fileSystemHandlers } from "./handlers/fileSystemHandlers";
import { navigationHandlers } from "./handlers/navigationHandlers";
import { searchHandlers } from "./handlers/searchHandlers";
import { symbolHandlers } from "./handlers/symbolHandlers";
import { indexHandlers } from "./handlers/indexHandlers";
import { diagnosticHandlers } from "./handlers/diagnosticHandlers";

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
  ...generalHandlers,
  ...fileSystemHandlers,
  ...navigationHandlers,
  ...searchHandlers,
  ...symbolHandlers,
  ...indexHandlers,
  ...diagnosticHandlers,
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
