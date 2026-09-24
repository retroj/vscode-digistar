
import * as vscode from 'vscode';
import { execFile } from 'child_process';
import { promisify } from 'util';

import * as utils from './utils';

const execFileAsync = promisify(execFile);

export let vscode_digistar_extensionUri: vscode.Uri;

export const digistarExecutablePath = utils.findFirstExistingPath([
    "C:/CXSoftware/Apps/Digistar/Bin/UI/Digistar.exe",
    "C:/D7Software/Apps/Digistar/Bin/UI/Digistar.exe",
    "C:/D7Software/Bin/GUI/Digistar.exe",
    "C:/D6Software/Bin/GUI/Digistar.exe",
    "C:/D5Software/Bin/GUI/Digistar.exe"]);

export async function digistarIsRunning (): Promise<boolean> {
    if (process.platform !== 'win32') {
        return false;
    }
    try {
        const { stdout } = await execFileAsync('tasklist', ['/FI', 'IMAGENAME eq Digistar.exe', '/NH'], {
            windowsHide: true,
            encoding: 'utf8'
        });
        return /^Digistar\.exe\s/im.test(stdout);
    } catch {
        return false;
    }
}

export function activate (context: vscode.ExtensionContext) {
    vscode_digistar_extensionUri = context.extensionUri;
}
