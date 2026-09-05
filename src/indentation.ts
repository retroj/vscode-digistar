
import * as vscode from 'vscode';

export async function command_digistarScriptIndentLine (): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (! editor) {
        return;
    }
    const document = editor.document;
    const selection = editor.selection;
    const lineText = document.lineAt(selection.active.line).text;

    const re = /^\s*([0-9+:.]*)\s*(.*)/;
    const match = re.exec(lineText);

    if (match) {
        const ts = match[1];
        const rest = match[2];
        const replacement = ts + '\t' + rest;

        await editor.edit(editBuilder => {
            const range = document.lineAt(selection.active.line).range;
            editBuilder.replace(range, replacement);
        });
    }
}
