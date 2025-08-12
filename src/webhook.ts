import * as http from "http";
import * as vscode from "vscode";
import { logInfo, logError } from "../logging";
import { config } from "../config";
import { rayWebhookServer, processedWebhookRequests, setRayWebhookServer } from "./globals";
import { processRayResponse } from "./responseHandler";

// Handle responses from Ray
export function handleRayPostResponse(rayResponse: any): void {
  console.log("[RayDaemon] *** handleRayPostResponse CALLED ***");
  console.log(
    "[RayDaemon] Ray response:",
    JSON.stringify(rayResponse, null, 2)
  );

  // Create a unique key for this webhook request
  const requestKey = JSON.stringify(rayResponse);
  if (processedWebhookRequests.has(requestKey)) {
    console.log("[RayDaemon] Skipping duplicate webhook request processing");
    return;
  }

  // Mark as processed
  processedWebhookRequests.add(requestKey);

  // Clean up old entries to prevent memory leaks (keep last 100)
  if (processedWebhookRequests.size > 100) {
    const firstKey = processedWebhookRequests.values().next().value;
    if (firstKey) {
      processedWebhookRequests.delete(firstKey);
    }
  }

  console.log(
    "[RayDaemon] Processing webhook request, calling processRayResponse..."
  );
  processRayResponse(rayResponse);
}

// Start webhook server for Ray to POST back to
export function startRayWebhookServer(): void {
  if (rayWebhookServer) {
    logInfo("Webhook server already running");
    return;
  }

  const port = config.webhookPort || 3001; // Default to port 3001 if not configured

  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      // Health check endpoint
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ status: "ok", timestamp: new Date().toISOString() })
      );
      return;
    }

    if (req.method === "POST" && req.url === "/ray-response") {
      let body = "";

      req.on("data", (chunk: Buffer) => {
        body += chunk.toString();
      });

      req.on("end", () => {
        try {
          const data = JSON.parse(body);
          console.log("[RayDaemon] Webhook received POST request:", {
            url: req.url,
            method: req.method,
            headers: req.headers,
            body: data,
            timestamp: new Date().toISOString(),
          });
          handleRayPostResponse(data);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "received" }));
        } catch (error) {
          logError("Error processing webhook:", error);
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid request" }));
        }
      });
    } else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    }
  });

  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      const errorMsg = `Port ${port} is already in use. Please free the port and restart the extension.`;
      logError(errorMsg);
      vscode.window.showErrorMessage(errorMsg);
    } else {
      logError("Webhook server error:", error);
    }
  });

  server.listen(port, "0.0.0.0", () => {
    logInfo(`Webhook server running on port ${port}`);
  });

  setRayWebhookServer(server);
}
