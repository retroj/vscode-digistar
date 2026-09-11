
import * as vscode from 'vscode';

import * as utils from './utils';

export let vscode_digistar_extensionUri: vscode.Uri;

export const digistarExecutablePath = utils.findFirstExistingPath([
    "C:/CXSoftware/Apps/Digistar/Bin/UI/Digistar.exe",
    "C:/D7Software/Apps/Digistar/Bin/UI/Digistar.exe",
    "C:/D7Software/Bin/GUI/Digistar.exe",
    "C:/D6Software/Bin/GUI/Digistar.exe",
    "C:/D5Software/Bin/GUI/Digistar.exe"]);

export function activate (context: vscode.ExtensionContext) {
    vscode_digistar_extensionUri = context.extensionUri;
}
