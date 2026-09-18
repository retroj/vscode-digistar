
import * as vscode from 'vscode';

import * as environment from './environment';
import * as commands from './commands';
import { DigistarScriptSemanticHighlighter } from './highlighter';
import { DigistarScriptPasteProvider } from './clipboard';


const semanticHighlighter = new DigistarScriptSemanticHighlighter();
const pasteProvider = new DigistarScriptPasteProvider();

export function activate (context: vscode.ExtensionContext) {
    console.log(`Digistar Script extension activated`);

    semanticHighlighter.activate(context);
    environment.activate(context);
    commands.activate(context);
    pasteProvider.activate(context);

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
