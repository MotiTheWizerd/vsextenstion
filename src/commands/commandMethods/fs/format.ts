import { FileEntry } from './types';

export function formatFileList(entries: FileEntry[]): string {
  return entries
    .map(entry => {
      const typeIcon = entry.type === 'directory' ? '📁' : '📄';
      const size = entry.size !== undefined ? ` (${formatFileSize(entry.size)})` : '';
      const modified = entry.modified ? ` - ${entry.modified.toLocaleString()}` : '';
      return `${typeIcon} ${entry.name}${size}${modified}`;
    })
    .join('\n');
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
