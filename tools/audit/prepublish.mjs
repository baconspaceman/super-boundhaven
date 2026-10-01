#!/usr/bin/env node
// Pre-publish audit for the Super BoundHaven repo. Read-only: it never modifies the tree or git history.
//
//   node tools/audit/prepublish.mjs [--no-history]
//
// Scans tracked + untracked-but-not-ignored files (respects .gitignore via git) and, unless --no-history,
// every commit's added lines for: secrets/tokens/keys, .env files, files over 5 MB, personal e-mail
// addresses, the waitlist data folder, ROM/ISO/archive extensions, absolute local Windows paths and
// committed node_modules/dist. Writes tools/audit/REPORT.md (values are masked so the report itself is
// safe to publish) and exits 1 if any FAIL finding exists.
import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPORT = path.join(ROOT, 'tools/audit/REPORT.md');
const HISTORY = !process.argv.includes('--no-history');
const MAX_BYTES = 5 * 1024 * 1024;

const SELF = new Set(['tools/audit/prepublish.mjs', 'tools/audit/REPORT.md']);
const LOCKFILES = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/;
const BINARY_EXT = /\.(png|jpe?g|gif|webp|ico|bmp|ttf|otf|woff2?|blend\d*|zip|gz|7z|exe|dll|bin|mp3|ogg|wav|mp4|webm|pdf|psd|aseprite)$/i;
const GAME_EXT = /\.(sfc|smc|nes|gb|gbc|gba|nds|n64|z64|iso|rom|cue|chd|zip|7z|rar|sav|srm)$/i;

// FAIL-level secret patterns (high-confidence values).
const SECRET_PATTERNS = [
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{20,}\b/],
  ['GitHub fine-grained token', /\bgithub_pat_[A-Za-z0-9_]{20,}\b/],
  ['AWS access key id', /\bAKIA[0-9A-Z]{16}\b/],
  ['Private key block', /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/],
  ['OpenAI/OpenRouter-style key', /\bsk-(?:or-)?[A-Za-z0-9_-]{20,}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/],
  ['Assigned credential literal', /\b(?:api[_-]?key|secret|passw(?:or)?d|token|auth)[A-Za-z_]*\s*[:=]\s*['"][^'"\s]{12,}['"]/i],
  ['OPENROUTER/GEMINI key assignment', /\b(?:OPENROUTER|GEMINI|OPENAI|ANTHROPIC)_[A-Z_]*KEY\s*[:=]\s*[^\s'"$<]{8,}/],
];
// WARN-level: keyword mentions that deserve a human glance.
const WARN_KEYWORDS = /\b(?:api[_-]?key|secret|password|passwd|private key)\b/i;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const EMAIL_OK = /@(?:users\.noreply\.github\.com|example\.(?:com|org|net|test)|localhost|b.co|something.tld)$/i;
// e.g. C:\Users\name, C:/Users/name, C:\\Users\\name, /c/Users/name
const WINPATH_RE = /(?:\b[A-Za-z]:[\\/]{1,2}|\/[a-z]\/)Users[\\/]{1,2}[^\\/\s'"`)]+/g;

/** @type {{sev:'FAIL'|'WARN', rule:string, where:string, detail:string}[]} */
const findings = [];
const add = (sev, rule, where, detail) => findings.push({ sev, rule, where, detail });

const mask = (s, keep = 4) => (s.length <= keep ? '***' : s.slice(0, keep) + '***(' + s.length + ' chars)');
const maskEmail = (e) => e.replace(/^(.{1,2})[^@]*@/, '$1***@');
const maskPath = (p) => p.replace(/(Users[\\/]{1,2})[^\\/\s]+/, '$1<name>');

function git(args, opts = {}) {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, ...opts });
  return r.status === 0 ? r.stdout : '';
}

function scanText(text, where, { skipEmail = false, skipPath = false, lineOffset = 0, isHistory = false } = {}) {
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    const loc = `${where}:${i + 1 + lineOffset}`;
    for (const [name, re] of SECRET_PATTERNS) {
      const m = re.exec(line);
      if (m) add('FAIL', `secret: ${name}`, loc, mask(m[0]));
    }
    if (!isHistory && WARN_KEYWORDS.test(line) && !SECRET_PATTERNS.some(([, re]) => re.test(line))) {
      add('WARN', 'keyword mention', loc, line.trim().slice(0, 100).replace(WINPATH_RE, maskPath));
    }
    if (!skipEmail) {
      for (const m of line.match(EMAIL_RE) ?? []) {
        if (!EMAIL_OK.test(m)) add('FAIL', 'personal/non-noreply email', loc, maskEmail(m));
      }
    }
    if (!skipPath) {
      for (const m of line.match(WINPATH_RE) ?? []) add('FAIL', 'absolute local path', loc, maskPath(m));
    }
  });
}

// ---- 1. working tree -------------------------------------------------------------------------
const listed = git(['ls-files', '-co', '--exclude-standard', '-z']).split('\0').filter(Boolean);
const tracked = new Set(git(['ls-files', '-z']).split('\0').filter(Boolean));
let scanned = 0;
for (const rel of listed) {
  if (SELF.has(rel)) continue;
  const base = path.posix.basename(rel);
  const status = tracked.has(rel) ? '' : ' (untracked, not ignored)';
  if (/^\.env(\..*)?$/.test(base) && !/\.(example|sample|template)$/.test(base)) {
    // Dev-only files holding nothing but VITE_* localhost URLs are harmless (production builds never load them).
    let harmless = false;
    try {
      const body = (await fs.readFile(path.join(ROOT, rel), 'utf8')).split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
      harmless = /\.development$/.test(base) && body.every((l) => /^VITE_[A-Z_]+=https?:\/\/localhost(:\d+)?\/?$/.test(l));
    } catch {
      /* unreadable: treat as not harmless */
    }
    add(harmless ? 'WARN' : 'FAIL', '.env file', rel, (harmless ? 'dev-only, VITE_* localhost URLs only' : 'environment file would be published') + status);
  }
  if (/(^|\/)node_modules\//.test(rel)) add('FAIL', 'node_modules', rel, 'dependency folder in tree');
  if (/(^|\/)dist\//.test(rel)) add('FAIL', 'dist output', rel, 'build output in tree');
  if (/^apps\/server\/data\//.test(rel)) add('FAIL', 'waitlist data', rel, 'waitlist data must never be published');
  if (GAME_EXT.test(base)) add('FAIL', 'ROM/ISO/archive extension', rel, base);
  let st;
  try {
    st = await fs.stat(path.join(ROOT, rel));
  } catch {
    continue;
  }
  if (st.size > MAX_BYTES) add('FAIL', 'file over 5 MB', rel, `${(st.size / 1048576).toFixed(1)} MB`);
  if (BINARY_EXT.test(base) || st.size > MAX_BYTES) continue;
  const buf = await fs.readFile(path.join(ROOT, rel));
  if (buf.subarray(0, 8000).includes(0)) continue; // binary
  scanned++;
  scanText(buf.toString('utf8'), rel, { skipEmail: LOCKFILES.test(rel), skipPath: LOCKFILES.test(rel) });
}
// Ignored-but-present sensitive data: informational.
for (const sensitive of ['apps/server/data']) {
  try {
    await fs.stat(path.join(ROOT, sensitive));
    add('WARN', 'ignored local data present', sensitive, 'exists locally but is git-ignored; confirm it is never force-added');
  } catch {
    /* absent */
  }
}

// ---- 2. git history --------------------------------------------------------------------------
let commits = 0;
if (HISTORY && git(['rev-parse', '--git-dir']).trim()) {
  commits = Number(git(['rev-list', '--all', '--count']).trim()) || 0;

  // identities
  const idents = new Set(git(['log', '--all', '--format=%an <%ae>%n%cn <%ce>']).split('\n').filter(Boolean));
  for (const id of idents) {
    const email = /<([^>]*)>/.exec(id)?.[1] ?? '';
    if (!EMAIL_OK.test(email)) add('FAIL', 'history: commit author/committer email', 'git log', `${id.replace(email, maskEmail(email))} (rewrite history to a noreply address before publishing)`);
  }
  // paths ever added
  const names = git(['log', '--all', '--name-only', '--format=', '--diff-filter=AM']).split('\n').filter(Boolean);
  for (const n of new Set(names)) {
    if (/^apps\/server\/data\//.test(n)) add('FAIL', 'history: waitlist data', n, 'present in history');
    if (/(^|\/)node_modules\//.test(n) || /(^|\/)dist\//.test(n)) add('FAIL', 'history: node_modules/dist', n, 'present in history');
    if (/(^|\/)\.env(\..*)?$/.test(n) && !/\.(example|sample|template)$/.test(n)) add(/\.env\.development$/.test(n) ? 'WARN' : 'FAIL', 'history: .env file', n, 'present in history (review contents)');
    if (GAME_EXT.test(n)) add('FAIL', 'history: ROM/ISO/archive extension', n, 'present in history');
  }
  // large blobs
  const objs = git(['rev-list', '--objects', '--all']);
  const blobIn = objs.split('\n').filter(Boolean).map((l) => l.split(' ')).filter((p) => p[1]);
  const sizes = spawnSync('git', ['cat-file', '--batch-check=%(objecttype) %(objectname) %(objectsize)'], { cwd: ROOT, input: blobIn.map((p) => p[0]).join('\n') + '\n', encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).stdout ?? '';
  const nameOf = new Map(blobIn.map((p) => [p[0], p.slice(1).join(' ')]));
  for (const l of sizes.split('\n').filter(Boolean)) {
    const [type, sha, size] = l.split(' ');
    if (type === 'blob' && Number(size) > MAX_BYTES) add('FAIL', 'history: file over 5 MB', nameOf.get(sha) ?? sha, `${(Number(size) / 1048576).toFixed(1)} MB`);
  }
  // added lines
  const log = git(['log', '--all', '-p', '--no-color', '--no-ext-diff', '-U0', '--format=commit %h']);
  let commit = '';
  let file = '';
  let newLine = 0;
  const seen = new Set();
  for (const line of log.split('\n')) {
    if (line.startsWith('commit ')) {
      commit = line.slice(7);
    } else if (line.startsWith('+++ b/')) {
      file = line.slice(6);
    } else if (line.startsWith('@@')) {
      newLine = Number(/\+(\d+)/.exec(line)?.[1] ?? 0) - 1;
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      newLine++;
      if (SELF.has(file) || BINARY_EXT.test(file) || LOCKFILES.test(file)) continue;
      const before = findings.length;
      scanText(line.slice(1), `${commit}:${file}`, { lineOffset: newLine - 1, isHistory: true });
      // de-duplicate identical hits that recur across commits
      for (let i = findings.length - 1; i >= before; i--) {
        const key = `${findings[i].rule}|${file}|${findings[i].detail}`;
        if (seen.has(key)) findings.splice(i, 1);
        else {
          seen.add(key);
          findings[i].rule = 'history: ' + findings[i].rule;
        }
      }
    } else if (!line.startsWith('-') && !line.startsWith('+')) {
      // context/headers: nothing to do
    }
  }
}

// ---- 3. report -------------------------------------------------------------------------------
const fails = findings.filter((f) => f.sev === 'FAIL');
const warns = findings.filter((f) => f.sev === 'WARN');
const group = (list) => {
  const m = new Map();
  for (const f of list) (m.get(f.rule) ?? m.set(f.rule, []).get(f.rule)).push(f);
  return m;
};
let md = `# Pre-publish audit report\n\nGenerated by \`tools/audit/prepublish.mjs\`. Matched values are masked.\n\n`;
md += `- Result: **${fails.length ? 'FAIL' : 'PASS'}**\n- Files scanned (text): ${scanned} of ${listed.length} listed\n- Commits scanned: ${HISTORY ? commits : 'skipped (--no-history)'}\n- FAIL findings: ${fails.length}\n- WARN findings: ${warns.length}\n\n`;
for (const [title, list] of [['FAIL', fails], ['WARN (review)', warns]]) {
  md += `## ${title}\n\n`;
  if (!list.length) md += 'None.\n\n';
  for (const [rule, items] of group(list)) {
    md += `### ${rule} (${items.length})\n\n`;
    for (const f of items.slice(0, 60)) md += `- \`${f.where}\` - ${f.detail}\n`;
    if (items.length > 60) md += `- ... and ${items.length - 60} more\n`;
    md += '\n';
  }
}
await fs.writeFile(REPORT, md);
console.log(`audit: ${fails.length} FAIL, ${warns.length} WARN (${scanned} text files, ${commits} commits). Report: tools/audit/REPORT.md`);
for (const [rule, items] of group(fails)) console.log(`  FAIL ${rule}: ${items.length}`);
process.exit(fails.length ? 1 : 0);
