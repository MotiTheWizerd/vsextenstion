import * as vscode from "vscode";

// Helper function to categorize tools
function getToolCategory(toolName: string): string {
  if (!toolName) {
    return "default";
  }

  const toolNameLower = toolName.toLowerCase();

  // Exact tool name matching first
  if (toolNameLower === "fetch") {
    return "fetch";
  }
  if (toolNameLower === "read_file") {
    return "read";
  }
  if (toolNameLower === "edit_file") {
    return "write";
  }
  if (toolNameLower === "web_search") {
    return "search";
  }
  if (toolNameLower === "terminal") {
    return "terminal";
  }
  if (toolNameLower === "grep") {
    return "search";
  }
  if (toolNameLower === "find_path") {
    return "search";
  }
  if (toolNameLower === "list_directory") {
    return "read";
  }
  if (toolNameLower === "diagnostics") {
    return "diagnostics";
  }
  if (toolNameLower === "delete_path") {
    return "write";
  }
  if (toolNameLower === "copy_path") {
    return "write";
  }
  if (toolNameLower === "move_path") {
    return "write";
  }
  if (toolNameLower === "create_directory") {
    return "write";
  }
  if (toolNameLower === "thinking") {
    return "thinking";
  }

  // Fallback to pattern matching
  if (toolNameLower.includes("fetch") || toolNameLower.includes("get")) {
    return "fetch";
  } else if (
    toolNameLower.includes("write") ||
    toolNameLower.includes("edit") ||
    toolNameLower.includes("create")
  ) {
    return "write";
  } else if (toolNameLower.includes("read") || toolNameLower.includes("file")) {
    return "read";
  } else if (
    toolNameLower.includes("terminal") ||
    toolNameLower.includes("exec")
  ) {
    return "terminal";
  } else if (
    toolNameLower.includes("search") ||
    toolNameLower.includes("find") ||
    toolNameLower.includes("grep")
  ) {
    return "search";
  } else if (toolNameLower.includes("diagnostic")) {
    return "diagnostics";
  } else {
    return "default";
  }
}

function getCurrentPanel(): any {
  const panel = (global as any).currentPanel;
  console.log(`[toolStatusNotifier] Current panel exists: ${!!panel}`);
  if (panel && panel.webview) {
    console.log(
      `[toolStatusNotifier] Webview is ready: ${!!panel.webview.postMessage}`,
    );
  }
  return panel;
}

export async function showInitialStatus(
  toolNames: string[],
  totalCount: number,
): Promise<void> {
  console.log(
    `[toolStatusNotifier] showInitialStatus called with ${toolNames.length} tools`,
  );
  const currentPanel = getCurrentPanel();
  if (currentPanel) {
    const message = {
      type: "toolStatus",
      data: {
        status: "starting",
        tools: toolNames,
        totalCount: totalCount,
        batchMode: true,
        description: `Initializing ${totalCount} operations`,
        timestamp: new Date().toISOString(),
        category: getToolCategory(toolNames[0] || ""),
        toolLabels: toolNames.map((name) => {
          // Extract human-readable labels from tool names
          const baseName = name.split("_").join(" ");
          return baseName.charAt(0).toUpperCase() + baseName.slice(1);
        }),
      },
    };
    console.log(
      "[toolStatusNotifier] Sending initial status:",
      JSON.stringify(message, null, 2),
    );
    currentPanel.webview.postMessage(message);
  } else {
    console.warn(
      "[toolStatusNotifier] No current panel available to send initial status",
    );
  }
  await new Promise((resolve) => setTimeout(resolve, 800));
}

export async function updateExecutionProgress(
  currentIndex: number,
  toolName: string,
  totalCount: number,
): Promise<void> {
  console.log(
    `[toolStatusNotifier] updateExecutionProgress - Tool ${currentIndex + 1}/${totalCount}: ${toolName}`,
  );
  const currentPanel = getCurrentPanel();
  if (currentPanel) {
    // Small delay to ensure starting message is visible
    if (currentIndex === 0) {
      console.log("[toolStatusNotifier] Adding initial delay for first tool");
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const message = {
      type: "toolStatus",
      data: {
        status: "working",
        tools: [toolName],
        currentIndex: currentIndex + 1,
        totalCount: totalCount,
        batchMode: true,
        description: `Processing ${toolName}`,
        progress: Math.round(((currentIndex + 1) / totalCount) * 100),
        timestamp: new Date().toISOString(),
        category: getToolCategory(toolName),
        toolLabel: (() => {
          // Extract human-readable label from tool name
          const baseName = toolName.split("_").join(" ");
          return baseName.charAt(0).toUpperCase() + baseName.slice(1);
        })(),
        estimatedTimeRemaining:
          totalCount > 1 ? (totalCount - currentIndex - 1) * 2 : undefined, // Rough estimate in seconds
      },
    };
    console.log(
      "[toolStatusNotifier] Sending progress update:",
      JSON.stringify(message, null, 2),
    );
    currentPanel.webview.postMessage(message);
  } else {
    console.warn(
      "[toolStatusNotifier] No current panel available to update execution progress",
    );
  }
}

export async function showFinalStatus(
  toolNames: string[],
  results: any[],
): Promise<void> {
  console.log(
    `[toolStatusNotifier] showFinalStatus called with ${results.length} results`,
  );
  const successCount = results.filter((r) => r.ok).length;
  const failedCount = results.length - successCount;
  console.log(
    `[toolStatusNotifier] Success: ${successCount}, Failed: ${failedCount}`,
  );
  const currentPanel = getCurrentPanel();
  if (currentPanel) {
    const message = {
      type: "toolStatus",
      data: {
        status:
          failedCount > 0
            ? successCount > 0
              ? "partial"
              : "failed"
            : "completed",
        tools: toolNames,
        toolTypes: toolNames.map((tool) => getToolCategory(tool)),
        totalCount: results.length,
        successCount,
        failedCount,
        results: results.map((result) => ({
          command: result.command,
          args: result.args,
          ok: result.ok,
          output: result.output,
          outputLength: result.output?.length || 0,
          error: result.error,
        })),
        batchMode: true,
        description:
          failedCount > 0
            ? successCount > 0
              ? `Completed with ${successCount} successful and ${failedCount} failed operations`
              : `Failed to complete operations`
            : `Successfully completed all ${successCount} operations`,
        timestamp: new Date().toISOString(),
        category: getToolCategory(toolNames[0] || ""),
        duration:
          results.length > 0 && results[0].duration
            ? results.reduce((total, r) => total + (r.duration || 0), 0)
            : undefined,
      },
    };

    // Log a summary of the results (without logging potentially large outputs)
    const logMessage = {
      ...message,
      data: {
        ...message.data,
        results: message.data.results.map((r) => ({
          command: r.command,
          ok: r.ok,
          outputLength: r.output ? r.output.length : 0,
          hasError: !!r.error,
        })),
      },
    };

    console.log(
      "[toolStatusNotifier] Sending final status:",
      JSON.stringify(logMessage, null, 2),
    );
    currentPanel.webview.postMessage(message);
  } else {
    console.warn(
      "[toolStatusNotifier] No current panel available to send final status",
    );
  }
}
