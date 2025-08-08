import * as vscode from 'vscode';
import { config } from './config';

export async function showLogs(command: string = ''): Promise<string> {
  try {
    // In a real implementation, this would read from a log file
    // For now, we'll return a simple log message
    const timestamp = new Date().toISOString();
    return `[${timestamp}] RayDaemon logs for command: ${command}\n` +
           `[${timestamp}] Log level: ${config.logLevel}\n` +
           `[${timestamp}] Server URL: ${config.apiEndpoint}\n` +
           `[${timestamp}] Logs functionality will be implemented here`;
  } catch (error) {
    console.error('[RayDaemon] Error showing logs:', error);
    throw error;
  }
}

export function logDebug(message: string, ...args: any[]): void {
  if (config.logLevel === 'debug') {
    console.debug(`[RayDaemon][DEBUG] ${message}`, ...args);
  }
}

export function logInfo(message: string, ...args: any[]): void {
  console.info(`[RayDaemon][INFO] ${message}`, ...args);
}

export function logWarning(message: string, ...args: any[]): void {
  console.warn(`[RayDaemon][WARN] ${message}`, ...args);
}

export function logError(message: string, ...args: any[]): void {
  console.error(`[RayDaemon][ERROR] ${message}`, ...args);
  
  // Show error to user if in development mode
  if (config.environment === 'development') {
    vscode.window.showErrorMessage(`RayDaemon Error: ${message}`);
  }
}
