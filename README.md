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
it. Select text in a paragraph or bullet to use the **Bold** and *Italic*
buttons. Changes save automatically and rebuild the PDF.

Use the **Format** button to change PDF typography, spacing, and margins. It
shows font size and line height for body, name, section heading, and contact
text, plus spacing between bullets and entries, spacing before sections, and
page margins. New résumés start with 10/12 pt body text, 20/20 pt name text,
12/12.4 pt section headings, 11/13 pt contact text, 2 pt between bullets, 4 pt
between entries, 6 pt before sections, and 0.5-inch margins. Changes apply only
to the PDF; the editing document stays at a fixed, comfortable size.

Each résumé stores its own format values in `resume.json`.

Use the menu button beside **auto-resume** to open the résumé folder list. Once
the master exists, the **+** beside it opens instructions and a copyable IDE
agent prompt for creating a company-specific résumé or another variation from
the master. The list includes `master`, `companies/<name>`, and
`variants/<name>` folders that contain a `resume.json` file. Each folder remains
an independent résumé.

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
