export type FileReadOptions = {
  autoAnalyze?: boolean;
  encoding?: BufferEncoding;
  startLine?: number;
  endLine?: number;
};

export const DEFAULT_READ_OPTIONS: FileReadOptions = {
  autoAnalyze: true,
  encoding: "utf-8",
};

export interface FileListingOptions {
  showHidden?: boolean;
  recursive?: boolean; // reserved for future, not used yet (kept for compatibility)
  maxDepth?: number; // reserved for future, not used yet (kept for compatibility)
}

export interface FileEntry {
  name: string;
  path: string;
  type: "file" | "directory" | "symbolic-link" | "other";
  size?: number;
  modified?: Date;
}

export type WriteOptions = {
  createDirs?: boolean;
  encoding?: BufferEncoding;
};

export type MoveOptions = {
  overwrite?: boolean;
  createDirs?: boolean;
};

export type RemoveOptions = {
  recursive?: boolean;
};

export type ReplaceOptions = {
  encoding?: BufferEncoding;
  isRegex?: boolean;
  multiline?: boolean;
  caseInsensitive?: boolean;
  global?: boolean;
};

export type GlobOptions = {
  ignore?: string[];
  limit?: number;
  includeDirs?: boolean;
};
