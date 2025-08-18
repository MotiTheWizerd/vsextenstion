import { CommandError } from "./commandHandler"; // you already export this
import type { CommandRegistry } from "./commandHandler"; // { [key]: { handler, description, usage } }

// --- Types from Ray payload ---
export interface CommandCall {
  command: string;
  args?: unknown; // will be validated into string[]
}

export interface RayResponsePayload {
  // text bits
  message?: string;
  content?: string;
  response?: string;
  text?: string;

  // control/state
  status?: "start working" | "working" | string;
  is_final?: boolean | string;
  ray_prompt?: string;
  timestamp?: string;
  test_id?: number | string;

  // tool calls
  command_calls?: Array<{
    command: string;
    args?: unknown;
  }>;
  commandCalls?: Array<{
    command: string;
    args?: unknown;
  }>;
}

// --- Result types ---
export interface CommandExecutionResult {
  command: string;
  args: string[];
  ok: boolean;
  output?: string; // string returned by handler
  error?: string; // serialized error message
}

export interface BatchExecutionResult {
  anyExecuted: boolean;
  results: CommandExecutionResult[];
}

/**
 * Validates that args looks like string[].
 * Coerces single string to [string], converts objects to JSON strings.
 */
function normalizeArgs(args: unknown): string[] {
  if (args === null) {
    return [];
  }
  if (Array.isArray(args)) {
    return args.map((arg) => {
      if (typeof arg === "string") {
        return arg;
      }
      if (typeof arg === "object" && arg !== null) {
        return JSON.stringify(arg);
      }
      return String(arg);
    });
  }
  if (typeof args === "string") {
    return [args];
  }
  if (typeof args === "object" && args !== null) {
    return [JSON.stringify(args)];
  }
  return [String(args)];
}

/**
 * Creates an executor bound to the existing command registry.
 * Each handler must match: (args: string[]) => Promise<string>
 */
export function createExecuteCommandFactory(commandRegistry: CommandRegistry) {
  /**
   * Execute a single call safely.
   */
  async function executeOne(
    call: CommandCall,
  ): Promise<CommandExecutionResult> {
    console.log("[execFactory] executeOne called with:", call);
    const { command } = call;
    const args = normalizeArgs(call.args);
    console.log("[execFactory] normalized args:", args);

    if (!command || typeof command !== "string") {
      console.log("[execFactory] Invalid command:", command);
      return {
        command: String(command),
        args,
        ok: false,
        error: "Missing or invalid 'command' name",
      };
    }

    const entry = commandRegistry[command];
    console.log("[execFactory] Registry lookup for", command, ":", !!entry);
    console.log(
      "[execFactory] Available commands:",
      Object.keys(commandRegistry),
    );

    if (!entry) {
      return {
        command,
        args,
        ok: false,
        error: `Unknown command '${command}'`,
      };
    }

    try {
      console.log(
        "[execFactory] Executing command:",
        command,
        "with args:",
        args,
      );
      const output = await entry.handler(args);
      console.log(
        "[execFactory] Command executed successfully, output length:",
        output?.length || 0,
      );
      console.log(
        "[execFactory] Command output preview:",
        output?.substring(0, 200) + (output?.length > 200 ? "..." : ""),
      );
      return { command, args, ok: true, output };
    } catch (err: any) {
      console.error("[execFactory] Command execution failed:", err);
      console.error("[execFactory] Error details:", {
        name: err?.name,
        message: err?.message,
        code: err?.code,
        stack: err?.stack?.split("\n").slice(0, 5).join("\n"), // First 5 lines of stack
      });
      const msg = err?.message ?? String(err);
      const code = err?.code ? ` [${err.code}]` : "";
      return { command, args, ok: false, error: `${msg}${code}` };
    }
  }

  /**
   * Execute an array of calls in order (sequential).
   * If you want fail‑fast, flip `stopOnError` to true.
   */
  async function executeBatch(
    calls: CommandCall[] | undefined,
    opts: { stopOnError?: boolean } = {},
  ): Promise<BatchExecutionResult> {
    console.log("[execFactory] executeBatch called with:", calls);
    const results: CommandExecutionResult[] = [];
    const list = Array.isArray(calls) ? calls : [];
    const stopOnError = !!opts.stopOnError;
    console.log("[execFactory] Processing", list.length, "calls");

    for (const call of list) {
      console.log("[execFactory] Processing call:", call);
      const res = await executeOne(call);
      console.log("[execFactory] Call result:", res);
      results.push(res);
      if (!res.ok && stopOnError) {
        console.log("[execFactory] Stopping on error");
        break;
      }
    }

    console.log("[execFactory] Final batch result:", {
      anyExecuted: results.length > 0,
      results,
    });
    return { anyExecuted: results.length > 0, results };
  }

  return { executeOne, executeBatch };
}
