# Agent Cancellation for VS Code Extension

- Endpoint: `POST /api/agent/stop`
- Purpose: Cooperatively stop the agent’s current task for a chat or specific task.

## Request Body
- `task_id` (string, optional): Preferred. Use the `task_id` returned by `/api/vscode_user_message`.
- `chat_id` (string, optional): Fallback if no `task_id` is available.

At least one of `task_id` or `chat_id` is required. If both are sent, `task_id` is used.

Example:
```json
{
  "task_id": "6c1ce8c9-6a3d-4c1a-8b59-3f7b7d3b20e5"
}
```

Or (fallback by chat):
```json
{
  "chat_id": "project-main-chat"
}
```

## Response
- `status`: "ok"
- `cancelled`: boolean — true if a running task was found and flagged
- `task_id`: echoed if provided
- `chat_id`: echoed if provided

Example:
```json
{
  "status": "ok",
  "cancelled": true,
  "task_id": "6c1ce8c9-6a3d-4c1a-8b59-3f7b7d3b20e5",
  "chat_id": null
}
```

Notes:
- Cancellation is best‑effort and cooperative. Long operations (e.g., LLM calls) may finish their current step before the agent exits.
- If no running task is found, you still receive `{ "status": "ok", "cancelled": false }`.
- If neither `task_id` nor `chat_id` is provided, the server returns HTTP 400.

## Getting `task_id`
Every response from `POST /api/vscode_user_message` includes a `task_id` field. Store it on the extension side and use it when calling `/api/agent/stop` for precise cancellation.

## Related Behavior (FYI)
- Chat responses include:
  - `command_calls`: instructions for VS Code to execute (primary)
  - `command_results`: may be present for compatibility
  - `task_id`: identifier for the current agent run
