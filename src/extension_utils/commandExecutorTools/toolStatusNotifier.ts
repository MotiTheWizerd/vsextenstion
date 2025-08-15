
import * as vscode from 'vscode';

function getCurrentPanel(): any {
    return (global as any).currentPanel;
}

export async function showInitialStatus(toolNames: string[], totalCount: number): Promise<void> {
    const currentPanel = getCurrentPanel();
    if (currentPanel) {
        currentPanel.webview.postMessage({
            type: "toolStatus",
            data: {
                status: "starting",
                tools: toolNames,
                totalCount: totalCount,
                batchMode: true,
            }
        });
    }
    await new Promise(resolve => setTimeout(resolve, 800));
}

export async function updateExecutionProgress(currentIndex: number, toolName: string, totalCount: number): Promise<void> {
    const currentPanel = getCurrentPanel();
    if (currentPanel) {
        // Small delay to ensure starting message is visible
        if (currentIndex === 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        currentPanel.webview.postMessage({
            type: "toolStatus",
            data: {
                status: "working",
                tools: [toolName],
                currentIndex: currentIndex + 1,
                totalCount: totalCount,
                batchMode: true,
            }
        });
    }
}

export async function showFinalStatus(toolNames: string[], results: any[]): Promise<void> {
    const currentPanel = getCurrentPanel();
    if (currentPanel) {
        const successCount = results.filter(r => r.ok).length;
        const failedCount = results.length - successCount;

        currentPanel.webview.postMessage({
            type: "toolStatus",
            data: {
                status: "completed",
                tools: toolNames,
                totalCount: results.length,
                successCount,
                failedCount,
                results: results.map(result => ({
                    command: result.command,
                    args: result.args,
                    ok: result.ok,
                    output: result.output,
                    outputLength: result.output?.length || 0,
                    error: result.error,
                })),
                batchMode: true,
            }
        });
    }
}
