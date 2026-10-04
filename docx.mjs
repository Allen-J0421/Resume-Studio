// Word (.docx) renderer for Résumé-Studio. No dependencies.
//
// The Word file is built from the same résumé model as the LaTeX PDF and copies
// its layout: US Letter, the same margins, Times New Roman, the same sizes,
// exact line heights, bullet indents, rules, and right-aligned dates and
// locations. Vertical spacing is solved so every baseline lands where TeX puts
// it. When the build recorded TeX's word positions, every line and page breaks
// exactly where it breaks in the PDF.

import { deflateRawSync } from 'node:zlib';

const PAGE_WIDTH = 612; // US Letter, points
const PAGE_HEIGHT = 792;
const WORD_DESCENT = 0.2163; // Times New Roman descent, in em; Word puts it below the baseline of an exact-height line
const LINESKIP = 1; // LaTeX \lineskip
const TOPSKIP = 10; // LaTeX \topskip in the generated document
const BULLET_WIDTH = 0.35; // em width of the bullet glyph in both Times fonts
const TEX_POINT = 72 / 72.27; // résumé formats are TeX points; Word uses 1/72 inch
const twips = (points) => Math.round(points * 20);
const halfPoints = (points) => Math.round(points * 2);

// Heights and depths of Times glyphs (em), used to reproduce the places where
// TeX measures real characters: the section rule and the first line after it.
const DEPTHS = [
  ['gjpqy', 0.217], ['Q', 0.178], ['()[]{}|', 0.18], [',;', 0.16], ['_', 0.125], ['$', 0.09], ['J', 0.096],
];
const TALL = /[A-Z0-9bdfhklt!?#$%&@/\\'"()[\]{}|]/;

function glyphDepth(text, bold) {
  let depth = text.trim() ? 0.014 : 0;
  for (const character of text) {
    for (const [set, value] of DEPTHS) {
      if (set.includes(character) && (character !== 'J' || bold)) depth = Math.max(depth, value);
    }
  }
  return depth;
}

function glyphHeight(text) {
  let height = 0;
  for (const character of text) {
    if (/\s/.test(character)) continue;
    const base = character.normalize('NFD');
    if (base.length > 1) height = Math.max(height, base[0] === base[0].toUpperCase() && base[0] !== base[0].toLowerCase() ? 0.88 : 0.69);
    else if (character === '$') height = Math.max(height, 0.75);
    else if (TALL.test(character) || /[^\x00-\x7f]/.test(character)) height = Math.max(height, 0.69);
    else if (/[ij]/.test(character)) height = Math.max(height, 0.641);
    else if (/[a-z:;<>+=*~]/.test(character)) height = Math.max(height, 0.46);
    else height = Math.max(height, 0.3);
  }
  return height;
}

const plain = (runs) => runs.map((run) => run.text).join('');
const xml = (text) => String(text)
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
  .replace(/[&<>"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character]);

// Splits formatted runs into text, spaces, and word marks. Mark 0 sits before
// the first character and mark k before the word after the k-th space, which
// are exactly the places TeX may start a new line. The PDF writer records a
// position at every mark; the Word writer breaks lines at the same marks.
export function segmentRuns(runs) {
  let started = false;
  let pendingSpace = false;
  let mark = 0;
  return runs.map((run) => {
    const pieces = [];
    const push = (type, text) => {
      const last = pieces.at(-1);
      if (last?.type === type) last.text += text;
      else pieces.push({ type, text });
    };
    for (const character of run.text) {
      if (/[ \t\r\n]/.test(character)) {
        if (started) pendingSpace = true;
        push('space', character);
        continue;
      }
      if (!started || pendingSpace) {
        pieces.push({ type: 'mark', index: started ? ++mark : 0 });
        started = true;
        pendingSpace = false;
      }
      push('text', character);
    }
    return { run, pieces };
  });
}

// TeX's distance between two baselines: the requested vertical space plus
// \baselineskip, or \lineskip when the boxes would otherwise touch.
function texGap(space, previousDepth, height, baselineSkip) {
  return space + (baselineSkip - previousDepth - height >= 0 ? baselineSkip : previousDepth + height + LINESKIP);
}

// Reads the word positions the LaTeX build wrote: "<mark id> <x> <y> <page>".
export function parsePositions(text = '') {
  const positions = new Map();
  for (const line of text.split(/\r?\n/)) {
    const [id, x, y, page] = line.trim().split(/\s+/);
    if (id && page) positions.set(id, { x: Number(x), y: Number(y), page: Number(page) });
  }
  return positions;
}

export function renderDocx(model, { positions = new Map(), title = '' } = {}) {
  const style = model.format;
  const margin = style.margin * 72;
  const textWidth = PAGE_WIDTH - 2 * margin;
  const body = style.body;
  const exact = positions.size > 0;
  const links = [];
  const paragraphs = [];

  // How TeX ended the line before a mark: '' (same line), 'line', or 'page'.
  let previousMark;
  const breakBefore = (id) => {
    const here = positions.get(id);
    const before = previousMark;
    if (here) previousMark = here;
    if (!here || !before) return '';
    if (here.page !== before.page) return 'page';
    return Math.abs(here.y - before.y) > 32768 ? 'line' : ''; // more than half a point apart
  };

  // Builds Word runs from pieces; a broken line drops its trailing spaces just as TeX does.
  const contentXml = (segments, prefix, extra = {}, afterFirstLine = '') => {
    const items = [];
    let firstLine = true;
    const endFirstLine = () => {
      if (firstLine && afterFirstLine) items.push({ raw: afterFirstLine });
      firstLine = false;
    };
    segments.forEach(({ run, pieces }) => {
      for (const piece of pieces) {
        if (piece.type === 'mark') {
          const kind = breakBefore(`${prefix}.${piece.index}`);
          if (kind && piece.index > 0) {
            while (items.at(-1)?.space) items.pop();
            endFirstLine();
            items.push({ run, br: kind });
          }
          continue;
        }
        items.push({ run, text: piece.text, space: piece.type === 'space' });
      }
    });
    endFirstLine();
    return itemsXml(items, extra);
  };

  const runProperties = (run, extra) => {
    const bold = run.bold || extra.bold;
    const italic = run.italic || extra.italic;
    const size = extra.size && extra.size !== body.size ? `<w:sz w:val="${halfPoints(extra.size)}"/><w:szCs w:val="${halfPoints(extra.size)}"/>` : '';
    const properties = `${bold ? '<w:b/><w:bCs/>' : ''}${italic ? '<w:i/><w:iCs/>' : ''}${size}`;
    return properties ? `<w:rPr>${properties}</w:rPr>` : '';
  };

  // Consecutive items from one run become one Word run, wrapped in its hyperlink.
  const itemsXml = (items, extra) => {
    let out = '';
    let index = 0;
    while (index < items.length) {
      if (items[index].raw) {
        out += items[index].raw;
        index += 1;
        continue;
      }
      const { run } = items[index];
      let children = '';
      while (index < items.length && !items[index].raw && items[index].run === run) {
        const item = items[index];
        if (item.br === 'page') children += '<w:br w:type="page"/>';
        else if (item.br) children += '<w:br/>';
        else children += `<w:t xml:space="preserve">${xml(item.text.replace(/[\t\r\n]/g, ' '))}</w:t>`;
        index += 1;
      }
      const runXml = `<w:r>${runProperties(run, extra)}${children}</w:r>`;
      if (run.link) {
        links.push(run.link);
        out += `<w:hyperlink r:id="rIdLink${links.length}" w:history="1">${runXml}</w:hyperlink>`;
      } else out += runXml;
    }
    return out;
  };

  const textRun = (text, extra) => `<w:r>${runProperties({}, extra)}<w:t xml:space="preserve">${xml(text)}</w:t></w:r>`;
  const markPage = (id) => positions.get(id)?.page;

  // Each paragraph records its TeX metrics; spacing is solved after layout.
  const add = (paragraph) => paragraphs.push({ keepNext: false, keepLines: false, ...paragraph });

  const nameRuns = [{ text: model.name, bold: true }];
  add({
    kind: 'name', size: style.name.size, lineHeight: style.name.lineHeight, align: 'center',
    content: contentXml(segmentRuns(nameRuns), model.ids.name, { size: style.name.size }),
    page: markPage(`${model.ids.name}.0`),
    height: glyphHeight(model.name) * style.name.size,
    depth: glyphDepth(model.name, true) * style.name.size,
  });

  if (model.contact.length) {
    const extra = { size: style.contact.size };
    let content = '';
    model.contact.forEach((runs, index) => {
      const prefix = `${model.ids.contact}.${index}`;
      if (index) {
        // TeX separator: space, \enspace, a bar, space, \enspace. A line break drops the space and \enspace.
        content += breakBefore(`${prefix}.bar`) ? '<w:r><w:br/></w:r>' : textRun('  ', extra);
        content += textRun('|', extra);
        content += breakBefore(`${prefix}.0`) ? '<w:r><w:br/></w:r>' : textRun(' \u2002', extra);
        previousMark = positions.get(`${prefix}.0`) || previousMark;
        content += contentXml(segmentRuns(runs), prefix, extra);
      } else {
        content += contentXml(segmentRuns(runs), prefix, extra);
      }
    });
    const contactText = model.contact.map(plain).join(' | ');
    add({
      kind: 'contact', size: style.contact.size, lineHeight: style.contact.lineHeight, align: 'center', space: 3,
      content, page: markPage(`${model.ids.contact}.0.0`),
      height: glyphHeight(contactText) * style.contact.size,
      depth: glyphDepth(contactText, false) * style.contact.size,
    });
  }

  // A tabularx row is a strut-sized box centred on the math axis.
  const rowBox = { height: body.lineHeight / 2 + 0.25 * body.size, depth: body.lineHeight / 2 - 0.25 * body.size };

  model.sections.forEach((section) => {
    const titleRuns = [{ text: section.title, bold: true }];
    add({
      kind: 'section', size: style.section.size, lineHeight: style.section.lineHeight, space: style.sectionSpacing,
      content: contentXml(segmentRuns(titleRuns), section.id, { size: style.section.size }),
      page: markPage(`${section.id}.0`),
      height: glyphHeight(section.title) * style.section.size,
      depth: glyphDepth(section.title, true) * style.section.size,
      keepNext: true,
    });
    add({ kind: 'rule', keepNext: true });

    section.items.forEach((item, index) => {
      const itemSpace = index ? (item.type === 'entry' ? style.entrySpacing : style.bulletSpacing) : 0;
      if (item.type === 'paragraph') {
        const text = plain(item.runs);
        add({
          kind: 'paragraph', size: body.size, lineHeight: body.lineHeight, space: itemSpace,
          content: contentXml(segmentRuns(item.runs), item.id),
          page: markPage(`${item.id}.0`),
          height: glyphHeight(text) * body.size, depth: glyphDepth(text, false) * body.size,
          keepLines: !exact && section.skills,
        });
        return;
      }
      let space = itemSpace;
      const rows = [];
      if (item.titleRow) rows.push([item.heading, item.location, { bold: true }, `${item.id}.title`]);
      if (item.subtitleRow) rows.push([item.subheading, item.date, { italic: true }, `${item.id}.subtitle`]);
      rows.forEach(([left, right, emphasis, id]) => {
        // The right-hand value follows the first line of the left-hand text, as in the PDF's table row.
        previousMark = undefined;
        const rightXml = right.length ? `<w:r><w:tab/></w:r>${itemsXml(right.map((run) => ({ run, text: run.text })), emphasis)}` : '';
        const leftXml = contentXml(segmentRuns(left), `${id}.left`, emphasis, rightXml);
        add({
          kind: 'row', size: body.size, lineHeight: body.lineHeight, space, tabs: true,
          content: leftXml,
          page: markPage(`${id}.left.0`) ?? markPage(`${id}.right.0`),
          height: rowBox.height, depth: rowBox.depth, keepNext: !exact && id.endsWith('.title') && item.subtitleRow,
        });
        space = 0;
      });
      if (rows.length && item.bullets.length) space += 2;
      item.bullets.forEach((bullet, bulletIndex) => {
        const text = plain(bullet);
        const id = `${item.id}.${bulletIndex}`;
        add({
          kind: 'bullet', size: body.size, lineHeight: body.lineHeight,
          space: bulletIndex ? style.bulletSpacing : space,
          content: contentXml(segmentRuns(bullet), id),
          page: markPage(`${id}.0`),
          height: Math.max(glyphHeight(text), 0.5) * body.size, depth: glyphDepth(text, false) * body.size,
        });
      });
    });
  });

  // Solve Word's "space before" for each paragraph. TeX spaces baselines by
  // the rules in texGap (in TeX points); Word puts an exact-height line's
  // baseline its font descent above the line's bottom (in Word points).
  const descent = (paragraph) => WORD_DESCENT * paragraph.size;
  // Every page's top margin sits where TeX's \topskip puts a body line's baseline.
  const top = margin + TOPSKIP * TEX_POINT - (body.lineHeight * TEX_POINT - WORD_DESCENT * body.size);
  let previous;
  let afterRule = false;
  let page = 1;
  for (const paragraph of paragraphs) {
    if (paragraph.kind === 'rule') {
      // TeX: \vspace{3pt}\hrule height 0.5pt\vspace{5pt}, measured from the title's real depth.
      paragraph.before = (previous.depth + 3) * TEX_POINT - descent(previous);
      paragraph.size = 1;
      paragraph.wordLine = 0.5 * TEX_POINT;
      afterRule = true;
      continue;
    }
    paragraph.wordLine = paragraph.lineHeight * TEX_POINT;
    const raise = paragraph.wordLine - descent(paragraph); // line top to baseline in Word
    if (!previous) {
      // \topskip then \vspace*{-11pt}: interline glue from a zero-depth start, 1pt above the text area.
      const baseline = (Math.max(paragraph.lineHeight, paragraph.height + LINESKIP) - 1) * TEX_POINT;
      paragraph.before = margin + baseline - top - raise;
    } else if (paragraph.page > page) {
      // TeX starts this paragraph on a new page and drops the space above it.
      paragraph.pageBreakBefore = true;
      paragraph.before = Math.max(TOPSKIP, paragraph.height) * TEX_POINT - (top - margin) - raise;
    } else if (afterRule) {
      // After a rule TeX adds no interline glue; the next box sits right under the 5pt space.
      // Word draws the 0.5pt border above the rule paragraph's own 0.5pt line, so take the border back out.
      paragraph.before = (5 + (paragraph.space || 0) + paragraph.height) * TEX_POINT - 0.5 - raise;
    } else {
      const gap = texGap(paragraph.space || 0, previous.depth, paragraph.height, paragraph.lineHeight);
      paragraph.before = gap * TEX_POINT - raise - descent(previous);
    }
    if (paragraph.page) page = Math.max(page, paragraph.page);
    // Lines a paragraph pushes onto a later page are counted by its content's page breaks.
    page += (paragraph.content.match(/w:type="page"/g) || []).length;
    afterRule = false;
    previous = paragraph;
  }
  // Word cannot use negative spacing; carry any shortfall into the next gap.
  let carry = 0;
  for (const paragraph of paragraphs) {
    if (paragraph.pageBreakBefore) carry = 0;
    paragraph.before += carry;
    carry = Math.min(0, paragraph.before);
    paragraph.before = Math.max(0, paragraph.before);
  }

  const paragraphXml = (paragraph) => {
    const properties = [];
    if (paragraph.kind === 'bullet') properties.push('<w:pStyle w:val="ResumeBullet"/>');
    if (paragraph.keepNext) properties.push('<w:keepNext/>');
    if (paragraph.keepLines) properties.push('<w:keepLines/>');
    if (paragraph.pageBreakBefore) properties.push('<w:pageBreakBefore/>');
    if (paragraph.kind === 'rule') properties.push('<w:pBdr><w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/></w:pBdr>');
    if (paragraph.kind === 'bullet') properties.push('<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>');
    if (paragraph.tabs) properties.push(`<w:tabs><w:tab w:val="right" w:pos="${twips(textWidth)}"/></w:tabs>`);
    properties.push(`<w:spacing w:before="${twips(paragraph.before)}" w:after="0" w:line="${Math.max(1, twips(paragraph.wordLine))}" w:lineRule="exact"/>`);
    // Centred text and the rule use the PDF's exact text width.
    if (paragraph.align || paragraph.kind === 'rule') properties.push(`<w:ind w:right="${twips(lineWidth - textWidth)}"/>`);
    if (paragraph.align) properties.push(`<w:jc w:val="${paragraph.align}"/>`);
    const markSize = paragraph.size !== body.size ? `<w:rPr><w:sz w:val="${halfPoints(paragraph.size)}"/><w:szCs w:val="${halfPoints(paragraph.size)}"/></w:rPr>` : '';
    return `<w:p><w:pPr>${properties.join('')}${markSize}</w:pPr>${paragraph.content || ''}</w:p>`;
  };

  // Word's 1/72-inch font sizes are 0.4% larger than TeX's, so the line is widened on the right by
  // that ratio. With TeX's recorded breaks every line ends where it ends in the PDF, so a little
  // more room keeps Word from ever wrapping a line TeX fit by tightening its word spacing.
  const widen = exact ? 1.025 : 1 / TEX_POINT;
  const rightMargin = Math.max(0, margin - textWidth * (widen - 1));
  const lineWidth = PAGE_WIDTH - margin - rightMargin;
  // TeX lets a page's last line hang its descenders into the margin; Word must fit the whole line.
  const bottom = Math.max(0, margin - WORD_DESCENT * body.size - 1);
  const bulletIndent = 10;
  const bulletStart = 4 - BULLET_WIDTH * body.size; // right edge of a 4pt label box

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${paragraphs.map(paragraphXml).join('')}<w:sectPr><w:pgSz w:w="${twips(PAGE_WIDTH)}" w:h="${twips(PAGE_HEIGHT)}"/><w:pgMar w:top="${twips(top)}" w:right="${twips(rightMargin)}" w:bottom="${twips(bottom)}" w:left="${twips(margin)}" w:header="0" w:footer="0" w:gutter="0"/><w:cols w:space="720"/></w:sectPr></w:body></w:document>`;


  const font = '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/>';
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr>${font}<w:kern w:val="2"/><w:sz w:val="${halfPoints(body.size)}"/><w:szCs w:val="${halfPoints(body.size)}"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:widowControl w:val="0"/><w:spacing w:before="0" w:after="0" w:line="${twips(body.lineHeight * TEX_POINT)}" w:lineRule="exact"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:widowControl w:val="0"/><w:suppressAutoHyphens/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="ResumeBullet"><w:name w:val="Résumé Bullet"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:ind w:left="${twips(bulletIndent)}" w:hanging="${twips(bulletIndent - bulletStart)}"/></w:pPr></w:style><w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont"><w:name w:val="Default Paragraph Font"/><w:uiPriority w:val="1"/><w:semiHidden/></w:style></w:styles>`;

  const numberingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="${twips(bulletIndent)}"/></w:tabs><w:ind w:left="${twips(bulletIndent)}" w:hanging="${twips(bulletIndent - bulletStart)}"/></w:pPr><w:rPr>${font}<w:b w:val="0"/><w:i w:val="0"/><w:sz w:val="${halfPoints(body.size)}"/><w:szCs w:val="${halfPoints(body.size)}"/></w:rPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;

  const settingsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:defaultTabStop w:val="720"/><w:autoHyphenation w:val="false"/><w:characterSpacingControl w:val="doNotCompress"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`;

  const relationshipsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rIdNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>${links.map((link, index) => `<Relationship Id="rIdLink${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xml(link)}" TargetMode="External"/>`).join('')}</Relationships>`;

  const files = [
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`],
    ['docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${xml(title || `${model.name} Résumé`.trim())}</dc:title><dc:creator>${xml(model.name)}</dc:creator></cp:coreProperties>`],
    ['word/document.xml', documentXml],
    ['word/styles.xml', stylesXml],
    ['word/numbering.xml', numberingXml],
    ['word/settings.xml', settingsXml],
    ['word/_rels/document.xml.rels', relationshipsXml],
  ];
  return zip(files);
}

// Minimal ZIP writer (deflate, fixed timestamp so identical résumés give identical files).
const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(files) {
  const DOS_TIME = 0;
  const DOS_DATE = (2024 - 1980) << 9 | 1 << 5 | 1;
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, content] of files) {
    const nameBuffer = Buffer.from(name, 'utf8');
    const data = Buffer.from(content, 'utf8');
    const compressed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuffer, compressed);
    centrals.push(central, nameBuffer);
    offset += local.length + nameBuffer.length + compressed.length;
  }
  const centralSize = centrals.reduce((size, part) => size + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}
