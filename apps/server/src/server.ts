import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createWaitlistHandler } from './waitlist';
import { WebSocketServer, type WebSocket } from 'ws';
import {
  MAX_NAME,
  PROTOCOL_VERSION,
  SNAPSHOT_EVERY,
  SNAPSHOT_LOOK_EVERY,
  defaultLookCode,
  parseLookCode,
  type NetPlayer,
  type ServerMsg,
} from '@sbh/protocol';
import { BTN_MASK, PLAYGROUND, TICK_RATE, clonePlayer, createPlayer, createWorld, stepWorld, type World } from '@sbh/sim';

export const MAX_PLAYERS = 16;
const MAX_PAYLOAD = 1024;
const QUEUE_MAX = 10;
const QUEUE_TRIM = 3;
const MAX_CATCHUP = 5;
const LOOP_MS = 4;
const LOOK_BURST = 3; // setLook token bucket: capacity
const LOOK_REFILL_MS = 1000; // ... one token per second

export interface GameServerOptions {
  port: number;
  tickRate?: number;
  graceMs?: number; // how long a disconnected player is kept for token reattach
  waitlistFile?: string; // JSON-lines waitlist path (default: SBH_WAITLIST_FILE or apps/server/data/waitlist.jsonl)
  allowedOrigins?: string[]; // CORS allowlist (default: SBH_ALLOWED_ORIGINS or localhost dev origins)
}

export interface GameServer {
  wss: WebSocketServer;
  port: number;
  world: World;
  close(): Promise<void>;
}

interface Session {
  id: number;
  token: string;
  name: string;
  look: string; // canonical encodeLook code, always valid
  lookTokens: number;
  lookRefillAt: number;
  ws: WebSocket | null;
  queue: { seq: number; buttons: number }[];
  buttons: number; // last applied, reused when the queue runs dry
  ack: number;
  dropTimer: NodeJS.Timeout | null;
}

const toInt = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : null);

function cleanName(raw: unknown, id: number): string {
  const s = typeof raw === 'string' ? raw.replace(/[^\x20-\x7e]/g, '').trim().slice(0, MAX_NAME).trim() : '';
  return s || `Player${id}`;
}

function send(ws: WebSocket | null, msg: ServerMsg | string): void {
  if (ws && ws.readyState === ws.OPEN) ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
}

export async function createGameServer(opts: GameServerOptions): Promise<GameServer> {
  const tickRate = opts.tickRate ?? TICK_RATE;
  const graceMs = opts.graceMs ?? 10_000;
  const stepMs = 1000 / tickRate;
  const world = createWorld();
  const sessions = new Map<number, Session>();
  const byToken = new Map<string, Session>();
  let nextId = 1;

  const waitlist = createWaitlistHandler({ file: opts.waitlistFile, allowedOrigins: opts.allowedOrigins });
  const httpServer = createServer((req, res) => waitlist.handle(req, res));
  const wss = new WebSocketServer({ server: httpServer, maxPayload: MAX_PAYLOAD });
  await new Promise<void>((resolve, reject) => {
    httpServer.once('listening', resolve);
    httpServer.once('error', reject);
    httpServer.listen(opts.port);
  });
  wss.on('error', () => {});
  httpServer.on('error', () => {});

  const dropSession = (s: Session): void => {
    if (s.dropTimer) clearTimeout(s.dropTimer);
    sessions.delete(s.id);
    byToken.delete(s.token);
    const i = world.players.findIndex((p) => p.id === s.id);
    if (i >= 0) world.players.splice(i, 1);
  };

  const detach = (s: Session): void => {
    s.ws = null;
    s.queue.length = 0;
    s.dropTimer = setTimeout(() => dropSession(s), graceMs);
  };

  const join = (ws: WebSocket, msg: Record<string, unknown>): Session | null => {
    let s = typeof msg.token === 'string' ? byToken.get(msg.token) : undefined;
    if (s) {
      if (s.dropTimer) clearTimeout(s.dropTimer);
      s.dropTimer = null;
      const old = s.ws;
      s.ws = ws;
      s.queue.length = 0;
      old?.close(); // stale socket; its close handler sees it no longer owns the session
    } else {
      if (sessions.size >= MAX_PLAYERS) {
        send(ws, { t: 'error', message: 'server full' });
        ws.close();
        return null;
      }
      const id = nextId++;
      s = {
        id,
        token: randomUUID(),
        name: cleanName(msg.name, id),
        look: parseLookCode(msg.look) ?? defaultLookCode(id),
        lookTokens: LOOK_BURST,
        lookRefillAt: Date.now(),
        ws,
        queue: [],
        buttons: 0,
        ack: 0,
        dropTimer: null,
      };
      sessions.set(id, s);
      byToken.set(s.token, s);
      world.players.push(createPlayer(id, PLAYGROUND)); // ids are monotonic, so the array stays sorted
    }
    send(ws, { t: 'welcome', id: s.id, token: s.token, tick: world.tick, level: PLAYGROUND.name, look: s.look, v: PROTOCOL_VERSION });
    // roster backfill: the joiner learns everyone's look now; everyone learns the joiner's look
    for (const o of sessions.values()) {
      send(ws, { t: 'look', id: o.id, look: o.look });
      if (o !== s) send(o.ws, { t: 'look', id: s.id, look: s.look });
    }
    return s;
  };

  wss.on('connection', (ws) => {
    let sess: Session | null = null;
    ws.on('error', () => {});
    ws.on('close', () => {
      if (sess && sess.ws === ws) detach(sess);
    });
    ws.on('message', (data, isBinary) => {
      if (isBinary) return;
      let msg: unknown;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return send(ws, { t: 'error', message: 'bad json' });
      }
      if (typeof msg !== 'object' || msg === null) return send(ws, { t: 'error', message: 'bad message' });
      const m = msg as Record<string, unknown>;
      switch (m.t) {
        case 'join':
          if (!sess) sess = join(ws, m);
          break;
        case 'setLook': {
          if (!sess) break;
          const look = parseLookCode(m.look);
          if (!look) return send(ws, { t: 'error', message: 'bad look' });
          const now = Date.now();
          const gained = Math.floor((now - sess.lookRefillAt) / LOOK_REFILL_MS);
          if (gained > 0) {
            sess.lookTokens = Math.min(LOOK_BURST, sess.lookTokens + gained);
            sess.lookRefillAt += gained * LOOK_REFILL_MS;
          }
          if (sess.lookTokens < 1) return send(ws, { t: 'error', message: 'look changes rate limited' });
          sess.lookTokens--;
          if (look === sess.look) break;
          sess.look = look;
          const out = JSON.stringify({ t: 'look', id: sess.id, look } satisfies ServerMsg);
          for (const o of sessions.values()) send(o.ws, out);
          break;
        }
        case 'ping': {
          const ts = toInt(m.ts);
          if (ts !== null) send(ws, { t: 'pong', ts });
          break;
        }
        case 'input': {
          if (!sess) break;
          const seq = toInt(m.seq);
          const buttons = toInt(m.buttons);
          if (seq === null || buttons === null) break;
          sess.queue.push({ seq, buttons: buttons & BTN_MASK });
          if (sess.queue.length > QUEUE_MAX) sess.queue.splice(0, sess.queue.length - QUEUE_TRIM);
          break;
        }
      }
    });
  });

  const broadcast = (withLooks: boolean): void => {
    const players: NetPlayer[] = world.players.map((p) => {
      const s = sessions.get(p.id)!;
      const np: NetPlayer = { id: p.id, name: s.name, ack: s.ack, connected: s.ws !== null, state: clonePlayer(p) };
      if (withLooks) np.look = s.look;
      return np;
    });
    const json = JSON.stringify({ t: 'snap', tick: world.tick, players } satisfies ServerMsg);
    for (const s of sessions.values()) send(s.ws, json);
  };

  let snapCount = 0;
  const tick = (): void => {
    const inputs: Record<number, number> = {};
    for (const s of sessions.values()) {
      const next = s.queue.shift();
      if (next) {
        s.buttons = next.buttons;
        s.ack = next.seq;
      } else if (!s.ws) s.buttons = 0;
      inputs[s.id] = s.buttons;
    }
    stepWorld(PLAYGROUND, world, inputs);
    if (world.tick % SNAPSHOT_EVERY === 0) {
      snapCount++;
      broadcast(snapCount % SNAPSHOT_LOOK_EVERY === 0);
    }
  };

  let last = performance.now();
  let acc = 0;
  const loop = setInterval(() => {
    const now = performance.now();
    acc = Math.min(acc + now - last, stepMs * MAX_CATCHUP);
    last = now;
    while (acc >= stepMs) {
      acc -= stepMs;
      tick();
    }
  }, LOOP_MS);

  return {
    wss,
    port: (httpServer.address() as AddressInfo).port,
    world,
    close: () =>
      new Promise<void>((resolve) => {
        clearInterval(loop);
        waitlist.dispose();
        for (const s of sessions.values()) if (s.dropTimer) clearTimeout(s.dropTimer);
        for (const c of wss.clients) c.terminate();
        wss.close(() => {
          httpServer.close(() => resolve());
          httpServer.closeAllConnections();
        });
      }),
  };
}
