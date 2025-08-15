import * as vscode from 'vscode';
import { logInfo, logError } from '../logging';
import { RayResponsePayload } from '../commands/execFactory';
import { sendCommandResultsToRay } from '../rayLoop';
import { CommandExecutor } from '.';

export class RayResponseHandler {
    private processedResponses = new Set<string>();
    private lastToolCompletionTime = 0;

    constructor(
        private commandExecutor: CommandExecutor
    ) {}

    private getCurrentPanel(): any {
        return (global as any).currentPanel;
    }

    handleRayPostResponse(rayResponse: any): void {
        console.log("[RayDaemon] *** handleRayPostResponse CALLED ***");
        console.log("[RayDaemon] Ray response:", JSON.stringify(rayResponse, null, 2));

        const requestKey = JSON.stringify(rayResponse);
        if (this.processedResponses.has(requestKey)) {
            console.log("[RayDaemon] Skipping duplicate webhook request processing");
            return;
        }

        this.processedResponses.add(requestKey);
        this.cleanupProcessedResponses();

        console.log("[RayDaemon] Processing webhook request, calling processRayResponse...");
        this.processRayResponse(rayResponse);
    }

    async processRayResponse(rayResponse: any): Promise<void> {
        if (!rayResponse) {
            logError("Empty response received");
            return;
        }

        const payload = rayResponse as RayResponsePayload;

        // Handle working status
        if (payload.status === "start working" || payload.status === "working") {
            this.handleWorkingStatus();
            return;
        }

        // Extract content
        const content = this.extractContent(payload);
        if (!content) { return; }

        const isFinalBoolean: boolean = typeof payload.is_final === "string" 
            ? payload.is_final === "true" 
            : !!payload.is_final;

        // Check if this is a completion message after tool execution
        // If we don't have command_calls and we have content, it's likely a completion message
        const hasCommandCalls = Array.isArray(payload.command_calls) && payload.command_calls.length > 0;
        const isCompletionMessage = !hasCommandCalls && !!content && content.length > 0;

        console.log(`[RayDaemon] processRayResponse - hasCommandCalls: ${hasCommandCalls}, isCompletionMessage: ${isCompletionMessage}, isFinal: ${isFinalBoolean}`);
        console.log(`[RayDaemon] processRayResponse - content: "${content}"`);

        const currentPanel = this.getCurrentPanel();
        if (!currentPanel) {
            this.handleNoPanelError();
            return;
        }

        try {
            const finalFlag: boolean = isFinalBoolean || isCompletionMessage;
            await this.processPayload(payload, content, finalFlag, currentPanel);
        } catch (error) {
            this.handleProcessingError(error);
        }
    }

    private cleanupProcessedResponses(): void {
        if (this.processedResponses.size > 100) {
            const firstKey = this.processedResponses.values().next().value;
            if (firstKey) {
                this.processedResponses.delete(firstKey);
            }
        }
    }

    private handleWorkingStatus(): void {
        logInfo("Ray is starting to work, showing working message to user");
        const currentPanel = this.getCurrentPanel();
        if (currentPanel) {
            currentPanel.webview.postMessage({
                type: "rayResponse",
                data: {
                    content: "🔄 **Ray is working on your request...** \n\nPlease wait while Ray processes your message. You'll receive the response shortly.",
                    isFinal: false,
                    isWorking: true,
                }
            });
        }
    }

    private extractContent(payload: RayResponsePayload): string {
        if (payload.message) {
            return payload.message;
        } else if (payload.content) {
            return payload.content;
        } else {
            logError("No message or content in response:", payload);
            return "";
        }
    }

    private handleNoPanelError(): void {
        logError("No active chat panel to display message");
        vscode.window.showErrorMessage(
            "No active chat panel. Please open the RayDaemon panel first using the command palette (Ctrl+Shift+P > RayDaemon: Open Panel)"
        );
    }

    private async processPayload(payload: any, content: string, isFinal: boolean, currentPanel: any): Promise<void> {
        const commandCalls = payload.command_calls || payload.command_calls;

        if (Array.isArray(commandCalls) && commandCalls.length > 0) {
            console.log("=== FOUND COMMAND CALLS - EXECUTING TOOLS ===");
            
            if (currentPanel && content) {
                currentPanel.webview.postMessage({
                    type: "rayResponse",
                    data: {
                        content: content,
                        isFinal: false,
                        isWorking: false,
                    }
                });
            }

            await this.commandExecutor.executeCommandCallsAndSendResults(content, commandCalls);
        } else {
            console.log("=== NO COMMAND CALLS - NORMAL RESPONSE ===");
            console.log(`[RayDaemon] Sending completion message to webview - content: "${content}", isFinal: ${isFinal}`);
            
            if (currentPanel) {
                currentPanel.webview.postMessage({
                    type: "rayResponse",
                    data: { 
                        content, 
                        isFinal,
                        isWorking: false
                    }
                });
            }
        }
    }

    private handleProcessingError(error: any): void {
        logError("Error processing Ray response:", error);

        const currentPanel = this.getCurrentPanel();
        if (currentPanel) {
            currentPanel.webview.postMessage({
                type: "rayResponse",
                data: {
                    content: `❌ **Error processing response:** ${error instanceof Error ? error.message : String(error)}`,
                    isFinal: true,
                    isWorking: false,
                }
            });
        }
    }
}
