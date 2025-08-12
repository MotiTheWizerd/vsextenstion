import { logInfo } from "../logging";
import { daemonInterval, rayWebhookServer, setDaemonInterval, setRayWebhookServer, setCurrentPanel } from "./globals";
import { startRayWebhookServer } from "./webhook";

// Start the Ray daemon
export function startRayDaemon(): void {
  if (daemonInterval) {
    logInfo("Daemon already running");
    return;
  }

  logInfo("Starting Ray daemon...");

  // Start the daemon interval
  const interval = setInterval(() => {
    logInfo("Daemon heartbeat");
  }, 60000); // Run every minute
  setDaemonInterval(interval);

  // Start the webhook server
  startRayWebhookServer();
}

// Stop the Ray daemon
export function stopRayDaemon(): void {
  if (daemonInterval) {
    clearInterval(daemonInterval);
    setDaemonInterval(undefined);
    logInfo("Daemon stopped");
  }

  if (rayWebhookServer) {
    rayWebhookServer.close();
    setRayWebhookServer(undefined);
    logInfo("Webhook server stopped");
  }

  // Clear the global panel reference
  setCurrentPanel(undefined);
}
