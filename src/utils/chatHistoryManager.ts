import * as vscode from "vscode";

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  content: string;
  timestamp: Date;
  options?: any;
}

export interface ChatSession {
  id: string;
  name: string;
  messages: ChatMessage[];
  createdAt: Date;
  lastUpdatedAt: Date;
  projectId: string;
}

export class ChatHistoryManager {
  private static instance: ChatHistoryManager;
  private context: vscode.ExtensionContext | null = null;
  private readonly CHAT_HISTORY_KEY = "rayDaemon.chatHistory";
  private readonly MAX_SESSIONS_PER_PROJECT = 50;
  private readonly MAX_MESSAGES_PER_SESSION = 1000;

  private constructor() {}

  public static getInstance(): ChatHistoryManager {
    if (!ChatHistoryManager.instance) {
      ChatHistoryManager.instance = new ChatHistoryManager();
    }
    return ChatHistoryManager.instance;
  }

  /**
   * Initialize the chat history manager with extension context
   */
  public initialize(context: vscode.ExtensionContext): void {
    console.log("[ChatHistoryManager] Initializing with extension context");
    this.context = context;
    
    // Test workspace state access
    try {
      const existingSessions = context.workspaceState.get<ChatSession[]>(this.CHAT_HISTORY_KEY, []);
      console.log(`[ChatHistoryManager] Found ${existingSessions.length} existing sessions in workspace state`);
      console.log("[ChatHistoryManager] Initialized with extension context successfully");
    } catch (error) {
      console.error("[ChatHistoryManager] Error accessing workspace state during initialization:", error);
    }
  }

  /**
   * Get all chat sessions for the current project
   */
  public getChatSessions(projectId: string): ChatSession[] {
    if (!this.context) {
      console.error("[ChatHistoryManager] Context not initialized");
      return [];
    }

    console.log(`[ChatHistoryManager] Getting chat sessions for project: ${projectId}`);
    const allSessions = this.context.workspaceState.get<ChatSession[]>(this.CHAT_HISTORY_KEY, []);
    console.log(`[ChatHistoryManager] Found ${allSessions.length} total sessions in workspace state`);
    
    // Ensure dates are properly deserialized
    const deserializedSessions = allSessions.map(session => ({
      ...session,
      createdAt: new Date(session.createdAt),
      lastUpdatedAt: new Date(session.lastUpdatedAt),
      messages: session.messages ? session.messages.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      })) : []
    }));
    
    const projectSessions = deserializedSessions.filter(session => session.projectId === projectId);
    console.log(`[ChatHistoryManager] Found ${projectSessions.length} sessions for project ${projectId}`);
    
    return projectSessions.sort((a, b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime());
  }

  /**
   * Get a specific chat session by ID
   */
  public getChatSession(sessionId: string): ChatSession | null {
    if (!this.context) {
      console.error("[ChatHistoryManager] Context not initialized");
      return null;
    }

    const allSessions = this.context.workspaceState.get<ChatSession[]>(this.CHAT_HISTORY_KEY, []);
    const session = allSessions.find(session => session.id === sessionId);
    
    if (!session) {
      return null;
    }
    
    // Ensure dates are properly deserialized
    return {
      ...session,
      createdAt: new Date(session.createdAt),
      lastUpdatedAt: new Date(session.lastUpdatedAt),
      messages: session.messages ? session.messages.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      })) : []
    };
  }

  /**
   * Create a new chat session
   */
  public createChatSession(sessionId: string, projectId: string, initialMessage?: string): ChatSession {
    console.log(`[ChatHistoryManager] Creating new chat session: ${sessionId} for project: ${projectId}`);
    
    if (!this.context) {
      console.error("[ChatHistoryManager] Context not initialized - cannot create session");
      throw new Error("[ChatHistoryManager] Context not initialized");
    }

    const now = new Date();
    const sessionName = this.generateSessionName(initialMessage);
    console.log(`[ChatHistoryManager] Generated session name: ${sessionName}`);
    
    const newSession: ChatSession = {
      id: sessionId,
      name: sessionName,
      messages: [],
      createdAt: now,
      lastUpdatedAt: now,
      projectId: projectId
    };

    // Add initial message if provided
    if (initialMessage) {
      console.log(`[ChatHistoryManager] Adding initial message to session`);
      newSession.messages.push({
        id: this.generateMessageId(),
        sender: "user",
        content: initialMessage,
        timestamp: now
      });
    }

    this.saveChatSession(newSession);
    console.log(`[ChatHistoryManager] Created new chat session: ${sessionId} for project: ${projectId} with ${newSession.messages.length} messages`);
    
    return newSession;
  }

  /**
   * Add a message to a chat session
   */
  public addMessageToSession(sessionId: string, sender: "user" | "assistant", content: string, options?: any): void {
    console.log(`[ChatHistoryManager] Adding ${sender} message to session: ${sessionId}`);
    
    if (!this.context) {
      console.error("[ChatHistoryManager] Context not initialized");
      return;
    }

    const session = this.getChatSession(sessionId);
    if (!session) {
      console.error(`[ChatHistoryManager] Session not found: ${sessionId}`);
      console.log(`[ChatHistoryManager] Available sessions:`, this.context.workspaceState.get<ChatSession[]>(this.CHAT_HISTORY_KEY, []).map(s => s.id));
      return;
    }

    console.log(`[ChatHistoryManager] Found session: ${session.name} with ${session.messages.length} messages`);

    const message: ChatMessage = {
      id: this.generateMessageId(),
      sender,
      content,
      timestamp: new Date(),
      options
    };

    session.messages.push(message);
    session.lastUpdatedAt = new Date();

    // Update session name if this is the first user message
    if (sender === "user" && session.messages.filter(m => m.sender === "user").length === 1) {
      const newName = this.generateSessionName(content);
      console.log(`[ChatHistoryManager] Updating session name from "${session.name}" to "${newName}"`);
      session.name = newName;
    }

    // Limit messages per session
    if (session.messages.length > this.MAX_MESSAGES_PER_SESSION) {
      session.messages = session.messages.slice(-this.MAX_MESSAGES_PER_SESSION);
    }

    this.saveChatSession(session);
    console.log(`[ChatHistoryManager] Added ${sender} message to session: ${sessionId}. Session now has ${session.messages.length} messages`);
  }

  /**
   * Update the name of a chat session
   */
  public updateSessionName(sessionId: string, newName: string): void {
    if (!this.context) {
      console.error("[ChatHistoryManager] Context not initialized");
      return;
    }

    const session = this.getChatSession(sessionId);
    if (!session) {
      console.error(`[ChatHistoryManager] Session not found: ${sessionId}`);
      return;
    }

    session.name = newName;
    session.lastUpdatedAt = new Date();
    this.saveChatSession(session);
    console.log(`[ChatHistoryManager] Updated session name: ${sessionId} -> ${newName}`);
  }

  /**
   * Delete a chat session
   */
  public deleteChatSession(sessionId: string): boolean {
    if (!this.context) {
      console.error("[ChatHistoryManager] Context not initialized");
      return false;
    }

    const allSessions = this.context.workspaceState.get<ChatSession[]>(this.CHAT_HISTORY_KEY, []);
    const filteredSessions = allSessions.filter(session => session.id !== sessionId);
    
    if (filteredSessions.length === allSessions.length) {
      console.error(`[ChatHistoryManager] Session not found for deletion: ${sessionId}`);
      return false;
    }

    this.context.workspaceState.update(this.CHAT_HISTORY_KEY, filteredSessions);
    console.log(`[ChatHistoryManager] Deleted chat session: ${sessionId}`);
    return true;
  }

  /**
   * Clear all chat sessions for a project
   */
  public clearProjectHistory(projectId: string): void {
    if (!this.context) {
      console.error("[ChatHistoryManager] Context not initialized");
      return;
    }

    const allSessions = this.context.workspaceState.get<ChatSession[]>(this.CHAT_HISTORY_KEY, []);
    const filteredSessions = allSessions.filter(session => session.projectId !== projectId);
    
    this.context.workspaceState.update(this.CHAT_HISTORY_KEY, filteredSessions);
    console.log(`[ChatHistoryManager] Cleared all chat history for project: ${projectId}`);
  }

  /**
   * Get chat history summary for display
   */
  public getChatHistorySummary(projectId: string): Array<{id: string, name: string, lastUpdated: Date, messageCount: number}> {
    console.log(`[ChatHistoryManager] Getting chat history summary for project: ${projectId}`);
    const sessions = this.getChatSessions(projectId);
    console.log(`[ChatHistoryManager] Found ${sessions.length} sessions for project ${projectId}`);
    
    const summary = sessions.map(session => {
      const messageCount = session.messages ? session.messages.length : 0;
      console.log(`[ChatHistoryManager] Session ${session.id} has ${messageCount} messages`);
      return {
        id: session.id,
        name: session.name,
        lastUpdated: session.lastUpdatedAt,
        messageCount: messageCount
      };
    });
    
    console.log(`[ChatHistoryManager] Returning summary with ${summary.length} sessions`);
    console.log(`[ChatHistoryManager] Summary details:`, summary.map(s => `${s.name}: ${s.messageCount} messages`));
    return summary;
  }

  /**
   * Save a chat session to workspace state
   */
  private saveChatSession(session: ChatSession): void {
    if (!this.context) {
      console.error("[ChatHistoryManager] Context not initialized");
      return;
    }

    console.log(`[ChatHistoryManager] Saving session: ${session.id} with ${session.messages.length} messages`);
    
    const allSessions = this.context.workspaceState.get<ChatSession[]>(this.CHAT_HISTORY_KEY, []);
    console.log(`[ChatHistoryManager] Current workspace has ${allSessions.length} total sessions`);
    
    const existingIndex = allSessions.findIndex(s => s.id === session.id);
    
    if (existingIndex >= 0) {
      console.log(`[ChatHistoryManager] Updating existing session at index ${existingIndex}`);
      allSessions[existingIndex] = session;
    } else {
      console.log(`[ChatHistoryManager] Adding new session to workspace state`);
      allSessions.push(session);
    }

    // Limit sessions per project
    const projectSessions = allSessions.filter(s => s.projectId === session.projectId);
    console.log(`[ChatHistoryManager] Project ${session.projectId} now has ${projectSessions.length} sessions`);
    
    if (projectSessions.length > this.MAX_SESSIONS_PER_PROJECT) {
      console.log(`[ChatHistoryManager] Cleaning up old sessions (limit: ${this.MAX_SESSIONS_PER_PROJECT})`);
      // Remove oldest sessions for this project
      const sortedProjectSessions = projectSessions.sort((a, b) => 
        new Date(a.lastUpdatedAt).getTime() - new Date(b.lastUpdatedAt).getTime()
      );
      const sessionsToRemove = sortedProjectSessions.slice(0, projectSessions.length - this.MAX_SESSIONS_PER_PROJECT);
      const filteredSessions = allSessions.filter(s => 
        !sessionsToRemove.some(remove => remove.id === s.id)
      );
      this.context.workspaceState.update(this.CHAT_HISTORY_KEY, filteredSessions);
      console.log(`[ChatHistoryManager] Removed ${sessionsToRemove.length} old sessions`);
    } else {
      this.context.workspaceState.update(this.CHAT_HISTORY_KEY, allSessions);
    }
    
    console.log(`[ChatHistoryManager] Session saved successfully. Total sessions in workspace: ${allSessions.length}`);
  }

  /**
   * Generate a session name from the first message
   */
  private generateSessionName(firstMessage?: string): string {
    if (!firstMessage) {
      return `Chat ${new Date().toLocaleString()}`;
    }

    // Take first 50 characters and clean up
    let name = firstMessage.substring(0, 50).trim();
    if (firstMessage.length > 50) {
      name += "...";
    }

    // Remove newlines and extra spaces
    name = name.replace(/\s+/g, " ");
    
    return name || `Chat ${new Date().toLocaleString()}`;
  }

  /**
   * Generate a unique message ID
   */
  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}