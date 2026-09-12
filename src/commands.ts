
import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';

import * as environment from './environment';

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
        const old_char_position = selection.active.character;
        let new_char_position = selection.active.character;
        if (old_char_position >= rest_begin) {
            const leading_chars_removed = rest_begin - (ts.length + 1);
            new_char_position -= leading_chars_removed;
        } else if (old_char_position >= ts_end) {
            new_char_position = ts.length + 1;
        }
        if (new_char_position != old_char_position) {
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
    const editor = vscode.window.activeTextEditor;
    if (! editor) {
        return;
    }
    const document = editor.document;
    const eol = document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
    const selection = editor.selection;
    const old_char_position = selection.active.character;
    const line = document.lineAt(selection.active.line);
    const range = line.range;
    const prevLine = line.text.substring(0, old_char_position);
    const newLine = line.text.substring(old_char_position, line.text.length);
    const ts_match = line.text.match(/^(\s*?[0-9+:.]*)\s*/);
    const match = prevLine.match(/^(\s*?)([0-9+:.]*)(\s*)(.*?)\s*$/);
    if (match && ts_match) { // always true
        const ts = match[2];
        const rest = match[4];
        const ts_end = ts_match[1].length;
        const prevLineTab = rest ? '\t' : '';
        // if the cursor is before the end of the timestamp, do not insert a tab on the new line.
        //XXX whitespace before the timestamp causes a failure of this rule.
        const newLineTab = selection.active.character >= ts_end ? '\t' : '';
        const replacement = ts + prevLineTab + rest + eol + newLineTab + newLine.trimStart();
        await editor.edit(editBuilder => {
            editBuilder.replace(range, replacement);
        });
        // Cursor Motion:
        //  - if the cursor is before the rest, and there is a rest, newchar = 0, otherwise 1.
        const newChar = selection.active.character < ts_match[0].length ? 0 : 1;
        const newPosition = new vscode.Position(selection.active.line + 1, newChar);
        editor.selection = new vscode.Selection(newPosition, newPosition);
    }
}

async function digistarPlayScript (filePath: string): Promise<boolean> {
    if (! environment.digistarExecutablePath) {
        vscode.window.showWarningMessage('Cannot play script. Digistar executable was not found.');
        return false;
    }
    spawn(environment.digistarExecutablePath, ['-p', filePath], {
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
    const fadestopreset_ds_path = vscode.Uri.joinPath(environment.vscode_digistar_extensionUri, 'resources',
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

export function activate (context: vscode.ExtensionContext) {
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
