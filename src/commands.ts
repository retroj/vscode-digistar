
import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';

import * as env from './environment';

export async function command_digistarScriptIndentLine (leaving: boolean = false): Promise<void> {
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
        let old_char_position = selection.active.character;
        let new_char_position = selection.active.character;
        if (old_char_position >= rest_begin) {
            const leading_chars_removed = rest_begin - (ts.length + 1);
            new_char_position -= leading_chars_removed;
        } else if (old_char_position >= ts_end) {
            new_char_position = ts.length + 1;
        }
        let maybe_tab = '\t';
        if (leaving && new_char_position == ts.length + 1) {
            new_char_position -= 1;
            maybe_tab = '';
        }
        if (new_char_position != old_char_position) {
            const newPosition = new vscode.Position(selection.active.line, new_char_position);
            editor.selection = new vscode.Selection(newPosition, newPosition);
        }
        const replacement = ts + maybe_tab + rest;
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
    await command_digistarScriptIndentLine(true);
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

async function digistarPlayScript (filePath: string): Promise<boolean> {
    if (! env.digistarExecutablePath) {
        vscode.window.showWarningMessage('Cannot play script. Digistar executable was not found.');
        return false;
    }
    spawn(env.digistarExecutablePath, ['-p', filePath], {
        detached: true,
        stdio: 'ignore'
    }).unref();
    return true;
}

export async function command_digistarPlayScript (uri: vscode.Uri|null): Promise<void> {
    if (! uri) {
        const editor = vscode.window.activeTextEditor;
        if (! editor) {
            return;
        }
        uri = editor.document.uri;
    }
    const re = /^[a-z]:\\(?:d\d|cx)content\\/i;
    const filePath = uri.fsPath.replace(re, "$Content\\");
    if (await digistarPlayScript(filePath)) {
        vscode.window.showInformationMessage(`Called Digistar.exe on ${filePath}`);
    }
}

export async function command_digistarFadeStopReset (): Promise<void> {
    const fadestopreset_ds_path = vscode.Uri.joinPath(env.vscode_digistar_extensionUri, 'resources',
        'scripts', 'fadestopreset.ds').fsPath;
    if (await digistarPlayScript(fadestopreset_ds_path)) {
        vscode.window.showInformationMessage('Digistar fadeStopReset');
    }
}

export async function command_toggleLisInExplorer (): Promise<void> {
    const config = vscode.workspace.getConfiguration('files');
    const excludeConfig = config.inspect<Record<string, boolean>>('exclude');
    const excludePattern = '**/*.lis';
    const currentExcludes = { ...excludeConfig?.globalValue, ...excludeConfig?.workspaceValue };
    const isCurrentlyHidden = currentExcludes[excludePattern] !== false;
    const shouldHide = !isCurrentlyHidden; // Toggle the value
    await config.update('exclude', {
        ...excludeConfig?.workspaceValue,
        [excludePattern]: shouldHide
    }, vscode.ConfigurationTarget.Workspace);
    vscode.window.showInformationMessage(
        `Lis files are now ${shouldHide ? 'hidden' : 'visible'} in the Explorer.`);
}

export function activate_commands (context: vscode.ExtensionContext) {
    const commands = [
        ['digistar.indentLine', command_digistarScriptIndentLine],
        ['digistar.indentLineAndEnter', command_digistarIndentLineAndEnter],
        ['digistar.playScript', command_digistarPlayScript],
        ['digistar.fadestopreset', command_digistarFadeStopReset],
        ['digistar.toggleLisInExplorer', command_toggleLisInExplorer]
    ] as const;
    for (let [name, fn] of commands) {
        context.subscriptions.push(vscode.commands.registerCommand(name, fn));
    }
}
