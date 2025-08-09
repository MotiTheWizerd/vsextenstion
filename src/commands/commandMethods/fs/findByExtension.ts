import { promises as fs } from "fs";
import * as path from "path";
import { FileEntry } from "./types";
import { FileOperationError } from "./errors";
import { resolveWorkspacePath } from "./pathResolver";

export interface FindByExtensionOptions {
  showHidden?: boolean;
  maxDepth?: number;
  caseSensitive?: boolean;
}

/**
 * Find files by extension(s) with fast filtering
 * Supports multiple extensions and recursive search
 */
export async function findByExtension(
  extensions: string | string[],
  dirPath: string = ".",
  options: FindByExtensionOptions = {}
): Promise<FileEntry[]> {
  const { showHidden = false, maxDepth = 10, caseSensitive = false } = options;

  try {
    if (!extensions) {
      throw new FileOperationError("No extensions provided", "EINVAL");
    }

    // Normalize extensions to array and ensure they start with dot
    const extArray = Array.isArray(extensions) ? extensions : [extensions];
    const normalizedExts = extArray.map((ext) => {
      const normalized = ext.startsWith(".") ? ext : `.${ext}`;
      return caseSensitive ? normalized : normalized.toLowerCase();
    });

    const resolvedPath = resolveWorkspacePath(dirPath);

    // Verify directory exists
    const stats = await fs.stat(resolvedPath);
    if (!stats.isDirectory()) {
      throw new FileOperationError(
        `Path is not a directory: ${resolvedPath}`,
        "ENOTDIR",
        resolvedPath
      );
    }

    const result: FileEntry[] = [];

    // Recursive search function
    async function searchDirectory(
      currentPath: string,
      currentDepth: number
    ): Promise<void> {
      if (currentDepth > maxDepth) {
        return;
      }

      try {
        const dirents = await fs.readdir(currentPath, { withFileTypes: true });

        for (const entry of dirents) {
          if (!showHidden && entry.name.startsWith(".")) {
            continue;
          }

          const entryPath = path.join(currentPath, entry.name);

          if (entry.isDirectory()) {
            // Recurse into subdirectories
            await searchDirectory(entryPath, currentDepth + 1);
          } else if (entry.isFile()) {
            // Check if file matches any of the extensions
            const fileExt = path.extname(entry.name);
            const checkExt = caseSensitive ? fileExt : fileExt.toLowerCase();

            if (normalizedExts.includes(checkExt)) {
              try {
                const st = await fs.stat(entryPath);
                result.push({
                  name: entry.name,
                  path: entryPath,
                  type: "file",
                  size: st.size,
                  modified: st.mtime,
                });
              } catch (e) {
                console.warn(
                  `[RayDaemon] Could not get stats for ${entryPath}:`,
                  e
                );
                // Still add the file even if we can't get stats
                result.push({
                  name: entry.name,
                  path: entryPath,
                  type: "file",
                });
              }
            }
          }
        }
      } catch (error: any) {
        // Log but don't fail the entire search for permission errors
        if (error?.code !== "EACCES" && error?.code !== "EPERM") {
          console.warn(
            `[RayDaemon] Error reading directory ${currentPath}:`,
            error
          );
        }
      }
    }

    await searchDirectory(resolvedPath, 0);

    // Sort results by path for consistent output
    result.sort((a, b) => a.path.localeCompare(b.path));

    return result;
  } catch (error) {
    if (error instanceof FileOperationError) {
      throw error;
    }
    throw new FileOperationError(
      `Unexpected error finding files by extension: ${
        error instanceof Error ? error.message : String(error)
      }`,
      "EUNKNOWN",
      dirPath
    );
  }
}

// Predefined extension groups for common use cases
export const EXTENSION_GROUPS = {
  code: [
    ".js",
    ".ts",
    ".jsx",
    ".tsx",
    ".py",
    ".java",
    ".cpp",
    ".c",
    ".cs",
    ".php",
    ".rb",
    ".go",
    ".rs",
    ".swift",
    ".kt",
  ],
  web: [".html", ".css", ".scss", ".sass", ".less", ".vue", ".svelte"],
  docs: [".md", ".txt", ".doc", ".docx", ".pdf", ".rtf", ".odt"],
  config: [".json", ".yaml", ".yml", ".toml", ".ini", ".conf", ".config"],
  images: [".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp", ".bmp", ".ico"],
  media: [
    ".mp4",
    ".avi",
    ".mov",
    ".wmv",
    ".flv",
    ".webm",
    ".mp3",
    ".wav",
    ".flac",
    ".ogg",
  ],
  data: [".csv", ".xml", ".sql", ".db", ".sqlite", ".json", ".parquet"],
};
