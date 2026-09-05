
import * as vscode from 'vscode';
import { command_digistarScriptIndentLine } from './indentation';


interface CustomToken {
    char: number;          // Starting character index on the line
    length: number;        // How many characters wide the token is
    typeIndex: number;     // Index of the token type in 'tokenTypes' array
    modifierIndex: number; // Index of the modifier in 'tokenModifiers' array
}


class DigistarScriptSemanticHighlighter
implements vscode.DocumentSemanticTokensProvider
{
    private _onDidChangeSemanticTokens = new vscode.EventEmitter<void>();
    readonly onDidChangeSemanticTokens = this._onDidChangeSemanticTokens.event;

    // Store tokens per document URI: { "file://...": [ [Tokens for Line 0], [Tokens for Line 1] ] }
    tokenCache = new Map<string, CustomToken[][]>();

    readonly legend = new vscode.SemanticTokensLegend(
        ['keyword', 'variable', 'string', 'number', 'comment'], // token types
        ['declaration', 'documentation']); // token modifiers

    special_objects = new Set(['capture','dome','eye','js','navigation','scene','script','system']);

    /**
    * Tokenizer logic for a single line
    */
    tokenize_line (line: string): CustomToken[] {
        let highlight_tokens: CustomToken[] = [];
        const token_re = /\S+/g;

        const tokens = [...line.matchAll(token_re)];
        if (tokens.length > 0) {
            if (this.special_objects.has(tokens[0][0])) {
                highlight_tokens.push({
                    char: tokens[0].index || 0,
                    length: tokens[0][0].length,
                    typeIndex: this.legend.tokenTypes.indexOf('keyword'),
                    modifierIndex: 0
                });
            }
        }

        return highlight_tokens;
    }


    /**
    * Performs a full file scan when a document is first encountered.
    */
    parse_document (document: vscode.TextDocument): void {
        const uri = document.uri.toString();
        const linesCount = document.lineCount;
        const fileLinesArray: CustomToken[][] = new Array(linesCount);

        for (let i = 0; i < linesCount; i++) {
            fileLinesArray[i] = this.tokenize_line(document.lineAt(i).text);
        }

        this.tokenCache.set(uri, fileLinesArray);
    }


    provideDocumentSemanticTokens (document: vscode.TextDocument)
        : vscode.ProviderResult<vscode.SemanticTokens>
    {
        const builder = new vscode.SemanticTokensBuilder();
        const uri = document.uri.toString();

        // 1. Initialize cache for new files
        if (! this.tokenCache.has(uri)) {
            this.parse_document(document);
        }

        // 2. Fetch the updated/shifted cache
        const fileCache = this.tokenCache.get(uri);
        if (! fileCache) {
            return builder.build();
        }

        // 3. Push all cached tokens into the builder
        // (VS Code requires the full document's tokens returned in this method)
        for (let lineNum = 0; lineNum < fileCache.length; lineNum++) {
            const lineTokens = fileCache[lineNum] || [];
            for (const t of lineTokens) {
                builder.push(lineNum, t.char, t.length, t.typeIndex, t.modifierIndex);
            }
        }

        return builder.build();
    }


    refresh () {
        this._onDidChangeSemanticTokens.fire();
    }

    debounceTimer: any;
    onDidChangeTextDocument (event: vscode.TextDocumentChangeEvent) {
        if (event.document.languageId !== 'digistar') {
            return;
        }
        const uri = event.document.uri.toString();
        if (! this.tokenCache.has(uri)) {
            this.parse_document(event.document);
            this.refresh();
            return;
        }
        let fileCache = this.tokenCache.get(uri);
        if (! fileCache) {
            return;
        }

        for (const change of event.contentChanges) {
            const startLine = change.range.start.line;
            const endLine = change.range.end.line;
            const linesRemoved = endLine - startLine;
            const linesAdded = (change.text.match(/\n/g) || []).length;
            const netChange = linesAdded - linesRemoved;

            // 1. Shift the array indices below the edit to account for added/removed lines
            if (netChange > 0) {
                // Lines added: Insert empty slots into the cache array
                fileCache.splice(startLine + 1, 0, ...new Array(netChange).fill(null));
            } else if (netChange < 0) {
                // Lines removed: Delete slots from the cache array
                fileCache.splice(startLine + 1, Math.abs(netChange));
            }

            // 2. Re-parse changed lines
            for (let i = startLine; i <= startLine + linesAdded; i++) {
                if (i < event.document.lineCount) {
                    const currentLineText = event.document.lineAt(i).text;
                    fileCache[i] = this.tokenize_line(currentLineText);
                }
            }
        }

        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        
        this.debounceTimer = setTimeout(() => {
            this.refresh();
        }, 150); 
    }

    activate (context: vscode.ExtensionContext) {
        const selector: vscode.DocumentSelector = { language: 'digistar', scheme: 'file' };
        context.subscriptions.push(
            vscode.languages.registerDocumentSemanticTokensProvider(selector, this, this.legend));

        // Text changes
        //
        let changeSubscription = vscode.workspace.onDidChangeTextDocument(event => this.onDidChangeTextDocument(event));
        context.subscriptions.push(changeSubscription);

        // 4. Cleanup memory cache when a text document is closed
        const closeSubscription = vscode.workspace.onDidCloseTextDocument((document: vscode.TextDocument) => {
            this.tokenCache.delete(document.uri.toString());
        });
        context.subscriptions.push(closeSubscription);
    }
}


/*
 * Extension Interface
 */ 

const semanticHighlighter = new DigistarScriptSemanticHighlighter();

export function activate (context: vscode.ExtensionContext) {
    console.log(`Digistar Script extension activated`);

    semanticHighlighter.activate(context);

    // Commands
    //
    context.subscriptions.push(
        vscode.commands.registerCommand('digistar.indentLine', command_digistarScriptIndentLine));

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
