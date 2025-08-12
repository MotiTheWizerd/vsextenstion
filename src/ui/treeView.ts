import * as vscode from 'vscode';
import { config } from '../../config';

export class RayDaemonTreeProvider implements vscode.TreeDataProvider<RayDaemonItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<RayDaemonItem | undefined | null> = 
    new vscode.EventEmitter<RayDaemonItem | undefined | null>();
  
  readonly onDidChangeTreeData: vscode.Event<RayDaemonItem | undefined | null> = 
    this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: RayDaemonItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: RayDaemonItem): Promise<RayDaemonItem[]> {
    if (element) {
      // Return children of the element if needed
      return [];
    }

    // Return empty array to show welcome view instead
    return [];
  }

  getUptime(): string {
    if (!this.startTime) {
      this.startTime = new Date();
    }
    const uptime = Math.floor((new Date().getTime() - this.startTime.getTime()) / 1000);
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = uptime % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  private startTime: Date = new Date();
}

export class RayDaemonItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly tooltip: string,
    commandId?: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.tooltip = tooltip;
    this.description = '';
    
    if (commandId) {
      this.command = {
        command: commandId,
        title: "Open Panel",
        arguments: [],
      };
    }
  }

  iconPath = new vscode.ThemeIcon('debug-start');
  contextValue = 'raydaemonItem';
}
