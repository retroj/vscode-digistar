
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
    const match = lineText.match(/^(\s*?)([0-9+:.]*)(\s*)(.*?)\s*$/);
    if (match) {
        const ts = match[2];
        const rest = match[4];
        // Cursor Motion:
        //  - if we're in the "rest" part, then we need to back up the cursor
        //    by the number of characters removed.
        //  - if we're after the timestamp, we should leave the cursor at the
        //    start of the rest.
        const ts_end = match[1].length + ts.length;
        const rest_begin = ts_end + match[3].length;
        let new_char_position = selection.active.character;
        if (selection.active.character >= rest_begin) {
            const leading_chars_removed = rest_begin - (ts.length + 1);
            new_char_position -= leading_chars_removed;
        } else if (selection.active.character >= ts_end) {
            new_char_position = ts.length + 1;
        }
        if (new_char_position != selection.active.character) {
            const newPosition = new vscode.Position(selection.active.line, new_char_position);
            editor.selection = new vscode.Selection(newPosition, newPosition);
        }
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
    const match = lineText.match(/^\s*[0-9+:.]*\s*/);
    let insertText: string;
    // if we are looking at a tab or a timestamp, do not insert a tab
    if ((match && selection.active.character < match[0].length) ||
        indentNewLine == "never")
    {
        insertText = '\n';
    } else if (indentNewLine == "always") {
        insertText = '\n\t';
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

async function digistarPlayScript (filePath: string): Promise<void> {
    if (! digistarExecutablePath) {
        vscode.window.showWarningMessage('Cannot play script. Digistar executable was not found.');
        return;
    }
    const child: ChildProcess = spawn(digistarExecutablePath, ['-p', filePath], {
        detached: true,
        stdio: 'ignore'
    });
    child.unref();
}

export async function command_digistarPlayScript (): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (! editor) {
        return;
    }
    const re = /^[a-z]:\\(?:d\d|cx)content\\/i;
    const filePath = editor.document.uri.fsPath.replace(re, "$Content\\");
    await digistarPlayScript(filePath);
}

let vscode_digistar_extensionUri: vscode.Uri;

export async function command_digistarFadeStopReset (): Promise<void> {
    const fadestopreset_ds_path = vscode.Uri.joinPath(vscode_digistar_extensionUri, 'resources',
        'scripts', 'fadestopreset.ds').fsPath;
    await digistarPlayScript(fadestopreset_ds_path);
}

export function activate_commands (context: vscode.ExtensionContext) {
    vscode_digistar_extensionUri = context.extensionUri;
    context.subscriptions.push(
        vscode.commands.registerCommand('digistar.indentLine', command_digistarScriptIndentLine));
    context.subscriptions.push(
        vscode.commands.registerCommand('digistar.indentLineAndEnter', command_digistarIndentLineAndEnter));
    context.subscriptions.push(
        vscode.commands.registerCommand('digistar.playScript', command_digistarPlayScript));
    context.subscriptions.push(
        vscode.commands.registerCommand('digistar.fadestopreset', command_digistarFadeStopReset));
}