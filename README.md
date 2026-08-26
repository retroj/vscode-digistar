
## Build

npx @vscode/vsce package --out ../jjfoerch.digistar-0.0.1.vsix


## Various Development Notes

### TypeScript?

npm install

Open extension root folder in VS Code.

Start the Watcher (Ctrl+Shift+B) and select the watch task.

Launch debugger (F5).  Extension Development Host window opens. Ctrl+R reloads this window with code changes.

### TextMate Grammars

https://macromates.com/manual/en/language_grammars

https://www.apeth.com/nonblog/stories/textmatebundle.html

It may be better to make a semantic grammar instead of a syntax grammar.  Syntax grammars are limited to what we can determine with regexps, while a semantic grammar would presumably allow us to parse each line.
