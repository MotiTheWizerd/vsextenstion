import * as vscode from "vscode";
import { WebviewRegistry } from "../ui/webview-registry";

export function setupEditorGuards(context: vscode.ExtensionContext) {
  // If chat panel is open, prevent other editors from sticking in its group (ViewColumn.Two)
  const sub = vscode.window.onDidChangeActiveTextEditor(async (editor) => {
    try {
      if (!WebviewRegistry.getPreferred()) return; // only enforce when chat is open
      if (!editor) return;
      if (editor.viewColumn === vscode.ViewColumn.Two) {
        // Move this editor to the primary group
        await vscode.commands.executeCommand("workbench.action.moveEditorToLeftGroup");
        await vscode.commands.executeCommand("workbench.action.focusFirstEditorGroup");
      }
    } catch (e) {
      console.log("[RayDaemon] editor guard move failed:", e);
    }
  });

  context.subscriptions.push(sub);
}

