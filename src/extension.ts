
import * as vscode from 'vscode';

export function activate (context: vscode.ExtensionContext) {
    console.log(`Digistar Script extension activated`);


    // Commands
    //
    let disposable = vscode.commands.registerCommand('digistar.helloWorld', () => {
        vscode.window.showInformationMessage('Hello Digistar!');
    });

    context.subscriptions.push(disposable);


    // Configuration defaults can be ignored when a window is initially opened and the extension
    // has not yet been activated.  This is a workaround to enforce our default tabSize or the
    // configured editor.tabSize for "[digistar]" in local settings.json.
    vscode.window.visibleTextEditors.forEach(editor => {
        if (editor.document.languageId === 'digistar') {
            const config = vscode.workspace.getConfiguration('editor', { languageId: 'digistar' });
            const activeTabSize = config.get<number>('tabSize');
            editor.options.tabSize = activeTabSize;
        }
    });
}

export function deactivate () {
}
