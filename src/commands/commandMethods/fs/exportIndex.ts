import * as vscode from 'vscode';
import * as path from 'path';
import { promises as fs } from 'fs';
import { FileOperationError } from './errors';
import { WorkspaceIndex } from './createIndex';

export interface ExportIndexOptions {
  format?: 'json' | 'csv' | 'markdown' | 'html';
  compress?: boolean;
  includeSymbols?: boolean;
  includeFileInfo?: boolean;
  minify?: boolean;
  splitByExtension?: boolean;
}

export interface ExportResult {
  outputPath: string;
  format: string; // Allow any string for compressed/split formats
  size: number;
  filesExported: number;
  symbolsExported: number;
}

/**
 * Write index to disk in various formats for reuse
 */
export async function exportIndex(
  index: WorkspaceIndex,
  outputPath: string,
  options: ExportIndexOptions = {}
): Promise<ExportResult> {
  const {
    format = 'json',
    compress = false,
    includeSymbols = true,
    includeFileInfo = true,
    minify = false,
    splitByExtension = false
  } = options;

  try {
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });

    let exportedContent: string;
    let actualOutputPath = outputPath;
    let filesExported = 0;
    let symbolsExported = 0;

    // Filter index based on options
    const filteredIndex = filterIndex(index, { includeSymbols, includeFileInfo });
    filesExported = filteredIndex.files.length;
    symbolsExported = filteredIndex.metadata.totalSymbols;

    switch (format) {
      case 'json':
        if (splitByExtension) {
          const result = await exportJsonByExtension(filteredIndex, outputPath, { minify, compress });
          return result;
        } else {
          exportedContent = minify 
            ? JSON.stringify(filteredIndex)
            : JSON.stringify(filteredIndex, null, 2);
        }
        break;

      case 'csv':
        exportedContent = exportToCsv(filteredIndex);
        actualOutputPath = replaceOrAddExtension(outputPath, '.csv');
        break;

      case 'markdown':
        exportedContent = exportToMarkdown(filteredIndex);
        actualOutputPath = replaceOrAddExtension(outputPath, '.md');
        break;

      case 'html':
        exportedContent = exportToHtml(filteredIndex);
        actualOutputPath = replaceOrAddExtension(outputPath, '.html');
        break;

      default:
        throw new FileOperationError(`Unsupported export format: ${format}`, 'EINVAL');
    }

    // Write to file
    let finalFormat: string = format;
    if (compress && format === 'json') {
      // Use gzip compression for JSON
      const zlib = await import('zlib');
      const compressed = zlib.gzipSync(exportedContent);
      await fs.writeFile(actualOutputPath + '.gz', compressed);
      actualOutputPath += '.gz';
      finalFormat = 'json.gz';
    } else {
      await fs.writeFile(actualOutputPath, exportedContent, 'utf-8');
    }

    const stats = await fs.stat(actualOutputPath);

    return {
      outputPath: actualOutputPath,
      format: finalFormat,
      size: stats.size,
      filesExported,
      symbolsExported
    };

  } catch (error) {
    if (error instanceof FileOperationError) {
      throw error;
    }
    throw new FileOperationError(
      `Failed to export index: ${error instanceof Error ? error.message : String(error)}`,
      'EWRITE',
      outputPath
    );
  }
}

/**
 * Replace or add file extension
 */
function replaceOrAddExtension(filePath: string, newExt: string): string {
  const currentExt = path.extname(filePath);
  if (currentExt) {
    return filePath.replace(/\.[^.]+$/, newExt);
  } else {
    return filePath + newExt;
  }
}

/**
 * Escape CSV content to prevent injection and parsing issues
 */
function escapeCsvContent(content: string): string {
  // Prevent formula injection
  if (content.match(/^[=+\-@]/)) {
    content = "'" + content;
  }
  
  // Escape quotes and wrap in quotes if contains special chars
  if (content.includes('"') || content.includes(',') || content.includes('\n')) {
    content = '"' + content.replace(/"/g, '""') + '"';
  }
  
  return content;
}

/**
 * Escape HTML content
 */
function escapeHtml(content: string): string {
  return content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Filter index based on export options
 */
function filterIndex(
  index: WorkspaceIndex, 
  options: { includeSymbols: boolean; includeFileInfo: boolean }
): WorkspaceIndex {
  const { includeSymbols, includeFileInfo } = options;

  const filteredFiles = index.files.map(file => {
    const result = { ...file };
    
    if (!includeSymbols) {
      result.symbols = [];
      result.symbolCount = 0;
    }
    
    if (!includeFileInfo) {
      result.fileInfo = {
        extension: file.fileInfo.extension,
        basename: file.fileInfo.basename,
        directory: file.fileInfo.directory,
        size: 0,
        modified: ''
      };
    }
    
    return result;
  });

  return {
    ...index,
    files: filteredFiles,
    metadata: {
      ...index.metadata,
      totalSymbols: includeSymbols ? index.metadata.totalSymbols : 0
    }
  };
}

/**
 * Export JSON split by file extension
 */
async function exportJsonByExtension(
  index: WorkspaceIndex,
  basePath: string,
  options: { minify: boolean; compress: boolean }
): Promise<ExportResult> {
  const { minify, compress } = options;
  
  // Group files by extension
  const filesByExtension = new Map<string, typeof index.files>();
  
  for (const file of index.files) {
    const ext = file.fileInfo.extension || 'no-extension';
    if (!filesByExtension.has(ext)) {
      filesByExtension.set(ext, []);
    }
    filesByExtension.get(ext)!.push(file);
  }

  const baseDir = path.dirname(basePath);
  const baseName = path.basename(basePath, path.extname(basePath));
  
  let totalSize = 0;
  const outputPaths: string[] = [];

  // Export main index file
  const mainIndex = {
    ...index,
    files: [], // Remove files from main index
    extensions: Array.from(filesByExtension.keys())
  };

  const mainContent = minify 
    ? JSON.stringify(mainIndex)
    : JSON.stringify(mainIndex, null, 2);
  
  const mainPath = path.join(baseDir, `${baseName}.json`);
  
  if (compress) {
    const zlib = await import('zlib');
    const compressed = zlib.gzipSync(mainContent);
    await fs.writeFile(mainPath + '.gz', compressed);
    outputPaths.push(mainPath + '.gz');
    totalSize += (await fs.stat(mainPath + '.gz')).size;
  } else {
    await fs.writeFile(mainPath, mainContent, 'utf-8');
    outputPaths.push(mainPath);
    totalSize += (await fs.stat(mainPath)).size;
  }

  // Export files by extension
  for (const [ext, files] of filesByExtension) {
    const extIndex = {
      metadata: {
        ...index.metadata,
        totalFiles: files.length,
        totalSymbols: files.reduce((sum, file) => sum + file.symbolCount, 0)
      },
      files,
      extension: ext
    };

    const extContent = minify 
      ? JSON.stringify(extIndex)
      : JSON.stringify(extIndex, null, 2);
    
    const extPath = path.join(baseDir, `${baseName}_${ext.replace('.', '')}.json`);
    
    if (compress) {
      const zlib = await import('zlib');
      const compressed = zlib.gzipSync(extContent);
      await fs.writeFile(extPath + '.gz', compressed);
      outputPaths.push(extPath + '.gz');
      totalSize += (await fs.stat(extPath + '.gz')).size;
    } else {
      await fs.writeFile(extPath, extContent, 'utf-8');
      outputPaths.push(extPath);
      totalSize += (await fs.stat(extPath)).size;
    }
  }

  const finalFormat = compress ? 'json-split.gz' : 'json-split';
  
  return {
    outputPath: outputPaths.join(', '),
    format: finalFormat,
    size: totalSize,
    filesExported: index.files.length,
    symbolsExported: index.metadata.totalSymbols
  };
}

/**
 * Export to CSV format
 */
function exportToCsv(index: WorkspaceIndex): string {
  const lines: string[] = [];
  
  // CSV Header
  lines.push('FilePath,RelativePath,Extension,Size,Modified,SymbolCount,SymbolKinds,Errors');
  
  for (const file of index.files) {
    // Normalize symbol kinds to strings and escape
    const symbolKinds = [...new Set(file.symbols.map(s => 
      typeof s.kind === 'string' ? s.kind : String(s.kind)
    ))].join(';');
    const errors = file.errors ? file.errors.join(';') : '';
    
    const row = [
      escapeCsvContent(file.filePath),
      escapeCsvContent(file.relativePath),
      escapeCsvContent(file.fileInfo.extension),
      file.fileInfo.size.toString(),
      escapeCsvContent(file.fileInfo.modified),
      file.symbolCount.toString(),
      escapeCsvContent(symbolKinds),
      escapeCsvContent(errors)
    ].join(',');
    
    lines.push(row);
  }
  
  return lines.join('\n');
}

/**
 * Export to Markdown format
 */
function exportToMarkdown(index: WorkspaceIndex): string {
  const lines: string[] = [];
  
  lines.push(`# Workspace Index: ${index.metadata.workspaceName}`);
  lines.push('');
  lines.push(`**Created:** ${new Date(index.metadata.createdAt).toLocaleString()}`);
  lines.push(`**Total Files:** ${index.metadata.totalFiles}`);
  lines.push(`**Total Symbols:** ${index.metadata.totalSymbols}`);
  lines.push('');

  // Summary tables
  lines.push('## Files by Extension');
  lines.push('');
  lines.push('| Extension | Count |');
  lines.push('|-----------|-------|');
  
  const sortedExtensions = Object.entries(index.summary.filesByExtension)
    .sort(([,a], [,b]) => b - a);
  
  for (const [ext, count] of sortedExtensions) {
    lines.push(`| ${ext} | ${count} |`);
  }
  lines.push('');

  lines.push('## Symbols by Kind');
  lines.push('');
  lines.push('| Symbol Kind | Count |');
  lines.push('|-------------|-------|');
  
  const sortedSymbols = Object.entries(index.summary.symbolsByKind)
    .sort(([,a], [,b]) => b - a);
  
  for (const [kind, count] of sortedSymbols) {
    lines.push(`| ${kind} | ${count} |`);
  }
  lines.push('');

  // File details
  lines.push('## File Details');
  lines.push('');
  
  for (const file of index.files.slice(0, 100)) { // Limit for readability
    lines.push(`### ${file.relativePath}`);
    lines.push('');
    lines.push(`- **Size:** ${Math.round(file.fileInfo.size / 1024)} KB`);
    lines.push(`- **Modified:** ${new Date(file.fileInfo.modified).toLocaleString()}`);
    lines.push(`- **Symbols:** ${file.symbolCount}`);
    
    if (file.symbols.length > 0) {
      lines.push('- **Symbol Types:** ' + [...new Set(file.symbols.map(s => s.kind))].join(', '));
    }
    
    if (file.errors && file.errors.length > 0) {
      lines.push('- **Errors:** ' + file.errors.join(', '));
    }
    
    lines.push('');
  }
  
  if (index.files.length > 100) {
    lines.push(`*... and ${index.files.length - 100} more files*`);
  }
  
  return lines.join('\n');
}

/**
 * Export to HTML format
 */
function exportToHtml(index: WorkspaceIndex): string {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Workspace Index: ${index.metadata.workspaceName}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; }
        .header { border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 30px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .stat-card { background: #f8f9fa; padding: 15px; border-radius: 8px; }
        .stat-number { font-size: 2em; font-weight: bold; color: #0066cc; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; font-weight: 600; }
        .file-list { max-height: 600px; overflow-y: auto; }
        .symbol-count { background: #e3f2fd; padding: 2px 8px; border-radius: 12px; font-size: 0.9em; }
        .error { color: #d32f2f; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Workspace Index: ${escapeHtml(index.metadata.workspaceName)}</h1>
        <p><strong>Created:</strong> ${escapeHtml(new Date(index.metadata.createdAt).toLocaleString())}</p>
    </div>

    <div class="stats">
        <div class="stat-card">
            <div class="stat-number">${index.metadata.totalFiles}</div>
            <div>Total Files</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${index.metadata.totalSymbols}</div>
            <div>Total Symbols</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${Object.keys(index.summary.filesByExtension).length}</div>
            <div>File Types</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${index.summary.errorFiles.length}</div>
            <div>Files with Errors</div>
        </div>
    </div>

    <h2>Files by Extension</h2>
    <table>
        <thead>
            <tr><th>Extension</th><th>Count</th><th>Percentage</th></tr>
        </thead>
        <tbody>
            ${Object.entries(index.summary.filesByExtension)
              .sort(([,a], [,b]) => b - a)
              .map(([ext, count]) => {
                const percentage = index.metadata.totalFiles === 0 ? '0.0' : ((count / index.metadata.totalFiles) * 100).toFixed(1);
                return `<tr><td>${escapeHtml(ext)}</td><td>${count}</td><td>${percentage}%</td></tr>`;
              }).join('')}
        </tbody>
    </table>

    <h2>Symbols by Kind</h2>
    <table>
        <thead>
            <tr><th>Symbol Kind</th><th>Count</th><th>Percentage</th></tr>
        </thead>
        <tbody>
            ${Object.entries(index.summary.symbolsByKind)
              .sort(([,a], [,b]) => b - a)
              .slice(0, 20)
              .map(([kind, count]) => {
                const percentage = index.metadata.totalSymbols === 0 ? '0.0' : ((count / index.metadata.totalSymbols) * 100).toFixed(1);
                return `<tr><td>${escapeHtml(kind)}</td><td>${count}</td><td>${percentage}%</td></tr>`;
              }).join('')}
        </tbody>
    </table>

    <h2>File Details</h2>
    <div class="file-list">
        <table>
            <thead>
                <tr><th>File</th><th>Size</th><th>Modified</th><th>Symbols</th><th>Status</th></tr>
            </thead>
            <tbody>
                ${index.files.slice(0, 200).map(file => {
                  const sizeKB = Math.round(file.fileInfo.size / 1024);
                  const modifiedDate = new Date(file.fileInfo.modified).toLocaleDateString();
                  const hasErrors = file.errors && file.errors.length > 0;
                  return `
                    <tr>
                        <td><code>${escapeHtml(file.relativePath)}</code></td>
                        <td>${sizeKB} KB</td>
                        <td>${escapeHtml(modifiedDate)}</td>
                        <td><span class="symbol-count">${file.symbolCount}</span></td>
                        <td>${hasErrors ? `<span class="error">⚠️ ${file.errors!.length} errors</span>` : '✅'}</td>
                    </tr>
                  `;
                }).join('')}
            </tbody>
        </table>
        ${index.files.length > 200 ? `<p><em>... and ${index.files.length - 200} more files</em></p>` : ''}
    </div>

    <script>
        // Add basic interactivity
        document.querySelectorAll('th').forEach(th => {
            th.style.cursor = 'pointer';
            th.addEventListener('click', () => {
                // Simple table sorting could be added here
                console.log('Sort by:', th.textContent);
            });
        });
    </script>
</body>
</html>`;

  return html;
}

/**
 * Format export result for display
 */
export function formatExportResult(result: ExportResult): string {
  const sizeKB = Math.round(result.size / 1024);
  const sizeMB = result.size > 1024 * 1024 ? ` (${(result.size / (1024 * 1024)).toFixed(1)} MB)` : '';
  
  return `✅ **Index exported successfully**

📁 **Output:** ${result.outputPath}
📊 **Format:** ${result.format}
📏 **Size:** ${sizeKB} KB${sizeMB}
📄 **Files:** ${result.filesExported}
🔧 **Symbols:** ${result.symbolsExported}`;
}