import * as vscode from "vscode";
import * as path from "path";
import { getWebviewContent } from "../../ui/WebviewContent";
import { handleCommand } from "../../commands/commandHandler";
import { logError } from "../../logging";
import { setCurrentPanel } from "../globals";
import { processRayResponse } from "../responseHandler";
import { ApiClient } from "../apiClient";

export function createWebviewPanel(context: vscode.ExtensionContext) {
    const panel = vscode.window.createWebviewPanel(
        "rayDaemonPanel",
        "RayDaemon",
        vscode.ViewColumn.Two,
        { enableScripts: true }
    );
    panel.iconPath = vscode.Uri.file(
        path.join(context.extensionPath, "media", "avatar.png") // Replace with your icon path
    );
    // Store panel reference for autonomous messaging
    setCurrentPanel(panel);

    // Handle panel disposal
    panel.onDidDispose(
        () => {
            setCurrentPanel(undefined);
        },
        null,
        context.subscriptions
    );

    // Enable message passing between webview and extension
    panel.webview.onDidReceiveMessage(
        async (message) => {
            switch (message.type || message.command) {
                case "chat":
                    try {
                        const result = await handleCommand(message.content);
                        // Check if the result indicates command execution is happening
                        // If so, we don't send a chat_response immediately
                        // The processRayResponse function will handle UI updates
                        if (!result.includes("Ray is working on your request")) {
                            // Check if the result is from sendToRayLoop by looking for the special marker
                            // If it's from sendToRayLoop, it will already be handled by processRayResponse
                            const isFromRayLoop = result.startsWith(
                                "__RAY_RESPONSE_HANDLED__:"
                            );

                            // Only send chat_response if it's not from sendToRayLoop
                            if (!isFromRayLoop) {
                                panel.webview.postMessage({
                                    type: "chat_response",
                                    content: result,
                                });
                            } else {
                                // Extract the actual response message
                                const actualResponse = result.substring(
                                    "__RAY_RESPONSE_HANDLED__:".length
                                );
                                // The response has already been handled by processRayResponse, so we don't need to do anything
                            }
                        }
                    } catch (error) {
                        logError("Error handling chat command:", error);
                        panel.webview.postMessage({
                            type: "chat_response",
                            content: `Error: ${error instanceof Error ? error.message : "Unknown error"
                                }`,
                        });
                    }
                    break;
                case "openFile":
                    try {
                        const filePath = message.filePath;
                        if (filePath) {
                            const uri = vscode.Uri.file(filePath);
                            await vscode.window.showTextDocument(uri);
                        }
                    } catch (error) {
                        logError("Error opening file:", error);
                        vscode.window.showErrorMessage(
                            `Failed to open file: ${message.filePath}`
                        );
                    }
                    break;
                case "makeApiCall":
                    try {
                        const apiResult = await vscode.commands.executeCommand(
                            "raydaemon.makeApiCall",
                            message.request
                        );
                        panel.webview.postMessage({
                            command: "apiCallResult",
                            id: message.id,
                            result: apiResult,
                        });
                    } catch (error) {
                        logError("Error handling API call command:", error);
                        panel.webview.postMessage({
                            command: "apiCallError",
                            id: message.id,
                            error:
                                error instanceof Error ? error.message : "Unknown error",
                        });
                    }
                    break;
            }
        },
        undefined,
        context.subscriptions
    );

    // Create webview configuration
    const webviewConfig = {
        showStatusBar: true,
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
            vscode.Uri.file(path.join(context.extensionPath, "media")),
            vscode.Uri.file(path.join(context.extensionPath, "out/compiled")),
        ],
    };

    panel.webview.html = getWebviewContent(context, webviewConfig);
}
