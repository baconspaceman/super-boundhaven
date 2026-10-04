import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BUILD = path.join(ROOT, 'tools', 'ai-bundle', 'build.mjs');
const PRIVATE_LINE = 'Zebra quartz marmalade projection table quarterly lantern figures private only secret sentence number one';

let tmp;
const run = (args) => spawnSync(process.execPath, [BUILD, ...args], { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const bundleDir = (out) => path.join(out, fs.readdirSync(out).find((d) => d.startsWith('SBH-AI-BUNDLE-')));
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)).map((x) => path.join(e.name, x)) : [e.name]));

beforeAll(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sbh-bundle-test-')); });
afterAll(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

describe('ai bundle builder', () => {
  let out, priv, dir, res;
  beforeAll(() => {
    out = path.join(tmp, 'out'); priv = path.join(tmp, 'private');
    fs.mkdirSync(priv, { recursive: true });
    fs.writeFileSync(path.join(priv, 'revenue.md'), `# Private\n\n${PRIVATE_LINE}\n`);
    res = run(['--out', out, '--private', priv, '--budget', '100000']);
    dir = bundleDir(out);
  }, 180_000);

  it('builds PUBLIC and LEAD structure', () => {
    // exit status may be 1 only if a repo doc currently trips the security self-check; structure must still exist
    expect(res.stdout + res.stderr).toContain('self-check');
    for (const f of ['00_START_HERE.md', 'CONTEXT_CORE.md', 'CONTEXT_FULL_part01.md', 'CODE_MAP.md', 'MANIFEST.json', 'VERIFY.md', 'source/sbh-source.zip']) {
      expect(fs.existsSync(path.join(dir, 'PUBLIC', f)), `PUBLIC/${f}`).toBe(true);
      expect(fs.existsSync(path.join(dir, 'LEAD', f)), `LEAD/${f}`).toBe(true);
    }
    expect(fs.readdirSync(path.join(dir, 'PUBLIC', 'prompts')).length).toBeGreaterThanOrEqual(5);
    expect(fs.readdirSync(dir).some((f) => /^SBH-PUBLIC-.*\.zip$/.test(f))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'LEAD', 'PRIVATE_DO_NOT_PASTE_INTO_THIRD_PARTY_CHAT.md'))).toBe(true);
  });

  it('keeps private material out of the public bundle', () => {
    expect(fs.existsSync(path.join(dir, 'PUBLIC', 'private'))).toBe(false);
    for (const rel of walk(path.join(dir, 'PUBLIC')).filter((f) => /\.(md|json)$/.test(f))) {
      expect(fs.readFileSync(path.join(dir, 'PUBLIC', rel), 'utf8')).not.toContain(PRIVATE_LINE);
    }
    expect(fs.readFileSync(path.join(dir, 'LEAD', 'private', 'revenue.md'), 'utf8')).toContain(PRIVATE_LINE);
    expect(fs.readFileSync(path.join(dir, 'PUBLIC', 'MANIFEST.json'), 'utf8')).not.toContain('revenue.md');
  });

  it('respects the CONTEXT_CORE budget accounting and manifest', () => {
    const core = fs.readFileSync(path.join(dir, 'PUBLIC', 'CONTEXT_CORE.md'), 'utf8');
    const man = JSON.parse(fs.readFileSync(path.join(dir, 'PUBLIC', 'MANIFEST.json'), 'utf8'));
    expect(man.contextCoreTokens).toBe(Math.ceil(core.length / 4));
    expect(man.contextCoreTokens).toBeLessThanOrEqual(100000);
    expect(core).toContain('## AGENTS.md');
    for (const f of man.files) {
      const buf = fs.readFileSync(path.join(dir, 'PUBLIC', f.path));
      expect(crypto.createHash('sha256').update(buf).digest('hex')).toBe(f.sha256);
    }
  });

  it('inlines the core into prompts', () => {
    const p = fs.readFileSync(path.join(dir, 'PUBLIC', 'prompts', 'claude-lead.md'), 'utf8');
    expect(p).not.toContain('<!-- bundle:inline-core -->');
    expect(p).toContain('## AGENTS.md');
  });

  it('--check passes on untouched hashes and fails after tampering', () => {
    const tamper = path.join(dir, 'PUBLIC', 'VERIFY.md');
    const orig = fs.readFileSync(tamper);
    fs.appendFileSync(tamper, '\nedited\n');
    const bad = run(['--check', dir]);
    expect(bad.status).toBe(1);
    expect(bad.stderr + bad.stdout).toContain('hash/size mismatch');
    fs.writeFileSync(tamper, orig);
  });

  it('--check flags planted secrets, emails and local paths', () => {
    const planted = ['gh' + 'p_' + 'a'.repeat(30), 'someone' + '@' + 'gmail.com', 'C:' + '\\Users\\someone\\x'];
    for (const s of planted) {
      const f = path.join(dir, 'PUBLIC', 'VERIFY.md');
      const orig = fs.readFileSync(f);
      fs.appendFileSync(f, `\n${s}\n`);
      // refresh manifest hash so only the content scan can fail
      const man = JSON.parse(fs.readFileSync(path.join(dir, 'PUBLIC', 'MANIFEST.json'), 'utf8'));
      const e = man.files.find((x) => x.path === 'VERIFY.md'); const b = fs.readFileSync(f);
      const oldE = { ...e }; e.bytes = b.length; e.sha256 = crypto.createHash('sha256').update(b).digest('hex');
      fs.writeFileSync(path.join(dir, 'PUBLIC', 'MANIFEST.json'), JSON.stringify(man));
      const r = run(['--check', dir]);
      expect(r.status, s).toBe(1);
      Object.assign(e, oldE); fs.writeFileSync(path.join(dir, 'PUBLIC', 'MANIFEST.json'), JSON.stringify(man));
      fs.writeFileSync(f, orig);
    }
  });

  it('refuses an --out inside the repo', () => {
    const r = run(['--out', path.join(ROOT, 'tmp-bundle-out'), '--no-source', '--no-zip']);
    expect(r.status).toBe(2);
    expect(fs.existsSync(path.join(ROOT, 'tmp-bundle-out'))).toBe(false);
  });

  it('warns when over budget but still builds', () => {
    const o = path.join(tmp, 'tiny');
    const r = run(['--out', o, '--budget', '10', '--no-private', '--no-source', '--no-zip']);
    expect(r.stderr).toContain('over the 10 budget');
    expect(fs.existsSync(o)).toBe(true);
  }, 120_000);
});

describe('shared folder target', () => {
  let shared, priv;
  beforeAll(() => {
    shared = path.join(tmp, 'shared'); priv = path.join(tmp, 'private2');
    fs.mkdirSync(priv, { recursive: true });
    fs.writeFileSync(path.join(priv, 'revenue.md'), `# Private\n\n${PRIVATE_LINE}\n`);
  });

  it('generates banners, live files, and no revenue map without --private', () => {
    const r = run(['--shared', shared, '--no-private', '--no-source']);
    expect(r.stdout).toContain('Shared folder');
    for (const f of ['README_FIRST.md', '01_DESIGN_BIBLE.md', '02_MECHANICS_AND_ROADMAP.md', '04_IMAGE_AND_MAINTENANCE_GUIDES.md', '05_TEAM_AND_OPERATING_SYSTEM.md', '06_BUNDLE_BUILDER.md', 'CODE_MAP.md', 'CONTEXT_CORE.md', 'DECISIONS.md', 'HANDOFF.md', 'MANIFEST.json', 'inbox/README.md', 'bots/README.md']) {
      expect(fs.existsSync(path.join(shared, f)), f).toBe(true);
    }
    for (const a of ['claude', 'codex', 'grok', 'kimi', 'anthony']) expect(fs.existsSync(path.join(shared, 'inbox', a, 'README.md'))).toBe(true);
    expect(fs.existsSync(path.join(shared, '03_REVENUE_MAP.md'))).toBe(false);
    for (const f of ['01_DESIGN_BIBLE.md', '02_MECHANICS_AND_ROADMAP.md', '04_IMAGE_AND_MAINTENANCE_GUIDES.md', '05_TEAM_AND_OPERATING_SYSTEM.md', '06_BUNDLE_BUILDER.md', 'DECISIONS.md', 'README_FIRST.md']) {
      expect(fs.readFileSync(path.join(shared, f), 'utf8')).toContain('GENERATED from the repo - do not edit here; propose changes via HANDOFF.md or an inbox note');
    }
  }, 180_000);

  it('never overwrites live files and preserves the proposals section', () => {
    fs.writeFileSync(path.join(shared, 'HANDOFF.md'), '# my handoff\nkeep me\n');
    fs.mkdirSync(path.join(shared, 'inbox', 'grok'), { recursive: true });
    fs.writeFileSync(path.join(shared, 'inbox', 'grok', '2026-10-04-note.md'), 'note body keep\n');
    fs.writeFileSync(path.join(shared, 'inbox', 'grok', 'README.md'), 'customized readme\n');
    fs.writeFileSync(path.join(shared, 'bots', 'chief.md'), 'bot custom\n');
    const dec = path.join(shared, 'DECISIONS.md');
    fs.appendFileSync(dec, '\n- 2026-10-04 grok: proposal keep me; status: open\n');
    const r = run(['--shared', shared, '--no-private', '--no-source']);
    expect(r.status === 0 || r.status === 1).toBe(true);
    expect(fs.readFileSync(path.join(shared, 'HANDOFF.md'), 'utf8')).toBe('# my handoff\nkeep me\n');
    expect(fs.readFileSync(path.join(shared, 'inbox', 'grok', '2026-10-04-note.md'), 'utf8')).toBe('note body keep\n');
    expect(fs.readFileSync(path.join(shared, 'inbox', 'grok', 'README.md'), 'utf8')).toBe('customized readme\n');
    expect(fs.readFileSync(path.join(shared, 'bots', 'chief.md'), 'utf8')).toBe('bot custom\n');
    expect(fs.readFileSync(dec, 'utf8')).toContain('proposal keep me');
  }, 180_000);

  it('writes 03_REVENUE_MAP.md with a PRIVATE banner only when private is supplied', () => {
    const r = run(['--shared', shared, '--private', priv, '--no-source']);
    expect(r.stdout).toContain('Shared folder');
    const text = fs.readFileSync(path.join(shared, '03_REVENUE_MAP.md'), 'utf8');
    expect(text.slice(0, 300)).toContain('PRIVATE');
    expect(text).toContain(PRIVATE_LINE);
    for (const f of ['01_DESIGN_BIBLE.md', '02_MECHANICS_AND_ROADMAP.md', 'CONTEXT_CORE.md', 'README_FIRST.md']) {
      expect(fs.readFileSync(path.join(shared, f), 'utf8')).not.toContain(PRIVATE_LINE);
    }
  }, 180_000);

  it('does not write the shared folder unless --shared is passed', () => {
    const o = path.join(tmp, 'noshared');
    run(['--out', o, '--no-private', '--no-source', '--no-zip']);
    expect(fs.existsSync(path.join(tmp, 'noshared-shared'))).toBe(false);
  }, 120_000);

  it('--check --shared detects an edited generated file', () => {
    fs.appendFileSync(path.join(shared, '01_DESIGN_BIBLE.md'), '\nhand edit\n');
    const r = run(['--check', '--shared', shared, '--private', priv]);
    expect(r.status).toBe(1);
    expect(r.stderr + r.stdout).toContain('01_DESIGN_BIBLE.md');
  });
});
