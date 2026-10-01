#!/usr/bin/env node
// Tiny static server that mounts a directory under a URL prefix, to mimic GitHub project Pages locally.
//   node tools/docs-site/serve.mjs [dir=apps/site/dist] [prefix=/super-boundhaven/] [port=4173]
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const dir = path.resolve(ROOT, process.argv[2] ?? 'apps/site/dist');
let prefix = process.argv[3] ?? '/super-boundhaven/';
if (!prefix.endsWith('/')) prefix += '/';
const port = Number(process.argv[4] ?? 4173);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.txt': 'text/plain', '.ico': 'image/x-icon',
};

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    let p = decodeURIComponent(url.pathname);
    if (p === prefix.slice(0, -1)) { res.writeHead(301, { location: prefix }).end(); return; }
    if (!p.startsWith(prefix)) { res.writeHead(404, { 'content-type': 'text/plain' }).end('404 (outside prefix)'); return; }
    p = p.slice(prefix.length);
    let file = path.join(dir, p);
    if (!file.startsWith(dir)) { res.writeHead(403).end(); return; }
    try {
      let st = await fs.stat(file).catch(() => null);
      if (st?.isDirectory()) {
        if (!url.pathname.endsWith('/')) { res.writeHead(301, { location: url.pathname + '/' }).end(); return; }
        file = path.join(file, 'index.html');
        st = await fs.stat(file).catch(() => null);
      }
      if (!st) { console.warn('404', url.pathname); res.writeHead(404, { 'content-type': 'text/html' }).end('<h1>404</h1>'); return; }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream' });
      res.end(await fs.readFile(file));
    } catch (e) {
      res.writeHead(500).end(String(e));
    }
  })
  .listen(port, () => console.log(`serving ${dir} at http://localhost:${port}${prefix}`));
