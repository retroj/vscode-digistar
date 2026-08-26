
import * as vscode from 'vscode';

export function activate (context: vscode.ExtensionContext) {
    console.log('Your extension is now active!');

    // Example: Register a basic hello world command
    let disposable = vscode.commands.registerCommand('digistar.helloWorld', () => {
        vscode.window.showInformationMessage('Hello Digistar!');
    });

    context.subscriptions.push(disposable);
}

export function deactivate () {
}
