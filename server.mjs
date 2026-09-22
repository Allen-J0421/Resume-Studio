import http from 'node:http';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile, watch } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = resolve(process.cwd());
const args = process.argv.slice(2);
const mode = args.includes('--check') ? 'check' : args.includes('--build') ? 'build' : 'serve';
const folderArgument = args.find((argument) => !argument.startsWith('--')) || 'master';
const folder = resolve(root, folderArgument);
const editorPath = join(root, 'editor.html');
const port = Number(process.env.PORT || 4319);

if (relative(root, folder).startsWith('..') || !Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('Use a résumé folder inside this workspace and a valid PORT.');
}

const digest = (text) => createHash('sha256').update(text).digest('hex');
const escapeLatex = (text = '') =>
  text.replace(/[\\{}$&#%_~^]/g, (character) => ({
    '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', '$': '\\$', '&': '\\&',
    '#': '\\#', '%': '\\%', '_': '\\_', '~': '\\textasciitilde{}', '^': '\\textasciicircum{}',
  })[character]);

function assertString(value, label) {
  if (typeof value !== 'string') throw new Error(`${label} must be text.`);
}

function assertPositiveNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new Error(`${label} must be a number greater than zero.`);
}

function assertNonNegativeNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error(`${label} must be zero or greater.`);
}

function assertFormat(format) {
  if (!format || typeof format !== 'object' || Array.isArray(format)) throw new Error('Format must be an object.');
  for (const role of ['body', 'name', 'section', 'contact']) {
    if (!format[role] || typeof format[role] !== 'object' || Array.isArray(format[role])) throw new Error(`Format ${role} must be an object.`);
    assertPositiveNumber(format[role].size, `Format ${role} size`);
    assertPositiveNumber(format[role].lineHeight, `Format ${role} line height`);
  }
  assertNonNegativeNumber(format.bulletSpacing, 'Format bullet spacing');
  assertNonNegativeNumber(format.entrySpacing, 'Format entry spacing');
  assertNonNegativeNumber(format.sectionSpacing, 'Format section spacing');
  assertPositiveNumber(format.margin, 'Format page margin');
}

function assertRichText(value, label) {
  if (typeof value === 'string') return;
  if (!Array.isArray(value)) throw new Error(`${label} must be text or a list of formatted text runs.`);
  value.forEach((run, index) => {
    if (!run || typeof run !== 'object' || Array.isArray(run)) throw new Error(`${label}, run ${index + 1} must be an object.`);
    assertString(run.text, `${label}, run ${index + 1} text`);
    if ('bold' in run && typeof run.bold !== 'boolean') throw new Error(`${label}, run ${index + 1} bold must be true or false.`);
    if ('italic' in run && typeof run.italic !== 'boolean') throw new Error(`${label}, run ${index + 1} italic must be true or false.`);
  });
}

function richTextLatex(value) {
  const runs = typeof value === 'string' ? [{ text: value }] : value;
  return runs.map((run) => {
    let text = escapeLatex(run.text);
    if (run.italic) text = `\\textit{${text}}`;
    if (run.bold) text = `\\textbf{${text}}`;
    return text;
  }).join('');
}

function parseDocument(source) {
  let document;
  try {
    document = JSON.parse(source);
  } catch (error) {
    throw new Error(`resume.json is not valid: ${error.message}`);
  }
  if (!document || typeof document !== 'object' || Array.isArray(document)) throw new Error('resume.json must contain an object.');
  assertFormat(document.format);
  assertString(document.name, 'Name');
  if (!Array.isArray(document.contact)) throw new Error('Contact must be a list.');
  document.contact.forEach((contact, index) => assertString(contact, `Contact ${index + 1}`));
  if (!Array.isArray(document.sections)) throw new Error('Sections must be a list.');
  for (const [sectionIndex, section] of document.sections.entries()) {
    assertString(section?.title, `Section ${sectionIndex + 1} title`);
    if (!Array.isArray(section.items)) throw new Error(`Section ${sectionIndex + 1} items must be a list.`);
    for (const [itemIndex, item] of section.items.entries()) {
      if (item?.type === 'paragraph') {
        assertRichText(item.text, `Section ${sectionIndex + 1}, text ${itemIndex + 1}`);
        if (section.title.trim().toLowerCase() === 'skills' && Array.isArray(item.text)) {
          item.text.forEach((run, runIndex) => {
            if (run.bold && /:\s*$/.test(run.text) && (runIndex !== 0 || /^\s/.test(run.text))) {
              throw new Error(`Skills label "${run.text.trim()}" must start its own paragraph item.`);
            }
          });
        }
      } else if (item?.type === 'entry') {
        for (const field of ['heading', 'date', 'subheading', 'location']) {
          assertString(item[field], `Section ${sectionIndex + 1}, entry ${itemIndex + 1} ${field}`);
        }
        if (!Array.isArray(item.bullets)) throw new Error(`Entry ${itemIndex + 1} bullets must be a list.`);
        item.bullets.forEach((bullet, bulletIndex) => assertRichText(bullet, `Bullet ${bulletIndex + 1}`));
      } else {
        throw new Error(`Section ${sectionIndex + 1}, item ${itemIndex + 1} has an invalid type.`);
      }
    }
  }
  return document;
}

function contactLatex(contact) {
  const label = escapeLatex(contact);
  let url = '';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) url = `mailto:${contact}`;
  else if (/^https?:\/\//i.test(contact)) url = contact;
  else if (/^(?:www\.)?[\w.-]+\.[a-z]{2,}(?:\/\S*)?$/i.test(contact)) url = `https://${contact}`;
  else if (/^\+?[\d\s().-]{7,}$/.test(contact)) url = `tel:${contact.replace(/[^+\d]/g, '')}`;
  if (!url) return label;
  url = url.replace(/[%#&_$]/g, (character) => `\\${character}`);
  return `\\href{${url}}{${label}}`;
}

function renderLatex(source) {
  const document = parseDocument(source);
  const style = document.format;
  const sections = document.sections.map((section, sectionIndex) => {
    let content = '';
    section.items.forEach((item, index) => {
      if (index) content += `\\vspace{${item.type === 'entry' ? style.entrySpacing : style.bulletSpacing}pt}\n`;
      if (item.type === 'paragraph') {
        if (section.title.trim().toLowerCase() === 'skills') content += `\\Needspace{26pt}\n`;
        content += `${richTextLatex(item.text)}\\par\n`;
        return;
      }
      content += `\\resumeRow{${escapeLatex(item.heading)}}{${escapeLatex(item.location)}}\n`;
      if (item.subheading || item.date) {
        content += `\\resumeSubrow{${escapeLatex(item.subheading)}}{${escapeLatex(item.date)}}\n`;
      }
      if (item.bullets.length) {
        content += `\\vspace{2pt}\n\\begin{itemize}\n${item.bullets.map((bullet) => `\\item ${richTextLatex(bullet)}`).join('\n')}\n\\end{itemize}\n`;
      }
    });
    const keepWithContent = sectionIndex ? `\\Needspace{44pt}\n` : '';
    return `${keepWithContent}\\resumeSection{${escapeLatex(section.title)}}\n${content}`;
  }).join('\n');

  const contacts = document.contact.filter(Boolean).map(contactLatex).join(' \\enspace | \\enspace ');

  return String.raw`% Generated from resume.json. Do not edit this file.
\RequirePackage{fix-cm}
\documentclass[letterpaper]{article}
\usepackage[letterpaper,margin=${style.margin}in]{geometry}
\usepackage{fontspec}
\IfFontExistsTF{Times New Roman}{\setmainfont{Times New Roman}}{\setmainfont{TeX Gyre Termes}}
\usepackage{enumitem}
\usepackage{tabularx}
\usepackage{array}
\usepackage{needspace}
\usepackage[hidelinks,unicode,breaklinks]{hyperref}
\usepackage{xurl}
\pagestyle{empty}
\setlength{\parindent}{0pt}
\setlength{\parskip}{0pt}
\setlength{\topskip}{10pt}
\setlength{\tabcolsep}{0pt}
\hyphenpenalty=10000
\exhyphenpenalty=10000
\emergencystretch=1em
\raggedbottom
\raggedright
\urlstyle{same}
\setlist[itemize]{leftmargin=10pt,label=\textbullet,labelwidth=4pt,labelsep=6pt,itemsep=${style.bulletSpacing}pt,topsep=0pt,parsep=0pt,partopsep=0pt}
\newcommand{\resumeSection}[1]{\par\vspace{${style.sectionSpacing}pt}{\fontsize{${style.section.size}}{${style.section.lineHeight}}\selectfont\bfseries #1\par}\vspace{3pt}\hrule height 0.5pt\vspace{5pt}}
\newcommand{\resumeRow}[2]{\par\noindent\begin{tabularx}{\linewidth}{@{}>{\raggedright\arraybackslash}X r@{}}\bfseries #1 & \bfseries #2\end{tabularx}\par}
\newcommand{\resumeSubrow}[2]{\noindent\begin{tabularx}{\linewidth}{@{}>{\raggedright\arraybackslash}X r@{}}\itshape #1 & \itshape #2\end{tabularx}\par}
\begin{document}
\fontsize{${style.body.size}}{${style.body.lineHeight}}\selectfont
\vspace*{-11pt}
{\centering\fontsize{${style.name.size}}{${style.name.lineHeight}}\selectfont\bfseries ${escapeLatex(document.name)}\par}
\vspace{3pt}
{\centering\fontsize{${style.contact.size}}{${style.contact.lineHeight}}\selectfont ${contacts}\par}
${sections}
\end{document}
`;
}

async function atomicWrite(path, value) {
  const temporary = `${path}.tmp`;
  await writeFile(temporary, value);
  await rename(temporary, path);
}

async function compile(source) {
  const latex = renderLatex(source);
  const temporary = await mkdtemp(join(tmpdir(), 'resume-studio-'));
  try {
    await writeFile(join(temporary, 'resume.tex'), latex);
    let output = '';
    try {
      const result = await run('latexmk', ['-xelatex', '-interaction=nonstopmode', '-file-line-error', '-halt-on-error', 'resume.tex'], {
        cwd: temporary,
        maxBuffer: 2_000_000,
      });
      output = result.stdout + result.stderr;
    } catch (error) {
      output = `${error.stdout || ''}${error.stderr || ''}`;
      throw new Error(output.trim() || 'XeLaTeX compilation failed.');
    }
    const pdf = await readFile(join(temporary, 'resume.pdf'));
    const warnings = [...new Set(output.split(/\r?\n/)
      .filter((line) => /Missing character:|Overfull \\[hv]box/i.test(line))
      .map((line) => line.trim()))];
    const pageMatch = output.match(/Output written on .*?\((\d+) pages?/);
    return { latex, pdf, pages: Number(pageMatch?.[1] || 1), warnings };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

async function compileAndPublish(source, targetFolder) {
  const sourcePath = join(targetFolder, 'resume.json');
  const version = digest(source);
  const result = await compile(source);
  if (digest(await readFile(sourcePath, 'utf8')) !== version) return false;
  await atomicWrite(join(targetFolder, 'resume.tex'), result.latex);
  await atomicWrite(join(targetFolder, 'resume.pdf'), result.pdf);
  return { ...result, version };
}

let status = { phase: 'starting', message: 'Preparing PDF…', warnings: [], pages: 0 };
let requested = false;
let building = false;
let activeFolderArgument = folderArgument;
let activeFolder = folder;
let watcherController;

async function resumeFolders() {
  const resumes = [];
  try {
    await readFile(join(root, 'master', 'resume.json'));
    resumes.push({ path: 'master', label: 'Master', kind: 'master' });
  } catch {}
  for (const [parent, kind] of [['companies', 'company'], ['variants', 'variant']]) {
    try {
      const folders = await readdir(join(root, parent), { withFileTypes: true });
      for (const entry of folders.filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
        try {
          await readFile(join(root, parent, entry.name, 'resume.json'));
          resumes.push({ path: `${parent}/${entry.name}`, label: entry.name, kind });
        } catch {}
      }
    } catch {}
  }
  return resumes;
}

function startWatcher() {
  watcherController?.abort();
  const controller = new AbortController();
  watcherController = controller;
  const watchedFolder = activeFolder;
  void (async () => {
    try {
      for await (const event of watch(watchedFolder, { signal: controller.signal })) {
        if (event.filename === 'resume.json' && controller === watcherController) void requestBuild();
      }
    } catch (error) {
      if (error.name !== 'AbortError') console.error(`Could not watch ${watchedFolder}: ${error.message}`);
    }
  })();
}

async function selectFolder(path) {
  const resumes = await resumeFolders();
  if (!resumes.some((resume) => resume.path === path)) throw new Error('That résumé folder is not available.');
  activeFolderArgument = path;
  activeFolder = resolve(root, path);
  status = { phase: 'starting', message: 'Preparing PDF…', warnings: [], pages: 0 };
  startWatcher();
  void requestBuild();
}

async function requestBuild() {
  requested = true;
  if (building) return;
  building = true;
  while (requested) {
    requested = false;
    const targetArgument = activeFolderArgument;
    const targetFolder = activeFolder;
    try {
      const source = await readFile(join(targetFolder, 'resume.json'), 'utf8');
      status = { ...status, phase: 'building', message: 'Rendering PDF…' };
      const result = await compileAndPublish(source, targetFolder);
      if (!result || targetArgument !== activeFolderArgument) {
        requested = true;
        continue;
      }
      status = { phase: 'ready', message: 'PDF ready', warnings: result.warnings, pages: result.pages, pdfVersion: result.version };
    } catch (error) {
      status = error.code === 'ENOENT' && targetArgument === activeFolderArgument
        ? { phase: 'empty', message: 'Create your master résumé to begin', warnings: [], pages: 0 }
        : { ...status, phase: 'error', message: error.message };
    }
  }
  building = false;
}

async function commandLineBuild() {
  const source = await readFile(join(folder, 'resume.json'), 'utf8');
  const result = await compileAndPublish(source, folder);
  if (!result) throw new Error('resume.json changed while compiling; run the command again.');
  console.log(`${folderArgument}: ${result.pages} page${result.pages === 1 ? '' : 's'}`);
  result.warnings.forEach((warning) => console.error(warning));
  if (mode === 'check' && result.warnings.length) process.exitCode = 1;
}

if (mode !== 'serve') {
  await commandLineBuild();
} else {
  await mkdir(folder, { recursive: true });
  console.log(`Starting Résumé-Studio for ${folderArgument}`);
  const server = http.createServer(async (request, response) => {
    try {
      const origin = request.headers.origin;
      if (origin && origin !== `http://127.0.0.1:${port}`) return response.writeHead(403).end('Local requests only');
      if (request.method === 'GET' && request.url === '/') {
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return response.end(await readFile(editorPath));
      }
      if (request.method === 'GET' && request.url === '/source') {
        let source;
        try {
          source = await readFile(join(activeFolder, 'resume.json'), 'utf8');
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
          response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
          return response.end(JSON.stringify({
            empty: true,
            folder: activeFolderArgument,
            resumes: await resumeFolders(),
          }));
        }
        response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        return response.end(JSON.stringify({
          source,
          version: digest(source),
          folder: activeFolderArgument,
          resumes: await resumeFolders(),
        }));
      }
      if (request.method === 'GET' && request.url === '/status') {
        response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        return response.end(JSON.stringify(status));
      }
      if (request.method === 'GET' && request.url?.startsWith('/resume.pdf')) {
        response.writeHead(200, { 'Content-Type': 'application/pdf', 'Cache-Control': 'no-store' });
        return response.end(await readFile(join(activeFolder, 'resume.pdf')));
      }
      if (request.method === 'POST' && request.url === '/select') {
        let body = '';
        for await (const chunk of request) body += chunk;
        const selection = JSON.parse(body);
        await selectFolder(selection.path);
        response.writeHead(200, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ folder: activeFolderArgument }));
      }
      if (request.method === 'POST' && request.url === '/save') {
        let body = '';
        for await (const chunk of request) {
          body += chunk;
          if (body.length > 1_000_000) throw new Error('Résumé data is too large.');
        }
        const update = JSON.parse(body);
        const sourcePath = join(activeFolder, 'resume.json');
        const current = await readFile(sourcePath, 'utf8');
        if (update.version !== digest(current)) {
          response.writeHead(409, { 'Content-Type': 'application/json' });
          return response.end(JSON.stringify({ source: current, version: digest(current) }));
        }
        if (typeof update.source !== 'string') throw new Error('Source must be text.');
        parseDocument(update.source);
        await atomicWrite(sourcePath, update.source);
        void requestBuild();
        response.writeHead(200, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ version: digest(update.source) }));
      }
      response.writeHead(404).end('Not found');
    } catch (error) {
      response.writeHead(400, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: error.message }));
    }
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      const probe = http.get(`http://127.0.0.1:${port}/source`, (response) => {
        response.resume();
        if (response.statusCode === 200) {
          console.log(`Résumé-Studio ready at http://127.0.0.1:${port} (already running)`);
          process.exit(0);
        }
        console.error(`Port ${port} is already in use by another program.`);
        process.exit(1);
      });
      probe.on('error', () => {
        console.error(`Port ${port} is already in use by another program.`);
        process.exit(1);
      });
      return;
    }
    console.error(error.message);
    process.exit(1);
  });

  server.listen(port, '127.0.0.1', async () => {
    startWatcher();
    await requestBuild();
    console.log(`Résumé-Studio ready at http://127.0.0.1:${port}`);
  });
  const close = () => {
    watcherController?.abort();
    server.close(() => process.exit(0));
  };
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
}
