import * as path from 'path';

// 🧠 Decision logic: When should Ray auto-analyze?
export function shouldAutoAnalyze(filename: string, content: string): boolean {
  // Skip empty files
  if (!content.trim()) {
    return false;
  }

  const ext = path.extname(filename).toLowerCase();
  const fileSize = content.length;
  const maxFileSize = 100 * 1024; // 100KB max file size for auto-analysis

  // Skip large files
  if (fileSize > maxFileSize) {
    return false;
  }

  // Only analyze certain file types
  const supportedExtensions = [
    '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp',
    '.go', '.rb', '.php', '.cs', '.swift', '.kt', '.rs', '.dart', '.lua', '.sh'
  ];

  return supportedExtensions.includes(ext);
}
