import * as vscode from 'vscode';
import * as path from 'path';
import { minimatch } from 'minimatch';
import { DiagnosticInfo, DiagnosticSummary, DiagnosticOptions } from './types';

/**
 * Get all current diagnostics across the workspace
 */
export async function getAllDiagnostics(options: DiagnosticOptions = {}): Promise<DiagnosticSummary> {
  const {
    severity = [
      vscode.DiagnosticSeverity.Error,
      vscode.DiagnosticSeverity.Warning,
      vscode.DiagnosticSeverity.Information,
      vscode.DiagnosticSeverity.Hint
    ],
    maxFiles = 1000,
    maxPerFile = 100,
    filePattern,
    isGlob = true
  } = options;

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    throw new Error('No workspace folder open');
  }

  const allDiagnostics = vscode.languages.getDiagnostics();
  const files: DiagnosticInfo[] = [];
  let totalDiagnostics = 0;
  let errorCount = 0;
  let warningCount = 0;
  let infoCount = 0;
  let hintCount = 0;

  for (const [uri, diagnostics] of allDiagnostics) {
    if (diagnostics.length === 0) {
      continue;
    }

    const relativePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
    
    // Apply file pattern filter if specified
    if (filePattern) {
      const matches = isGlob 
        ? minimatch(relativePath, filePattern, { matchBase: true })
        : relativePath.includes(filePattern);
      
      if (!matches) {
        continue;
      }
    }

    // Filter diagnostics by severity
    const filteredDiagnostics = diagnostics
      .filter(d => severity.includes(d.severity))
      .slice(0, maxPerFile); // Limit per file

    if (filteredDiagnostics.length === 0) {
      continue;
    }

    // Count by severity
    for (const diagnostic of filteredDiagnostics) {
      totalDiagnostics++;
      switch (diagnostic.severity) {
        case vscode.DiagnosticSeverity.Error:
          errorCount++;
          break;
        case vscode.DiagnosticSeverity.Warning:
          warningCount++;
          break;
        case vscode.DiagnosticSeverity.Information:
          infoCount++;
          break;
        case vscode.DiagnosticSeverity.Hint:
          hintCount++;
          break;
      }
    }

    files.push({
      uri: uri.toString(),
      relativePath,
      diagnostics: filteredDiagnostics
    });

    // Respect max files limit
    if (files.length >= maxFiles) {
      break;
    }
  }

  return {
    totalFiles: files.length,
    totalDiagnostics,
    errorCount,
    warningCount,
    infoCount,
    hintCount,
    files
  };
}

/**
 * Get diagnostics for a specific file
 */
export async function getFileDiagnostics(filePath: string, options: DiagnosticOptions = {}): Promise<DiagnosticInfo | null> {
  const {
    severity = [
      vscode.DiagnosticSeverity.Error,
      vscode.DiagnosticSeverity.Warning,
      vscode.DiagnosticSeverity.Information,
      vscode.DiagnosticSeverity.Hint
    ],
    maxPerFile = 100
  } = options;

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    throw new Error('No workspace folder open');
  }

  let fileUri: vscode.Uri;
  
  // Handle both absolute and relative paths
  if (path.isAbsolute(filePath)) {
    fileUri = vscode.Uri.file(filePath);
  } else {
    fileUri = vscode.Uri.joinPath(workspaceFolder.uri, filePath);
  }

  const diagnostics = vscode.languages.getDiagnostics(fileUri);
  
  if (diagnostics.length === 0) {
    return null;
  }

  // Filter diagnostics by severity and limit
  const filteredDiagnostics = diagnostics
    .filter(d => severity.includes(d.severity))
    .slice(0, maxPerFile);

  if (filteredDiagnostics.length === 0) {
    return null;
  }

  const relativePath = path.relative(workspaceFolder.uri.fsPath, fileUri.fsPath);

  return {
    uri: fileUri.toString(),
    relativePath,
    diagnostics: filteredDiagnostics
  };
}

/**
 * Parse severity string into array of DiagnosticSeverity
 */
export function parseSeverityString(severityStr: string): vscode.DiagnosticSeverity[] {
  const severityMap: { [key: string]: vscode.DiagnosticSeverity } = {
    'error': vscode.DiagnosticSeverity.Error,
    'warning': vscode.DiagnosticSeverity.Warning,
    'info': vscode.DiagnosticSeverity.Information,
    'hint': vscode.DiagnosticSeverity.Hint
  };

  return severityStr
    .split(',')
    .map(s => s.trim().toLowerCase())
    .map(s => severityMap[s])
    .filter(s => s !== undefined);
}