// Message routing for incoming postMessage events

export function routeIncomingMessage({ chatUI, toolStatusHandler }, message) {
  console.groupCollapsed(`[Webview] Received message: ${message?.type}`);
  console.log("Full message:", message);

  if (!message || !message.type) {
    console.warn("[Webview] Received message with no type:", message);
    console.groupEnd();
    return;
  }

  console.group(`[Webview] Message Details`);
  try {
    console.log("Full message:", JSON.parse(JSON.stringify(message)));
  } catch (_) {
    console.log("Message (raw):", message);
  }
  console.groupEnd();

  if (window.performance && window.performance.memory) {
    console.log(
      `[Webview] Memory: ${(window.performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB used`,
    );
  }

  if (chatUI.typingTimeout) {
    clearTimeout(chatUI.typingTimeout);
    chatUI.typingTimeout = null;
  }
  chatUI.showTypingIndicator(false);

  if (message.type === "toolStatus" && message.data) {
    toolStatusHandler.handleToolStatus(message.data);
    return;
  }

  if (message.type === "chat_response") {
    chatUI.addMessage("assistant", message.content, {
      isMarkdown: true,
      showAvatar: true,
    });
    chatUI.showTypingIndicator(false);
    return;
  }

  if (message.type === "rayResponse" && message.data) {
    const { content, isWorking, isFinal, isCommandResult } = message.data;
    if (content) {
      if (isCommandResult && !isFinal) {
        console.log("Skipping command result message (not final)");
        console.groupEnd();
        return;
      }
      if (isFinal !== false && !isWorking) {
        const workingMessage = chatUI.chatMessages.querySelector('[data-working="true"]');
        if (workingMessage) workingMessage.remove();
        chatUI.showTypingIndicator(false);
      }
      chatUI.addMessage("assistant", content, {
        isMarkdown: true,
        showAvatar: true,
        isWorking: isWorking || false,
      });
    } else {
      console.log("rayResponse has no content, skipping");
    }
    console.groupEnd();
    return;
  }

  if (message.type === "chatHistory" && message.data) {
    console.log("Received chat history data:", message.data);
    console.log("Chat history length:", message.data.length);
    chatUI.displayChatHistoryModal(message.data);
    console.groupEnd();
    return;
  }

  if (message.type === "loadChatSession" && message.data) {
    console.log("Loading chat session:", message.data);
    chatUI.loadChatSessionMessages(message.data);
    console.groupEnd();
    return;
  }

  if (message.command) {
    try {
      console.log(`[Webview] Processing command: ${message.command}`);
      switch (message.command) {
        case "addMessage":
          chatUI.addMessage(message.sender, message.content, {
            ...message.options,
            showAvatar: true,
          });
          break;
        case "showTyping":
          chatUI.showTypingIndicator(message.typing);
          break;
        case "clearChat":
          chatUI.clearChat();
          break;
        case "setStatus":
          chatUI.setStatus(message.status);
          break;
        case "chatError":
          chatUI.addMessage("assistant", `Error: ${message.error}`, {
            isMarkdown: false,
            showAvatar: true,
          });
          break;
        default:
          console.warn("[Webview] Unknown command:", message.command);
      }
    } catch (error) {
      console.error("[Webview] Error processing command:", error);
      console.error("Command that caused error:", message);
    } finally {
      console.groupEnd();
    }
  }
}

