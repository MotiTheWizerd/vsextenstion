import { initializeUI, updateChatInputStructure, setStatus, adjustTextareaHeight, ensureInputWidth, scrollToBottom, focusInput } from "./chat-ui/dom-setup.js";
import { addMessage, handleSendMessage, navigateHistory, showTypingIndicator, updateSendButton } from "./chat-ui/messages.js";
import { initializeEventListeners } from "./chat-ui/events.js";
import { handlePaste, handleFileUpload } from "./chat-ui/paste-upload.js";
import { initializeDropdowns } from "./chat-ui/dropdowns.js";

class ModernChatUI {
  constructor(vscodeApi) {
    this.vscodeApi = vscodeApi;
    this.fileUtils = new FileUtils(this);
    this.chatInput = document.getElementById("chatInput");
    this.sendButton = document.getElementById("sendButton");
    this.chatMessages = document.getElementById("chatMessages");
    this.typingIndicator = document.getElementById("typingIndicator");
    this.actionBar = document.getElementById("actionBar");

    this.messageHistory = [];
    this.historyIndex = -1;
    this.typingTimeout = null;

    this.initializeEventListeners();
    this.initializeUI();
    this.scrollToBottom();

    this.postMessage({ command: "webviewReady" });
  }

  // Core messaging to extension
  postMessage(message) { this.vscodeApi.postMessage(message); }

  // DOM setup
  initializeUI() { return initializeUI(this); }
  updateChatInputStructure() { return updateChatInputStructure(this); }
  setStatus(status) { return setStatus(this, status); }
  adjustTextareaHeight() { return adjustTextareaHeight(this); }
  ensureInputWidth() { return ensureInputWidth(this); }
  scrollToBottom() { return scrollToBottom(this); }
  focusInput() { return focusInput(this); }

  // Events
  initializeEventListeners() { return initializeEventListeners(this); }
  initializeDropdowns() { return initializeDropdowns(this); }

  // Messages and typing
  addMessage(sender, content, options = {}) { return addMessage(this, sender, content, options); }
  handleSendMessage() { return handleSendMessage(this); }
  navigateHistory(direction) { return navigateHistory(this, direction); }
  showTypingIndicator(show) { return showTypingIndicator(this, show); }
  updateSendButton() { return updateSendButton(this); }

  // Paste / Upload
  handlePaste(event) { return handlePaste(this, event); }
  handleFileUpload(file) { return handleFileUpload(this, file); }

  // Clear chat
  clearChat() { this.chatMessages.innerHTML = ""; }

  // Action bar handlers
  handleNewChat() {
    this.clearChat();
    this.messageHistory = [];
    this.historyIndex = -1;
    this.focusInput();
    
    // Notify extension to start a new chat session
    this.postMessage({ command: "startNewChat" });
  }

  handleChatHistory() {
    console.log("Chat history clicked - opening history modal");
    console.log("Posting getChatHistory command to extension");
    this.showChatHistoryModal();
  }

  showChatHistoryModal() {
    // Request chat history from extension
    console.log("Requesting chat history from extension...");
    this.postMessage({ command: "getChatHistory" });
    
    // Fallback: show modal with empty data after 2 seconds if no response
    setTimeout(() => {
      const existingModal = document.getElementById("chatHistoryModal");
      if (!existingModal) {
        console.log("No modal shown yet, displaying fallback empty modal");
        this.displayChatHistoryModal([]);
      }
    }, 2000);
  }

  displayChatHistoryModal(chatHistory) {
    console.log("Displaying chat history modal with data:", chatHistory);
    
    // Remove existing modal if present
    const existingModal = document.getElementById("chatHistoryModal");
    if (existingModal) {
      existingModal.remove();
    }

    // Create modal
    const modal = document.createElement("div");
    modal.id = "chatHistoryModal";
    modal.className = "chat-history-modal";
    
    const modalContent = document.createElement("div");
    modalContent.className = "modal-content";
    
    // Header
    const header = document.createElement("div");
    header.className = "modal-header";
    header.innerHTML = `
      <h3>Chat History</h3>
      <button class="close-button" onclick="this.closest('.chat-history-modal').remove()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;
    
    // Body
    const body = document.createElement("div");
    body.className = "modal-body";
    
    if (chatHistory.length === 0) {
      body.innerHTML = `
        <div class="empty-history">
          <p>No chat history found for this project.</p>
          <p><small>Debug: Received ${chatHistory.length} sessions</small></p>
        </div>
      `;
    } else {
      const historyList = document.createElement("div");
      historyList.className = "history-list";
      
      chatHistory.forEach(session => {
        const sessionItem = document.createElement("div");
        sessionItem.className = "history-item";
        sessionItem.innerHTML = `
          <div class="history-item-content">
            <div class="history-item-name">${this.escapeHtml(session.name)}</div>
            <div class="history-item-meta">
              ${session.messageCount} messages • ${this.formatDate(session.lastUpdated)}
            </div>
          </div>
          <div class="history-item-actions">
            <button class="load-button" data-session-id="${session.id}" title="Load Chat">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2z"></path>
                <path d="M8 21v-4a2 2 0 012-2h4a2 2 0 012 2v4"></path>
              </svg>
            </button>
            <button class="delete-button" data-session-id="${session.id}" title="Delete Chat">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3,6 5,6 21,6"></polyline>
                <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
              </svg>
            </button>
          </div>
        `;
        
        // Add event listeners
        const loadButton = sessionItem.querySelector(".load-button");
        const deleteButton = sessionItem.querySelector(".delete-button");
        
        loadButton.addEventListener("click", () => {
          this.loadChatSession(session.id);
          modal.remove();
        });
        
        deleteButton.addEventListener("click", (e) => {
          e.stopPropagation();
          this.deleteChatSession(session.id, sessionItem);
        });
        
        historyList.appendChild(sessionItem);
      });
      
      body.appendChild(historyList);
    }
    
    modalContent.appendChild(header);
    modalContent.appendChild(body);
    modal.appendChild(modalContent);
    
    // Add to DOM
    document.body.appendChild(modal);
    
    // Close on background click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  loadChatSession(sessionId) {
    console.log("Loading chat session:", sessionId);
    this.postMessage({ command: "loadChatSession", sessionId: sessionId });
  }

  deleteChatSession(sessionId, itemElement) {
    if (confirm("Are you sure you want to delete this chat session?")) {
      console.log("Deleting chat session:", sessionId);
      this.postMessage({ command: "deleteChatSession", sessionId: sessionId });
      itemElement.remove();
    }
  }

  loadChatSessionMessages(session) {
    // Clear current chat
    this.clearChat();
    this.messageHistory = [];
    this.historyIndex = -1;
    
    // Load messages from session
    if (session && session.messages) {
      session.messages.forEach(message => {
        this.addMessage(message.sender, message.content, message.options || {});
        if (message.sender === "user") {
          this.messageHistory.push(message.content);
        }
      });
    }
    
    this.scrollToBottom();
    this.focusInput();
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  }
}

export default ModernChatUI;
