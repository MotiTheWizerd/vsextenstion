// Export all diagnostic functionality
export * from './types';
export * from './getDiagnostics';
export * from './formatDiagnostics';
export * from './diagnosticWatcher';

// Re-export commonly used VS Code diagnostic types for convenience
export { DiagnosticSeverity, Diagnostic, Uri, Range, Position } from 'vscode';