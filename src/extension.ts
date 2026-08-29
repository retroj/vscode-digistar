
import * as vscode from 'vscode';

interface CustomToken {
    char: number;          // Starting character index on the line
    length: number;        // How many characters wide the token is
    typeIndex: number;     // Index of the token type in 'tokenTypes' array
    modifierIndex: number; // Index of the modifier in 'tokenModifiers' array
}

// Store tokens per document URI: { "file://...": [ [Tokens for Line 0], [Tokens for Line 1] ] }
const tokenCache = new Map<string, CustomToken[][]>();
const legend = new vscode.SemanticTokensLegend(
    ['keyword', 'variable', 'string', 'number', 'comment'], // token types
    ['declaration', 'documentation']); // token modifiers

class IncrementalSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
    private _onDidChangeSemanticTokens = new vscode.EventEmitter<void>();
    readonly onDidChangeSemanticTokens = this._onDidChangeSemanticTokens.event;

    public provideDocumentSemanticTokens (document : vscode.TextDocument)
        : vscode.ProviderResult<vscode.SemanticTokens>
    {
        const builder = new vscode.SemanticTokensBuilder();
        const uri = document.uri.toString();

        // 1. Initialize cache for new files
        if (!tokenCache.has(uri)) {
            parseEntireFile(document);
        }

        // 2. Fetch the updated/shifted cache
        const fileCache = tokenCache.get(uri);
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
        console.log("refresh");
        this._onDidChangeSemanticTokens.fire();
    }
}


/**
 * Tokenizer logic for a single line
 */
function tokenizeSingleLine (lineText: string): CustomToken[] {
    const tokens: CustomToken[] = [];
    
    // --- SAMPLE PARSING LOGIC (Replace this with your actual lexer) ---
    const regex = /\b(if|else|return|function|var|let|const)\b/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(lineText)) !== null) {
        tokens.push({
            char: match.index,
            length: match[0].length,
            typeIndex: legend.tokenTypes.indexOf('keyword'),
            modifierIndex: 0
        });
    }
    // -----------------------------------------------------------------

    return tokens;
}


/**
 * Performs a full file scan when a document is first encountered.
 */
function parseEntireFile (document: vscode.TextDocument): void {
    const uri = document.uri.toString();
    const linesCount = document.lineCount;
    const fileLinesArray: CustomToken[][] = new Array(linesCount);

    for (let i = 0; i < linesCount; i++) {
        fileLinesArray[i] = tokenizeSingleLine(document.lineAt(i).text);
    }

    tokenCache.set(uri, fileLinesArray);
}


export function activate (context: vscode.ExtensionContext) {
    console.log(`Digistar Script extension activated`);

    const provider = new IncrementalSemanticTokensProvider();
    const selector: vscode.DocumentSelector = { language: 'digistar', scheme: 'file' };
    context.subscriptions.push(
        vscode.languages.registerDocumentSemanticTokensProvider(selector, provider, legend));
    let debounceTimer: any;

    // Text changes
    //
    let changeSubscription = vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document.languageId !== 'digistar') {
            return;
        }
        const uri = event.document.uri.toString();
        if (! tokenCache.has(uri)) {
            parseEntireFile(event.document);
            provider.refresh();
            return;
        }
        let fileCache = tokenCache.get(uri);
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

            // 2. Mark the affected lines as null (dirty) so they get re-parsed
            for (let i = startLine; i <= startLine + linesAdded; i++) {
                if (i < event.document.lineCount) {
                    const currentLineText = event.document.lineAt(i).text;
                    fileCache[i] = tokenizeSingleLine(currentLineText);
                }
            }
        }

        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        
        debounceTimer = setTimeout(() => {
            provider.refresh(); // Forces VS Code to fetch the updated cache data
        }, 150); 
    });
    context.subscriptions.push(changeSubscription);


    // 4. Cleanup memory cache when a text document is closed
    const closeSubscription = vscode.workspace.onDidCloseTextDocument((document: vscode.TextDocument) => {
        tokenCache.delete(document.uri.toString());
    });
    context.subscriptions.push(closeSubscription);


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
    tokenCache.clear();
}
