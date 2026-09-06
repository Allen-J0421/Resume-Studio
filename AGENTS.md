# Resume Workspace Guide

Use this guide for all future résumé work in this project.

## Purpose

This is a human-directed résumé workspace. Once created, `master/resume.json`
is the most comprehensive version and the default content source. Humans edit
it through the document-style editor; IDE agents may edit the JSON directly.
LaTeX and PDF files are generated outputs.

## First-use setup

The repository intentionally starts with an empty `master/` folder. When the
user attaches an existing résumé or pastes its contents and asks you to create
the master résumé:

1. Read all provided résumé material before writing anything.
2. Create `master/resume.json` using the source structure below. Use `compact`
   unless the user requests another layout.
3. Transcribe the user's facts faithfully. Do not add plausible details or
   silently omit content that does not fit the expected structure.
4. Preserve attached and reference files unchanged.
5. Build, check, and visually inspect the generated PDF.

If the source is missing, unreadable, or ambiguous, ask the user for the needed
material instead of creating sample content. A minimal valid file has this
shape:

```json
{
  "layout": "compact",
  "name": "",
  "contact": [],
  "sections": []
}
```

## Workflow

1. Default to `master/resume.json` unless the user directs you to another
   résumé folder. Follow the first-use setup when it does not exist.
2. For a tailored résumé, copy `master/` into the requested variant or
   `companies/<company>/` folder and edit only that copy.
3. Preserve reference files as read-only sources.
4. Build and visually verify every résumé edit.

Do not edit generated `resume.tex` or `resume.pdf`. Do not synchronize résumé
copies, rename files, or change unrelated variants unless requested.

## Source structure

Keep the existing JSON shape. Each résumé contains:

- `layout`: `compact`, `standard`, or `spacious`.
- `name`: the candidate's name.
- `contact`: plain text for a city, email, phone number, or website. Recognized
  emails, phone numbers, and websites become links automatically.
- `sections`: ordered section titles containing ordered items.
- A paragraph item has `type: "paragraph"` and `text`.
- An entry item has `type: "entry"`, heading, date, subheading, location, and
  a list of bullets.
- Paragraph text and bullets may use a list of formatted text runs when partial
  emphasis is needed. Each run has `text` and may set `bold` or `italic` to
  `true`; keep ordinary unformatted content as a string.

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

## Layout presets

Compact is the minimum format: 10/12 pt body, 20/20 pt name, 12/12.4 pt
section headings, 11/13 pt contact text, 2 pt between bullets, 4 pt between
entries, 6 pt before sections, and 0.5-inch margins.

Standard uses 11/13 pt body, 22/24 pt name, 12.5/14 pt section headings,
11/13 pt contact text, 3 pt between bullets, 6 pt between entries, 8 pt before
sections, and 0.6-inch margins.

Spacious uses 11.5/14 pt body, 24/26 pt name, 13/15 pt section headings,
11.5/14 pt contact text, 4 pt between bullets, 8 pt between entries, 10 pt
before sections, and 0.7-inch margins.

All presets use US Letter, Times New Roman when installed with TeX Gyre Termes
as fallback, consistent section rules and entry alignment, no paragraph
indentation, and no page numbers, headers, footers, or hyphenation. Treat the
section's leading space as the single shared gap after the contact line; do not
add a second contact-to-section gap. Render each entry with heading and
location on the first row, then subheading and date on the second row. Keep the
right-hand values at their natural width so the left side receives the
remaining line width. Use a 4 pt bullet label width and 6 pt label separation.
Apply preset entry spacing before entries; use the preset bullet spacing
between additional standalone paragraphs rather than entry spacing. Keep later
section headings with their following content, but do not apply that page-space
guard to the first section.

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
