
import * as vscode from 'vscode';

import * as utils from './utils';
import { DigistarScriptRangeFormattingEditProvider } from './formatter';

/*

This module is a Paste Provider that performs cleanup on pasted Digistar Script,
like replacing OS paths with Digistar aliases.

It also provides a workaround for an issue in VS Code concerning the config option,
editor.formatOnPaste, which is complex enough that we should give an overview of it
here.  If the issue is ever resolved, the code related to it can be stripped from
this module, so we also have comments below indicating where the relevant portions
of code are.

A Paste Provider is suitable for transforming the contents of a paste before they
are added to the buffer.  A Formatting Provider is suitable for formatting whitespace
of the lines that were pasted in, after the paste itself is finished.  Neither of
these tools is well suited to the job of the other, particularly because pastes can
be quite complicated, effecting multiple lines.

The problem is that VS Code ignores the config option editor.formatOnPaste when a
paste provider provides changes.  We have reported this to the VS Code development
team, so hopefully it may be fixed in the future.  For now, we have a workaround.

The workaround is that the Paste Provider records the ranges it affects, and installs
an onDidChangeTextDocument handler to listen for when its own corresponding paste is
completed.  If the ranges of that handler match the expected ranges from the Paste
Provider, we format the whitespace just-pasted lines.  A timeout is also used to cancel
this action if the expected edit did not occur within a short window.

*/

/*
 * State for editor.formatOnPaste workaround
 */

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

function normalizeLineEndings (text: string): string {
    return text.replace(/\r\n|\r/g, '\n');
}

function pasteTextMatches (expected: string, actual: string): boolean {
    const normalizedExpected = normalizeLineEndings(expected);
    const normalizedActual = normalizeLineEndings(actual);
    if (normalizedExpected === normalizedActual) {
        return true;
    }
    const expectedLines = normalizedExpected.split('\n');
    const actualLines = normalizedActual.split('\n');
    if (expectedLines.length !== actualLines.length) {
        return false;
    }
    return expectedLines.every((line, index) => {
        if (line === actualLines[index]) {
            return true;
        }
        return index > 0 && actualLines[index] === `\t${line}`;
    });
}


/*
 * Formatters
 */

function pasteFormatdigistarResolvePathAliases (line: string): string {
    return line.replace(/[a-z]:[\\/](?:CX|D\d)(?=Content|Software)/ig, '$');
}

function pasteFormatPosixPathSeparators (line: string): string {
    return line.replace(/^([^"|#;]*)/, (_, prefix) => prefix.replace(/\\/g, '/'));
}


/*
 * Paste Provider
 */

export class DigistarScriptPasteEditProvider implements vscode.DocumentPasteEditProvider {
    readonly providedPasteEditKinds = [vscode.DocumentDropOrPasteEditKind.Text];
    private pendingPaste?: PendingPaste;
    private formattingTimer?: ReturnType<typeof setTimeout>;

    private constructor (private readonly formatter: DigistarScriptRangeFormattingEditProvider) {}

    async provideDocumentPasteEdits (document: vscode.TextDocument,
                                     ranges: readonly vscode.Range[],
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

            // Expected ranges for editor.formatOnPaste workaround
            //
            const changes = ranges.map(pasteRange => ({
                range: pasteRange,
                offset: document.offsetAt(pasteRange.start),
                text: lines.join(eol)
            }));

            // editor.formatOnPaste workaround: if another paste is occurring with 0.5 seconds
            // of the previous one, clear the abort timeout, then set a new abort timeout and
            // record the information about the expected paste.
            //
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

            // Return the result of the Paste Provider
            //
            return [new vscode.DocumentPasteEdit(lines.join(eol),
                                                 'Transformed Digistar Script Paste',
                                                 this.providedPasteEditKinds[0])];
        } else {
            return undefined;
        }
    }

    // editor.formatOnPaste workaround: used by handleDocumentChange in the onDidChangeTextDocument
    // to determine if a given change matches an expected paste edit, and if so, return the
    // effected ranges for formatting.
    //
    consumeMatchingPaste (document: vscode.TextDocument,
                           event: vscode.TextDocumentChangeEvent): vscode.Range[] | undefined {
        const pending = this.pendingPaste;
        if (!pending || pending.documentUri !== document.uri.toString() ||
            pending.version !== event.document.version - 1 ||
            pending.changes.length !== event.contentChanges.length) {
            return undefined;
        }

        const matched = event.contentChanges.map(change => {
            const expected = pending.changes.find(expected => expected.range.isEqual(change.range));
            if (!expected) {
                return undefined;
            }
            if (!pasteTextMatches(expected.text, change.text)) {
                return undefined;
            }
            return expected;
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

    // editor.formatOnPaste workaround: handler for onDidChangeTextDocument
    //
    private handleDocumentChange (event: vscode.TextDocumentChangeEvent): void {
        const ranges = this.consumeMatchingPaste(event.document, event);
        if (!ranges) {
            return;
        }
        if (this.formattingTimer) {
            clearTimeout(this.formattingTimer);
        }
        const version = event.document.version;
        // Apply formatting after a short delay (with debounce).
        // Likely possible to go lower than 25 ms here.
        //
        this.formattingTimer = setTimeout(async () => {
            this.formattingTimer = undefined;
            if (event.document.isClosed || event.document.version !== version) {
                return;
            }
            const cancellation = new vscode.CancellationTokenSource();
            const edits = this.formatter.formatDocumentRanges(event.document, ranges, cancellation.token);
            cancellation.dispose();
            if (!edits.length) {
                return;
            }
            const workspaceEdit = new vscode.WorkspaceEdit();
            workspaceEdit.set(event.document.uri, edits);
            await vscode.workspace.applyEdit(workspaceEdit);
        }, 25);
    }

    public static activate (context: vscode.ExtensionContext, formatter: DigistarScriptRangeFormattingEditProvider) {
        const pasteProvider = new DigistarScriptPasteEditProvider(formatter);
        const selector: vscode.DocumentSelector = { scheme: 'file', language: 'digistar' };
        context.subscriptions.push(vscode.languages.registerDocumentPasteEditProvider(
            selector, pasteProvider, {
            providedPasteEditKinds: [vscode.DocumentDropOrPasteEditKind.Text],
            pasteMimeTypes: ['text/plain']
        }));

        // Install the onDidChangeDocument handler for the editor.formatOnPaste workaround.
        //
        context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(
            pasteProvider.handleDocumentChange.bind(pasteProvider)));
        context.subscriptions.push(new vscode.Disposable(() => {
            if (pasteProvider.formattingTimer) {
                clearTimeout(pasteProvider.formattingTimer);
            }
        }));

        return pasteProvider;
    }
}
