import * as vscode from 'vscode';
import { WebviewRegistry } from './ui/webview-registry';

declare global {
  // Extend the global namespace to include our panel reference
  interface Global {
    currentPanel?: vscode.WebviewPanel;
  }
}

export async function sendAutonomousMessage(message: string): Promise<void> {
  const panel = WebviewRegistry.getPreferred();
  if (!panel) {
    console.log('[RayDaemon] No active panel to send message to');
    return;
  }
  
  try {
    await panel.webview.postMessage({
      type: 'autonomous_message',
      content: message,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[RayDaemon] Error sending autonomous message:', error);
  }
}

export async function sendRayLoopMessage(content: string): Promise<void> {
  const panel = WebviewRegistry.getPreferred();
  if (!panel) {
    console.log('[RayDaemon] No active panel to send Ray loop message to');
    return;
  }
  
  try {
    await panel.webview.postMessage({
      type: 'ray_loop_message',
      content: content,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[RayDaemon] Error sending Ray loop message:', error);
  }
}
