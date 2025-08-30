import * as vscode from "vscode";
import {
  WebhookServer,
  RayResponseHandler,
  CommandExecutor,
  ApiClient,
} from ".";
import { CommandExecutorRegistry } from "./commandExecutorRegistry";
// Sidebar tree and view intentionally disabled
// import { RayDaemonTreeProvider } from "../treeView";
// import { RayDaemonViewProvider } from "../ui/RayDaemonViewProvider";
import { logInfo } from "../logging";
import { disposeGlobalDiagnosticWatcher } from "../commands/commandMethods/diagnostics";
import { registerCommands as registerAllCommands } from "../commands";
import { setProcessRayResponseCallback } from "../rayLoop";
import { setupEditorGuards } from "./editorGuards";
import { SessionManager } from "../utils/sessionManager";

export class ExtensionManager {
  private daemonInterval: NodeJS.Timeout | undefined;
  private webhookServer: WebhookServer | undefined;
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

    // Initialize SessionManager with extension context
    console.log("[RayDaemon] Initializing SessionManager...");
    SessionManager.getInstance().initialize(this.context);
    console.log("[RayDaemon] SessionManager initialized successfully");
    
    // Test chat history functionality
    try {
      const sessionManager = SessionManager.getInstance();
      const existingHistory = sessionManager.getChatHistory();
      console.log(`[RayDaemon] Found ${existingHistory.length} existing chat sessions`);
      
      // Test creating a session manually
      console.log("[RayDaemon] Testing manual session creation...");
      const testChatId = sessionManager.startNewChat("Test message");
      console.log(`[RayDaemon] Created test session: ${testChatId}`);
      
      // Check if it was saved
      const updatedHistory = sessionManager.getChatHistory();
      console.log(`[RayDaemon] After test creation, found ${updatedHistory.length} chat sessions`);
    } catch (error) {
      console.error("[RayDaemon] Error testing chat history:", error);
      if (error instanceof Error) {
        console.error("[RayDaemon] Error stack:", error.stack);
      }
    }

    this.setupRayResponseHandling();
    this.startDaemon();
    // Sidebar view disabled intentionally; only chat panel is active.
    console.log("[RayDaemon] Calling registerCommands()...");
    registerAllCommands(this.context);
    // Sidebar tree view disabled with sidebar.
    setupEditorGuards(this.context);
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
    // Register the CommandExecutor globally for cancellation access
    CommandExecutorRegistry.getInstance().setCommandExecutor(this.commandExecutor);
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

    // No global panel tracking; WebviewRegistry handles lifecycle.
  }

  // Sidebar provider and tree view intentionally not registered.

  private autoOpenPanel(): void {
    setTimeout(async () => {
      try {
        // Open only the chat panel, do not open the sidebar view
        await vscode.commands.executeCommand("raydaemon.openChatPanel");
      } catch (error) {
        console.error("[RayDaemon] Failed to auto-open chat panel:", error);
      }
    }, 2000);
  }
}
