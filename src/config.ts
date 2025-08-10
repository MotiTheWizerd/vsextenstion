// Configuration for RayDaemon API integration
export const config = {
  // Ray's main API endpoint - where all messages go (both user messages and command results)
  apiEndpoint: "http://localhost:8000/api/messages",

  // Port for the webhook server that Ray can POST back to
  webhookPort: 3001,

  // Environment (development, production, etc.)
  environment: process.env.NODE_ENV || "development",

  // Log level (debug, info, warn, error)
  logLevel: process.env.RAYDAEMON_LOG_LEVEL || "info",

  // Add any headers your API needs (like authorization)
  apiHeaders: {
    "Content-Type": "application/json",
    // 'Authorization': 'Bearer YOUR_TOKEN_HERE'
  },

  // Customize the request body format for your API
  formatMessage: (message: string) => ({
    message: message,
    timestamp: new Date().toISOString(),
    source: "raydaemon-vscode",
    command_results: [],
  }),

  // Format message with command results populated
  formatMessageWithResults: (message: string, commandResults: any[]) => ({
    message: message,
    timestamp: new Date().toISOString(),
    source: "raydaemon-vscode",
    command_results: commandResults,
  }),
};
