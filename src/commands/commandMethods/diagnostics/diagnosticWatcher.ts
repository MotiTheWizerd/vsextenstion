import * as vscode from 'vscode';
import * as path from 'path';
import { minimatch } from 'minimatch';
import { DiagnosticChangeEvent, WatcherOptions } from './types';

/**
 * Diagnostic change watcher that tracks changes to diagnostics
 */
export class DiagnosticWatcher {
  private disposable: vscode.Disposable | null = null;
  private previousDiagnostics = new Map<string, vscode.Diagnostic[]>();
  private changeHandlers: ((event: DiagnosticChangeEvent) => void)[] = [];
  private options: WatcherOptions = {};
  private debounceTimer: NodeJS.Timeout | null = null;

  /**
   * Start watching for diagnostic changes
   */
  start(options: WatcherOptions = {}): void {
    if (this.disposable) {
      return; // Already started
    }

    this.options = { debounceMs: 100, ...options };

    // Initialize with current diagnostics
    this.updatePreviousDiagnostics();

    // Listen for changes
    this.disposable = vscode.languages.onDidChangeDiagnostics((event) => {
      this.handleDiagnosticChange(event);
    });
  }

  /**
   * Stop watching for diagnostic changes
   */
  stop(): void {
    if (this.disposable) {
      this.disposable.dispose();
      this.disposable = null;
    }
    
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    
    this.previousDiagnostics.clear();
    this.changeHandlers = [];
    this.options = {};
  }

  /**
   * Add a handler for diagnostic changes
   */
  onDidChangeDiagnostics(handler: (event: DiagnosticChangeEvent) => void): vscode.Disposable {
    this.changeHandlers.push(handler);
    
    return new vscode.Disposable(() => {
      const index = this.changeHandlers.indexOf(handler);
      if (index >= 0) {
        this.changeHandlers.splice(index, 1);
      }
    });
  }

  /**
   * Get current diagnostic change statistics
   */
  getChangeStats(): {
    watchedFiles: number;
    totalHandlers: number;
    isActive: boolean;
    debounceMs: number;
    activeFilters: {
      severity?: string[];
      filePattern?: string;
    };
  } {
    const severityNames = this.options.severity?.map(s => {
      switch (s) {
        case vscode.DiagnosticSeverity.Error: return 'error';
        case vscode.DiagnosticSeverity.Warning: return 'warning';
        case vscode.DiagnosticSeverity.Information: return 'info';
        case vscode.DiagnosticSeverity.Hint: return 'hint';
        default: return 'unknown';
      }
    });

    return {
      watchedFiles: this.previousDiagnostics.size,
      totalHandlers: this.changeHandlers.length,
      isActive: this.disposable !== null,
      debounceMs: this.options.debounceMs || 100,
      activeFilters: {
        severity: severityNames,
        filePattern: this.options.filePattern
      }
    };
  }

  /**
   * Take a single snapshot diff (useful for CI)
   */
  async takeSnapshot(): Promise<DiagnosticChangeEvent[]> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return [];
    }

    const allDiagnostics = vscode.languages.getDiagnostics();
    const changes: DiagnosticChangeEvent[] = [];

    for (const [uri, currentDiagnostics] of allDiagnostics) {
      const uriString = uri.toString();
      const previousDiagnostics = this.previousDiagnostics.get(uriString) || [];
      
      // Apply filters
      if (!this.shouldProcessUri(uri)) {
        continue;
      }

      const filteredCurrent = this.filterDiagnostics(currentDiagnostics);
      const filteredPrevious = this.filterDiagnostics(previousDiagnostics);
      
      // Calculate changes
      const added = this.findAddedDiagnostics(filteredPrevious, filteredCurrent);
      const removed = this.findRemovedDiagnostics(filteredPrevious, filteredCurrent);
      
      // Only include if there are actual changes
      if (added.length > 0 || removed.length > 0) {
        const relativePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
        
        changes.push({
          uri: uriString,
          relativePath,
          added,
          removed,
          current: filteredCurrent
        });
      }
    }

    // Update previous diagnostics for next snapshot
    this.updatePreviousDiagnostics();

    return changes;
  }

  private updatePreviousDiagnostics(): void {
    const allDiagnostics = vscode.languages.getDiagnostics();
    this.previousDiagnostics.clear();
    
    for (const [uri, diagnostics] of allDiagnostics) {
      this.previousDiagnostics.set(uri.toString(), [...diagnostics]);
    }
  }

  private handleDiagnosticChange(event: vscode.DiagnosticChangeEvent): void {
    // Debounce rapid changes
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.processChanges(event);
    }, this.options.debounceMs || 100);
  }

  private processChanges(event: vscode.DiagnosticChangeEvent): void {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return;
    }

    for (const uri of event.uris) {
      if (!this.shouldProcessUri(uri)) {
        continue;
      }

      const uriString = uri.toString();
      const currentDiagnostics = vscode.languages.getDiagnostics(uri);
      const previousDiagnostics = this.previousDiagnostics.get(uriString) || [];
      
      const filteredCurrent = this.filterDiagnostics(currentDiagnostics);
      const filteredPrevious = this.filterDiagnostics(previousDiagnostics);
      
      // Calculate changes
      const added = this.findAddedDiagnostics(filteredPrevious, filteredCurrent);
      const removed = this.findRemovedDiagnostics(filteredPrevious, filteredCurrent);
      
      // Only notify if there are actual changes
      if (added.length > 0 || removed.length > 0) {
        const relativePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
        
        const changeEvent: DiagnosticChangeEvent = {
          uri: uriString,
          relativePath,
          added,
          removed,
          current: filteredCurrent
        };

        // Notify all handlers
        for (const handler of this.changeHandlers) {
          try {
            handler(changeEvent);
          } catch (error) {
            console.error('Error in diagnostic change handler:', error);
          }
        }
      }

      // Update previous diagnostics
      this.previousDiagnostics.set(uriString, [...currentDiagnostics]);
    }
  }

  private shouldProcessUri(uri: vscode.Uri): boolean {
    if (!this.options.filePattern) {
      return true;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return false;
    }

    const relativePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
    return minimatch(relativePath, this.options.filePattern, { matchBase: true });
  }

  private filterDiagnostics(diagnostics: vscode.Diagnostic[]): vscode.Diagnostic[] {
    if (!this.options.severity || this.options.severity.length === 0) {
      return diagnostics;
    }

    return diagnostics.filter(d => this.options.severity!.includes(d.severity));
  }

  private findAddedDiagnostics(previous: vscode.Diagnostic[], current: vscode.Diagnostic[]): vscode.Diagnostic[] {
    return current.filter(curr => 
      !previous.some(prev => this.diagnosticsEqual(prev, curr))
    );
  }

  private findRemovedDiagnostics(previous: vscode.Diagnostic[], current: vscode.Diagnostic[]): vscode.Diagnostic[] {
    return previous.filter(prev => 
      !current.some(curr => this.diagnosticsEqual(prev, curr))
    );
  }

  private diagnosticsEqual(a: vscode.Diagnostic, b: vscode.Diagnostic): boolean {
    return (
      a.message === b.message &&
      a.severity === b.severity &&
      a.range.start.line === b.range.start.line &&
      a.range.start.character === b.range.start.character &&
      a.range.end.line === b.range.end.line &&
      a.range.end.character === b.range.end.character &&
      a.source === b.source &&
      a.code === b.code
    );
  }
}

// Global watcher instance
let globalWatcher: DiagnosticWatcher | null = null;

/**
 * Get or create the global diagnostic watcher
 */
export function getGlobalDiagnosticWatcher(): DiagnosticWatcher {
  if (!globalWatcher) {
    globalWatcher = new DiagnosticWatcher();
  }
  return globalWatcher;
}

/**
 * Dispose the global diagnostic watcher
 */
export function disposeGlobalDiagnosticWatcher(): void {
  if (globalWatcher) {
    globalWatcher.stop();
    globalWatcher = null;
  }
}