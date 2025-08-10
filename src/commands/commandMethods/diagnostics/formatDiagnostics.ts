import * as vscode from 'vscode';
import * as path from 'path';
import { DiagnosticInfo, DiagnosticSummary, DiagnosticFormatOptions } from './types';

/**
 * Get severity icon for display
 */
function getSeverityIcon(severity: vscode.DiagnosticSeverity, noEmoji = false): string {
  if (noEmoji) {
    switch (severity) {
      case vscode.DiagnosticSeverity.Error:
        return '[E]';
      case vscode.DiagnosticSeverity.Warning:
        return '[W]';
      case vscode.DiagnosticSeverity.Information:
        return '[I]';
      case vscode.DiagnosticSeverity.Hint:
        return '[H]';
      default:
        return '[?]';
    }
  }

  switch (severity) {
    case vscode.DiagnosticSeverity.Error:
      return '❌';
    case vscode.DiagnosticSeverity.Warning:
      return '⚠️';
    case vscode.DiagnosticSeverity.Information:
      return 'ℹ️';
    case vscode.DiagnosticSeverity.Hint:
      return '💡';
    default:
      return '❓';
  }
}

/**
 * Get severity name for display
 */
function getSeverityName(severity: vscode.DiagnosticSeverity): string {
  switch (severity) {
    case vscode.DiagnosticSeverity.Error:
      return 'Error';
    case vscode.DiagnosticSeverity.Warning:
      return 'Warning';
    case vscode.DiagnosticSeverity.Information:
      return 'Info';
    case vscode.DiagnosticSeverity.Hint:
      return 'Hint';
    default:
      return 'Unknown';
  }
}

/**
 * Get severity sort order
 */
function getSeverityOrder(severity: vscode.DiagnosticSeverity): number {
  switch (severity) {
    case vscode.DiagnosticSeverity.Error:
      return 0;
    case vscode.DiagnosticSeverity.Warning:
      return 1;
    case vscode.DiagnosticSeverity.Information:
      return 2;
    case vscode.DiagnosticSeverity.Hint:
      return 3;
    default:
      return 4;
  }
}

/**
 * Truncate long messages
 */
function truncateMessage(message: string, maxLength = 100): string {
  if (message.length <= maxLength) {
    return message;
  }
  return message.substring(0, maxLength - 3) + '...';
}

/**
 * Format a single diagnostic for display
 */
export function formatDiagnostic(diagnostic: vscode.Diagnostic, options: DiagnosticFormatOptions = {}): string {
  const { includeSource = true, noEmoji = false, json = false } = options;
  
  const icon = getSeverityIcon(diagnostic.severity, noEmoji);
  const severityName = getSeverityName(diagnostic.severity);
  const line = diagnostic.range.start.line + 1;
  const char = diagnostic.range.start.character + 1;
  const location = `${line}:${char}`;
  
  let message = json ? diagnostic.message : truncateMessage(diagnostic.message);
  
  let result = `${icon} [${severityName}] ${message} (${location})`;
  
  if (includeSource && diagnostic.source) {
    result += ` [${diagnostic.source}]`;
  }
  
  if (diagnostic.code) {
    const code = typeof diagnostic.code === 'object' ? diagnostic.code.value : diagnostic.code;
    result += ` (${code})`;
  }
  
  return result;
}

/**
 * Get file diagnostic counts
 */
function getFileCounts(diagnostics: vscode.Diagnostic[]): { errors: number; warnings: number; info: number; hints: number } {
  const counts = { errors: 0, warnings: 0, info: 0, hints: 0 };
  
  for (const diagnostic of diagnostics) {
    switch (diagnostic.severity) {
      case vscode.DiagnosticSeverity.Error:
        counts.errors++;
        break;
      case vscode.DiagnosticSeverity.Warning:
        counts.warnings++;
        break;
      case vscode.DiagnosticSeverity.Information:
        counts.info++;
        break;
      case vscode.DiagnosticSeverity.Hint:
        counts.hints++;
        break;
    }
  }
  
  return counts;
}

/**
 * Format diagnostics for a single file
 */
export function formatFileDiagnostics(fileInfo: DiagnosticInfo, options: DiagnosticFormatOptions = {}): string {
  const { includeSource = true, noEmoji = false, maxPerFile = 100 } = options;
  
  const counts = getFileCounts(fileInfo.diagnostics);
  const diagnosticsToShow = fileInfo.diagnostics.slice(0, maxPerFile);
  
  const lines: string[] = [];
  
  // File header with badges
  const errorBadge = counts.errors > 0 ? `${getSeverityIcon(vscode.DiagnosticSeverity.Error, noEmoji)}${counts.errors}` : '';
  const warningBadge = counts.warnings > 0 ? `${getSeverityIcon(vscode.DiagnosticSeverity.Warning, noEmoji)}${counts.warnings}` : '';
  const infoBadge = counts.info > 0 ? `${getSeverityIcon(vscode.DiagnosticSeverity.Information, noEmoji)}${counts.info}` : '';
  const hintBadge = counts.hints > 0 ? `${getSeverityIcon(vscode.DiagnosticSeverity.Hint, noEmoji)}${counts.hints}` : '';
  
  const badges = [errorBadge, warningBadge, infoBadge, hintBadge].filter(b => b).join(' ');
  const fileIcon = noEmoji ? '[F]' : '📄';
  
  lines.push(`${fileIcon} \`${fileInfo.relativePath}\` — ${badges}`);
  
  for (const diagnostic of diagnosticsToShow) {
    lines.push(`   ${formatDiagnostic(diagnostic, options)}`);
  }
  
  if (fileInfo.diagnostics.length > maxPerFile) {
    const remaining = fileInfo.diagnostics.length - maxPerFile;
    lines.push(`   ... and ${remaining} more issues`);
  }
  
  return lines.join('\n');
}

/**
 * Sort files based on options
 */
function sortFiles(files: DiagnosticInfo[], sortBy: string): DiagnosticInfo[] {
  switch (sortBy) {
    case 'severity':
      return [...files].sort((a, b) => {
        const aMinSeverity = Math.min(...a.diagnostics.map(d => getSeverityOrder(d.severity)));
        const bMinSeverity = Math.min(...b.diagnostics.map(d => getSeverityOrder(d.severity)));
        return aMinSeverity - bMinSeverity;
      });
    case 'path':
      return [...files].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    case 'count':
      return [...files].sort((a, b) => b.diagnostics.length - a.diagnostics.length);
    default:
      return files;
  }
}

/**
 * Group files based on options
 */
function groupFiles(files: DiagnosticInfo[], groupBy: string): { [key: string]: DiagnosticInfo[] } {
  if (groupBy === 'none') {
    return { 'All Files': files };
  }
  
  const groups: { [key: string]: DiagnosticInfo[] } = {};
  
  for (const file of files) {
    let groupKey: string;
    
    if (groupBy === 'severity') {
      const minSeverity = Math.min(...file.diagnostics.map(d => getSeverityOrder(d.severity)));
      groupKey = getSeverityName(minSeverity as vscode.DiagnosticSeverity);
    } else if (groupBy === 'folder') {
      const dir = path.dirname(file.relativePath);
      groupKey = dir === '.' ? 'Root' : dir;
    } else {
      groupKey = 'All Files';
    }
    
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(file);
  }
  
  return groups;
}

/**
 * Format diagnostic summary with all files
 */
export function formatDiagnosticSummary(summary: DiagnosticSummary, options: DiagnosticFormatOptions = {}): string {
  const {
    includeSource = true,
    maxFilesToShow = 20,
    maxPerFile = 100,
    showSummaryOnly = false,
    noEmoji = false,
    groupBy = 'none',
    sortBy = 'severity',
    json = false
  } = options;

  if (json) {
    return JSON.stringify(summary, null, 2);
  }

  const lines: string[] = [];
  const searchIcon = noEmoji ? '[S]' : '🔍';
  const statsIcon = noEmoji ? '[#]' : '📊';
  
  // Summary header
  lines.push(`${searchIcon} **Diagnostic Summary**`);
  lines.push('');
  lines.push(`${statsIcon} **Total:** ${summary.totalDiagnostics} issues in ${summary.totalFiles} files`);
  lines.push(`${getSeverityIcon(vscode.DiagnosticSeverity.Error, noEmoji)} **Errors:** ${summary.errorCount}`);
  lines.push(`${getSeverityIcon(vscode.DiagnosticSeverity.Warning, noEmoji)} **Warnings:** ${summary.warningCount}`);
  lines.push(`${getSeverityIcon(vscode.DiagnosticSeverity.Information, noEmoji)} **Info:** ${summary.infoCount}`);
  lines.push(`${getSeverityIcon(vscode.DiagnosticSeverity.Hint, noEmoji)} **Hints:** ${summary.hintCount}`);
  
  if (showSummaryOnly) {
    return lines.join('\n');
  }
  
  if (summary.files.length === 0) {
    lines.push('');
    const checkIcon = noEmoji ? '[✓]' : '✅';
    lines.push(`${checkIcon} **Great job! No issues found in your workspace.**`);
    return lines.join('\n');
  }
  
  lines.push('');
  const detailsIcon = noEmoji ? '[D]' : '📋';
  lines.push(`${detailsIcon} **Details:**`);
  lines.push('');
  
  // Sort and group files
  const sortedFiles = sortFiles(summary.files, sortBy);
  const groupedFiles = groupFiles(sortedFiles, groupBy);
  
  let filesShown = 0;
  
  for (const [groupName, groupFiles] of Object.entries(groupedFiles)) {
    if (groupBy !== 'none') {
      lines.push(`**${groupName}:**`);
      lines.push('');
    }
    
    for (const fileInfo of groupFiles) {
      if (filesShown >= maxFilesToShow) {
        break;
      }
      
      lines.push(formatFileDiagnostics(fileInfo, { ...options, maxPerFile }));
      lines.push('');
      filesShown++;
    }
    
    if (filesShown >= maxFilesToShow) {
      break;
    }
  }
  
  if (summary.files.length > maxFilesToShow) {
    const remaining = summary.files.length - maxFilesToShow;
    lines.push(`... and ${remaining} more files with issues`);
  }
  
  return lines.join('\n');
}

/**
 * Format diagnostics in a compact list format
 */
export function formatDiagnosticsCompact(summary: DiagnosticSummary, options: DiagnosticFormatOptions = {}): string {
  const { noEmoji = false, json = false } = options;
  
  if (json) {
    const compactData = summary.files.flatMap(file => 
      file.diagnostics.map(diagnostic => ({
        file: file.relativePath,
        line: diagnostic.range.start.line + 1,
        character: diagnostic.range.start.character + 1,
        severity: getSeverityName(diagnostic.severity).toLowerCase(),
        message: diagnostic.message,
        source: diagnostic.source,
        code: diagnostic.code
      }))
    );
    return JSON.stringify(compactData, null, 2);
  }

  const lines: string[] = [];
  const searchIcon = noEmoji ? '[S]' : '🔍';
  
  lines.push(`${searchIcon} Found ${summary.totalDiagnostics} issues in ${summary.totalFiles} files`);
  
  if (summary.files.length === 0) {
    const checkIcon = noEmoji ? '[✓]' : '✅';
    return `${checkIcon} No issues found!`;
  }
  
  for (const fileInfo of summary.files) {
    for (const diagnostic of fileInfo.diagnostics) {
      const icon = getSeverityIcon(diagnostic.severity, noEmoji);
      const line = diagnostic.range.start.line + 1;
      const char = diagnostic.range.start.character + 1;
      const message = truncateMessage(diagnostic.message);
      lines.push(`${icon} \`${fileInfo.relativePath}:${line}:${char}\` - ${message}`);
    }
  }
  
  return lines.join('\n');
}