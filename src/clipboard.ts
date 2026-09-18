
import * as vscode from 'vscode';

import * as utils from './utils';

export class DigistarScriptPasteProvider implements vscode.DocumentPasteEditProvider {
    readonly providedPasteEditKinds = [vscode.DocumentDropOrPasteEditKind.Text];

    async provideDocumentPasteEdits (document: vscode.TextDocument,
                                     range: readonly vscode.Range[],
                                     dataTransfer: vscode.DataTransfer,
                                     context: vscode.DocumentPasteEditContext,
                                     token: vscode.CancellationToken):
          Promise<vscode.DocumentPasteEdit[] | undefined>
    {
        const text = dataTransfer.get('text/plain')?.value;
        if (! text) {
            return undefined;
        }
        const eol = document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
        const lines: string[] = text.split(/\r?\n/);
        if (utils.digistarExtensionGetConfiguration('posixPathSeparators')) {
            for (let i = 0; i < lines.length; i++) {
                lines[i] = lines[i].replace(/^([^|#;]*)/, (_, prefix) => prefix.replace(/\\/g, '/'));
            }
        }
        return [new vscode.DocumentPasteEdit(lines.join(eol),
                                             'Indented Digistar Script Paste',
                                             this.providedPasteEditKinds[0])];
    }

    activate (context: vscode.ExtensionContext) {
        const selector: vscode.DocumentSelector = { scheme: 'file', language: 'digistar' };
        context.subscriptions.push(vscode.languages.registerDocumentPasteEditProvider(
            selector, this, {
                providedPasteEditKinds: [vscode.DocumentDropOrPasteEditKind.Text],
                pasteMimeTypes: ['text/plain']
            }));
    }
}
