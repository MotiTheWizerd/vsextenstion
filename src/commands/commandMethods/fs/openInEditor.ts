import * as vscode from 'vscode';
import { resolveWorkspacePath } from './pathResolver';
import * as path from 'path';

export type EditorOpenOptions = {
  preserveFocus?: boolean;
  preview?: boolean;
  selection?: { start: { line: number; character: number }, end?: { line: number; character: number } };
};

export async function openInEditor(filePath: string, options: EditorOpenOptions = {}): Promise<void> {
  const abs = resolveWorkspacePath(filePath);
  const uri = vscode.Uri.file(abs);

  const doc = await vscode.workspace.openTextDocument(uri);
  const editor = await vscode.window.showTextDocument(doc, {
    preserveFocus: options.preserveFocus ?? false,
    preview: options.preview ?? true,
  });

  if (options.selection) {
    const start = new vscode.Position(options.selection.start.line, options.selection.start.character);
    const end = options.selection.end
      ? new vscode.Position(options.selection.end.line, options.selection.end.character)
      : start;
    editor.selection = new vscode.Selection(start, end);
    editor.revealRange(new vscode.Range(start, end), vscode.TextEditorRevealType.InCenter);
  }
}
