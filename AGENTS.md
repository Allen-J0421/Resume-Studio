# Resume Workspace Guide

Use this guide for all future résumé work in this project.

## Purpose

This is a human-directed résumé workspace. Once created, `master/resume.json`
is the most comprehensive version and the default content source. Humans edit
it through the document-style editor; IDE agents may edit the JSON directly.
LaTeX, PDF, and Word (`resume.docx`) files are generated outputs; each build
writes the Word file with the same layout, line breaks, and page breaks as the
PDF.

## First-use setup

The repository intentionally starts with an empty `master/` folder. When the
user attaches an existing résumé or pastes its contents and asks you to create
the master résumé:

1. Read all provided résumé material before writing anything.
2. Create `master/resume.json` using the source structure and initial format
   values below.
3. Treat the first master creation as a verbatim transcription. Preserve every
   legible word, number, punctuation mark, capitalization choice, section and
   entry order, and bullet boundary exactly as they appear in the source. Do
   not rewrite, correct, summarize, standardize, add, remove, or
   infer anything. Preserve visible bold and italic emphasis with formatted
   text runs when the source uses it.
4. Do not apply the Content refinement guidance during this first import. That
   guidance applies only when the user later asks to revise or tailor wording.
5. Preserve attached and reference files unchanged.
6. Build and check the generated PDF, then compare all transcribed text against
   the source in order and visually inspect every page before reporting
   completion.

If any source text is missing, unreadable, or ambiguous, ask the user for that
text instead of guessing or completing the first import. A minimal valid file
has this shape:

```json
{
  "format": {
    "body": { "size": 10, "lineHeight": 12 },
    "name": { "size": 20, "lineHeight": 20 },
    "section": { "size": 12, "lineHeight": 12.4 },
    "contact": { "size": 11, "lineHeight": 13 },
    "bulletSpacing": 2,
    "entrySpacing": 4,
    "sectionSpacing": 6,
    "margin": 0.5
  },
  "name": "",
  "contact": [],
  "sections": []
}
```

## Workflow

1. Default to `master/resume.json` unless the user directs you to another
   résumé folder. Follow the first-use setup when it does not exist.
2. For a company-specific résumé, copy `master/resume.json` to
   `companies/<company-or-role>/resume.json`. For another reusable variation,
   copy it to `variants/<variation-name>/resume.json`. Use a short,
   filesystem-safe folder name, preserve the copied formatting, and edit only
   the new résumé. Never change `master/resume.json` while tailoring a copy.
3. Preserve reference files as read-only sources.
4. Build and visually verify every résumé edit.

Do not edit generated `resume.tex`, `resume.pdf`, or `resume.docx`. Do not synchronize résumé
copies, rename files, or change unrelated variants unless requested.

## Source structure

Keep the existing JSON shape. Each résumé contains:

- `format`: the current PDF typography, spacing, and margin values. The Format
  panel writes these values, and agents must read and preserve them.
- `name`: the candidate's name.
- `contact`: items for a city, email, phone number, or website. Plain-text
  emails, phone numbers, and websites become links automatically. To show a
  label such as "LinkedIn" that links elsewhere, use formatted text runs:
  `[{ "text": "LinkedIn", "link": "https://www.linkedin.com/in/name" }]`.
- `sections`: ordered section titles containing ordered items.
- A paragraph item has `type: "paragraph"` and `text`.
- An entry item has `type: "entry"`, heading, date, subheading, location, and
  a list of bullets. A row whose two fields are both empty is left out of the
  PDF and Word file: heading and location form the title row; subheading and
  date form the role row.
- Contact items, entry fields, paragraph text, and bullets may use a list of
  formatted text runs when partial emphasis or a link is needed. Each run has
  `text` and may set `bold` or `italic` to `true` and `link` to a web address,
  email address, or phone number; keep ordinary unformatted content as a
  string.

All written content remains plain text. Never put Markdown, HTML, or LaTeX
commands in `resume.json`; use formatted text runs instead.

## Content refinement

Ground every claim in user-provided material. Never invent metrics,
technologies, responsibilities, qualifications, scale, or outcomes. Write
concise accomplishment bullets rather than task or feature inventories.
Establish the candidate's contribution, include relevant methods when they add
useful evidence, and state supported results or improvements. Avoid repeating
the same context or outcome across bullets.

Aim for no more than two rendered lines per bullet when practical. If a bullet
runs longer, tighten the writing rather than changing the format. Within each
section, use reverse chronological order and put ongoing entries first unless
the user requests another order.

In a Skills section, put every category in its own paragraph item so every bold
label always starts a new rendered line. Begin each paragraph with the category
label bolded through its colon, such as **Marketing & Growth:**, using a
formatted text run. Keep the skills after the label in regular text on that
same line unless the source uses other emphasis.

## PDF formatting

Every résumé stores its own formatting in `format`. The editor's Format panel
updates this object, and the generated PDF must always use its current values.
Do not replace or normalize user-selected format values unless the user asks.
New master résumés start with 10/12 pt body text, 20/20 pt name text, 12/12.4 pt
section headings, 11/13 pt contact text, 2 pt between bullets, 4 pt between
entries, 6 pt before sections, and 0.5-inch margins.

The layout uses US Letter, Times New Roman when installed with TeX Gyre Termes
as fallback, consistent section rules and entry alignment, no paragraph
indentation, and no page numbers, headers, footers, or hyphenation. Treat the
section's leading space as the single shared gap after the contact line; do not
add a second contact-to-section gap. Render each entry with heading and
location on the first row, then subheading and date on the second row. Keep the
right-hand values at their natural width so the left side receives the
remaining line width. Use a 4 pt bullet label width and 6 pt label separation.
Apply the configured entry spacing before entries; use the configured bullet
spacing between additional standalone paragraphs rather than entry spacing.
Keep later section headings with their following content, but do not apply that
page-space guard to the first section.

Do not shrink text, change margins, delete content, or insert manual page breaks
to force a page count. Report natural pagination.

## Build and verification

From the workspace root:

```sh
npm run build -- master
npm run check -- master
```

Replace `master` with the target folder. `check` reports missing characters,
overfull boxes, and page count. After every edit, inspect every generated PDF
page for clipping, overlap, bad wrapping, stranded headings, uneven rules, and
misaligned dates or locations. A successful compile does not establish visual
correctness.
