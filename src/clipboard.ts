
import * as vscode from 'vscode';

import * as utils from './utils';

function pasteFormatdigistarResolvePathAliases (line: string): string {
    return line.replace(/[a-z]:[\\/](?:CX|D\d)(?=Content|Software)/ig, '$');
}

function pasteFormatPosixPathSeparators (line: string): string {
    return line.replace(/^([^"|#;]*)/, (_, prefix) => prefix.replace(/\\/g, '/'));
}

export class DigistarScriptPasteProvider implements vscode.DocumentPasteEditProvider {
    readonly providedPasteEditKinds = [vscode.DocumentDropOrPasteEditKind.Text];

    async provideDocumentPasteEdits (document: vscode.TextDocument,
                                     range: readonly vscode.Range[],
                                     dataTransfer: vscode.DataTransfer,
                                     context: vscode.DocumentPasteEditContext,
                                     token: vscode.CancellationToken):
          Promise<vscode.DocumentPasteEdit[] | undefined>
    {
        let text = dataTransfer.get('text/plain')?.value;
        if (! text) {
            return undefined;
        }
        let formatters = [
            { enabled: utils.digistarExtensionGetConfiguration('pasteResolveAliases'),
              formatter: pasteFormatdigistarResolvePathAliases },
            { enabled: utils.digistarExtensionGetConfiguration('posixPathSeparators'),
              formatter: pasteFormatPosixPathSeparators }
        ];
        if (formatters.find(f => f.enabled)) {
            const eol = document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
            const lines: string[] = text.split(/\r?\n/);
            for (let formatter of formatters) {
                for (let i = 0; i < lines.length; i++) {
                    if (formatter.enabled) {
                        lines[i] = formatter.formatter(lines[i]);
                    }
                }
            }
            return [new vscode.DocumentPasteEdit(lines.join(eol),
                                                 'Indented Digistar Script Paste',
                                                 this.providedPasteEditKinds[0])];
        } else {
            return undefined;
        }
    }

    public static activate (context: vscode.ExtensionContext) {
        const pasteProvider = new DigistarScriptPasteProvider();
        const selector: vscode.DocumentSelector = { scheme: 'file', language: 'digistar' };
        context.subscriptions.push(vscode.languages.registerDocumentPasteEditProvider(
            selector, pasteProvider, {
                providedPasteEditKinds: [vscode.DocumentDropOrPasteEditKind.Text],
                pasteMimeTypes: ['text/plain']
            }));
        return pasteProvider;
    }
}
