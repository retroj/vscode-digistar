
import * as vscode from 'vscode';

let lisAnnotations: vscode.DiagnosticCollection;
const displayedLisAnnotations = new Set<string>();

export function lisUriForDocument (document: vscode.TextDocument): vscode.Uri | undefined {
    if (document.languageId !== 'digistar' || !document.uri.fsPath.toLowerCase().endsWith('.ds')) {
        return undefined;
    }
    return vscode.Uri.file(document.uri.fsPath.replace(/\.ds$/i, '.lis'));
}

async function lisAnnotationsShow (document: vscode.TextDocument): Promise<boolean> {
    const lisUri = lisUriForDocument(document);
    if (!lisUri) {
        return false;
    }

    let lisText: string;
    try {
        const lisDocument = await vscode.workspace.openTextDocument(lisUri);
        lisText = lisDocument.getText();
    } catch {
        return false;
    }

    const diagnostics: vscode.Diagnostic[] = [];
    const lisLines = lisText.split(/\r?\n/);
    let errorCount = 0;
    for (let lisLine = 0; lisLine < lisLines.length; lisLine++) {
        const errorMatch = lisLines[lisLine].match(/^!+\s*(.*)$/);
        if (errorMatch) {
            errorCount++;
        } else {
            continue;
        }
        const sourceLine = lisLine - errorCount;
        if (sourceLine < 0 || sourceLine >= document.lineCount) {
            continue;
        }
        const sourceText = document.lineAt(sourceLine).text;
        const range = new vscode.Range(sourceLine, 0, sourceLine, sourceText.length);
        diagnostics.push(new vscode.Diagnostic(
            range,
            errorMatch[1].trim() || 'Digistar error',
            vscode.DiagnosticSeverity.Error
        ));
    }
    lisAnnotations.set(document.uri, diagnostics);
    displayedLisAnnotations.add(document.uri.toString());
    return true;
}

async function lisAnnotationsShowIfNew (document: vscode.TextDocument): Promise<void> {
    const lisUri = lisUriForDocument(document);
    if (!lisUri) {
        return;
    }
    try {
        const [dsStat, lisStat] = await Promise.all([
            vscode.workspace.fs.stat(document.uri),
            vscode.workspace.fs.stat(lisUri)
        ]);
        if (lisStat.mtime > dsStat.mtime) {
            await lisAnnotationsShow(document);
        }
    } catch {
        return;
    }
}

function lisWatcherUpdateAnnotations (lisUri: vscode.Uri): void {
    const lisUriString = lisUri.toString();
    for (const document of vscode.workspace.textDocuments) {
        if (lisUriForDocument(document)?.toString() === lisUriString) {
            void lisAnnotationsShow(document);
        }
    }
}



/*
 * Lis Commands
 */

export async function command_digistarToggleLisAnnotations (): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || ! lisUriForDocument(editor.document)) {
        return;
    }
    const documentKey = editor.document.uri.toString();
    if (displayedLisAnnotations.has(documentKey)) {
        lisAnnotations.delete(editor.document.uri);
        displayedLisAnnotations.delete(documentKey);
        vscode.window.showInformationMessage('Lis annotations removed.');
        return;
    }
    if (await lisAnnotationsShow(editor.document)) {
        vscode.window.showInformationMessage('Lis annotations added.');
    } else {
        vscode.window.showInformationMessage('No .lis file was found.');
    }
}

export async function command_digistarToggleLisInExplorer (): Promise<void> {
    const config = vscode.workspace.getConfiguration('files');
    const excludeConfig = config.inspect<Record<string, boolean>>('exclude');
    const excludePattern = '**/*.lis';
    const currentExcludes = { ...excludeConfig?.globalValue, ...excludeConfig?.workspaceValue };
    const isCurrentlyHidden = currentExcludes[excludePattern] !== false;
    const shouldHide = !isCurrentlyHidden; // Toggle the value
    await config.update('exclude', {
        ...excludeConfig?.workspaceValue,
        [excludePattern]: shouldHide
    }, vscode.ConfigurationTarget.Workspace);
    vscode.window.showInformationMessage(
        `Lis files are now ${shouldHide ? 'hidden' : 'visible'} in the Explorer.`);
}


/*
 * Activation
 */

export function activate (context: vscode.ExtensionContext) {
    lisAnnotations = vscode.languages.createDiagnosticCollection('digistar-lis');
    const lisWatcher = vscode.workspace.createFileSystemWatcher('**/*.lis');
    context.subscriptions.push(
        lisAnnotations,
        lisWatcher,
        lisWatcher.onDidCreate(lisWatcherUpdateAnnotations),
        lisWatcher.onDidChange(lisWatcherUpdateAnnotations),
        vscode.workspace.onDidOpenTextDocument(lisAnnotationsShowIfNew));

    const commands = [
        ['digistar.toggleLisAnnotations', command_digistarToggleLisAnnotations],
        ['digistar.toggleLisInExplorer', command_digistarToggleLisInExplorer]
    ] as const;
    for (let [name, fn] of commands) {
        context.subscriptions.push(vscode.commands.registerCommand(name, fn));
    }
}
