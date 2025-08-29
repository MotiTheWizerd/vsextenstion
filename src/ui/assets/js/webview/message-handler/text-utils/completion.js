export function getCompletionText(tools = [], resultCount = 1) {
  if (!tools || tools.length === 0) {
    return "Task completed";
  }
  const toolTypes = tools.map((tool) => String(tool).toLowerCase());
  if (toolTypes.some((t) => t.includes("search"))) return "Searched codebase";
  if (toolTypes.some((t) => t.includes("read"))) return "Read file(s)";
  if (toolTypes.some((t) => t.includes("find") || t.includes("symbol"))) return "Found symbols";
  if (toolTypes.some((t) => t.includes("load") || t.includes("index"))) return "Updated index";
  if (toolTypes.some((t) => t.includes("list"))) return "Listed directory";
  if (toolTypes.some((t) => t.includes("open"))) return "Opened file(s)";
  if (toolTypes.some((t) => t.includes("write"))) return "Modified file(s)";
  return "Analyzed codebase";
}

