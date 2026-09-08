
import * as vscode from 'vscode';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';

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
        if (replacement !== lineText) {
            await editor.edit(editBuilder => {
                const range = document.lineAt(selection.active.line).range;
                editBuilder.replace(range, replacement);
            });
        }
    }
}

export async function command_digistarIndentLineAndEnter (): Promise<void> {
    const config = vscode.workspace.getConfiguration('digistar');
    const indentNewLine = config.get('indentNewLine');
    await command_digistarScriptIndentLine();
    const editor = vscode.window.activeTextEditor;
    if (! editor) {
        return;
    }
    const document = editor.document;
    const selection = editor.selection;
    const lineText = document.lineAt(selection.active.line).text;
    const re = /\s+$/;
    const match = re.exec(lineText);
    if (match) {
        await editor.edit(editBuilder => {
            const range = new vscode.Range(
                selection.active.line,
                match.index,
                selection.active.line,
                lineText.length
            );
            editBuilder.delete(range);
        });
    }
    let insertText: string;
    if (indentNewLine == "always") {
        insertText = '\n\t';
    } else if (indentNewLine == "never") {
        insertText = '\n';
    } else {
        // "auto"
        const prevLineText = document.lineAt(selection.active.line).text;
        const prevLineMatch = /^\S/.exec(prevLineText);
        insertText = prevLineMatch ? '\n' : '\n\t';
    }
    await vscode.commands.executeCommand('type', { text: insertText });
}


/**
 * Finds the first path in a list that exists on the file system.
 * @param paths Array of file paths to check
 * @returns The first existing path string, or undefined if none exist
 */
function findFirstExistingPath(paths: string[]): string | undefined {
    return paths.find(filePath => fs.existsSync(filePath));
}

const digistarExecutablePath = findFirstExistingPath([
    "C:/CXSoftware/Apps/Digistar/Bin/UI/Digistar.exe",
    "C:/D7Software/Apps/Digistar/Bin/UI/Digistar.exe",
    "C:/D7Software/Bin/GUI/Digistar.exe",
    "C:/D6Software/Bin/GUI/Digistar.exe",
    "C:/D5Software/Bin/GUI/Digistar.exe"]);


export async function command_digistarPlayScript (): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (! editor) {
        return;
    }
    if (! digistarExecutablePath) {
        vscode.window.showWarningMessage('Cannot play script. Digistar executable was not found.');
        return;
    }
    const filePath: string = editor.document.uri.fsPath;
    const child: ChildProcess = spawn(digistarExecutablePath, ['-p', filePath], {
        detached: true,
        stdio: 'ignore'
    });
    child.unref();
}
