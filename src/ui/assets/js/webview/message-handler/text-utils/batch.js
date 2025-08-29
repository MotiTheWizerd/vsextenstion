import { categorizeCommands } from "./categorize.js";

export function getBatchDescription(tools = [], totalCount = 1) {
  const categories = categorizeCommands(tools, []);
  const primaryCategory = Object.entries(categories)
    .filter(([_, value]) => value.count > 0)
    .sort(([, a], [, b]) => b.count - a.count)[0];
  if (!primaryCategory) {
    return `${totalCount} operation${totalCount > 1 ? "s" : ""}`;
  }
  const [categoryName, categoryData] = primaryCategory;
  const hasMultipleCategories =
    Object.values(categories).filter((cat) => cat.count > 0).length > 1;
  switch (categoryName) {
    case "diagnostic":
      return hasMultipleCategories
        ? `${categoryData.count} diagnostics + ${totalCount - categoryData.count} other${
            totalCount - categoryData.count > 1 ? "s" : ""
          }`
        : `${categoryData.count} diagnostics`;
    case "fileModification":
      return hasMultipleCategories
        ? `${categoryData.count} file modifications + ${totalCount - categoryData.count} other${
            totalCount - categoryData.count > 1 ? "s" : ""
          }`
        : `${categoryData.count} file${categoryData.count > 1 ? "s" : ""}`;
    case "fileReading":
      return hasMultipleCategories
        ? `${categoryData.count} file reads + ${totalCount - categoryData.count} other${
            totalCount - categoryData.count > 1 ? "s" : ""
          }`
        : `${categoryData.count} file${categoryData.count > 1 ? "s" : ""}`;
    case "search":
      return hasMultipleCategories
        ? `${categoryData.count} searches + ${totalCount - categoryData.count} other${
            totalCount - categoryData.count > 1 ? "s" : ""
          }`
        : `${categoryData.count} search${categoryData.count > 1 ? "es" : ""}`;
    case "listing":
      return hasMultipleCategories
        ? `${categoryData.count} listings + ${totalCount - categoryData.count} other${
            totalCount - categoryData.count > 1 ? "s" : ""
          }`
        : `${categoryData.count} director${
            categoryData.count > 1 ? "ies" : "y"
          }`;
    case "indexing":
      return hasMultipleCategories
        ? `index update + ${totalCount - categoryData.count} other${
            totalCount - categoryData.count > 1 ? "s" : ""
          }`
        : `index update`;
    default:
      return `${totalCount} operation${totalCount > 1 ? "s" : ""}`;
  }
}

