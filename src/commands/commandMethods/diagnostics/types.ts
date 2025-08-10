import * as vscode from 'vscode';

export interface DiagnosticInfo {
  uri: string;
  relativePath: string;
  diagnostics: vscode.Diagnostic[];
}

export interface DiagnosticSummary {
  totalFiles: number;
  totalDiagnostics: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  hintCount: number;
  files: DiagnosticInfo[];
}

export interface DiagnosticOptions {
  severity?: vscode.DiagnosticSeverity[];
  includeSource?: boolean;
  maxFiles?: number;
  maxPerFile?: number;
  filePattern?: string;
  isGlob?: boolean;
}

export interface DiagnosticChangeEvent {
  uri: string;
  relativePath: string;
  added: vscode.Diagnostic[];
  removed: vscode.Diagnostic[];
  current: vscode.Diagnostic[];
}

export interface DiagnosticFormatOptions {
  includeSource?: boolean;
  maxFilesToShow?: number;
  maxPerFile?: number;
  showSummaryOnly?: boolean;
  json?: boolean;
  noEmoji?: boolean;
  groupBy?: 'severity' | 'folder' | 'none';
  sortBy?: 'severity' | 'path' | 'count';
}

export interface WatcherOptions {
  severity?: vscode.DiagnosticSeverity[];
  filePattern?: string;
  debounceMs?: number;
}