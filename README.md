
# VSCode Digistar Script Extension

## Features
### Activation

Activation in .ds and .lis files.

### Highlighting
#### Syntax Highlighter (TextMate Grammar)

The TextMate grammar syntax provides highlighting for the simplest parts of Digistar Script:

 - Timestamps
 - Comments
 - Strings
 - The "duration" keyword
 - Error lines in .lis files

#### Semantic Highlighter

The semantic highlighter provides parsing-based highlighting of Digistar commands.  It is minimal so far but will grow over time to cover more of the language.

### Configuration Defaults

 - tabSize 12.  Accomodates long timestamps.
 - Use tabs instead of spaces when indenting commands.
 - Render trailing whitespace.

### Language Configuration

 - Support for Ctrl+/ to comment a line or selection.
 - Auto insertion of paired delimiters.

### Commands and Key Bindings

 - tab: indent line (timestamp at column 0, command at 1 tab)
 - enter: auto-indent and whitespace cleanup

### Development

 - Support for VS Code's debug build system.


## Installation

The easiest way to install this extension is to download the latest VSIX package from the Releases section of the project Github page, and use VS Code's extension manager to install it.

Open VS Code.  Open its extension manager (Ctrl+Shift+X).  From the `...` drop-down menu, select `Install from VSIX...`, and then find and select digistar-x.x.x.vsix.


## Build

If you would like to build the package for yourself in order to modify it or run features that are not yet in a release, here is how.

### 1. Install nodejs

Install Node.js.  For a typical installation on Windows, visit https://nodejs.org/en/download and download the MSI package for the LTS release (long-term support), then run it and follow prompts.

### 2. Install TypeScript

```bash
npm install -g typescript
```

### 3. Install VS Code support packages

Globally install the vsce executable (VS Code Extension Manager).  Use the following command in a command line terminal:

```bash
npm install -g @vscode/vsce
```

### 4. npm install

After cloning or updating the project repository, install support libraries.  This will download the necessary libraries into the `node_modules` directory.

Open a command line terminal in the vscode-digistar directory, and run the following command:

```bash
npm install
```

### 5. vsce package

Build the extension package with vsce (VS Code Extension Manager)

```bash
npx @vscode/vsce package
```

This will create digistar-x.x.x.vsix.

### 6. Install the package

Open VS Code.  Open its extension manager (Ctrl+Shift+X).  From the `...` drop-down menu, select `Install from VSIX...`, and then find and select digistar-x.x.x.vsix.

## How to Run the Extension in Debug Mode

If you want to modify the extension, the easiest way to test your code as you work on it is to us VS Code's Debug Mode.

1. Open extension root folder in VS Code.

2. Start the Watcher (Ctrl+Shift+B) and select the tsc watch task.

3. Launch debugger (F5).  Extension Development Host window opens. Ctrl+R reloads this window with code changes.

## References and Development Notes
### TextMate Grammars

https://macromates.com/manual/en/language_grammars

https://www.apeth.com/nonblog/stories/textmatebundle.html

