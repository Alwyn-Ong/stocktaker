// Generates a slide deck from USER_MANUAL.md.
//
// Usage: node scripts/generate-manual-pptx.mjs [--out <path>] [--version <x.y.z>]
//
// Title slide from the manual's `#` heading, one slide (or more, when the
// content overflows) per `##` section. Bullets, nesting, and **bold** carry
// over; other markdown syntax is stripped.

import fs from 'node:fs';
import path from 'node:path';
import pptxgen from 'pptxgenjs';

const ROOT = path.resolve(import.meta.dirname, '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const OUT = path.resolve(ROOT, arg('out', 'dist/Stocktaker_User_Manual_Slides.pptx'));
const VERSION = arg(
  'version',
  JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version
);

const ACCENT = '1F2933'; // matches the app's adaptive-icon background
const GREY = '52606D';

// --- markdown parsing -------------------------------------------------------

// Inline markdown -> text runs. Handles **bold** and `code`; other markers
// are stripped.
function parseInline(text) {
  const runs = [];
  const re = /\*\*(.+?)\*\*|`([^`]+)`/g;
  let last = 0;
  let m;
  const plain = (s) => s.replace(/\*(\S[^*]*)\*/g, '$1');
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) runs.push({ text: plain(text.slice(last, m.index)) });
    if (m[1] !== undefined) runs.push({ text: m[1], bold: true });
    else runs.push({ text: m[2], fontFace: 'Courier New' });
    last = m.index + m[0].length;
  }
  if (last < text.length) runs.push({ text: plain(text.slice(last)) });
  return runs.filter((r) => r.text.length > 0);
}

// Manual body -> [{ title, blocks: [{ runs, bullet, indent }] }]
function parseManual(md) {
  const lines = md.split('\n');
  let docTitle = 'User Manual';
  const introLines = [];
  const sections = [];
  let current = null;
  let pending = null; // { indent, bullet, parts: [] }

  const flush = () => {
    if (pending && current) {
      current.blocks.push({
        runs: parseInline(pending.parts.join(' ')),
        bullet: pending.bullet,
        indent: pending.indent,
      });
    }
    pending = null;
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    const h1 = line.match(/^# (.+)/);
    const h2 = line.match(/^## (.+)/);
    const li = line.match(/^(\s*)- (.*)/);

    if (h1) {
      flush();
      docTitle = h1[1];
    } else if (h2) {
      flush();
      current = { title: h2[1], blocks: [] };
      sections.push(current);
    } else if (line.trim() === '') {
      flush();
    } else if (li) {
      flush();
      pending = { indent: Math.min(Math.floor(li[1].length / 2), 3), bullet: true, parts: [li[2]] };
    } else if (pending) {
      pending.parts.push(line.trim());
    } else if (current) {
      pending = { indent: 0, bullet: false, parts: [line.trim()] };
    } else {
      // intro paragraph between the doc title and the first section
      introLines.push(line.trim());
    }
  }
  flush();
  return { docTitle, intro: introLines.join(' '), sections };
}

// --- deck building ----------------------------------------------------------

// Rough wrapped-line count so long sections split across slides.
function blockLines(block) {
  const chars = block.runs.reduce((n, r) => n + r.text.length, 0);
  return Math.max(1, Math.ceil(chars / 85));
}

function chunkBlocks(blocks, maxLines = 15) {
  const chunks = [];
  let chunk = [];
  let used = 0;
  for (const b of blocks) {
    const n = blockLines(b);
    if (chunk.length > 0 && used + n > maxLines) {
      chunks.push(chunk);
      chunk = [];
      used = 0;
    }
    chunk.push(b);
    used += n;
  }
  if (chunk.length > 0) chunks.push(chunk);
  return chunks;
}

function blocksToTextRuns(blocks) {
  return blocks.flatMap((block) =>
    block.runs.map((run, i) => ({
      text: run.text,
      options: {
        bold: run.bold ?? false,
        fontFace: run.fontFace,
        bullet: i === 0 && block.bullet ? { code: '2022' } : false,
        indentLevel: block.indent,
        breakLine: i === block.runs.length - 1,
        paraSpaceAfter: i === block.runs.length - 1 ? 8 : 0,
      },
    }))
  );
}

const { docTitle, intro, sections } = parseManual(
  fs.readFileSync(path.join(ROOT, 'USER_MANUAL.md'), 'utf8')
);

const pptx = new pptxgen();
pptx.layout = 'LAYOUT_16x9';
pptx.author = 'Stocktaker release script';
pptx.title = `${docTitle} v${VERSION}`;

const now = new Date();
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

// Title slide
{
  const slide = pptx.addSlide();
  slide.background = { color: ACCENT };
  slide.addText(docTitle, {
    x: 0.6, y: 1.6, w: 8.8, h: 1.0, fontSize: 40, bold: true, color: 'FFFFFF',
  });
  slide.addText(`Version ${VERSION} — ${today}`, {
    x: 0.6, y: 2.6, w: 8.8, h: 0.5, fontSize: 18, color: 'CBD2D9',
  });
  if (intro) {
    slide.addText(intro, {
      x: 0.6, y: 3.3, w: 8.8, h: 1.4, fontSize: 14, color: 'E4E7EB', valign: 'top',
    });
  }
}

for (const section of sections) {
  const chunks = chunkBlocks(section.blocks);
  chunks.forEach((blocks, i) => {
    const slide = pptx.addSlide();
    const title = i === 0 ? section.title : `${section.title} (cont.)`;
    slide.addText(title, {
      x: 0.5, y: 0.35, w: 9.0, h: 0.6, fontSize: 26, bold: true, color: ACCENT,
    });
    slide.addShape('line', { x: 0.5, y: 1.0, w: 9.0, h: 0, line: { color: ACCENT, width: 1.5 } });
    slide.addText(blocksToTextRuns(blocks), {
      x: 0.5, y: 1.15, w: 9.0, h: 4.2, fontSize: 13, color: '323F4B', valign: 'top',
    });
    slide.addText(`Stocktaker v${VERSION}`, {
      x: 7.6, y: 5.35, w: 1.9, h: 0.3, fontSize: 9, color: GREY, align: 'right',
    });
  });
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
await pptx.writeFile({ fileName: OUT });
console.log(`Wrote ${path.relative(ROOT, OUT)} (v${VERSION}, ${sections.length} sections)`);
