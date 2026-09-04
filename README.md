
## Build
### Install nodejs

Install Node.js.  For a typical installation on Windows, visit https://nodejs.org/en/download and download the MSI package for the LTS release (long-term support), then run it and follow prompts.

### Install VS Code support packages

Globally install the vsce executable (VS Code Extension Manager).  Use the following command in a command line terminal:

```bash
npm install -g @vscode/vsce
```

### npm install

After cloning or updating the project repository, install support libraries.  This will download the necessary libraries into the `node_modules` directory.

Open a command line terminal in the vscode-digistar directory, and run the following command:

```bash
npm install
```

### vsce package

Build the extension package with vsce (VS Code Extension Manager)

```bash
npx @vscode/vsce package
```

This will create digistar-0.0.1.vsix.

### Install the package

Open VS Code.  Open its extension manager (Ctrl+Shift+X).  From the `...` drop-down menu, select `Install from VSIX...`, and then find and select digistar-0.0.1.vsix.

## Various Development Notes

### TypeScript?

npm install

Open extension root folder in VS Code.

Start the Watcher (Ctrl+Shift+B) and select the watch task.

Launch debugger (F5).  Extension Development Host window opens. Ctrl+R reloads this window with code changes.

### TextMate Grammars

https://macromates.com/manual/en/language_grammars

https://www.apeth.com/nonblog/stories/textmatebundle.html

