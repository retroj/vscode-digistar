
import * as vscode from 'vscode';

import * as utils from './utils';
import { DigistarScriptRangeFormattingEditProvider } from './formatter';

interface PendingPasteChange {
    range: vscode.Range;
    offset: number;
    text: string;
}

interface PendingPaste {
    documentUri: string;
    version: number;
    changes: PendingPasteChange[];
    timeout: ReturnType<typeof setTimeout>;
}

function pasteFormatdigistarResolvePathAliases (line: string): string {
    return line.replace(/[a-z]:[\\/](?:CX|D\d)(?=Content|Software)/ig, '$');
}

function pasteFormatPosixPathSeparators (line: string): string {
    return line.replace(/^([^"|#;]*)/, (_, prefix) => prefix.replace(/\\/g, '/'));
}

export class DigistarScriptPasteEditProvider implements vscode.DocumentPasteEditProvider {
    readonly providedPasteEditKinds = [vscode.DocumentDropOrPasteEditKind.Text];
    private pendingPaste?: PendingPaste;

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
            const changes = range.map(pasteRange => ({
                range: pasteRange,
                offset: document.offsetAt(pasteRange.start),
                text: lines.join(eol)
            }));
            this.pendingPaste?.timeout && clearTimeout(this.pendingPaste.timeout);
            const timeout = setTimeout(() => {
                this.pendingPaste = undefined;
            }, 500);
            this.pendingPaste = {
                documentUri: document.uri.toString(),
                version: document.version,
                changes,
                timeout
            };
            return [new vscode.DocumentPasteEdit(lines.join(eol),
                                                 'Transformed Digistar Script Paste',
                                                 this.providedPasteEditKinds[0])];
        } else {
            return undefined;
        }
    }

    consumeMatchingPaste (document: vscode.TextDocument,
                           event: vscode.TextDocumentChangeEvent): vscode.Range[] | undefined {
        const pending = this.pendingPaste;
        if (!pending || pending.documentUri !== document.uri.toString() ||
            pending.version !== event.document.version - 1 ||
            pending.changes.length !== event.contentChanges.length) {
            return undefined;
        }

        const matched = event.contentChanges.map(change => {
            return pending.changes.find(expected =>
                expected.range.isEqual(change.range) && expected.text === change.text);
        });
        if (matched.some(change => !change)) {
            return undefined;
        }

        clearTimeout(pending.timeout);
        this.pendingPaste = undefined;
        const ordered = event.contentChanges
            .map((change, index) => ({ change, expected: matched[index]! }))
            .sort((a, b) => a.expected.offset - b.expected.offset);
        let offsetDelta = 0;
        const ranges: vscode.Range[] = [];
        for (let { change, expected } of ordered) {
            const startOffset = expected.offset + offsetDelta;
            const start = document.positionAt(startOffset);
            const end = document.positionAt(startOffset + change.text.length);
            ranges.push(new vscode.Range(start.line, 0, end.line, end.character));
            offsetDelta += change.text.length - change.rangeLength;
        }
        return ranges;
    }

    public static activate (context: vscode.ExtensionContext, formatter: DigistarScriptRangeFormattingEditProvider) {
        const pasteProvider = new DigistarScriptPasteEditProvider();
        const selector: vscode.DocumentSelector = { scheme: 'file', language: 'digistar' };
        context.subscriptions.push(vscode.languages.registerDocumentPasteEditProvider(
            selector, pasteProvider, {
            providedPasteEditKinds: [vscode.DocumentDropOrPasteEditKind.Text],
            pasteMimeTypes: ['text/plain']
        }));

        let formattingTimer: ReturnType<typeof setTimeout> | undefined;
        context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {
            const ranges = pasteProvider.consumeMatchingPaste(event.document, event);
            if (!ranges) {
                return;
            }
            if (formattingTimer) {
                clearTimeout(formattingTimer);
            }
            const version = event.document.version;
            formattingTimer = setTimeout(async () => {
                formattingTimer = undefined;
                if (event.document.isClosed || event.document.version !== version) {
                    return;
                }
                const cancellation = new vscode.CancellationTokenSource();
                const edits = formatter.formatDocumentRanges(event.document, ranges, cancellation.token);
                cancellation.dispose();
                if (!edits.length) {
                    return;
                }
                const workspaceEdit = new vscode.WorkspaceEdit();
                workspaceEdit.set(event.document.uri, edits);
                await vscode.workspace.applyEdit(workspaceEdit);
            }, 25);
        }));

        return pasteProvider;
    }
}
