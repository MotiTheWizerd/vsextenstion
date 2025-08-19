import * as vscode from "vscode";
import * as crypto from "crypto";

export class SessionManager {
  private static instance: SessionManager;
  private projectId: string | null = null;
  private chatId: string | null = null;
  private userId: string | null = null;
  private readonly DEFAULT_USER_ID = "00000000-0000-4000-8000-000000000000"; // Default UUID4

  private constructor() {}

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

      // Create a hash from workspace path for consistency across sessions
      const hash = crypto.createHash("md5").update(workspacePath).digest("hex");
      this.projectId = `${workspaceName.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${hash.substring(0, 8)}`;
    } else {
      // Fallback to random ID if no workspace
      this.projectId = `project-${this.generateRandomId()}`;
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
   * Start a new chat session (generates new chat_id)
   */
  public startNewChat(): string {
    this.chatId = `chat-${this.generateRandomId()}`;
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
   * Generate a random ID using crypto
   */
  private generateRandomId(): string {
    return crypto.randomBytes(8).toString("hex");
  }
}
