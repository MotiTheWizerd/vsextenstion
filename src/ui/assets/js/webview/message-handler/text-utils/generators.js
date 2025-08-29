// Generators for various category-specific messages and mixed summaries

export function generateDiagnosticMessage(categoryData, hasMultiple, totalCount) {
  let diagnosticCount = 0;
  let fileCount = 0;

  (categoryData?.results || []).forEach((result) => {
    if (result && result.ok && typeof result.output === "string") {
      const lines = result.output.split("\n").filter((line) => line.trim());
      diagnosticCount += lines.length;
      const files = new Set();
      lines.forEach((line) => {
        if (line.includes("/") || line.includes("\\")) {
          const parts = line.split(":");
          if (parts.length > 0) files.add(parts[0]);
        }
      });
      fileCount += files.size;
    }
  });

  if (hasMultiple) {
    if (diagnosticCount > 0) {
      return `Analyzed ${diagnosticCount} diagnostic${diagnosticCount > 1 ? "s" : ""} + ${
        totalCount - (categoryData?.count || 0)
      } other operation${totalCount - (categoryData?.count || 0) > 1 ? "s" : ""}`;
    }
    return `Analyzed diagnostics + ${
      totalCount - (categoryData?.count || 0)
    } other operation${totalCount - (categoryData?.count || 0) > 1 ? "s" : ""}`;
  }
  if (diagnosticCount > 0) {
    return `Analyzed ${diagnosticCount} diagnostic${diagnosticCount > 1 ? "s" : ""} across ${fileCount} file${fileCount > 1 ? "s" : ""}`;
  }
  return `Analyzed diagnostics (no issues found)`;
}

export function generateFileModificationMessage(categoryData, hasMultiple, totalCount) {
  const fileCount = categoryData?.count || 0;
  const modifiedFiles = [];
  (categoryData?.results || []).forEach((result) => {
    if (result && result.ok && Array.isArray(result.args) && result.args.length > 0) {
      const filePath = result.args[0];
      const fileName = String(filePath).split(/[\/\\]/).pop() || filePath;
      modifiedFiles.push(fileName);
    }
  });

  if (modifiedFiles.length === 0) {
    return hasMultiple
      ? `Modified ${fileCount} file${fileCount > 1 ? "s" : ""} + ${totalCount - fileCount} other operation${totalCount - fileCount > 1 ? "s" : ""}`
      : `Modified ${fileCount} file${fileCount > 1 ? "s" : ""}`;
  }

  if (modifiedFiles.length === 1) {
    const message = `${modifiedFiles[0]} was modified`;
    return hasMultiple
      ? `${message} + ${totalCount - fileCount} other operation${totalCount - fileCount > 1 ? "s" : ""}`
      : message;
  }
  const firstFile = modifiedFiles[0];
  const remainingCount = modifiedFiles.length - 1;
  const message = `${firstFile} was modified and ${remainingCount}+ other${remainingCount > 1 ? "s" : ""}`;
  return hasMultiple
    ? `${message} + ${totalCount - fileCount} other operation${totalCount - fileCount > 1 ? "s" : ""}`
    : message;
}

export function generateFileReadingMessage(categoryData, hasMultiple, totalCount) {
  let totalLines = 0;
  const fileCount = categoryData?.count || 0;
  (categoryData?.results || []).forEach((result) => {
    if (result && result.ok && typeof result.output === "string") {
      const lines = result.output.split("\n").filter((line) => line.trim());
      totalLines += lines.length;
    }
  });
  if (hasMultiple) {
    return `Read ${fileCount} file${fileCount > 1 ? "s" : ""} + ${
      totalCount - fileCount
    } other operation${totalCount - fileCount > 1 ? "s" : ""}`;
  }
  if (totalLines > 0) {
    return `Read ${fileCount} file${fileCount > 1 ? "s" : ""} (${totalLines} lines total)`;
  }
  return `Read ${fileCount} file${fileCount > 1 ? "s" : ""}`;
}

export function generateSearchMessage(categoryData, hasMultiple, totalCount) {
  let totalMatches = 0;
  let totalFiles = 0;
  (categoryData?.results || []).forEach((result) => {
    if (result && result.ok && typeof result.output === "string") {
      const lines = result.output.split("\n").filter((line) => line.trim());
      const matches = lines.filter(
        (line) => line.includes(":") && (line.includes("/") || line.includes("\\")),
      );
      totalMatches += matches.length;
      const files = new Set();
      matches.forEach((match) => {
        const parts = match.split(":");
        if (parts.length > 0) files.add(parts[0]);
      });
      totalFiles += files.size;
    }
  });
  if (hasMultiple) {
    if (totalMatches > 0) {
      return `Found ${totalMatches} match${totalMatches > 1 ? "es" : ""} + ${
        totalCount - (categoryData?.count || 0)
      } other operation${totalCount - (categoryData?.count || 0) > 1 ? "s" : ""}`;
    }
    return `Searched codebase + ${
      totalCount - (categoryData?.count || 0)
    } other operation${totalCount - (categoryData?.count || 0) > 1 ? "s" : ""}`;
  }
  if (totalMatches > 0) {
    return `Found ${totalMatches} match${totalMatches > 1 ? "es" : ""} across ${totalFiles} file${totalFiles > 1 ? "s" : ""}`;
  }
  return `Searched codebase (no matches)`;
}

export function generateListingMessage(categoryData, hasMultiple, totalCount) {
  const dirCount = categoryData?.count || 0;
  let dirName = "";
  const firstResult = (categoryData?.results || [])[0];
  if (firstResult && Array.isArray(firstResult.args) && firstResult.args.length > 0) {
    const dirPath = firstResult.args[0] || ".";
    dirName = dirPath === "." ? "current directory" : String(dirPath).split(/[\/\\]/).pop() || dirPath;
  }
  if (hasMultiple) {
    return `Listed ${dirCount} director${dirCount > 1 ? "ies" : "y"} + ${
      totalCount - dirCount
    } other operation${totalCount - dirCount > 1 ? "s" : ""}`;
  }
  if (dirName) {
    return `Listed ${dirName}`;
  }
  return `Listed ${dirCount} director${dirCount > 1 ? "ies" : "y"}`;
}

export function generateIndexingMessage(categoryData, hasMultiple, totalCount) {
  if (hasMultiple) {
    return `index update + ${
      totalCount - (categoryData?.count || 0)
    } other operation${totalCount - (categoryData?.count || 0) > 1 ? "s" : ""}`;
  }
  return `index update`;
}

export function generateMixedMessage(categories, totalCount) {
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
        ? `${categoryData.count} diagnostic${
            categoryData.count > 1 ? "s" : ""
          } + ${totalCount - categoryData.count} other${
            totalCount - categoryData.count > 1 ? "s" : ""
          }`
        : `${categoryData.count} diagnostic${
            categoryData.count > 1 ? "s" : ""
          }`;
    case "fileModification":
      return hasMultipleCategories
        ? `${categoryData.count} file modification${
            categoryData.count > 1 ? "s" : ""
          } + ${totalCount - categoryData.count} other${
            totalCount - categoryData.count > 1 ? "s" : ""
          }`
        : `${categoryData.count} file${categoryData.count > 1 ? "s" : ""}`;
    case "fileReading":
      return hasMultipleCategories
        ? `${categoryData.count} file read${
            categoryData.count > 1 ? "s" : ""
          } + ${totalCount - categoryData.count} other${
            totalCount - categoryData.count > 1 ? "s" : ""
          }`
        : `${categoryData.count} file${categoryData.count > 1 ? "s" : ""}`;
    case "search":
      return hasMultipleCategories
        ? `${categoryData.count} search${
            categoryData.count > 1 ? "es" : ""
          } + ${totalCount - categoryData.count} other${
            totalCount - categoryData.count > 1 ? "s" : ""
          }`
        : `${categoryData.count} search${categoryData.count > 1 ? "es" : ""}`;
    case "listing":
      return hasMultipleCategories
        ? `${categoryData.count} listing${
            categoryData.count > 1 ? "s" : ""
          } + ${totalCount - categoryData.count} other${
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

