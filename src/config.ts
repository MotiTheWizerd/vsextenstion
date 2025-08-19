// Configuration for RayDaemon API integration
import { SessionManager } from "./utils/sessionManager";

export const config = {
  // Ray's main API endpoint - where all messages go (both user messages and command results)
  apiEndpoint: "http://localhost:8000/api/vscode_user_message",

  // Port for the webhook server that Ray can POST back to
  webhookPort: 3001,

  // Environment (development, production, etc.)
  environment: process.env.NODE_ENV || "development",

  // Log level (debug, info, warn, error)
  logLevel: process.env.RAYDAEMON_LOG_LEVEL || "info",

  // Auto-open modified files in editor (can be overridden by VS Code setting)
  autoOpenModifiedFiles: true,

  // Add any headers your API needs (like authorization)
  apiHeaders: {
    "Content-Type": "application/json",
    // 'Authorization': 'Bearer YOUR_TOKEN_HERE'
  },

  // Customize the request body format for your API - match server expectations
  formatMessage: (message: string) => {
    const sessionManager = SessionManager.getInstance();
    const sessionInfo = sessionManager.getSessionInfo();

    // Log user login status for debugging
    if (!sessionManager.isUserLoggedIn()) {
      console.warn(
        "[Config] User not logged in - using default user_id. User should login to server for proper user identification.",
      );
    }

    return {
      message: message,
      model: null,
      project_id: sessionInfo.projectId,
      chat_id: sessionInfo.chatId,
      user_id: sessionInfo.userId,
    };
  },

  // Format message with command results populated - match server expectations
  formatMessageWithResults: (message: string, commandResults: any[]) => {
    const sessionManager = SessionManager.getInstance();
    const sessionInfo = sessionManager.getSessionInfo();

    // Log user login status for debugging
    if (!sessionManager.isUserLoggedIn()) {
      console.warn(
        "[Config] User not logged in - using default user_id. Command results sent with default user identification.",
      );
    }

    return {
      message: message,
      command_results: commandResults,
      model: null,
      project_id: sessionInfo.projectId,
      chat_id: sessionInfo.chatId,
      user_id: sessionInfo.userId,
    };
  },
};
