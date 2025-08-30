import * as vscode from "vscode";
import * as crypto from "crypto";
import { ChatHistoryManager } from "./chatHistoryManager";

export class SessionManager {
  private static instance: SessionManager;
  private projectId: string | null = null;
  private chatId: string | null = null;
  private userId: string | null = null;
  private lastTaskId: string | null = null;
  private readonly DEFAULT_USER_ID = "00000000-0000-4000-8000-000000000000"; // Default UUID4
  private chatHistoryManager: ChatHistoryManager;

  private constructor() {
    this.chatHistoryManager = ChatHistoryManager.getInstance();
  }

  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  /**
   * Generate a project ID based on workspace folder or create a random one
   */
  public getProjectId(): string {
    if (this.projectId) {
      return this.projectId;
    }

    // Try to get workspace folder name for consistent project ID
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      const workspaceName = workspaceFolders[0].name;
      const workspacePath = workspaceFolders[0].uri.fsPath;

      // Create a proper UUID based on workspace path for consistency across sessions
      const hash = crypto.createHash("md5").update(workspacePath).digest("hex");
      // Format as UUID v4
      this.projectId = `${hash.substring(0, 8)}-${hash.substring(8, 12)}-4${hash.substring(13, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
    } else {
      // Fallback to random UUID if no workspace
      this.projectId = SessionManager.generateUUID4();
    }

    console.log(`[SessionManager] Generated project_id: ${this.projectId}`);
    return this.projectId;
  }

  /**
   * Generate a new chat ID for the current session
   */
  public getChatId(): string {
    if (this.chatId) {
      return this.chatId;
    }

    this.chatId = `chat-${this.generateRandomId()}`;
    console.log(`[SessionManager] Generated chat_id: ${this.chatId}`);
    return this.chatId;
  }

  /**
   * Get user ID - either configured from server login or default UUID4
   */
  public getUserId(): string {
    if (this.userId) {
      return this.userId;
    }

    // Use default UUID4 if no user ID has been set from server login
    this.userId = this.DEFAULT_USER_ID;
    console.log(`[SessionManager] Using default user_id: ${this.userId}`);
    console.log(
      `[SessionManager] Note: User should login to server to get proper user_id`,
    );
    return this.userId;
  }

  /**
   * Set user ID from server login response
   */
  public setUserId(userId: string): void {
    if (!userId || typeof userId !== "string") {
      console.error(`[SessionManager] Invalid user_id provided: ${userId}`);
      return;
    }

    // Validate UUID4 format (basic validation)
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      console.warn(
        `[SessionManager] Provided user_id does not appear to be valid UUID4: ${userId}`,
      );
    }

    this.userId = userId;
    console.log(`[SessionManager] User ID set from server: ${this.userId}`);
  }

  /**
   * Check if user is logged in (has non-default user ID)
   */
  public isUserLoggedIn(): boolean {
    return this.userId !== null && this.userId !== this.DEFAULT_USER_ID;
  }

  /**
   * Generate a new UUID4 (for server-side use)
   */
  public static generateUUID4(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      },
    );
  }

  /**
   * Start a new chat session (generates new chat_id and creates history entry)
   */
  public startNewChat(initialMessage?: string): string {
    this.chatId = `chat-${this.generateRandomId()}`;
    console.log(`[SessionManager] Starting new chat session: ${this.chatId}`);
    
    // Create chat session in history
    try {
      this.chatHistoryManager.createChatSession(this.chatId, this.getProjectId(), initialMessage);
      console.log(`[SessionManager] Created chat history session successfully`);
    } catch (error) {
      console.error(`[SessionManager] Failed to create chat history session: ${error}`);
      if (error instanceof Error) {
        console.error(`[SessionManager] Error stack: ${error.stack}`);
      }
    }
    
    console.log(`[SessionManager] Started new chat session: ${this.chatId}`);
    return this.chatId;
  }

  /**
   * Reset the session (useful for testing or when switching projects)
   */
  public resetSession(): void {
    this.projectId = null;
    this.chatId = null;
    this.userId = null;
    console.log(
      "[SessionManager] Session reset - user will need to login again",
    );
  }

  /**
   * Reset only project and chat (keep user logged in)
   */
  public resetProjectSession(): void {
    this.projectId = null;
    this.chatId = null;
    console.log(
      "[SessionManager] Project session reset - user remains logged in",
    );
  }

  /**
   * Logout user (reset user_id to default)
   */
  public logoutUser(): void {
    this.userId = null;
    console.log("[SessionManager] User logged out - user_id reset to default");
  }

  /**
   * Get current session info
   */
  public getSessionInfo(): {
    projectId: string;
    chatId: string;
    userId: string;
  } {
    return {
      projectId: this.getProjectId(),
      chatId: this.getChatId(),
      userId: this.getUserId(),
    };
  }

  /**
   * Track the last task_id returned by the server for this session
   */
  public setLastTaskId(taskId: string | null | undefined): void {
    if (typeof taskId === "string" && taskId.length > 0) {
      this.lastTaskId = taskId;
      console.log(`[SessionManager] Updated last task_id: ${this.lastTaskId}`);
    }
  }

  public getLastTaskId(): string | null {
    return this.lastTaskId;
  }

  /**
   * Initialize the session manager with extension context
   */
  public initialize(context: vscode.ExtensionContext): void {
    console.log("[SessionManager] Initializing with extension context");
    this.chatHistoryManager.initialize(context);
    console.log("[SessionManager] Initialized with extension context");
    
    // Test workspace state access
    try {
      const testData = context.workspaceState.get("test", null);
      console.log("[SessionManager] Workspace state access test successful");
    } catch (error) {
      console.error("[SessionManager] Workspace state access test failed:", error);
    }
  }

  /**
   * Add a message to the current chat session history
   */
  public addMessageToHistory(sender: "user" | "assistant", content: string, options?: any): void {
    console.log(`[SessionManager] Adding ${sender} message to history. ChatId: ${this.chatId}`);
    
    if (!this.chatId) {
      console.warn("[SessionManager] No active chat session to add message to");
      return;
    }

    try {
      this.chatHistoryManager.addMessageToSession(this.chatId, sender, content, options);
      console.log(`[SessionManager] Successfully added ${sender} message to session ${this.chatId}`);
    } catch (error) {
      console.error(`[SessionManager] Failed to add message to history: ${error}`);
      if (error instanceof Error) {
        console.error(`[SessionManager] Error stack: ${error.stack}`);
      }
    }
  }

  /**
   * Get chat history for the current project
   */
  public getChatHistory(): Array<{id: string, name: string, lastUpdated: Date, messageCount: number}> {
    try {
      const projectId = this.getProjectId();
      console.log(`[SessionManager] Getting chat history for project: ${projectId}`);
      const history = this.chatHistoryManager.getChatHistorySummary(projectId);
      console.log(`[SessionManager] Retrieved ${history.length} chat sessions`);
      return history;
    } catch (error) {
      console.error(`[SessionManager] Failed to get chat history: ${error}`);
      if (error instanceof Error) {
        console.error(`[SessionManager] Error stack: ${error.stack}`);
      }
      return [];
    }
  }

  /**
   * Load a previous chat session
   */
  public loadChatSession(sessionId: string): any {
    try {
      const session = this.chatHistoryManager.getChatSession(sessionId);
      if (session) {
        this.chatId = sessionId;
        console.log(`[SessionManager] Loaded chat session: ${sessionId}`);
        return session;
      }
      return null;
    } catch (error) {
      console.error(`[SessionManager] Failed to load chat session: ${error}`);
      return null;
    }
  }

  /**
   * Delete a chat session
   */
  public deleteChatSession(sessionId: string): boolean {
    try {
      return this.chatHistoryManager.deleteChatSession(sessionId);
    } catch (error) {
      console.error(`[SessionManager] Failed to delete chat session: ${error}`);
      return false;
    }
  }

  /**
   * Update the name of the current chat session
   */
  public updateCurrentChatName(newName: string): void {
    if (!this.chatId) {
      console.warn("[SessionManager] No active chat session to rename");
      return;
    }

    try {
      this.chatHistoryManager.updateSessionName(this.chatId, newName);
    } catch (error) {
      console.error(`[SessionManager] Failed to update chat name: ${error}`);
    }
  }

  /**
   * Create a chat session using Ray API's session ID
   */
  public createChatSessionFromRay(rayChatId: string, rayProjectId: string): void {
    console.log(`[SessionManager] Creating chat session from Ray API: ${rayChatId} for project: ${rayProjectId}`);
    
    // Set our current session to match Ray's
    this.chatId = rayChatId;
    console.log(`[SessionManager] Set current chatId to: ${this.chatId}`);
    
    // Create the session in history
    try {
      console.log(`[SessionManager] Calling chatHistoryManager.createChatSession...`);
      this.chatHistoryManager.createChatSession(rayChatId, rayProjectId);
      console.log(`[SessionManager] Successfully created chat session from Ray API`);
    } catch (error) {
      console.error(`[SessionManager] Failed to create chat session from Ray API: ${error}`);
      if (error instanceof Error) {
        console.error(`[SessionManager] Error stack: ${error.stack}`);
      }
    }
  }

  /**
   * Generate a random ID using crypto
   */
  private generateRandomId(): string {
    return crypto.randomBytes(8).toString("hex");
  }
}
