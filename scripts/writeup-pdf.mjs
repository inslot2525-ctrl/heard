// Build the submission PDF from docs/WRITEUP.md.
//
//   VIDEO_URL=https://youtu.be/... node scripts/writeup-pdf.mjs
//
// - Drops the draft note and the internal demo-video script.
// - Fills the App Key and demo passcode from .env, so neither is ever committed in the write-up.
// - Writes docs/writeup/out/Heard-writeup.html and .pdf (gitignored: the PDF contains the passcode).
// - Lists any [placeholder] still left, and refuses to finish if one is.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const root = fileURLToPath(new URL('..', import.meta.url));
const env = Object.fromEntries(
  readFileSync(`${root}.env`, 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]),
);
const appKey = env.VITE_NEXCONN_APP_KEY || env.NEXCONN_APP_KEY;
const passcode = env.DEMO_PASSCODE;
const video = process.env.VIDEO_URL;
if (passcode === 'rocky_balboa') {
  console.error('DEMO_PASSCODE in .env is still the old one. Put the new passcode in .env first.');
  process.exit(1);
}

let md = readFileSync(`${root}docs/WRITEUP.md`, 'utf8');
md = md.slice(0, md.indexOf('\n---\n\n## Demo video script')); // internal script stays out of the PDF
md = md.replace(/^# .*\n\n(> .*\n)+\n/, ''); // title + draft note
md = md
  .replace('[new DEMO_PASSCODE]', passcode ? `\`${passcode}\`` : '[new DEMO_PASSCODE]')
  .replace('[App Key]', appKey ? `\`${appKey}\`` : '[App Key]')
  .replace('**Video:** [link]', video ? `**Video:** ${video}` : '**Video:** [link]');

const left = [...md.matchAll(/\[[^\]]+\](?!\()/g)].map((m) => m[0]);

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Heard: Nexconn Build Challenge 2026</title>
<style>
  @page { size: A4; margin: 16mm 15mm; }
  body { font-family: Inter, "Segoe UI", system-ui, sans-serif; color: #0f172a; font-size: 10.5pt; line-height: 1.5; }
  header { border-bottom: 3px solid #1d4ed8; padding-bottom: 8px; margin-bottom: 14px; }
  header h1 { font-size: 24pt; margin: 0; letter-spacing: -0.02em; }
  header p { margin: 2px 0 0; color: #475569; }
  h2 { font-size: 14pt; color: #1d4ed8; margin: 18px 0 6px; page-break-after: avoid; }
  table { border-collapse: collapse; width: 100%; font-size: 9.5pt; margin: 6px 0; page-break-inside: avoid; }
  th, td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #eff6ff; }
  code { background: #f1f5f9; padding: 0 3px; border-radius: 3px; font-size: 9.5pt; }
  li { margin: 2px 0; }
  a { color: #1d4ed8; }
  .shots { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 10px 0; page-break-inside: avoid; }
  .shots img { width: 100%; border: 1px solid #cbd5e1; border-radius: 4px; }
  .shots figcaption { font-size: 8.5pt; color: #475569; }
</style></head><body>
<header><h1>Heard</h1><p>Hostel students, heard before it's a crisis · Nexconn Build Challenge 2026 · Humanitarian &amp; Social Good · Team: Aditya Chimurkar, Om</p></header>
${marked.parse(md)}
<h2>Screens</h2>
<div class="shots">
${[
  ['inbox', 'Mentor inbox: evidence, no scores'],
  ['register-flag', 'Register flag with the perception gap and a target'],
  ['register-photo', 'Hostel register read from a photo, checked before saving'],
  ['ask-heard', 'Ask Heard: receipts checked by code'],
  ['journey', "A student's journey, in their words (translated)"],
  ['review', 'Advisory six-month review: the mentor decides'],
]
  .map(([f, c]) => `<figure style="margin:0"><img src="../../screenshots/${f}.jpg"><figcaption>${c}</figcaption></figure>`)
  .join('\n')}
</div>
</body></html>`;

const out = `${root}docs/writeup/out`;
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/Heard-writeup.html`, html);
console.log(`html: ${out}/Heard-writeup.html`);

if (left.length) {
  console.error(`Still to fill in: ${[...new Set(left)].join(', ')}. Not making the PDF yet.`);
  process.exit(2);
}

const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find(existsSync);
if (!chrome) {
  console.error('Chrome not found: open the HTML in a browser and print to PDF.');
  process.exit(3);
}
execFileSync(chrome, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${out}/Heard-writeup.pdf`, `file:///${out}/Heard-writeup.html`.replace(/\\/g, '/')], { stdio: 'ignore' });
console.log(`pdf:  ${out}/Heard-writeup.pdf`);
