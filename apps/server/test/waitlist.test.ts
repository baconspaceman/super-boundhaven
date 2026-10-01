import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { createGameServer, type GameServer } from '../src/server';

let server: GameServer;
let dir: string;
let file: string;
const ORIGIN = 'http://localhost:5174';

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'sbh-waitlist-'));
  file = join(dir, 'nested', 'waitlist.jsonl');
  server = await createGameServer({ port: 0, waitlistFile: file, allowedOrigins: [ORIGIN, 'http://localhost:5173'] });
});

afterEach(async () => {
  await server.close();
  rmSync(dir, { recursive: true, force: true });
});

const url = (p = '/api/waitlist') => `http://127.0.0.1:${server.port}${p}`;
const post = (body: unknown, headers: Record<string, string> = {}) =>
  fetch(url(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
const lines = () =>
  readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));

describe('waitlist endpoint', () => {
  it('stores a signup with 201 and no IP / user agent', async () => {
    const r = await post({ email: 'Hero@Example.com', name: '  Hero\u0007 ', consent: true }, { 'User-Agent': 'secret-agent' });
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ ok: true });
    const rows = lines();
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual(['createdAt', 'email', 'name']);
    expect(rows[0].email).toBe('Hero@Example.com');
    expect(rows[0].name).toBe('Hero');
    expect(new Date(rows[0].createdAt).toISOString()).toBe(rows[0].createdAt);
    const raw = readFileSync(file, 'utf8');
    expect(raw).not.toContain('127.0.0.1');
    expect(raw).not.toContain('secret-agent');
  });

  it('dedupes by lowercase email', async () => {
    expect((await post({ email: 'a@b.co', consent: true })).status).toBe(201);
    const r = await post({ email: 'A@B.CO', consent: true });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, duplicate: true });
    expect(lines()).toHaveLength(1);
  });

  it('truncates long names to 32 chars', async () => {
    await post({ email: 'n@b.co', name: 'x'.repeat(100), consent: true });
    expect(lines()[0].name).toHaveLength(32);
  });

  it('rejects bad email', async () => {
    for (const email of ['nope', 'a@b', 5, `${'a'.repeat(250)}@b.co`]) {
      const r = await post({ email, consent: true });
      expect(r.status).toBe(400);
      expect((await r.json()).ok).toBe(false);
    }
    expect(existsSync(file)).toBe(false);
  });

  it('rejects invalid json and missing/false consent', async () => {
    expect((await post('{oops')).status).toBe(400);
    expect((await post({ email: 'a@b.co' })).status).toBe(400);
    expect((await post({ email: 'a@b.co', consent: 'true' })).status).toBe(400);
    const r = await post({ email: 'a@b.co', consent: false });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ ok: false, error: 'consent required' });
    expect(existsSync(file)).toBe(false);
  });

  it('413 for bodies over 2KB', async () => {
    const r = await post({ email: 'a@b.co', consent: true, pad: 'x'.repeat(3000) });
    expect(r.status).toBe(413);
    expect(existsSync(file)).toBe(false);
  });

  it('405 for other methods, 404 elsewhere, healthz ok', async () => {
    expect((await fetch(url())).status).toBe(405);
    expect((await fetch(url(), { method: 'PUT' })).status).toBe(405);
    expect((await fetch(url('/nope'))).status).toBe(404);
    const h = await fetch(url('/healthz'));
    expect(h.status).toBe(200);
    expect(await h.json()).toEqual({ ok: true });
  });

  it('rate limits to 5 requests per minute', async () => {
    for (let i = 0; i < 5; i++) expect((await post({ email: `u${i}@b.co`, consent: true })).status).toBe(201);
    const r = await post({ email: 'u9@b.co', consent: true });
    expect(r.status).toBe(429);
    expect((await r.json()).ok).toBe(false);
    expect(lines()).toHaveLength(5);
  });

  it('CORS: allowed origin gets headers on POST and preflight', async () => {
    const pre = await fetch(url(), {
      method: 'OPTIONS',
      headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' },
    });
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect(pre.headers.get('access-control-allow-methods')).toContain('POST');
    expect(pre.headers.get('access-control-allow-headers')).toContain('Content-Type');
    const r = await post({ email: 'c@b.co', consent: true }, { Origin: ORIGIN });
    expect(r.headers.get('access-control-allow-origin')).toBe(ORIGIN);
  });

  it('CORS: blocked origin gets no allow headers', async () => {
    const evil = 'http://evil.example';
    const pre = await fetch(url(), { method: 'OPTIONS', headers: { Origin: evil, 'Access-Control-Request-Method': 'POST' } });
    expect(pre.status).toBe(403);
    expect(pre.headers.get('access-control-allow-origin')).toBeNull();
    const r = await post({ email: 'd@b.co', consent: true }, { Origin: evil });
    expect(r.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('websocket game still works on the same port', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}`);
    const welcome = await new Promise<{ t: string; id: number }>((resolve, reject) => {
      ws.on('error', reject);
      ws.on('open', () => ws.send(JSON.stringify({ t: 'join', name: 'w' })));
      ws.on('message', (d) => {
        const m = JSON.parse(d.toString());
        if (m.t === 'welcome') resolve(m);
      });
    });
    expect(welcome.id).toBeGreaterThan(0);
    ws.terminate();
  });
});
