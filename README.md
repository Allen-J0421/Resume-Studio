# auto-resume

A small local résumé tool for an IDE workflow. Edit the résumé directly on the
left, like a word-processing document, and see the LaTeX-rendered PDF on the
right. Users do not write Markdown, JSON, or LaTeX.

There is no account, database, AI provider, extension, front-end framework, or
npm dependency.

Requirements: Node.js 20+ and a TeX installation containing `latexmk` and
XeLaTeX.

## Set up on macOS

Double-click **`setup.command`**. It installs Homebrew when needed, followed by
Node.js, MacTeX, and Visual Studio Code. macOS may request your administrator
password during installation. When setup finishes, it starts auto-resume and
then opens this folder in VS Code. If the integrated editor is not already
visible, press **Command+Shift+B** once.

If macOS blocks the downloaded file, right-click `setup.command`, choose
**Open**, then choose **Open** again.

You can also run it from Terminal:

```sh
./setup.command
```

## Open in VS Code

Press **Cmd/Ctrl+Shift+B**. The default **auto-resume: Open editor** task starts the
local server and opens `http://127.0.0.1:4319` in VS Code's integrated browser.

From any IDE or terminal:

```sh
npm start
```

The repository starts with an empty `master/` folder. On first use, auto-resume
shows a short guide. Attach your existing résumé to your IDE agent's chat, or
paste its text there, then send the copyable prompt shown in the editor. The
agent instructions explain how to create, build, and verify `master/resume.json`
without inventing content.

After the master résumé exists, you can also open a copied résumé folder directly:

```sh
npm start -- companies/example
```

## Editing

Click any name, heading, date, paragraph, or bullet and type normally. Small
controls appear when you move over content so you can add, delete, or reorder
it. Changes save automatically and rebuild the PDF.

The PDF layout menu offers three coordinated presets:

| Layout | Body | Name | Section | Margin |
|---|---:|---:|---:|---:|
| Compact | 10.5/12 pt | 20/20 pt | 12/12.4 pt | 0.5 in |
| Standard | 11/13 pt | 22/24 pt | 12.5/14 pt | 0.6 in |
| Spacious | 11.5/14 pt | 24/26 pt | 13/15 pt | 0.7 in |

Compact matches the original résumé format. The selected layout is stored with
that résumé and applies consistently to every section. It changes the PDF only;
the editing document stays at a fixed, comfortable size.

Use the menu button beside **auto-resume** to open the résumé folder list. It is
hidden by default and includes `master` plus every `companies/<name>` folder
that contains a `resume.json` file. Each folder remains an independent résumé.

`resume.json` is the source used by IDE agents. Generated `resume.tex` and
`resume.pdf` files should not be edited directly.

Build without opening the editor:

```sh
npm run build -- master
npm run check -- master
```

`check` exits nonzero for missing characters or overfull boxes. Compilation
does not establish visual correctness; inspect every PDF page after an edit.

## License

MIT.
