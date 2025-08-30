// Extracted from webview-bundle.js
import FileUtils from "./file-utils.js";
import MarkdownParser from "./markdown-parser.js";

export default class ModernChatUI {
  constructor(vscodeApi) {
    this.vscodeApi = vscodeApi;
    this.fileUtils = new FileUtils(this);

    // Get DOM elements with debugging
    this.chatInput = document.getElementById("chatInput");
    this.sendButton = document.getElementById("sendButton");
    this.chatMessages = document.getElementById("chatMessages");
    this.typingIndicator = document.getElementById("typingIndicator");
    this.statusBar = document.getElementById("statusBar");

    console.log("DOM elements found:");
    console.log("- chatInput:", !!this.chatInput);
    console.log("- sendButton:", !!this.sendButton);
    console.log("- chatMessages:", !!this.chatMessages);
    console.log("- typingIndicator:", !!this.typingIndicator);

    this.messageHistory = [];
    this.historyIndex = -1;
    this.typingTimeout = null;

    this.initializeEventListeners();
    this.initializeUI();
    this.scrollToBottom();

    this.postMessage({ command: "webviewReady" });
  }

  initializeUI() {
    this.updateChatInputStructure();
    // Initialize action bar buttons after a delay to ensure DOM is ready
    setTimeout(() => {
      this.initializeActionBar();
    }, 50);
  }

  updateChatInputStructure() {
    if (
      this.typingIndicator &&
      !this.typingIndicator.querySelector(".typing-dots")
    ) {
      this.typingIndicator.innerHTML = `
        RayDaemon is thinking
        <div class="typing-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      `;
    }
    if (this.statusBar && !this.statusBar.querySelector(".status-indicator")) {
      this.statusBar.innerHTML = `
        <div class="status-indicator"></div>
        <span>RayDaemon is ready</span>
      `;
    }
  }

  initializeActionBar() {
    console.log("Initializing action bar buttons...");
    const actionBar = document.getElementById("actionBar");
    console.log("Action bar element:", actionBar);

    if (actionBar) {
      const newChatButton = document.getElementById("newChatButton");
      const historyButton = document.getElementById("historyButton");

      console.log("New chat button:", newChatButton);
      console.log("History button:", historyButton);

      if (newChatButton) {
        console.log("Setting up new chat button event listener");
        newChatButton.addEventListener("click", () => {
          console.log("New chat button clicked!");
          this.handleNewChat();
        });
      } else {
        console.log("New chat button not found in DOM!");
      }

      if (historyButton) {
        console.log("Setting up history button event listener");
        historyButton.addEventListener("click", () => {
          console.log("History button clicked!");
          this.handleChatHistory();
        });
      } else {
        console.log("History button not found in DOM!");
      }
    } else {
      console.log("Action bar not found in DOM!");
    }
  }

  postMessage(message) {
    this.vscodeApi.postMessage(message);
  }

  initializeEventListeners() {
    console.log("Initializing event listeners...");

    if (this.sendButton) {
      console.log("Adding click listener to send button");
      this.sendButton.addEventListener("click", () => {
        console.log("Send button clicked!");
        const state = this.sendButton.getAttribute("data-state");
        if (state === "working") {
          try {
            this.postMessage({ command: "cancelAgent" });
          } catch (_) {}
          return;
        }
        this.handleSendMessage();
      });
    } else {
      console.log("Send button not found!");
    }

    if (this.chatInput) {
      console.log("Adding keydown listener to chat input");
      this.chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          console.log("Enter key pressed in chat input");
          e.preventDefault();
          this.handleSendMessage();
          return;
        }
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          this.navigateHistory(e.key === "ArrowUp" ? "up" : "down");
          e.preventDefault();
          return;
        }
        if (e.key.length === 1 || e.key === "Backspace" || e.key === "Delete") {
          this.historyIndex = -1;
        }
      });

      this.chatInput.addEventListener("input", () => {
        this.adjustTextareaHeight();
        this.updateSendButton();
        this.ensureInputWidth();
      });

      this.chatInput.addEventListener("focus", () => {
        this.ensureInputWidth();
      });
    } else {
      console.log("Chat input not found!");
    }

    if (this.chatMessages) {
      this.chatMessages.addEventListener("click", (e) => {
        if (
          e.target.closest(
            ".tool-count, .tool-file-item, .copy-button, a, button"
          )
        ) {
          return;
        }
        if (this.chatInput) {
          this.chatInput.focus();
        }
      });
    }

    window.addEventListener("resize", () => {
      this.ensureInputWidth();
      this.adjustTextareaHeight();
    });
  }

  updateSendButton() {
    // Keep button always enabled (acts as send/stop visually)
    try {
      this.sendButton.disabled = false;
    } catch (_) {}
  }

  handleSendMessage() {
    const message = this.chatInput.value.trim();
    if (!message) {
      return;
    }
    this.addMessage("user", message, { showAvatar: true });
    this.chatInput.value = "";
    this.adjustTextareaHeight();
    this.updateSendButton();
    this.showTypingIndicator(true);
    this.messageHistory.push(message);
    if (this.messageHistory.length > 50) {
      this.messageHistory.shift();
    }
    try {
      this.postMessage({
        command: "sendMessage",
        message: message,
      });
      this.typingTimeout = setTimeout(() => {
        this.showTypingIndicator(false);
        this.addMessage(
          "assistant",
          "Sorry, I didn't receive a response. Please try again.",
          { isMarkdown: false, showAvatar: true }
        );
      }, 30000);
    } catch (error) {
      this.showTypingIndicator(false);
      this.addMessage(
        "assistant",
        "Failed to send message. Please try again.",
        { isMarkdown: false, showAvatar: true }
      );
    }
  }

  addMessage(sender, content, options = {}) {
    const {
      timestamp = new Date(),
      isMarkdown = true,
      showAvatar = false,
      replaceLast = false,
      isWorking = false,
      isToolMessage = false,
      customElement = null,
    } = options;
    if (replaceLast) {
      const lastMessage = this.chatMessages.lastElementChild;
      if (lastMessage && lastMessage.classList.contains("message")) {
        lastMessage.remove();
      }
    }
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${sender}`;
    if (isWorking) {
      messageDiv.setAttribute("data-working", "true");
    }
    if (isToolMessage) {
      messageDiv.classList.add("tool-message");
    }
    if (showAvatar && !isToolMessage) {
      const avatar = document.createElement("div");
      avatar.className = "message-avatar";
      avatar.textContent = sender === "user" ? "U" : "R";
      messageDiv.appendChild(avatar);
    }
    const contentDiv = document.createElement("div");
    contentDiv.className = "message-content";
    if (customElement) {
      contentDiv.appendChild(customElement);
    } else if (isMarkdown && content) {
      contentDiv.innerHTML = MarkdownParser.parse(content);
    } else {
      contentDiv.textContent = content || "";
    }
    messageDiv.appendChild(contentDiv);
    if (!isToolMessage) {
      const timeDiv = document.createElement("div");
      timeDiv.className = "message-time";
      timeDiv.textContent = timestamp.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      contentDiv.appendChild(timeDiv);
    }
    this.chatMessages.appendChild(messageDiv);
    this.scrollToBottom();
    return messageDiv;
  }

  navigateHistory(direction) {
    if (this.messageHistory.length === 0) {
      return;
    }
    if (
      direction === "up" &&
      this.historyIndex < this.messageHistory.length - 1
    ) {
      this.historyIndex++;
    } else if (direction === "down" && this.historyIndex >= 0) {
      this.historyIndex--;
    } else {
      return;
    }
    const message =
      this.historyIndex >= 0
        ? this.messageHistory[
            this.messageHistory.length - 1 - this.historyIndex
          ]
        : "";
    this.chatInput.value = message;
    this.adjustTextareaHeight();
    this.updateSendButton();
  }

  showTypingIndicator(show) {
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
    this.typingIndicator.classList.toggle("show", show);
    if (this.sendButton) {
      this.sendButton.setAttribute("data-state", show ? "working" : "idle");
    }
    // Global working state (shim if not present)
    try {
      if (!window.AgentWork) {
        (function initAgentWorkShim() {
          let working = false;
          const subscribers = new Set();
          function notify() {
            try {
              document.documentElement?.toggleAttribute(
                "data-agent-working",
                working
              );
            } catch (_) {}
            try {
              window.dispatchEvent(
                new CustomEvent("agent:working-changed", {
                  detail: { working },
                })
              );
            } catch (_) {}
            subscribers.forEach((fn) => {
              try {
                fn(working);
              } catch (e) {
                console.error("[AgentWork] subscriber error", e);
              }
            });
          }
          window.AgentWork = {
            setWorking(val) {
              const next = !!val;
              if (next === working) {
                return;
              }
              working = next;
              notify();
            },
            isWorking() {
              return !!working;
            },
            subscribe(fn) {
              if (typeof fn === "function") {
                subscribers.add(fn);
              }
              return () => subscribers.delete(fn);
            },
            unsubscribe(fn) {
              subscribers.delete(fn);
            },
          };
        })();
      }
      window.AgentWork.setWorking(!!show);
    } catch (_) {}
    // Ensure button enable state reflects working immediately
    try {
      this.updateSendButton();
    } catch (_) {}
    if (show) {
      this.scrollToBottom();
    }
  }

  clearChat() {
    this.chatMessages.innerHTML = "";
    if (this.chatInput) {
      this.chatInput.value = "";
      this.adjustTextareaHeight();
    }
  }

  setStatus(status) {
    const statusText = this.statusBar?.querySelector("span");
    if (statusText) {
      statusText.textContent = status;
    }
  }

  adjustTextareaHeight() {
    this.chatInput.style.height = "auto";
    this.chatInput.style.height =
      Math.min(this.chatInput.scrollHeight, 120) + "px";
  }

  ensureInputWidth() {
    const inputWrapper = this.chatInput.parentElement;
    if (inputWrapper && inputWrapper.classList.contains("input-wrapper")) {
      const sendButtonWidth = this.sendButton.offsetWidth;
      const gap = 12;
      const containerPadding = 48;
      const availableWidth =
        inputWrapper.offsetWidth - sendButtonWidth - gap - containerPadding;
      this.chatInput.style.width = `${Math.max(availableWidth, 200)}px`;
    }
  }

  scrollToBottom() {
    setTimeout(() => {
      this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }, 10);
  }

  focusInput() {
    this.chatInput?.focus();
    this.ensureInputWidth();
  }

  // Chat history functionality
  handleChatHistory() {
    console.log("Chat history clicked - opening history modal");
    console.log("Posting getChatHistory command to extension");
    this.showChatHistoryModal();
  }

  handleNewChat() {
    console.log("New chat clicked");
    this.clearChat();
    this.messageHistory = [];
    this.historyIndex = -1;
    this.focusInput();
    this.postMessage({ command: "startNewChat" });
  }

  showChatHistoryModal() {
    console.log("Requesting chat history from extension");
    this.postMessage({ command: "getChatHistory" });
  }

  loadChatSessionMessages(session) {
    console.log("Loading chat session messages:", session);

    // Clear current chat
    this.clearChat();
    this.messageHistory = [];
    this.historyIndex = -1;

    // Load messages from session (last 5 messages)
    if (session && session.messages && session.messages.length > 0) {
      console.log(`Loading ${session.messages.length} messages from session`);

      // Get last 5 messages or all if less than 5
      const messagesToLoad = session.messages.slice(-5);
      console.log(`Displaying last ${messagesToLoad.length} messages`);

      messagesToLoad.forEach((message) => {
        // Convert the data structure from ChatMessage to UI format
        const sender = message.sender === "user" ? "user" : "assistant";
        const content = message.content || "";
        const timestamp = message.timestamp
          ? new Date(message.timestamp)
          : new Date();

        this.addMessage(sender, content, {
          showAvatar: true,
          isMarkdown: sender === "assistant",
          timestamp: timestamp,
        });

        // Add user messages to history for navigation
        if (sender === "user") {
          this.messageHistory.push(content);
        }
      });

      console.log(
        `Loaded ${messagesToLoad.length} messages, ${this.messageHistory.length} in history`
      );
    } else {
      console.log("No messages to load from session");
    }

    this.scrollToBottom();
    this.focusInput();
  }

  displayChatHistoryModal(chatHistory) {
    try {
      console.log("Displaying chat history modal with data:", chatHistory);
      console.log("First session structure:", chatHistory && chatHistory[0]);

      // Remove existing modal if any
      const existingModal = document.querySelector(".chat-history-modal");
      if (existingModal) {
        console.log("Removing existing modal");
        existingModal.remove();
      }

      // Create modal HTML
      console.log("Creating modal element");
      const modal = document.createElement("div");
      modal.className = "chat-history-modal";
      console.log("Setting modal innerHTML");
      modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Chat History</h3>
          <button class="close-button">&times;</button>
        </div>
        <div class="modal-body">
          ${
            chatHistory && chatHistory.length > 0
              ? chatHistory
                  .map((session) => {
                    // Use the session name from the summary
                    let title = session.name || "New Chat";

                    // For summary data, we don't have message content for preview
                    let preview = `${session.messageCount || 0} messages`;

                    // Format date better
                    const date = new Date(
                      session.lastUpdated || session.lastUpdatedAt
                    );
                    const now = new Date();
                    const diffTime = Math.abs(now - date);
                    const diffDays = Math.ceil(
                      diffTime / (1000 * 60 * 60 * 24)
                    );

                    let dateStr;
                    if (diffDays === 1) {
                      dateStr = "Today";
                    } else if (diffDays === 2) {
                      dateStr = "Yesterday";
                    } else if (diffDays <= 7) {
                      dateStr = `${diffDays - 1} days ago`;
                    } else {
                      dateStr = date.toLocaleDateString();
                    }

                    return `
                  <div class="chat-session" data-chat-id="${
                    session.id || session.chatId
                  }">
                    <div class="session-content">
                      <div class="session-title">${title}</div>
                      <div class="session-preview">${preview}</div>
                    </div>
                    <div class="session-meta">
                      <div class="session-date">${dateStr}</div>
                      <div class="session-count">${
                        session.messageCount || 0
                      } messages</div>
                    </div>
                  </div>
                `;
                  })
                  .join("")
              : '<div class="no-sessions">No chat history found</div>'
          }
        </div>
      </div>
    `;

      // Add to DOM
      console.log("Adding modal to DOM");
      document.body.appendChild(modal);
      console.log("Modal added to DOM, checking visibility");
      console.log("Modal element:", modal);
      const computedStyle = window.getComputedStyle(modal);
      console.log("Modal display:", computedStyle.display);
      console.log("Modal position:", computedStyle.position);
      console.log("Modal z-index:", computedStyle.zIndex);
      console.log("Modal opacity:", computedStyle.opacity);
      console.log("Modal visibility:", computedStyle.visibility);
      console.log("Modal background-color:", computedStyle.backgroundColor);

      // Add event listeners
      const closeButton = modal.querySelector(".close-button");
      closeButton.addEventListener("click", () => {
        modal.remove();
      });

      // Close on outside click
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      });

      // Handle session clicks
      const sessions = modal.querySelectorAll(".chat-session");
      sessions.forEach((session) => {
        session.addEventListener("click", () => {
          const chatId = session.getAttribute("data-chat-id");
          console.log("Loading chat session:", chatId);
          this.postMessage({ command: "loadChatSession", chatId });
          modal.remove();
        });
      });
    } catch (error) {
      console.error("Error displaying chat history modal:", error);
    }
  }
}
