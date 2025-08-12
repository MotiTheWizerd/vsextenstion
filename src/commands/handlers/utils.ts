import { EXTENSION_GROUPS } from "../commandMethods/fs";

/**
 * Get icon for symbol kind
 */
export function getSymbolIcon(kind: string): string {
  const icons: { [key: string]: string } = {
    File: "📄",
    Module: "📦",
    Namespace: "🏷️",
    Package: "📦",
    Class: "🏛️",
    Method: "⚡",
    Property: "🔧",
    Field: "🔧",
    Constructor: "🏗️",
    Enum: "📋",
    Interface: "🔌",
    Function: "⚡",
    Variable: "📊",
    Constant: "🔒",
    String: "📝",
    Number: "🔢",
    Boolean: "✅",
    Array: "📚",
    Object: "📦",
    Key: "🔑",
    Null: "❌",
    EnumMember: "📋",
    Struct: "🏗️",
    Event: "⚡",
    Operator: "➕",
    TypeParameter: "🏷️",
  };

  return icons[kind] || "❓";
}

/**
 * Expand extension groups to actual extensions
 */
export function expandExtensions(
  extensions: string | string[]
): string | string[] {
  if (Array.isArray(extensions)) {
    return extensions;
  }

  // Check if it's a known extension group
  if (extensions in EXTENSION_GROUPS) {
    return EXTENSION_GROUPS[extensions as keyof typeof EXTENSION_GROUPS];
  }

  // Check if it's comma-separated extensions
  if (extensions.includes(",")) {
    return extensions.split(",").map((ext) => ext.trim());
  }

  // Return as-is (single extension)
  return extensions;
}
