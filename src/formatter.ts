
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

    provideDocumentRangeFormattingEdits (document: vscode.TextDocument,
                                         range: vscode.Range,
                                         options: vscode.FormattingOptions,
                                         token: vscode.CancellationToken):
        vscode.ProviderResult<vscode.TextEdit[]>
    {
        console.log("Hello, World! Format on paste!");
        const edits: vscode.TextEdit[] = [];
        const firstLine = range.start.line;
        const lastLine = range.end.line;
        for (let lineNumber = firstLine; lineNumber <= lastLine; lineNumber++) {
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

    public static activate (context: vscode.ExtensionContext) {
        const provider = new DigistarScriptRangeFormattingEditProvider();
        const selector: vscode.DocumentSelector = { scheme: 'file', language: 'digistar' };
        context.subscriptions.push(vscode.languages.registerDocumentRangeFormattingEditProvider(
            selector, provider));
        return provider;
    }
}
