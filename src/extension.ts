import * as vscode from "vscode";
import { ExtensionManager } from "./extension_utils";

let extensionManager: ExtensionManager;

export function activate(context: vscode.ExtensionContext) {
  extensionManager = new ExtensionManager(context);
  extensionManager.activate();
}

export function deactivate() {
  if (extensionManager) {
    extensionManager.deactivate();
  }
}
