import * as vscode from "vscode";
import * as http from "http";

// Global state
export let daemonInterval: NodeJS.Timeout | undefined;
export let rayWebhookServer: http.Server | undefined;
export let currentPanel: vscode.WebviewPanel | undefined;

// Track processed webhook requests to prevent duplicates
export const processedWebhookRequests = new Set<string>();

export function setCurrentPanel(panel: vscode.WebviewPanel | undefined) {
    currentPanel = panel;
}

export function setDaemonInterval(interval: NodeJS.Timeout | undefined) {
    daemonInterval = interval;
}

export function setRayWebhookServer(server: http.Server | undefined) {
    rayWebhookServer = server;
}
