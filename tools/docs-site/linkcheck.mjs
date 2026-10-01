#!/usr/bin/env node
// Link checker over a built static tree. Resolves href/src/srcset/CSS-url references in every .html file
// (and url() in .css) relative to the page, under the given URL prefix, and verifies the target exists.
//   node tools/docs-site/linkcheck.mjs [dir=apps/site/dist] [prefix=/super-boundhaven/]
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const dir = path.resolve(ROOT, process.argv[2] ?? 'apps/site/dist');
let prefix = process.argv[3] ?? '/super-boundhaven/';
if (!prefix.endsWith('/')) prefix += '/';

async function walk(d, acc = []) {
  for (const e of await fs.readdir(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    e.isDirectory() ? await walk(f, acc) : acc.push(f);
  }
  return acc;
}
const exists = async (p) => {
  try {
    return await fs.stat(p);
  } catch {
    return null;
  }
};

const files = await walk(dir);
const idCache = new Map();
async function hasId(file, id) {
  if (!idCache.has(file)) {
    const t = await fs.readFile(file, 'utf8');
    idCache.set(file, new Set([...t.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1])));
  }
  return idCache.get(file).has(id);
}

let checked = 0;
const broken = [];
for (const f of files.filter((x) => /\.(html|css)$/.test(x))) {
  const text = await fs.readFile(f, 'utf8');
  const pageUrl = prefix + path.relative(dir, f).split(path.sep).join('/');
  const refs = [];
  if (f.endsWith('.html')) {
    // <meta content> is only a URL for og:image/twitter:image; ignore other meta text.
    for (const m of text.matchAll(/<(?!meta)[^>]*?\s(?:href|src|poster)="([^"]*)"/g)) refs.push(m[1]);
    for (const m of text.matchAll(/<meta[^>]*(?:property|name)="(?:og:image|twitter:image)"[^>]*content="([^"]*)"/g)) refs.push(m[1]);
    for (const m of text.matchAll(/\ssrcset="([^"]*)"/g)) m[1].split(',').forEach((s) => refs.push(s.trim().split(/\s+/)[0]));
  }
  for (const m of text.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) refs.push(m[1]);
  for (let r of refs) {
    r = r.replace(/&amp;/g, '&');
    if (!r || /^(https?:|mailto:|data:|tel:|javascript:)/i.test(r)) continue;
    // placeholder links (href="#") are explicit "not yet" markers in the site; skip bare '#'
    if (r === '#') continue;
    checked++;
    const u = new URL(r, 'http://x' + pageUrl);
    const p = decodeURIComponent(u.pathname);
    if (!p.startsWith(prefix)) {
      broken.push(`${pageUrl}: ${r} -> outside prefix (${p})`);
      continue;
    }
    let target = path.join(dir, p.slice(prefix.length));
    let st = await exists(target);
    if (st?.isDirectory()) {
      target = path.join(target, 'index.html');
      st = await exists(target);
    }
    if (!st) {
      broken.push(`${pageUrl}: ${r} -> missing ${p}`);
      continue;
    }
    if (u.hash.length > 1 && target.endsWith('.html') && !(await hasId(target, decodeURIComponent(u.hash.slice(1))))) {
      broken.push(`${pageUrl}: ${r} -> missing anchor ${u.hash}`);
    }
  }
}
console.log(`linkcheck: ${files.length} files, ${checked} references checked, ${broken.length} broken`);
broken.slice(0, 200).forEach((b) => console.log('  BROKEN', b));
process.exit(broken.length ? 1 : 0);
