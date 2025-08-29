export function categorizeCommands(tools = [], results = []) {
  const categories = {
    diagnostic: { count: 0, tools: [], results: [] },
    fileModification: { count: 0, tools: [], results: [] },
    fileReading: { count: 0, tools: [], results: [] },
    search: { count: 0, tools: [], results: [] },
    listing: { count: 0, tools: [], results: [] },
    indexing: { count: 0, tools: [], results: [] },
    other: { count: 0, tools: [], results: [] },
  };

  try {
    tools.forEach((tool, index) => {
      const toolLower = String(tool || "").toLowerCase();
      const result = results[index];

      if (
        toolLower === "getalldiagnostics" ||
        toolLower === "getfilediagnostics" ||
        toolLower.includes("diagnostic")
      ) {
        categories.diagnostic.count++;
        categories.diagnostic.tools.push(tool);
        categories.diagnostic.results.push(result);
      } else if (
        toolLower === "write" ||
        toolLower === "append" ||
        toolLower === "replace" ||
        toolLower.startsWith("writing ") ||
        toolLower.startsWith("modifying ")
      ) {
        categories.fileModification.count++;
        categories.fileModification.tools.push(tool);
        categories.fileModification.results.push(result);
      } else if (
        toolLower === "read" ||
        toolLower === "open" ||
        toolLower.startsWith("reading ")
      ) {
        categories.fileReading.count++;
        categories.fileReading.tools.push(tool);
        categories.fileReading.results.push(result);
      } else if (
        toolLower.includes("search") ||
        toolLower.includes("find") ||
        toolLower.includes("grep")
      ) {
        categories.search.count++;
        categories.search.tools.push(tool);
        categories.search.results.push(result);
      } else if (
        toolLower === "ls" ||
        toolLower === "list" ||
        toolLower.startsWith("listing ")
      ) {
        categories.listing.count++;
        categories.listing.tools.push(tool);
        categories.listing.results.push(result);
      } else if (
        toolLower === "loadindex" ||
        toolLower === "createindex" ||
        toolLower === "updateindex" ||
        (toolLower.includes("index") &&
          (toolLower.includes("load") ||
            toolLower.includes("create") ||
            toolLower.includes("update")))
      ) {
        categories.indexing.count++;
        categories.indexing.tools.push(tool);
        categories.indexing.results.push(result);
      } else {
        categories.other.count++;
        categories.other.tools.push(tool);
        categories.other.results.push(result);
      }
    });
  } catch (e) {}

  return categories;
}

