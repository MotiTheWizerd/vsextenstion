// Shared contract types for RayDaemon ⇄ Server communication

export interface CommandCall {
  command: string;
  args?: unknown; // Transport can be unknown; will be normalized to string[] for execution
}

export interface CommandResult {
  command: string;
  args: string[];
  ok: boolean;
  output?: string;
  error?: string;
}

export interface RayRequest {
  message: string;
  model: string | null;
  project_id: string;
  chat_id: string;
  user_id: string; // UUID4 when authenticated, default UUID when anonymous
  command_results?: CommandResult[]; // Present on follow-up after local tool execution
}

export type WorkingStatus = "start working" | "working" | string | undefined;

export interface RayResponse {
  // Assistant content (server may choose any of these fields)
  message?: string;
  content?: string;
  response?: string;
  text?: string;

  // Control / state
  status?: WorkingStatus;
  is_final?: boolean | string;
  timestamp?: string;

  // Tooling
  command_calls?: CommandCall[]; // When present: must be executed locally
  commandCalls?: CommandCall[]; // legacy alias
  command_results?: CommandResult[]; // Optional server summaries
}

// Type guards
export function hasCommandCalls(r: RayResponse): boolean {
  const calls = r.command_calls ?? r.commandCalls;
  return Array.isArray(calls) && calls.length > 0;
}

export function extractContent(r: RayResponse): string {
  return (
    r.message || r.content || r.response || r.text || ""
  );
}

export function isFinalFlag(v: boolean | string | undefined): boolean {
  if (typeof v === "string") return v === "true";
  return !!v;
}

