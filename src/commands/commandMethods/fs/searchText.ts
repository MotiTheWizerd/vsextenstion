import * as vscode from 'vscode';
import * as path from 'path';
import { promises as fs } from 'fs';
import { FileOperationError } from './errors';
import { findByExtension, EXTENSION_GROUPS } from './findByExtension';
import { expandExtensions } from '../../handlers/utils';

export interface TextSearchResult {
  filePath: string;
  relativePath: string;
  matches: TextMatch[];
  totalMatches: number;
}

export interface TextMatch {
  line: number;
  column: number;
  text: string;
  context: {
    before: string;
    match: string;
    after: string;
  };
}

export interface SearchTextOptions {
  extensions?: string | string[];
  caseSensitive?: boolean;
  wholeWord?: boolean;
  maxResults?: number;
  maxMatches?: number;
  contextLines?: number;
  includeHidden?: boolean;
  excludePatterns?: string[];
}

/**
 * Plain text search across the workspace
 */
export async function searchText(
  query: string,
  searchPath: string = '.',
  options: SearchTextOptions = {}
): Promise<TextSearchResult[]> {
  const {
    extensions = 'code',
    caseSensitive = false,
    wholeWord = false,
    maxResults = 1000,
    maxMatches = 100,
    contextLines = 1,
    includeHidden = false,
    excludePatterns = ['node_modules', '.git', 'dist', 'build', '.next', '.nuxt']
  } = options;

  try {
    if (!query || query.trim().length === 0) {
      throw new FileOperationError('No search query provided', 'EINVAL');
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

    // Prepare search parameters
    const searchFlags = caseSensitive ? 'g' : 'gi';
    let searchRegex: RegExp;

    if (wholeWord) {
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      searchRegex = new RegExp(`\\b${escapedQuery}\\b`, searchFlags);
    } else {
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      searchRegex = new RegExp(escapedQuery, searchFlags);
    }

    const results: TextSearchResult[] = [];
    let totalResults = 0;

    // Search in batches to avoid overwhelming the system
    const batchSize = 20;
    for (let i = 0; i < filteredFiles.length && totalResults < maxResults; i += batchSize) {
      const batch = filteredFiles.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (file) => {
        try {
          const content = await fs.readFile(file.path, 'utf-8');
          const lines = content.split('\n');
          const matches: TextMatch[] = [];

          for (let lineIndex = 0; lineIndex < lines.length && matches.length < maxMatches; lineIndex++) {
            const line = lines[lineIndex];
            const lineMatches = Array.from(line.matchAll(searchRegex));

            for (const match of lineMatches) {
              if (matches.length >= maxMatches) {break;}

              const column = match.index || 0;
              const matchText = match[0];

              // Extract context
              const contextStart = Math.max(0, lineIndex - contextLines);
              const contextEnd = Math.min(lines.length - 1, lineIndex + contextLines);
              
              const beforeContext = lines.slice(contextStart, lineIndex).join('\n');
              const afterContext = lines.slice(lineIndex + 1, contextEnd + 1).join('\n');

              // Extract match context within the line
              const beforeMatch = line.substring(0, column);
              const afterMatch = line.substring(column + matchText.length);

              matches.push({
                line: lineIndex,
                column,
                text: line,
                context: {
                  before: contextLines > 0 ? beforeContext : beforeMatch,
                  match: matchText,
                  after: contextLines > 0 ? afterContext : afterMatch
                }
              });
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
      const validResults = batchResults.filter((result): result is TextSearchResult => result !== null);
      
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
      `Unexpected error searching text: ${error instanceof Error ? error.message : String(error)}`,
      'EUNKNOWN',
      query
    );
  }
}

/**
 * Format text search results for display
 */
export function formatTextSearchResults(
  results: TextSearchResult[], 
  query: string,
  options: { showContext?: boolean; maxContextLength?: number; groupByFile?: boolean } = {}
): string {
  const { showContext = true, maxContextLength = 100, groupByFile = true } = options;

  if (results.length === 0) {
    return JSON.stringify({
      type: 'searchResults',
      query,
      totalMatches: 0,
      totalFiles: 0,
      files: []
    }, null, 2);
  }

  const totalMatches = results.reduce((sum, result) => sum + result.totalMatches, 0);
  
  // Create structured data
  const structuredData = {
    type: 'searchResults',
    query,
    totalMatches,
    totalFiles: results.length,
    files: results.map(result => ({
      name: result.relativePath.split(/[/\\]/).pop() || result.relativePath,
      path: result.filePath,
      relativePath: result.relativePath,
      matchCount: result.totalMatches,
      icon: '📄',
      matches: result.matches.map(match => ({
        line: match.line + 1, // Convert to 1-based line numbers
        column: match.column + 1, // Convert to 1-based column numbers
        text: match.context.match,
        contextBefore: showContext ? (
          match.context.before.length > maxContextLength 
            ? '...' + match.context.before.slice(-maxContextLength)
            : match.context.before
        ) : '',
        contextAfter: showContext ? (
          match.context.after.length > maxContextLength
            ? match.context.after.slice(0, maxContextLength) + '...'
            : match.context.after
        ) : ''
      }))
    }))
  };

  return JSON.stringify(structuredData, null, 2);
}