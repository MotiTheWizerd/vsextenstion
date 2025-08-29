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
    this.statusBar = document.getElementById("statusBar");

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
}

export default ModernChatUI;
