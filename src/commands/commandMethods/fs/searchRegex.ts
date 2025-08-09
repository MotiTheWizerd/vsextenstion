import * as vscode from 'vscode';
import * as path from 'path';
import { promises as fs } from 'fs';
import { FileOperationError } from './errors';
import { findByExtension } from './findByExtension';
import { expandExtensions } from '../../commandHandler';

export interface RegexSearchResult {
  filePath: string;
  relativePath: string;
  matches: RegexMatch[];
  totalMatches: number;
}

export interface RegexMatch {
  line: number;
  column: number;
  text: string;
  match: string;
  groups: string[];
  namedGroups: { [key: string]: string };
  context: {
    before: string;
    match: string;
    after: string;
  };
}

export interface SearchRegexOptions {
  extensions?: string | string[];
  flags?: string;
  maxResults?: number;
  maxMatches?: number;
  contextLines?: number;
  includeHidden?: boolean;
  excludePatterns?: string[];
  multiline?: boolean;
}

/**
 * Regex search across files with optional file filters
 */
export async function searchRegex(
  pattern: string,
  searchPath: string = '.',
  options: SearchRegexOptions = {}
): Promise<RegexSearchResult[]> {
  const {
    extensions = 'code',
    flags = 'g',
    maxResults = 1000,
    maxMatches = 100,
    contextLines = 1,
    includeHidden = false,
    excludePatterns = ['node_modules', '.git', 'dist', 'build', '.next', '.nuxt'],
    multiline = false
  } = options;

  try {
    if (!pattern || pattern.trim().length === 0) {
      throw new FileOperationError('No regex pattern provided', 'EINVAL');
    }

    // Validate regex pattern
    let searchRegex: RegExp;
    try {
      const regexFlags = multiline ? flags.includes('m') ? flags : flags + 'm' : flags;
      searchRegex = new RegExp(pattern, regexFlags);
    } catch (error) {
      throw new FileOperationError(
        `Invalid regex pattern: ${error instanceof Error ? error.message : String(error)}`,
        'EINVAL',
        pattern
      );
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new FileOperationError('No workspace folder open', 'ENOWORKSPACE');
    }

    // Expand extension groups
    const expandedExtensions = expandExtensions(extensions);

    // Find files to search
    const files = await findByExtension(expandedExtensions, searchPath, {
      showHidden: includeHidden,
      maxDepth: 20,
      caseSensitive: false
    });

    if (files.length === 0) {
      return [];
    }

    // Filter out excluded patterns
    const filteredFiles = files.filter(file => {
      const relativePath = path.relative(workspaceFolder.uri.fsPath, file.path);
      return !excludePatterns.some(pattern => 
        relativePath.includes(pattern) || 
        path.basename(file.path).includes(pattern)
      );
    });

    const results: RegexSearchResult[] = [];
    let totalResults = 0;

    // Search in batches to avoid overwhelming the system
    const batchSize = 20;
    for (let i = 0; i < filteredFiles.length && totalResults < maxResults; i += batchSize) {
      const batch = filteredFiles.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (file) => {
        try {
          const content = await fs.readFile(file.path, 'utf-8');
          const matches: RegexMatch[] = [];

          if (multiline) {
            // Multiline regex search
            const globalMatches = Array.from(content.matchAll(searchRegex));
            
            for (const match of globalMatches) {
              if (matches.length >= maxMatches) break;

              const matchStart = match.index || 0;
              const matchText = match[0];
              
              // Find line and column
              const beforeMatch = content.substring(0, matchStart);
              const line = beforeMatch.split('\n').length - 1;
              const column = beforeMatch.split('\n').pop()?.length || 0;
              
              // Extract line text
              const lines = content.split('\n');
              const lineText = lines[line] || '';
              
              // Extract context
              const contextStart = Math.max(0, line - contextLines);
              const contextEnd = Math.min(lines.length - 1, line + contextLines);
              
              const beforeContext = lines.slice(contextStart, line).join('\n');
              const afterContext = lines.slice(line + 1, contextEnd + 1).join('\n');

              matches.push({
                line,
                column,
                text: lineText,
                match: matchText,
                groups: match.slice(1),
                namedGroups: match.groups || {},
                context: {
                  before: beforeContext,
                  match: matchText,
                  after: afterContext
                }
              });
            }
          } else {
            // Line-by-line regex search
            const lines = content.split('\n');
            
            for (let lineIndex = 0; lineIndex < lines.length && matches.length < maxMatches; lineIndex++) {
              const line = lines[lineIndex];
              const lineMatches = Array.from(line.matchAll(searchRegex));

              for (const match of lineMatches) {
                if (matches.length >= maxMatches) break;

                const column = match.index || 0;
                const matchText = match[0];

                // Extract context
                const contextStart = Math.max(0, lineIndex - contextLines);
                const contextEnd = Math.min(lines.length - 1, lineIndex + contextLines);
                
                const beforeContext = lines.slice(contextStart, lineIndex).join('\n');
                const afterContext = lines.slice(lineIndex + 1, contextEnd + 1).join('\n');

                matches.push({
                  line: lineIndex,
                  column,
                  text: line,
                  match: matchText,
                  groups: match.slice(1),
                  namedGroups: match.groups || {},
                  context: {
                    before: beforeContext,
                    match: matchText,
                    after: afterContext
                  }
                });
              }
            }
          }

          if (matches.length > 0) {
            const relativePath = path.relative(workspaceFolder.uri.fsPath, file.path);
            return {
              filePath: file.path,
              relativePath,
              matches,
              totalMatches: matches.length
            };
          }

          return null;
        } catch (error) {
          // Log but don't fail for individual file errors
          console.warn(`[RayDaemon] Could not search in file ${file.path}:`, error);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      const validResults = batchResults.filter((result): result is RegexSearchResult => result !== null);
      
      results.push(...validResults);
      totalResults += validResults.length;

      // Add small delay between batches for better responsiveness
      if (i + batchSize < filteredFiles.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    // Sort results by relevance (more matches first, then by file path)
    results.sort((a, b) => {
      const matchDiff = b.totalMatches - a.totalMatches;
      return matchDiff !== 0 ? matchDiff : a.relativePath.localeCompare(b.relativePath);
    });

    return results.slice(0, maxResults);

  } catch (error) {
    if (error instanceof FileOperationError) {
      throw error;
    }
    throw new FileOperationError(
      `Unexpected error searching regex: ${error instanceof Error ? error.message : String(error)}`,
      'EUNKNOWN',
      pattern
    );
  }
}

/**
 * Format regex search results for display
 */
export function formatRegexSearchResults(
  results: RegexSearchResult[], 
  pattern: string,
  options: { 
    showContext?: boolean; 
    showGroups?: boolean;
    maxContextLength?: number; 
    groupByFile?: boolean 
  } = {}
): string {
  const { showContext = true, showGroups = true, maxContextLength = 100, groupByFile = true } = options;

  if (results.length === 0) {
    return `No matches found for regex pattern "${pattern}"`;
  }

  const totalMatches = results.reduce((sum, result) => sum + result.totalMatches, 0);
  const lines: string[] = [];
  
  lines.push(`🔍 **Found ${totalMatches} regex matches in ${results.length} files for pattern "${pattern}"**\n`);

  if (groupByFile) {
    // Group by file
    for (const result of results) {
      lines.push(`📁 **${result.relativePath}** (${result.totalMatches} matches)`);
      
      for (const match of result.matches) {
        const location = `${match.line + 1}:${match.column + 1}`;
        let contextDisplay = '';
        
        if (showContext) {
          const before = match.context.before.length > maxContextLength 
            ? '...' + match.context.before.slice(-maxContextLength)
            : match.context.before;
          const after = match.context.after.length > maxContextLength
            ? match.context.after.slice(0, maxContextLength) + '...'
            : match.context.after;
          
          contextDisplay = ` - \`${before}**${match.match}**${after}\``;
        }
        
        let groupsDisplay = '';
        if (showGroups && (match.groups.length > 0 || Object.keys(match.namedGroups).length > 0)) {
          const groupInfo: string[] = [];
          
          if (match.groups.length > 0) {
            groupInfo.push(`Groups: [${match.groups.map(g => `"${g}"`).join(', ')}]`);
          }
          
          if (Object.keys(match.namedGroups).length > 0) {
            const namedGroupsStr = Object.entries(match.namedGroups)
              .map(([name, value]) => `${name}:"${value}"`)
              .join(', ');
            groupInfo.push(`Named: {${namedGroupsStr}}`);
          }
          
          groupsDisplay = `\n      ${groupInfo.join(', ')}`;
        }
        
        lines.push(`   Line ${location}${contextDisplay}${groupsDisplay}`);
      }
      lines.push('');
    }
  } else {
    // Flat list of all matches
    const allMatches: Array<RegexMatch & { filePath: string; relativePath: string }> = [];
    
    for (const result of results) {
      for (const match of result.matches) {
        allMatches.push({
          ...match,
          filePath: result.filePath,
          relativePath: result.relativePath
        });
      }
    }

    for (const match of allMatches) {
      const location = `${match.relativePath}:${match.line + 1}:${match.column + 1}`;
      let contextDisplay = '';
      
      if (showContext) {
        const before = match.context.before.length > maxContextLength 
          ? '...' + match.context.before.slice(-maxContextLength)
          : match.context.before;
        const after = match.context.after.length > maxContextLength
          ? match.context.after.slice(0, maxContextLength) + '...'
          : match.context.after;
        
        contextDisplay = ` - \`${before}**${match.match}**${after}\``;
      }
      
      let groupsDisplay = '';
      if (showGroups && (match.groups.length > 0 || Object.keys(match.namedGroups).length > 0)) {
        const groupInfo: string[] = [];
        
        if (match.groups.length > 0) {
          groupInfo.push(`[${match.groups.join(', ')}]`);
        }
        
        if (Object.keys(match.namedGroups).length > 0) {
          const namedGroupsStr = Object.entries(match.namedGroups)
            .map(([name, value]) => `${name}:${value}`)
            .join(', ');
          groupInfo.push(`{${namedGroupsStr}}`);
        }
        
        groupsDisplay = ` ${groupInfo.join(' ')}`;
      }
      
      lines.push(`📍 ${location}${contextDisplay}${groupsDisplay}`);
    }
  }

  return lines.join('\n');
}