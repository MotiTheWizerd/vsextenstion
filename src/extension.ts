import * as vscode from "vscode";
import { startRayDaemon, stopRayDaemon } from "./daemon";
import { setProcessRayResponseCallback } from "../rayLoop";
import { processRayResponse } from "./responseHandler";
import { RayDaemonTreeProvider } from "./ui/treeView";
import { createWebviewPanel } from "./ui/webview";
import { disposeGlobalDiagnosticWatcher } from "../commands/commandMethods/diagnostics";
import { ApiClient } from "./apiClient";

export function activate(context: vscode.ExtensionContext) {
    console.log("[RayDaemon] Extension activated.");

    // Set up the callback for processing Ray responses in rayLoop.ts
    setProcessRayResponseCallback(processRayResponse);

    startRayDaemon();

    context.subscriptions.push(
        vscode.commands.registerCommand("raydaemon.helloWorld", () => {
            vscode.window.showInformationMessage("Hello World from RayDaemon!");
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("raydaemon.openPanel", () => {
            createWebviewPanel(context);
        })
    );

    // Create a tree data provider for the sidebar view
    const treeDataProvider = new RayDaemonTreeProvider();
    vscode.window.registerTreeDataProvider(
        "rayDaemonDummyView",
        treeDataProvider
    );

    // Register command to handle tree item clicks
    context.subscriptions.push(
        vscode.commands.registerCommand("raydaemon.openFromSidebar", () => {
            vscode.commands.executeCommand("raydaemon.openPanel");
        })
    );

    // Register API call command
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "raydaemon.makeApiCall",
            async (request) => {
                try {
                    const { url, method, headers, body } = request;
                    console.log(`[RayDaemon] Making API call: ${method} ${url}`);

                    const response = await ApiClient.makeRequest(
                        url,
                        method,
                        headers,
                        body
                    );

                    console.log(`[RayDaemon] API Response: ${response.status}`);
                    return {
                        success: true,
                        response: response,
                        timestamp: new Date().toISOString(),
                    };
                } catch (error) {
                    console.error(`[RayDaemon] API call failed:`, error);
                    return {
                        success: false,
                        error: error instanceof Error ? error.message : String(error),
                        timestamp: new Date().toISOString(),
                    };
                }
            }
        )
    );

    context.subscriptions.push({ dispose: () => stopRayDaemon() });
}

export function deactivate() {
    stopRayDaemon();
    disposeGlobalDiagnosticWatcher();
}
