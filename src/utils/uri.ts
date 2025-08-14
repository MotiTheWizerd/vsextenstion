import * as vscode from 'vscode';

/**
 * Safely convert a string into a vscode.Uri.
 * If the string looks like a URI (has a scheme), use Uri.parse.
 * Otherwise fall back to Uri.file so Windows paths like C:\... work.
 */
export function safeUriFromString(s: string): vscode.Uri {
  try {
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s)) {
      return vscode.Uri.parse(s);
    }
    return vscode.Uri.file(s);
  } catch (err) {
    return vscode.Uri.file(s);
  }
}
