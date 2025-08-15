import * as http from 'http';
import * as vscode from 'vscode';
import { config } from '../config';
import { logInfo, logError } from '../logging';
import { RayResponseHandler } from '.';

export class WebhookServer {
    private server: http.Server | undefined;

    constructor(private rayResponseHandler: RayResponseHandler) {}

    start(): void {
        if (this.server) {
            logInfo("Webhook server already running");
            return;
        }

        const port = config.webhookPort || 3001;

        this.server = http.createServer((req, res) => {
            if (req.method === "GET" && req.url === "/health") {
                this.handleHealthCheck(res);
                return;
            }

            if (req.method === "POST" && req.url === "/ray-response") {
                this.handleRayResponse(req, res);
                return;
            }

            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Not found" }));
        });

        this.server.on("error", this.handleServerError.bind(this));

        this.server.listen(port, "0.0.0.0", () => {
            logInfo(`Webhook server running on port ${port}`);
        });
    }

    stop(): void {
        if (this.server) {
            this.server.close();
            this.server = undefined;
            logInfo("Webhook server stopped");
        }
    }

    private handleHealthCheck(res: http.ServerResponse): void {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ 
            status: "ok", 
            timestamp: new Date().toISOString() 
        }));
    }

    private handleRayResponse(req: http.IncomingMessage, res: http.ServerResponse): void {
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
                this.rayResponseHandler.handleRayPostResponse(data);
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ status: "received" }));
            } catch (error) {
                logError("Error processing webhook:", error);
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Invalid request" }));
            }
        });
    }

    private handleServerError(error: NodeJS.ErrnoException): void {
        const port = config.webhookPort || 3001;
        if (error.code === "EADDRINUSE") {
            const errorMsg = `Port ${port} is already in use. Please free the port and restart the extension.`;
            logError(errorMsg);
            vscode.window.showErrorMessage(errorMsg);
        } else {
            logError("Webhook server error:", error);
        }
    }
}
