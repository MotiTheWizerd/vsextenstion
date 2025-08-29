import { categorizeCommands } from "./categorize.js";
import { generateCategoryMessage } from "./category-message.js";

export function getDetailedCompletionMessage(tools, results, totalCount) {
  if (!tools || tools.length === 0 || !results || results.length === 0) {
    return `Analyzed ${totalCount} task${totalCount > 1 ? "s" : ""}`;
  }
  const successfulResults = (results || []).filter((r) => r?.ok);
  const commandCategories = categorizeCommands(tools, results);
  return generateCategoryMessage(commandCategories, successfulResults, totalCount);
}

