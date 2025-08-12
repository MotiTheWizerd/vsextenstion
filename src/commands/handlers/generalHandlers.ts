import { CommandRegistry } from "../commandHandler";
import { sendToRayLoop } from "../../rayLoop";
import { config } from "../../config";

export const generalHandlers: CommandRegistry = {
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
};
