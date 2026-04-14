#!/usr/bin/env node
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, normalize } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');
const port = Number(process.env.PORT || 3000);

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
  '.ico': 'image/x-icon',
};

function mimeForPath(filePath) {
  const dot = filePath.lastIndexOf('.');
  if (dot === -1) return 'application/octet-stream';
  const ext = filePath.slice(dot).toLowerCase();
  return MIME_BY_EXT[ext] || 'application/octet-stream';
}

function safeResolvePath(urlPathname) {
  const raw = decodeURIComponent(urlPathname.split('?')[0].split('#')[0]);
  const requestPath = raw === '/' ? '/index.html' : raw;
  const normalized = normalize(requestPath).replace(/^(\.\.(\/|\\|$))+/, '');
  const fullPath = resolve(root, `.${normalized.startsWith('/') ? normalized : `/${normalized}`}`);
  if (!fullPath.startsWith(root)) return null;
  return fullPath;
}

const server = createServer(async (req, res) => {
  const method = req.method || 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method Not Allowed');
    return;
  }

  const path = safeResolvePath(req.url || '/');
  if (!path || !existsSync(path)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }

  try {
    const content = await readFile(path);
    res.writeHead(200, { 'Content-Type': mimeForPath(path), 'Cache-Control': 'no-cache' });
    if (method === 'HEAD') {
      res.end();
      return;
    }
    res.end(content);
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal Server Error');
  }
});

server.listen(port, () => {
  console.log(`Stella Decks preview server running at http://localhost:${port}`);
});
