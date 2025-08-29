import { countFilesInResults } from "./file-heuristics.js";
import {
  generateDiagnosticMessage,
  generateFileModificationMessage,
  generateFileReadingMessage,
  generateSearchMessage,
  generateListingMessage,
  generateIndexingMessage,
  generateMixedMessage,
} from "./generators.js";

export function generateSpecificMessage(categoryData, hasMultiple, totalCount) {
  if (!categoryData?.tools || categoryData.tools.length === 0) return null;
  const tools = categoryData.tools;
  const results = categoryData.results;
  const toolsLower = tools.map((t) => String(t).toLowerCase());

  if (toolsLower.some((t) => t.includes("codebase") && t.includes("index"))) {
    return hasMultiple
      ? `Updated codebase index + ${
          totalCount - (categoryData?.count || 0)
        } other operation${totalCount - (categoryData?.count || 0) > 1 ? "s" : ""}`
      : `Updated codebase index`;
  }
  if (toolsLower.some((t) => t.includes("analyzing") || t.includes("analyzed"))) {
    const fileCount = countFilesInResults(results);
    return hasMultiple
      ? `Analyzed ${fileCount} file${fileCount > 1 ? "s" : ""} + ${
          totalCount - (categoryData?.count || 0)
        } other operation${totalCount - (categoryData?.count || 0) > 1 ? "s" : ""}`
      : `Analyzed ${fileCount} file${fileCount > 1 ? "s" : ""}`;
  }
  if (toolsLower.some((t) => t.includes("reading") || t.includes("read"))) {
    const fileCount = countFilesInResults(results);
    return hasMultiple
      ? `Read ${fileCount} file${fileCount > 1 ? "s" : ""} + ${
          totalCount - (categoryData?.count || 0)
        } other operation${totalCount - (categoryData?.count || 0) > 1 ? "s" : ""}`
      : `Read ${fileCount} file${fileCount > 1 ? "s" : ""}`;
  }
  if (toolsLower.some((t) => t.includes("writing") || t.includes("modifying"))) {
    const fileCount = categoryData?.count || 0;
    return hasMultiple
      ? `Modified ${fileCount} file${fileCount > 1 ? "s" : ""} + ${
          totalCount - fileCount
        } other operation${totalCount - fileCount > 1 ? "s" : ""}`
      : `Modified ${fileCount} file${fileCount > 1 ? "s" : ""}`;
  }
  return null;
}

export function generateCategoryMessage(categories, successfulResults, totalCount) {
  const primaryCategory = Object.entries(categories)
    .filter(([_, value]) => value.count > 0)
    .sort(([, a], [, b]) => b.count - a.count)[0];
  if (!primaryCategory) {
    return `Completed ${totalCount} operation${totalCount > 1 ? "s" : ""}`;
  }
  const [categoryName, categoryData] = primaryCategory;
  const hasMultipleCategories =
    Object.values(categories).filter((cat) => cat.count > 0).length > 1;

  const specific = generateSpecificMessage(categoryData, hasMultipleCategories, totalCount);
  if (specific) return specific;

  switch (categoryName) {
    case "diagnostic":
      return generateDiagnosticMessage(categoryData, hasMultipleCategories, totalCount);
    case "fileModification":
      return generateFileModificationMessage(categoryData, hasMultipleCategories, totalCount);
    case "fileReading":
      return generateFileReadingMessage(categoryData, hasMultipleCategories, totalCount);
    case "search":
      return generateSearchMessage(categoryData, hasMultipleCategories, totalCount);
    case "listing":
      return generateListingMessage(categoryData, hasMultipleCategories, totalCount);
    case "indexing":
      return generateIndexingMessage(categoryData, hasMultipleCategories, totalCount);
    default:
      return generateMixedMessage(categories, totalCount);
  }
}

