// Barrel exports: keep external import path stable
export { categorizeCommands } from "./text-utils/categorize.js";
export { getStartingIcon, getCommandIcon } from "./text-utils/icons.js";
export { countFilesInResults, shouldHaveFileResults } from "./text-utils/file-heuristics.js";
export {
  generateDiagnosticMessage,
  generateFileModificationMessage,
  generateFileReadingMessage,
  generateSearchMessage,
  generateListingMessage,
  generateIndexingMessage,
  generateMixedMessage,
} from "./text-utils/generators.js";
export { generateSpecificMessage, generateCategoryMessage } from "./text-utils/category-message.js";
export { getBatchDescription } from "./text-utils/batch.js";
export { getCompletionText } from "./text-utils/completion.js";
export { getDetailedCompletionMessage } from "./text-utils/detailed-completion.js";
