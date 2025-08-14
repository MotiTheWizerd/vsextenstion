import { FileEntry } from './types';

export function formatFileList(entries: FileEntry[]): string {
  // For backward compatibility, return JSON string that can be parsed
  const structuredData = {
    type: 'fileList',
    files: entries.map(entry => ({
      name: entry.name,
      path: entry.path || entry.name,
      type: entry.type,
      size: entry.size,
      sizeFormatted: entry.size !== undefined ? formatFileSize(entry.size) : undefined,
      modified: entry.modified?.toISOString(),
      modifiedFormatted: entry.modified?.toLocaleString(),
      icon: entry.type === 'directory' ? '📁' : '📄'
    }))
  };
  
  return JSON.stringify(structuredData, null, 2);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
