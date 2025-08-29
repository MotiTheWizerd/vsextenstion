import ToolStatusHandler from "./message-handler/tool-status-handler.js";
import { routeIncomingMessage } from "./message-handler/message-router.js";

// Thin orchestrator that delegates to focused modules under ./message-handler/
class MessageHandler {
  constructor(chatUI) {
    this.chatUI = chatUI;
    this.toolStatusHandler = new ToolStatusHandler(chatUI);
  }

  handleToolStatus(data) {
    return this.toolStatusHandler.handleToolStatus(data);
  }

  handleIncomingMessage(message) {
    return routeIncomingMessage(
      { chatUI: this.chatUI, toolStatusHandler: this.toolStatusHandler },
      message,
    );
  }
}

export default MessageHandler;

