#!/usr/bin/env node
// Super BoundHaven docs portal builder. Pure Node + `marked`. No network access, no CDN.
//
//   node tools/docs-site/build.mjs [--out apps/site/dist/docs]
//
// Converts every *.md in the repo root and docs/** to a styled static HTML page, builds a client-side
// search index, an art gallery, and copies every referenced image. All links between pages are
// relative, so the output works under any URL prefix (e.g. /super-boundhaven/docs/).
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const argOut = process.argv.indexOf('--out');
const OUT = path.resolve(ROOT, argOut > -1 ? process.argv[argOut + 1] : 'apps/site/dist/docs');
const REPO = 'https://github.com/baconspaceman/super-boundhaven';
const BRANCH = 'main';
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.vite', '_work', '__pycache__', '.claude']);
const SKIP_FILES = new Set(['tools/audit/REPORT.md']);
const IMG_EXT = /\.(png|jpe?g|gif|webp|svg)$/i;

const posix = (p) => p.split(path.sep).join('/');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const exists = (p) => fs.stat(p).then(() => true, () => false);

async function walk(dir, filter, acc = []) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await walk(full, filter, acc);
    else if (filter(full)) acc.push(full);
  }
  return acc;
}

// ---- categories --------------------------------------------------------------------------------
const CATS = ['Overview', 'Design', 'Art', 'Engineering', 'Research', 'Decisions'];
function categorize(rel) {
  if (/^docs\/design\//.test(rel) || rel === 'DESIGN_BRIEF.md') return 'Design';
  if (/^docs\/ART_|^docs\/CHARACTER_CREATOR/.test(rel)) return 'Art';
  if (/^docs\/research\//.test(rel)) return 'Research';
  if (rel === 'DECISIONS.md' || rel === 'OPEN_QUESTIONS.md') return 'Decisions';
  if (/^docs\/(NETCODE|NEXT_ACTION)/.test(rel) || /^docs\/superpowers\//.test(rel) || rel === 'CLAUDE_HANDOFF.md') return 'Engineering';
  return 'Overview';
}
const PRIORITY = [
  'README.md', 'docs/README.md', 'docs/PUBLIC_DOCS_INDEX.md', 'docs/design/README.md', 'docs/design/GAME_DESIGN_DOCUMENT.md',
  'docs/design/SKILL_TREE_AND_ABILITIES.md', 'docs/design/MOUNTS_AND_EXPLORATION.md', 'DESIGN_BRIEF.md', 'docs/ART_NORTH_STAR.md',
  'docs/ART_DIRECTION.md', 'docs/ART_WORLD.md', 'docs/CHARACTER_CREATOR.md', 'docs/ART_BLENDER_PIPELINE.md',
  'docs/NETCODE.md', 'docs/NEXT_ACTION.md', 'DECISIONS.md', 'OPEN_QUESTIONS.md',
];
const prio = (rel) => { const i = PRIORITY.indexOf(rel); return i < 0 ? 999 : i; };

// ---- page model --------------------------------------------------------------------------------
const outPath = (rel) => 'p/' + rel.replace(/\.md$/i, '.html'); // path inside OUT
const relUrl = (fromOut, toOut) => {
  const r = posix(path.relative(path.posix.dirname(fromOut), toOut));
  return r.startsWith('.') ? r : r;
};
const rootPrefix = (outFile) => {
  const depth = outFile.split('/').length - 1;
  return depth === 0 ? './' : '../'.repeat(depth);
};
const ghUrl = (rel, isDir) => `${REPO}/${isDir ? 'tree' : 'blob'}/${BRANCH}/${rel}`;

const warnings = [];
const copiedImages = new Map(); // repo-rel -> out-rel

async function copyImage(rel) {
  if (copiedImages.has(rel)) return copiedImages.get(rel);
  const dest = 'img/' + rel;
  await fs.mkdir(path.dirname(path.join(OUT, dest)), { recursive: true });
  await fs.copyFile(path.join(ROOT, rel), path.join(OUT, dest));
  copiedImages.set(rel, dest);
  return dest;
}

const slugify = (t) =>
  t.toLowerCase().replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-') || 'section';

let currentSlugs = new Map();
let currentToc = [];
marked.use({
  gfm: true,
  renderer: {
    heading({ tokens, depth }) {
      const inner = this.parser.parseInline(tokens);
      const plain = tokens.map((t) => t.raw ?? t.text ?? '').join('');
      let id = slugify(plain);
      const n = currentSlugs.get(id) ?? 0;
      currentSlugs.set(id, n + 1);
      if (n) id += '-' + n;
      if (depth >= 2 && depth <= 3) currentToc.push({ depth, id, text: plain.replace(/[`*_]/g, '') });
      return `<h${depth} id="${id}">${inner}<a class="anchor" href="#${id}" aria-label="Link to this section">#</a></h${depth}>\n`;
    },
    code({ text, lang }) {
      if ((lang ?? '').trim() === 'mermaid') {
        return `<figure class="mermaid-fallback"><figcaption>Diagram source (Mermaid). The docs portal does not load external scripts, so the diagram is shown as text; GitHub renders it natively in the repository view.</figcaption><pre><code>${esc(text)}</code></pre></figure>\n`;
      }
      return `<pre><code${lang ? ` class="language-${esc(lang.split(/\s/)[0])}"` : ''}>${esc(text)}</code></pre>\n`;
    },
    table(token) {
      // wrap tables so wide ones scroll on phones
      const head = token.header.map((c, i) => `<th${token.align[i] ? ` align="${token.align[i]}"` : ''}>${this.parser.parseInline(c.tokens)}</th>`).join('');
      const body = token.rows
        .map((r) => '<tr>' + r.map((c, i) => `<td${token.align[i] ? ` align="${token.align[i]}"` : ''}>${this.parser.parseInline(c.tokens)}</td>`).join('') + '</tr>')
        .join('');
      return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>\n`;
    },
  },
});

async function rewriteHref(href, srcRel, mdSet, pageOut, isImage) {
  if (!href || /^(https?:|mailto:|data:|tel:)/i.test(href) || href.startsWith('#')) return href;
  const [pathPart, hash = ''] = href.split('#');
  let decoded;
  try { decoded = decodeURI(pathPart); } catch { decoded = pathPart; }
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(srcRel), decoded)).replace(/\/$/, '');
  if (target.startsWith('..')) { warnings.push(`${srcRel}: link escapes repo: ${href}`); return href; }
  const h = hash ? '#' + hash : '';
  if (mdSet.has(target)) return relUrl(pageOut, outPath(target)) + h;
  const abs = path.join(ROOT, target);
  let st = null;
  try { st = await fs.stat(abs); } catch { /* missing */ }
  if (!st) { warnings.push(`${srcRel}: unresolved link -> ${href}`); return href; }
  if (isImage && st.isFile() && IMG_EXT.test(target)) return relUrl(pageOut, await copyImage(target));
  return ghUrl(target, st.isDirectory()) + h;
}

async function renderMd(src, srcRel, mdSet) {
  const pageOut = outPath(srcRel);
  currentSlugs = new Map();
  currentToc = [];
  const tokens = marked.lexer(src);
  const pending = [];
  marked.walkTokens(tokens, (t) => {
    if (t.type === 'link' || t.type === 'image') {
      pending.push(rewriteHref(t.href, srcRel, mdSet, pageOut, t.type === 'image').then((h) => { t.href = h; }));
    }
    if (t.type === 'html' && /<img[^>]+src=/i.test(t.text)) {
      pending.push(
        (async () => {
          const m = /src="([^"]+)"/i.exec(t.text);
          if (m) {
            const h = await rewriteHref(m[1], srcRel, mdSet, pageOut, true);
            t.text = t.text.replace(m[1], h);
            t.raw = t.text;
          }
        })(),
      );
    }
  });
  await Promise.all(pending);
  return { html: marked.parser(tokens), toc: currentToc.slice() };
}

// ---- templates ---------------------------------------------------------------------------------
const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' shape-rendering='crispEdges'%3E%3Crect width='8' height='8' fill='%230b0b14'/%3E%3Crect x='1' y='1' width='6' height='6' fill='%23ffd84a'/%3E%3Crect x='2' y='2' width='4' height='4' fill='%23ff4f7b'/%3E%3C/svg%3E";

function sidebar(pages, rp, currentOut) {
  const link = (href, label, cur) => `<li><a href="${href}"${cur ? ' aria-current="page"' : ''}>${esc(label)}</a></li>`;
  let h = `<ul class="nav-top">${link(rp + 'index.html', 'Docs home', currentOut === 'index.html')}${link(rp + 'art.html', 'Art gallery', currentOut === 'art.html')}</ul>`;
  for (const c of CATS) {
    const list = pages.filter((p) => p.cat === c);
    if (!list.length) continue;
    const open = list.some((p) => p.out === currentOut);
    h += `<details class="nav-group"${open ? ' open' : ''}><summary>${c}</summary><ul>${list
      .map((p) => link(rp + p.out, p.title, p.out === currentOut))
      .join('')}</ul></details>`;
  }
  return h;
}

function shell({ title, body, out, pages, srcRel, toc = [] }) {
  const rp = rootPrefix(out);
  const tocHtml = toc.length
    ? `<nav class="toc" aria-label="On this page"><h2>On this page</h2><ul>${toc
        .map((t) => `<li class="d${t.depth}"><a href="#${t.id}">${esc(t.text)}</a></li>`)
        .join('')}</ul></nav>`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} - SBH docs</title>
<meta name="description" content="Super BoundHaven design, art, engineering and research documentation.">
<link rel="icon" href="${FAVICON}">
<link rel="stylesheet" href="${rp}assets/docs.css">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="top">
  <button class="menu-btn" id="menu-btn" aria-controls="side" aria-expanded="false">Menu</button>
  <a class="brand" href="${rp}index.html">Super BoundHaven <span>docs</span></a>
  <form class="search" role="search" id="search-form" action="${rp}search.html">
    <label class="sr" for="q">Search the docs</label>
    <input id="q" type="search" placeholder="Search docs..." autocomplete="off" data-root="${rp}">
    <div class="results" id="results" hidden></div>
  </form>
  <a class="site-link" href="${rp}../">Game site</a>
</header>
<div class="layout">
  <aside class="side" id="side" aria-label="Documentation navigation">${sidebar(pages, rp, out)}</aside>
  <main id="main" class="content">
${body}
${srcRel ? `<p class="edit"><a href="${ghUrl(srcRel, false)}">View source on GitHub</a></p>` : ''}
  </main>
  <div class="rail">${tocHtml}</div>
</div>
<footer class="foot">Super BoundHaven is a work in progress. Design pages mark each idea as confirmed, proposal or open. All rights reserved for now; see <a href="${rp}p/NOTICE.html">NOTICE</a>.</footer>
<script src="${rp}assets/docs.js" defer></script>
</body>
</html>
`;
}

const CSS = `:root{color-scheme:dark;--bg:#0b0b14;--bg-alt:#10102a;--surface:#1a1a38;--surface-2:#232350;--line:#3a3a86;--line-soft:#2a2a5c;--text:#f1f2ff;--muted:#b4b7d8;--gold:#ffd84a;--pink:#ff4f7b;--cyan:#3be0ff;--green:#5ef29a;--purple:#9a7bff;
--mono:ui-monospace,'Cascadia Mono','SF Mono',Consolas,'Courier New',monospace;--body:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif}
*,*::before,*::after{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:72px}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.65 var(--body)}
a{color:var(--cyan)}a:hover{color:var(--gold)}
:focus-visible{outline:3px solid #fff;outline-offset:2px}
.skip{position:absolute;left:-999px;top:0;background:var(--gold);color:#000;padding:8px 12px;z-index:100}.skip:focus{left:8px;top:8px}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.top{position:sticky;top:0;z-index:50;display:flex;align-items:center;gap:12px;padding:10px 16px;background:var(--bg-alt);border-bottom:3px solid var(--line)}
.brand{font:700 15px var(--mono);color:var(--gold);text-decoration:none;white-space:nowrap}.brand span{color:var(--pink)}
.site-link{font:13px var(--mono);margin-left:auto;white-space:nowrap}
.menu-btn{display:none;font:13px var(--mono);background:var(--surface);color:var(--text);border:2px solid var(--line);padding:6px 10px;cursor:pointer}
.search{position:relative;flex:1;max-width:420px}
.search input{width:100%;padding:8px 10px;background:var(--bg);color:var(--text);border:2px solid var(--line);font:14px var(--mono);border-radius:4px}
.results{position:absolute;top:100%;left:0;right:0;max-height:70vh;overflow:auto;background:var(--surface);border:2px solid var(--line);box-shadow:0 6px 0 #000}
.results a{display:block;padding:8px 12px;text-decoration:none;color:var(--text);border-bottom:1px solid var(--line-soft)}
.results a:hover,.results a:focus{background:var(--surface-2)}
.results b{color:var(--gold)}.results small{display:block;color:var(--muted);font-size:12px}.results .cat{color:var(--purple);font:11px var(--mono);text-transform:uppercase}
.results p{margin:0;padding:10px 12px;color:var(--muted)}
.layout{display:grid;grid-template-columns:260px minmax(0,1fr) 220px;gap:24px;max-width:1360px;margin:0 auto;padding:0 16px}
.side{position:sticky;top:64px;align-self:start;max-height:calc(100vh - 72px);overflow:auto;padding:16px 0;font-size:14px}
.side ul{list-style:none;margin:0;padding:0}.side li a{display:block;padding:4px 10px;color:var(--muted);text-decoration:none;border-left:3px solid transparent}
.side li a:hover{color:var(--text)}.side a[aria-current=page]{color:var(--gold);border-left-color:var(--pink);background:var(--surface)}
.nav-group{margin-top:10px}.nav-group summary{cursor:pointer;font:700 12px var(--mono);text-transform:uppercase;letter-spacing:.08em;color:var(--purple);padding:4px 10px}
.nav-top{margin-bottom:6px}
.content{padding:24px 0 64px;min-width:0;max-width:860px}
.rail{position:sticky;top:64px;align-self:start;padding-top:24px;font-size:13px;max-height:calc(100vh - 72px);overflow:auto}
.toc h2{font:700 12px var(--mono);text-transform:uppercase;color:var(--purple);margin:0 0 8px}.toc ul{list-style:none;margin:0;padding:0}
.toc a{display:block;padding:2px 0;color:var(--muted);text-decoration:none}.toc a:hover{color:var(--gold)}.toc .d3{padding-left:12px}
h1,h2,h3,h4{line-height:1.25;font-family:var(--mono)}
h1{font-size:28px;color:var(--gold);margin:0 0 16px;text-shadow:3px 3px 0 #000}
h2{font-size:21px;color:var(--cyan);margin:40px 0 12px;padding-bottom:6px;border-bottom:2px solid var(--line-soft)}
h3{font-size:17px;color:var(--green);margin:28px 0 8px}h4{font-size:15px;color:var(--pink)}
.anchor{margin-left:8px;color:var(--line);text-decoration:none;opacity:0}h1:hover .anchor,h2:hover .anchor,h3:hover .anchor,h4:hover .anchor,.anchor:focus{opacity:1}
code{font:0.9em var(--mono);background:var(--surface);padding:1px 5px;border-radius:3px;color:#ffe9a0}
pre{background:#07070f;border:2px solid var(--line-soft);padding:12px 14px;overflow:auto;border-radius:4px}pre code{background:none;padding:0;color:#d8ddff}
blockquote{margin:16px 0;padding:4px 16px;border-left:4px solid var(--purple);background:var(--surface);color:var(--muted)}
.table-wrap{overflow-x:auto;margin:16px 0}table{border-collapse:collapse;min-width:100%;font-size:14px}
th,td{border:1px solid var(--line-soft);padding:6px 10px;text-align:left;vertical-align:top}th{background:var(--surface-2);font-family:var(--mono)}tr:nth-child(even) td{background:rgba(255,255,255,.03)}
img{max-width:100%;height:auto;image-rendering:pixelated;border:2px solid var(--line-soft)}
hr{border:0;border-top:2px dashed var(--line-soft);margin:32px 0}
.mermaid-fallback{margin:16px 0;border:2px dashed var(--purple);padding:8px;background:var(--surface)}.mermaid-fallback figcaption{font-size:12px;color:var(--muted);margin-bottom:6px}.mermaid-fallback pre{margin:0}
.edit{margin-top:48px;font:13px var(--mono)}
.foot{border-top:3px solid var(--line);padding:20px 16px;text-align:center;color:var(--muted);font-size:13px;background:var(--bg-alt)}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px;margin:16px 0 32px}
.card{display:block;background:var(--surface);border:2px solid var(--line);padding:14px;text-decoration:none;color:var(--text);box-shadow:0 4px 0 #000}
.card:hover{border-color:var(--gold)}.card b{color:var(--gold);font-family:var(--mono)}.card span{display:block;color:var(--muted);font-size:13px;margin-top:4px}
.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
.gallery figure{margin:0;background:var(--surface);border:2px solid var(--line);padding:10px}.gallery img{width:100%;background:#000;border:0;object-fit:contain;max-height:360px}
.gallery figcaption{font:12px var(--mono);color:var(--muted);margin-top:6px;word-break:break-all}
.badge{display:inline-block;font:12px var(--mono);padding:2px 8px;border:2px solid var(--line);margin:0 6px 6px 0;color:var(--muted)}
@media (max-width:1100px){.layout{grid-template-columns:240px minmax(0,1fr)}.rail{display:none}}
@media (max-width:760px){
 .menu-btn{display:inline-block}.layout{grid-template-columns:1fr}
 .side{display:none;position:static;max-height:none;border-bottom:2px solid var(--line-soft)}.side.open{display:block}
 .top{flex-wrap:wrap}.search{order:5;flex-basis:100%;max-width:none}.site-link{margin-left:auto}
 h1{font-size:23px}
}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
`;

const JS = `(()=>{
const btn=document.getElementById('menu-btn'),side=document.getElementById('side');
if(btn&&side)btn.addEventListener('click',()=>{const o=side.classList.toggle('open');btn.setAttribute('aria-expanded',String(o));});
const q=document.getElementById('q'),res=document.getElementById('results'),form=document.getElementById('search-form');
if(!q||!res)return;
const root=q.dataset.root||'./';let index=null,loading=null;
const load=()=>loading||(loading=fetch(root+'search-index.json').then(r=>r.json()).then(j=>{index=j;return j;}).catch(()=>{index=[];return[];}));
const esc=s=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function run(){
 const terms=q.value.toLowerCase().split(/\\s+/).filter(t=>t.length>1);
 if(!terms.length){res.hidden=true;return;}
 const scored=[];
 for(const d of index){
  const title=d.title.toLowerCase(),text=d.text.toLowerCase();let score=0,ok=true,first=-1;
  for(const t of terms){const ti=title.indexOf(t),xi=text.indexOf(t);
   if(ti<0&&xi<0){ok=false;break;}
   if(ti>=0)score+=10;if(xi>=0){score+=1+Math.min(5,text.split(t).length-1)*0.3;if(first<0)first=xi;}}
  if(ok)scored.push({d,score,first});
 }
 scored.sort((a,b)=>b.score-a.score);
 res.hidden=false;
 if(!scored.length){res.innerHTML='<p>No matches.</p>';return;}
 res.innerHTML=scored.slice(0,8).map(({d,first})=>{
  const s=first<0?0:Math.max(0,first-50);const snip=esc(d.text.slice(s,s+140));
  return '<a href="'+root+d.url+'"><span class="cat">'+esc(d.cat)+'</span> <b>'+esc(d.title)+'</b><small>'+snip+'...</small></a>';}).join('');
}
q.addEventListener('focus',load);
q.addEventListener('input',()=>{load().then(run);});
q.addEventListener('keydown',e=>{if(e.key==='Escape'){res.hidden=true;q.blur();}});
form.addEventListener('submit',e=>{e.preventDefault();load().then(()=>{run();const a=res.querySelector('a');if(a)location.href=a.href;});});
document.addEventListener('click',e=>{if(!form.contains(e.target))res.hidden=true;});
})();
`;

// ---- main --------------------------------------------------------------------------------------
async function main() {
  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(OUT, { recursive: true });

  const rootMd = (await fs.readdir(ROOT)).filter((f) => f.endsWith('.md')).map((f) => path.join(ROOT, f));
  const docsMd = (await exists(path.join(ROOT, 'docs'))) ? await walk(path.join(ROOT, 'docs'), (f) => f.endsWith('.md')) : [];
  const toolsMd = await walk(path.join(ROOT, 'tools'), (f) => f.endsWith('.md')).catch(() => []);
  const files = [...new Set([...rootMd, ...docsMd, ...toolsMd])]
    .map((f) => posix(path.relative(ROOT, f)))
    .filter((r) => !SKIP_FILES.has(r))
    .sort();
  const mdSet = new Set(files);

  const pages = [];
  for (const rel of files) {
    const src = await fs.readFile(path.join(ROOT, rel), 'utf8');
    const h1 = /^#\s+(.+)$/m.exec(src);
    const title = (h1 ? h1[1] : path.posix.basename(rel, '.md')).replace(/[`*_]/g, '').trim();
    const cat = rel.startsWith('tools/') ? 'Engineering' : categorize(rel);
    pages.push({ rel, src, title, cat, out: outPath(rel) });
  }
  pages.sort((a, b) => prio(a.rel) - prio(b.rel) || a.title.localeCompare(b.title));

  const index = [];
  for (const p of pages) {
    const { html, toc } = await renderMd(p.src, p.rel, mdSet);
    const body = `<article class="doc"><p class="badge">${esc(p.cat)}</p><p class="badge">${esc(p.rel)}</p>\n${html}</article>`;
    const file = path.join(OUT, p.out);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, shell({ title: p.title, body, out: p.out, pages, srcRel: p.rel, toc }));
    index.push({
      title: p.title,
      cat: p.cat,
      url: p.out,
      text: p.src.replace(/```[\s\S]*?```/g, ' ').replace(/[#>*_`|\[\]()]/g, ' ').replace(/\s+/g, ' ').trim(),
    });
  }

  // ---- art gallery ----
  const artDir = path.join(ROOT, 'packages/art/assets');
  const pngs = (await exists(artDir)) ? (await walk(artDir, (f) => f.endsWith('.png'))).map((f) => posix(path.relative(ROOT, f))).sort() : [];
  const shots = (await exists(path.join(ROOT, 'apps/site/public/shots')))
    ? (await walk(path.join(ROOT, 'apps/site/public/shots'), (f) => f.endsWith('.png'))).map((f) => posix(path.relative(ROOT, f))).sort()
    : [];
  const base = (r) => path.posix.basename(r);
  const groups = [
    ['Prototype screenshots', 'Captured from the running prototype client.', shots],
    ['Character and creature previews', 'Generated contact sheets of heroes, mounts, riders, creatures and fonts.', pngs.filter((r) => /characters_preview/.test(base(r)))],
    ['Blender time-of-day previews', 'Procedural Blender scenes, pixelized to the SBH look (dawn, day, sunset, night).', pngs.filter((r) => /preview/.test(base(r)) && r.includes('/blender/'))],
    ['Hero sheets', 'Layered paper-doll sprite sheets used by the character creator.', pngs.filter((r) => /characters_(hero_\d+|layers)\.png$/.test(base(r)))],
    ['Mount sheets', 'Frog, dinosaur, flying drake and cheetah mount sprite sheets.', pngs.filter((r) => /characters_mount_/.test(base(r)))],
    ['Enemies, effects and font', 'Enemy sheet, juice effects and the pixel font.', pngs.filter((r) => /characters_(enemies|fx|font)\.png$/.test(base(r)))],
    ['World tilesets and props', 'Hand-authored 16x16 tile language per region.', pngs.filter((r) => /world_(tiles|props)_/.test(base(r)))],
    ['Parallax background layers', 'Layered backgrounds for each region.', pngs.filter((r) => /world_bg_/.test(base(r)))],
  ];
  let gal = '<h1>Art gallery</h1><p>Every image here is generated or hand-authored inside this repository (pixel code, procedural Blender scenes). Nothing is taken from another game. See the <a href="p/docs/ART_NORTH_STAR.html">art north star</a> for the visual rules.</p>';
  let galCount = 0;
  for (const [name, blurb, list] of groups) {
    if (!list.length) continue;
    gal += `<h2>${esc(name)}</h2><p>${esc(blurb)}</p><div class="gallery">`;
    for (const r of list) {
      const dest = await copyImage(r);
      galCount++;
      gal += `<figure><a href="${dest}"><img src="${dest}" alt="${esc(base(r).replace(/\.png$/, '').replace(/_/g, ' '))}" loading="lazy"></a><figcaption>${esc(r)}</figcaption></figure>`;
    }
    gal += '</div>';
  }
  await fs.writeFile(path.join(OUT, 'art.html'), shell({ title: 'Art gallery', body: `<article class="doc">${gal}</article>`, out: 'art.html', pages, srcRel: null }));
  index.push({ title: 'Art gallery', cat: 'Art', url: 'art.html', text: 'art gallery previews sprites characters mounts tilesets backgrounds blender screenshots' });

  // ---- landing ----
  const pick = (rel) => pages.find((p) => p.rel === rel);
  const card = (rel, blurb) => {
    const p = pick(rel);
    return p ? `<a class="card" href="${p.out}"><b>${esc(p.title)}</b><span>${esc(blurb)}</span></a>` : '';
  };
  const landing = `<article class="doc"><h1>Super BoundHaven documentation</h1>
<p>Design, art, engineering and research notes for Super BoundHaven (SBH), a 16-bit platforming MMO in early development. A playable prototype exists; most of the game is still planned. Pages tag ideas as <b>confirmed</b>, <b>proposal</b> or <b>open</b>.</p>
<h2>Start here</h2><div class="cards">
${card('README.md', 'Project front page, status, how to run it.')}
${card('docs/design/GAME_DESIGN_DOCUMENT.md', 'The master design: movement, skills, mounts, gear, co-op, economy.')}
${card('docs/design/SKILL_TREE_AND_ABILITIES.md', 'Ability layers, stacking, the Movement Budget and a sample tree.')}
${card('docs/design/MOUNTS_AND_EXPLORATION.md', 'Mounts and Metroidvania-style exploration.')}
${card('docs/ART_NORTH_STAR.md', 'The art authority: SMW-style essence, original designs.')}
${card('docs/ART_DIRECTION.md', 'Art direction and palettes.')}
${card('docs/CHARACTER_CREATOR.md', 'Layered humanoid creator and look codes.')}
${card('docs/ART_BLENDER_PIPELINE.md', 'Procedural Blender scenes to pixel art.')}
${card('docs/NETCODE.md', 'Authoritative server, prediction and reconciliation.')}
${card('docs/research/CHARACTER_BLENDER_TO_2D.md', 'Research: Blender-to-2D character approaches.')}
${card('DECISIONS.md', 'Accepted decisions log.')}
${card('OPEN_QUESTIONS.md', 'Questions the owner still has to answer.')}
${card('docs/NEXT_ACTION.md', 'Live roadmap and next steps.')}
<a class="card" href="art.html"><b>Art gallery</b><span>${galCount} images: sheets, previews, tilesets, screenshots.</span></a>
</div>
<h2>All pages</h2>
${CATS.map((c) => {
    const l = pages.filter((p) => p.cat === c);
    return l.length ? `<h3>${c}</h3><ul>${l.map((p) => `<li><a href="${p.out}">${esc(p.title)}</a> <small>(${esc(p.rel)})</small></li>`).join('')}</ul>` : '';
  }).join('')}
<p>Source and issues: <a href="${REPO}">${REPO}</a></p></article>`;
  await fs.writeFile(path.join(OUT, 'index.html'), shell({ title: 'Documentation', body: landing, out: 'index.html', pages, srcRel: null }));

  await fs.mkdir(path.join(OUT, 'assets'), { recursive: true });
  await fs.writeFile(path.join(OUT, 'assets/docs.css'), CSS);
  await fs.writeFile(path.join(OUT, 'assets/docs.js'), JS);
  await fs.writeFile(path.join(OUT, 'search-index.json'), JSON.stringify(index));
  // search.html fallback target for non-JS form submits
  await fs.writeFile(path.join(OUT, 'search.html'), shell({ title: 'Search', body: '<article class="doc"><h1>Search</h1><p>Type in the search box above (JavaScript required).</p></article>', out: 'search.html', pages, srcRel: null }));

  console.log(`docs-site: ${pages.length} pages, ${galCount} gallery images, ${copiedImages.size} copied images -> ${posix(path.relative(ROOT, OUT))}`);
  for (const w of warnings) console.warn('warn:', w);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
