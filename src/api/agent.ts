import { ApiClient } from "../apiClient";
import { getCancelEndpoint, config } from "../config";
import { SessionManager } from "../utils/sessionManager";

export interface CancelRequest {
  task_id?: string;
  chat_id?: string;
}

export interface CancelResponse {
  status: string;
  cancelled: boolean;
  task_id?: string | null;
  chat_id?: string | null;
}

export async function cancelAgent(): Promise<CancelResponse> {
  const endpoint = getCancelEndpoint();
  const session = SessionManager.getInstance();
  const taskId = session.getLastTaskId();
  const chatId = session.getSessionInfo().chatId;

  const body: CancelRequest = {};
  if (taskId) body.task_id = taskId;
  else if (chatId) body.chat_id = chatId;

  if (!body.task_id && !body.chat_id) {
    // Shouldn't happen, but guard anyway
    return { status: "ok", cancelled: false, task_id: null, chat_id: null };
  }

  const res = await ApiClient.post(endpoint, body, config.apiHeaders);
  // Normalize response shape
  const data = (res?.data ?? {}) as Partial<CancelResponse> & Record<string, any>;
  return {
    status: (data.status as string) || (res.status >= 200 && res.status < 300 ? "ok" : "error"),
    cancelled: Boolean(data.cancelled),
    task_id: (data.task_id as string) ?? body.task_id ?? null,
    chat_id: (data.chat_id as string) ?? body.chat_id ?? null,
  };
}

