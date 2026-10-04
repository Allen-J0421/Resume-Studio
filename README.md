# Résumé-Studio

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-blue.svg"></a>
  <img alt="Node.js 20+" src="https://img.shields.io/badge/Node.js-20%2B-brightgreen.svg">
  <img alt="Dependencies: none" src="https://img.shields.io/badge/dependencies-none-lightgrey.svg">
</p>

Edit your résumé directly and see the automatically formatted PDF side by side.
Generate a job-description-tailored résumé in seconds, with agents editing the
source file directly; no more copying and pasting back and forth. Adjust spacing
and margins across the entire résumé in one click, without spending hours
fighting with formatting.

This is a lightweight tool designed to help with résumé writing and job
searching by cutting out the repetitive, boring work; not to replace your
judgment with a fully automated, out-of-scope AI-generated résumé. Built for
IDE-based workflows, with fully customizable agent behavior defined through
`AGENTS.md`.

> **Requirements:** VS Code, your own OpenAI or Claude subscription, and the
> Codex or Claude extension so the agent can work alongside you. We handle the
> rest of the setup and dependencies.

---

## Set up on macOS

Double-click **`setup.command`**. It installs Homebrew when needed, followed by
Node.js, MacTeX, and Visual Studio Code. macOS may request your administrator
password during installation. When setup finishes, it opens this folder in
VS Code. Setup and launching are separate: the setup file does not start the
local résumé tool.

If macOS blocks the downloaded file, right-click `setup.command`, choose
**Open**, then choose **Open** again.

You can also run it from Terminal:

```sh
./setup.command
```

## Start Résumé-Studio

After setup opens the folder, press <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd>
on macOS or <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd> on Windows and Linux.

The default **Résumé-Studio: Open editor** task starts the local server and opens
`http://127.0.0.1:4319` in VS Code's integrated browser. Keep its terminal
running while you edit.

To start only the server from a terminal, run `npm start`, then open the printed
URL in a browser.

The repository starts with an empty `master/` folder. On first use, Résumé-Studio
shows a short guide. Attach your most comprehensive version of résumé to your
IDE agent's chat, or paste its text there, then send the copyable prompt shown
in the editor.

After your master résumé is ready, you can create copies and tailor the same
experience around different JDs. We set clear boundaries so the agent knows how
to tell a strong story for the target role instead of inventing a bunch of
random metrics. Vibe everything, save yourself the copy-paste work.

## Editing

Click any name, heading, date, paragraph, or bullet and type normally. Select
text to switch **Bold** and *Italic* buttons. To make text a hyperlink, such as
"LinkedIn" in your headline, select it and press the link button or
<kbd>Cmd</kbd>/<kbd>Ctrl</kbd>+<kbd>K</kbd>, then paste a web address, email,
or phone number. Links stay clickable in the PDF and the Word file. Changes save
automatically and rebuild the PDF.

Hover an entry's title or role row and click the **×** in the left margin to
remove that row; use **Delete entry** to remove the whole entry, and **+ Title**
or **+ Role** to bring a row back.

Use **PDF** and **Word** beside the preview to download the résumé. Each build
writes `resume.pdf` and `resume.docx` together in the résumé's folder. The Word
file is generated natively, without a converter, using the PDF's fonts, sizes,
spacing, and margins, and it copies the exact line and page breaks recorded
while the PDF was typeset, so it looks the same as the PDF and preview.

Use **Format** to adjust PDF typography, spacing, and margins, including text
sizes, line heights, bullet and entry spacing, section spacing, and page
margins. Changes affect only the PDF preview; the editor stays at a fixed,
comfortable size.

Use the menu beside **Résumé-Studio** to manage résumé folders. Once your master
résumé exists, click **+** to get instructions and a copyable agent prompt for
creating a company-specific or custom variant. Each `master`,
`companies/<name>`, or `variants/<name>` folder contains its own independent
`resume.json`.

For now there is a single template: the one-column, reverse-chronological
layout that is standard across tech and finance résumés.

## License

[MIT](LICENSE).
