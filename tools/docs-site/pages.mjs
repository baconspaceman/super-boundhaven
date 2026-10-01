#!/usr/bin/env node
// Builds the complete GitHub Pages artifact into apps/site/dist:
//   /          marketing site (apps/site)
//   /play/     static prototype client, offline-capable (apps/client)
//   /docs/     docs portal (tools/docs-site/build.mjs)
// Base path comes from VITE_BASE (default /super-boundhaven/). Use VITE_BASE=/ for a root-hosted preview.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
let base = process.env.VITE_BASE ?? '/super-boundhaven/';
if (!base.endsWith('/')) base += '/';

function run(cmd, env = {}) {
  console.log(`\n> ${cmd}`);
  const r = spawnSync(cmd, { cwd: ROOT, stdio: 'inherit', shell: true, env: { ...process.env, ...env } });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run('npm run build -w @sbh/site', { VITE_BASE: base, VITE_PLAY_URL: './play/' });
run('npm run build -w @sbh/client -- --outDir ../site/dist/play --emptyOutDir', { VITE_CLIENT_BASE: base + 'play/', VITE_SERVER_URL: '' });
run('node tools/docs-site/build.mjs');
console.log(`\nPages artifact ready: apps/site/dist (base ${base})`);
