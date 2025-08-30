// DOM logging utilities for message handling

export function logToolStatusElements(chatUI) {
  try {
    console.group("[Webview] Tool Status Elements in DOM");

    // 1) Log elements tracked via data-tool-id (used by tool status rendering)
    const elements = chatUI?.chatMessages
      ? chatUI.chatMessages.querySelectorAll("[data-tool-id]")
      : document.querySelectorAll("[data-tool-id]");
    console.log(`Found ${elements.length} tool status elements in DOM:`);
    elements.forEach((el, i) => {
      const id = el.getAttribute("data-tool-id") || "(none)";
      const cls = el.className || "";
      const text = (el.textContent || "").substring(0, 50);
      console.log(`  [${i}] ${id} - ${cls} - ${text}...`);
    });

    // 2) Log containers/messages (legacy/detailed logging)
    const toolStatusContainers = document.querySelectorAll(
      ".tool-status-container",
    );
    console.log(`Found ${toolStatusContainers.length} tool status containers`);
    toolStatusContainers.forEach((container, index) => {
      console.group(`Container #${index + 1}`);
      console.log("ID:", container.id);
      console.log(
        "Status:",
        container.getAttribute("data-status") || "none",
      );
      console.log("Tool:", container.getAttribute("data-tool") || "none");
      console.log("HTML:", container.outerHTML);
      console.groupEnd();
    });

    const toolMessages = document.querySelectorAll(".tool-message");
    console.log(`Found ${toolMessages.length} tool messages`);
    toolMessages.forEach((msg, index) => {
      console.group(`Message #${index + 1}`);
      console.log("Class:", msg.className);
      console.log(
        "Data Status:",
        msg.getAttribute("data-status") || "none",
      );
      const inner = msg.innerText || "";
      console.log(
        "Inner Text:",
        inner.substring(0, 100) + (inner.length > 100 ? "..." : ""),
      );
      console.groupEnd();
    });
  } catch (e) {
    console.warn("[Webview] Failed to log tool status elements", e);
  } finally {
    console.groupEnd();
  }
}

