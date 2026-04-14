#!/usr/bin/env node
/**
 * Export deck slides as high-quality PNG screenshots, then compose into a PDF.
 *
 * Usage:
 *   node scripts/export-deck.mjs              -> PNGs + PDF (example deck)
 *   node scripts/export-deck.mjs my-deck      -> Export a specific deck
 *   node scripts/export-deck.mjs --png-only   -> PNGs only
 *   node scripts/export-deck.mjs --pdf-only   -> PDF only (requires PNGs already exported)
 *
 * Output:
 *   exports/{deck}/slides/01-slide-cover.png   (2560x1440, 2x retina)
 *   exports/{deck}/{deck}.pdf                  (1280x720pt pages, image-based)
 */

import puppeteer from 'puppeteer-core';
import { readFileSync, mkdirSync, readdirSync, existsSync, unlinkSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { PDFDocument } from 'pdf-lib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const SLIDE_W = 1280;
const SLIDE_H = 720;
const SCALE = 2; // 2x for retina quality

const args = process.argv.slice(2);
const pngOnly = args.includes('--png-only');
const pdfOnly = args.includes('--pdf-only');

const deckSlug = args.find(a => !a.startsWith('--')) || 'example';
const deckDir = resolve(root, 'decks', deckSlug);
const manifestPath = resolve(deckDir, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
const slides = manifest.slides;

const pngDir = resolve(root, `exports/${deckSlug}/slides`);
const pdfPath = resolve(root, `exports/${deckSlug}/${deckSlug}.pdf`);

const MIME_BY_EXT = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
};

function mimeForPath(filePath) {
  const dot = filePath.lastIndexOf('.');
  if (dot === -1) return 'application/octet-stream';
  const ext = filePath.slice(dot).toLowerCase();
  return MIME_BY_EXT[ext] || 'application/octet-stream';
}

function findChrome() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH && existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  const candidates = [
    // Windows
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    // Linux
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    // WSL
    '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe',
    '/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/mnt/c/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ];

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return undefined;
}

function startServer(port) {
  return new Promise((res) => {
    const server = createServer(async (req, resp) => {
      try {
        const filePath = resolve(root, decodeURIComponent(req.url).slice(1));
        const content = await readFile(filePath);
        const mime = mimeForPath(filePath);
        resp.writeHead(200, { 'Content-Type': mime });
        resp.end(content);
      } catch {
        resp.writeHead(404);
        resp.end('Not found');
      }
    });
    server.listen(port, () => res(server));
  });
}

async function exportPngs() {
  if (existsSync(pngDir)) {
    for (const f of readdirSync(pngDir)) {
      if (f.endsWith('.png')) {
        unlinkSync(resolve(pngDir, f));
      }
    }
  }
  mkdirSync(pngDir, { recursive: true });

  const port = 3850;
  const server = await startServer(port);

  const chromePath = findChrome();
  if (!chromePath) {
    server.close();
    throw new Error(
      'No Chrome/Chromium executable found. Install Chrome or set PUPPETEER_EXECUTABLE_PATH.'
    );
  }

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: chromePath,
    timeout: 60000,
    protocolTimeout: 60000,
  });

  const page = await browser.newPage();
  await page.setViewport({
    width: SLIDE_W,
    height: SLIDE_H,
    deviceScaleFactor: SCALE,
  });

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const slideFile = slide.ref ? slide.ref.file : slide.file;
    const slideDeck = slide.ref ? slide.ref.deck : deckSlug;
    const url = `http://localhost:${port}/decks/${slideDeck}/slides/${slideFile}`;
    const num = String(i + 1).padStart(2, '0');
    const slug = slideFile.replace('.html', '');
    const outFile = resolve(pngDir, `${num}-${slug}.png`);

    process.stdout.write(`  PNG ${num}/${slides.length}: ${slide.label}...`);

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

    await page.evaluate(async () => {
      const families = ['Instrument Serif', 'DM Sans'];
      const weights = ['400', '500', '600', '700'];
      const loads = [];
      for (const f of families) {
        for (const w of weights) {
          loads.push(document.fonts.load(`${w} 16px "${f}"`).catch(() => {}));
          loads.push(document.fonts.load(`italic ${w} 16px "${f}"`).catch(() => {}));
        }
      }
      await Promise.all(loads);
      await document.fonts.ready;
    });

    await page.evaluate((slideNum) => {
      const el = document.querySelector('.slide-num');
      if (el) el.textContent = slideNum;
    }, num);

    await new Promise(r => setTimeout(r, 600));

    await page.screenshot({
      path: outFile,
      type: 'png',
      clip: { x: 0, y: 0, width: SLIDE_W, height: SLIDE_H },
    });

    console.log(' done');
  }

  await browser.close();
  server.close();
  console.log(`\n  ${slides.length} PNGs exported to ${pngDir}\n`);
}

async function composePdf() {
  const pdf = await PDFDocument.create();

  const pngFiles = readdirSync(pngDir)
    .filter(f => f.endsWith('.png') && /^\d{2}-/.test(f))
    .sort();

  if (pngFiles.length === 0) {
    console.error('  No PNGs found. Run without --pdf-only first.');
    process.exit(1);
  }

  console.log(`  Composing ${pngFiles.length} slides into PDF...`);

  for (const file of pngFiles) {
    const imgBytes = await readFile(resolve(pngDir, file));
    const img = await pdf.embedPng(imgBytes);
    const page = pdf.addPage([SLIDE_W, SLIDE_H]);
    page.drawImage(img, { x: 0, y: 0, width: SLIDE_W, height: SLIDE_H });
  }

  pdf.setTitle(manifest.title);
  pdf.setCreator('Stella Decks');
  pdf.setProducer('puppeteer-core + pdf-lib');

  const pdfBytes = await pdf.save();
  await writeFile(pdfPath, pdfBytes);
  console.log(
    `  PDF saved: ${pdfPath} (${pngFiles.length} pages, ${(pdfBytes.length / 1024 / 1024).toFixed(1)}MB)\n`
  );
}

async function main() {
  console.log(`\nExporting "${manifest.title}" (${slides.length} slides)\n`);

  if (!pdfOnly) {
    await exportPngs();
  }

  if (!pngOnly) {
    await composePdf();
  }

  console.log('Done.\n');
}

main().catch(err => {
  console.error('Export failed:', err.message);
  process.exit(1);
});
