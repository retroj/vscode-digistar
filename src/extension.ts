
import * as vscode from 'vscode';

import * as env from './environment';
import * as commands from './commands';
import { DigistarScriptSemanticHighlighter } from './highlighter';


const semanticHighlighter = new DigistarScriptSemanticHighlighter();

export function activate (context: vscode.ExtensionContext) {
    console.log(`Digistar Script extension activated`);

    semanticHighlighter.activate(context);
    env.activate_environment(context);
    commands.activate_commands(context);

    // Configuration defaults can be ignored when a window is initially opened and the extension
    // has not yet been activated.  This is a workaround to enforce our default tabSize or the
    // configured editor.tabSize for "[digistar]" in local settings.json.
    for (let editor of vscode.window.visibleTextEditors) {
        if (editor.document.languageId === 'digistar') {
            const config = vscode.workspace.getConfiguration('editor', { languageId: 'digistar' });
            const activeTabSize = config.get<number>('tabSize');
            editor.options.tabSize = activeTabSize;
        }
    }
}

export function deactivate () {
    semanticHighlighter.tokenCache.clear();
}
