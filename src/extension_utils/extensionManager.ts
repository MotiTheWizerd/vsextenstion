import * as vscode from "vscode";
import {
  WebhookServer,
  RayResponseHandler,
  CommandExecutor,
  ApiClient,
} from ".";
import { RayDaemonTreeProvider } from "../treeView";
import { RayDaemonViewProvider } from "../ui/RayDaemonViewProvider";
import { logInfo } from "../logging";
import { disposeGlobalDiagnosticWatcher } from "../commands/commandMethods/diagnostics";
import { registerCommands as registerAllCommands } from "../commands";
import { setProcessRayResponseCallback } from "../rayLoop";

export class ExtensionManager {
  private daemonInterval: NodeJS.Timeout | undefined;
  private webhookServer: WebhookServer | undefined;
  private currentPanel: vscode.WebviewPanel | undefined;
  private commandExecutor: CommandExecutor | undefined;
  private rayResponseHandler: RayResponseHandler | undefined;
  private activated: boolean = false;
  private autoPanelOpened: boolean = false;

  constructor(private context: vscode.ExtensionContext) {}

  activate(): void {
    if (this.activated) {
      console.log("[RayDaemon] Extension already activated, skipping.");
      return;
    }
    this.activated = true;
    console.log("[RayDaemon] Extension activated.");

    this.setupRayResponseHandling();
    this.startDaemon();
    this.registerWebviewProvider();
    console.log("[RayDaemon] Calling registerCommands()...");
    registerAllCommands(this.context);
    this.setupTreeView();
    if (!this.autoPanelOpened) {
      this.autoOpenPanel();
      this.autoPanelOpened = true;
    }

    this.context.subscriptions.push({ dispose: () => this.deactivate() });
  }

  deactivate(): void {
    this.stopDaemon();
    disposeGlobalDiagnosticWatcher();
  }

  private setupRayResponseHandling(): void {
    this.commandExecutor = new CommandExecutor();
    this.rayResponseHandler = new RayResponseHandler(this.commandExecutor);
    setProcessRayResponseCallback(
      this.rayResponseHandler.processRayResponse.bind(this.rayResponseHandler),
    );
  }

  private startDaemon(): void {
    if (this.daemonInterval) {
      logInfo("Daemon already running");
      return;
    }

    logInfo("Starting Ray daemon...");

    this.daemonInterval = setInterval(() => {
      logInfo("Daemon heartbeat");
    }, 60000);

    this.webhookServer = new WebhookServer(this.rayResponseHandler!);
    this.webhookServer.start();
  }

  private stopDaemon(): void {
    if (this.daemonInterval) {
      clearInterval(this.daemonInterval);
      this.daemonInterval = undefined;
      logInfo("Daemon stopped");
    }

    if (this.webhookServer) {
      this.webhookServer.stop();
      this.webhookServer = undefined;
      logInfo("Webhook server stopped");
    }

    (global as any).currentPanel = undefined;
  }

  private registerWebviewProvider(): void {
    const provider = new RayDaemonViewProvider(this.context);
    this.context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        RayDaemonViewProvider.viewType,
        provider,
      ),
    );
  }

  private setupTreeView(): void {
    const treeDataProvider = new RayDaemonTreeProvider();
    vscode.window.registerTreeDataProvider(
      "rayDaemonDummyView",
      treeDataProvider,
    );
  }

  private autoOpenPanel(): void {
    setTimeout(async () => {
      try {
        // First open the sidebar to show the welcome view
        await vscode.commands.executeCommand(
          "workbench.view.extension.rayDaemonContainer",
        );
        // Then automatically open the chat panel like the button does
        await vscode.commands.executeCommand("raydaemon.openChatPanel");
      } catch (error) {
        console.error("[RayDaemon] Failed to auto-open chat panel:", error);
      }
    }, 2000);
  }
}
