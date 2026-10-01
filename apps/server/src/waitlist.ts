import { appendFile, mkdir, readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const WAITLIST_PATH = '/api/waitlist';
export const MAX_BODY_BYTES = 2048;
export const MAX_EMAIL = 254;
export const MAX_WAITLIST_NAME = 32;
export const RATE_LIMIT = 5;
export const RATE_WINDOW_MS = 60_000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_ORIGINS = 'http://localhost:5174,http://localhost:5173';

export interface WaitlistOptions {
  file?: string;
  allowedOrigins?: string[];
}

export interface WaitlistHandler {
  handle(req: IncomingMessage, res: ServerResponse): void;
  dispose(): void;
}

export function defaultWaitlistFile(): string {
  return (
    process.env.SBH_WAITLIST_FILE ??
    resolve(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'waitlist.jsonl')
  );
}

export function parseOrigins(raw: string | undefined): string[] {
  return (raw ?? DEFAULT_ORIGINS)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function cleanName(raw: unknown): string {
  return typeof raw === 'string' ? raw.replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_WAITLIST_NAME).trim() : '';
}

function json(res: ServerResponse, status: number, body: unknown, extra: Record<string, string> = {}): void {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    'Cache-Control': 'no-store',
    ...extra,
  });
  res.end(data);
}

export function createWaitlistHandler(opts: WaitlistOptions = {}): WaitlistHandler {
  const file = opts.file ?? defaultWaitlistFile();
  const origins = new Set(opts.allowedOrigins ?? parseOrigins(process.env.SBH_ALLOWED_ORIGINS));

  // Remote addresses live only in this in-memory map; never persisted or logged.
  const hits = new Map<string, number[]>();
  const sweep = setInterval(() => {
    const cutoff = Date.now() - RATE_WINDOW_MS;
    for (const [k, v] of hits) if (!v.some((t) => t > cutoff)) hits.delete(k);
  }, RATE_WINDOW_MS);
  sweep.unref();

  const limited = (addr: string): boolean => {
    const now = Date.now();
    const recent = (hits.get(addr) ?? []).filter((t) => t > now - RATE_WINDOW_MS);
    if (recent.length >= RATE_LIMIT) {
      hits.set(addr, recent);
      return true;
    }
    recent.push(now);
    hits.set(addr, recent);
    return false;
  };

  let emails: Set<string> | null = null;
  let chain: Promise<unknown> = Promise.resolve();

  const loadEmails = async (): Promise<Set<string>> => {
    if (emails) return emails;
    const set = new Set<string>();
    try {
      for (const line of (await readFile(file, 'utf8')).split('\n')) {
        if (!line.trim()) continue;
        try {
          const e = (JSON.parse(line) as { email?: unknown }).email;
          if (typeof e === 'string') set.add(e.toLowerCase());
        } catch {
          /* skip corrupt line */
        }
      }
    } catch {
      /* no file yet */
    }
    return (emails = set);
  };

  // Serialized so concurrent signups can't double-write the same email.
  const store = (email: string, name: string): Promise<boolean> => {
    const run = async (): Promise<boolean> => {
      const set = await loadEmails();
      const key = email.toLowerCase();
      if (set.has(key)) return false;
      await mkdir(dirname(file), { recursive: true });
      await appendFile(file, JSON.stringify({ email, name, createdAt: new Date().toISOString() }) + '\n', 'utf8');
      set.add(key);
      return true;
    };
    const p = chain.then(run, run);
    chain = p.catch(() => {});
    return p;
  };

  const readBody = (req: IncomingMessage): Promise<string | null> =>
    new Promise((res) => {
      const declared = Number(req.headers['content-length']);
      if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return res(null);
      const chunks: Buffer[] = [];
      let size = 0;
      let done = false;
      req.on('data', (c: Buffer) => {
        if (done) return;
        size += c.length;
        if (size > MAX_BODY_BYTES) {
          done = true;
          res(null);
          return;
        }
        chunks.push(c);
      });
      req.on('end', () => !done && ((done = true), res(Buffer.concat(chunks).toString('utf8'))));
      req.on('error', () => !done && ((done = true), res(null)));
    });

  const handle = (req: IncomingMessage, res: ServerResponse): void => {
    void (async () => {
      const path = (req.url ?? '/').split('?')[0];
      const method = req.method ?? 'GET';
      const origin = req.headers.origin;
      const allowed = typeof origin === 'string' && origins.has(origin);
      const cors: Record<string, string> = { Vary: 'Origin' };
      if (allowed) cors['Access-Control-Allow-Origin'] = origin;

      if (path === '/healthz') {
        if (method !== 'GET' && method !== 'HEAD') return json(res, 405, { ok: false, error: 'method not allowed' }, { Allow: 'GET, HEAD' });
        return json(res, 200, { ok: true });
      }
      if (path !== WAITLIST_PATH) return json(res, 404, { ok: false, error: 'not found' });

      if (method === 'OPTIONS') {
        if (!allowed) return json(res, 403, { ok: false, error: 'origin not allowed' }, cors);
        res.writeHead(204, {
          ...cors,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '600',
        });
        return void res.end();
      }
      if (method !== 'POST') return json(res, 405, { ok: false, error: 'method not allowed' }, { ...cors, Allow: 'POST, OPTIONS' });

      if (limited(req.socket.remoteAddress ?? 'unknown')) {
        return json(res, 429, { ok: false, error: 'too many requests' }, { ...cors, 'Retry-After': String(RATE_WINDOW_MS / 1000) });
      }

      const raw = await readBody(req);
      if (raw === null) return json(res, 413, { ok: false, error: 'payload too large' }, { ...cors, Connection: 'close' });

      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        return json(res, 400, { ok: false, error: 'invalid json' }, cors);
      }
      if (typeof body !== 'object' || body === null || Array.isArray(body)) return json(res, 400, { ok: false, error: 'invalid body' }, cors);
      const b = body as Record<string, unknown>;

      const email = typeof b.email === 'string' ? b.email.trim() : '';
      if (!email || email.length > MAX_EMAIL || !EMAIL_RE.test(email)) return json(res, 400, { ok: false, error: 'invalid email' }, cors);
      if (b.consent !== true) return json(res, 400, { ok: false, error: 'consent required' }, cors);

      try {
        const added = await store(email, cleanName(b.name));
        return added ? json(res, 201, { ok: true }, cors) : json(res, 200, { ok: true, duplicate: true }, cors);
      } catch {
        return json(res, 500, { ok: false, error: 'storage error' }, cors);
      }
    })().catch(() => {
      if (!res.headersSent) json(res, 500, { ok: false, error: 'server error' });
      else res.end();
    });
  };

  return { handle, dispose: () => clearInterval(sweep) };
}
