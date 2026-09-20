
import * as vscode from 'vscode';

export class DigistarScriptRangeFormattingEditProvider
       implements vscode.DocumentRangeFormattingEditProvider {
        
    formatLineWhitespace (line: string): string {
        const match = line.match(/^(\s*)([0-9+:.]*)(\s*)(.*?)\s*$/);
        if (match) {
            const ts = match[2];
            const rest = match[4];
            if (rest) {
                return ts + '\t' + rest;
            } else {
                return ts;
            }
        } else {
            return line;
        }
    }

    formatDocumentRanges (document: vscode.TextDocument,
                          ranges: readonly vscode.Range[],
                          token: vscode.CancellationToken): vscode.TextEdit[]
    {
        const edits: vscode.TextEdit[] = [];
        const lines = new Set<number>();
        for (let range of ranges) {
            for (let lineNumber = range.start.line; lineNumber <= range.end.line; lineNumber++) {
                lines.add(lineNumber);
            }
        }
        for (let lineNumber of [...lines].sort((a, b) => a - b)) {
            if (token.isCancellationRequested) {
                return [];
            }
            const line = document.lineAt(lineNumber);
            const formatted = this.formatLineWhitespace(line.text);
            if (formatted !== line.text) {
                edits.push(vscode.TextEdit.replace(line.range, formatted));
            }
        }
        return edits;
    }

    provideDocumentRangeFormattingEdits (document: vscode.TextDocument,
                                         range: vscode.Range,
                                         options: vscode.FormattingOptions,
                                         token: vscode.CancellationToken):
        vscode.ProviderResult<vscode.TextEdit[]>
    {
        return this.formatDocumentRanges(document, [range], token);
    }

    public static activate (context: vscode.ExtensionContext) {
        const provider = new DigistarScriptRangeFormattingEditProvider();
        const selector: vscode.DocumentSelector = { scheme: 'file', language: 'digistar' };
        context.subscriptions.push(vscode.languages.registerDocumentRangeFormattingEditProvider(
            selector, provider));
        return provider;
    }
}
