import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createWaitlistHandler } from './waitlist';
import { AccountStore, nameKey } from './accounts';
import { runCommand, type CmdSession } from './commands';
import { WebSocketServer, type WebSocket } from 'ws';
import {
  MAX_COMMAND,
  MAX_NAME,
  PROTOCOL_VERSION,
  SNAPSHOT_EVERY,
  SNAPSHOT_FULL_EVERY,
  SNAPSHOT_LOOK_EVERY,
  createWorldEncoder,
  defaultLookCode,
  parseLookCode,
  type ClaimInfo,
  type NetPlayer,
  type Role,
  type ServerMsg,
} from '@sbh/protocol';
import {
  BTN_MASK,
  DEFAULT_LEVEL,
  TICK_RATE,
  clonePlayer,
  createPlayer,
  createWorld,
  getLevel,
  stepWorld,
  type Level,
  type World,
} from '@sbh/sim';

export const MAX_PLAYERS = 16;
const MAX_PAYLOAD = 1024;
const QUEUE_MAX = 10;
const QUEUE_TRIM = 3;
const MAX_CATCHUP = 5;
const LOOP_MS = 4;
const LOOK_BURST = 3; // setLook token bucket: capacity
const LOOK_REFILL_MS = 1000; // ... one token per second
const CMD_BURST = 6; // console commands: token bucket capacity, refilled 3 per second
const CMD_REFILL_MS = 333;
const AUTH_FAILS_MAX = 8; // wrong passwords per address ...
const AUTH_FAILS_WINDOW_MS = 10 * 60_000; // ... per 10 minutes

export interface GameServerOptions {
  port: number;
  tickRate?: number;
  graceMs?: number; // how long a disconnected player is kept for token reattach
  waitlistFile?: string; // JSON-lines waitlist path (default: SBH_WAITLIST_FILE or apps/server/data/waitlist.jsonl)
  allowedOrigins?: string[]; // CORS allowlist (default: SBH_ALLOWED_ORIGINS or localhost dev origins)
  levelName?: string; // key of sim LEVELS (default: 'playground'); unknown names reject
  maxPlayers?: number; // capped at MAX_PLAYERS; default = the level's room.maxPlayers or MAX_PLAYERS
  accountsFile?: string | null; // names, claims, accounts, bans; default null = memory only (src/index.ts passes the real file)
  adminName?: string; // reserved developer name (default: SBH_ADMIN_NAME or 'baconspaceman')
  adminPassword?: string; // sets the developer password at start-up (default: SBH_ADMIN_PASSWORD)
  now?: () => number; // clock for claim expiry (tests)
  quiet?: boolean; // no console output (tests)
}

export interface GameServer {
  wss: WebSocketServer;
  port: number;
  world: World;
  level: Level;
  maxPlayers: number;
  accounts: AccountStore;
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
  needFull: boolean; // next snapshot must carry the full world state (new or re-attached client)
  key: string; // nameKey of the name ('' = anonymous guest with no claim)
  role: Role;
  god: boolean;
  cmdTokens: number;
  cmdRefillAt: number;
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
  const level = getLevel(opts.levelName ?? DEFAULT_LEVEL);
  if (!level) throw new Error(`unknown level: ${opts.levelName}`);
  const maxPlayers = Math.max(1, Math.min(MAX_PLAYERS, opts.maxPlayers ?? level.room.maxPlayers ?? MAX_PLAYERS));
  const world = createWorld(level);
  const encoder = createWorldEncoder();
  const accountsFile = opts.accountsFile ?? null;
  const accounts = new AccountStore({
    file: accountsFile,
    adminName: opts.adminName ?? process.env.SBH_ADMIN_NAME ?? 'baconspaceman',
    adminPassword: opts.adminPassword ?? (process.env.SBH_ADMIN_PASSWORD || undefined),
    now: opts.now,
  });
  const authFails = new Map<string, { n: number; resetAt: number }>();
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

  const cmdCtx = {
    world,
    level,
    store: accounts,
    sessions: (): Iterable<CmdSession> => sessions.values(),
    announce: (text: string): void => {
      for (const o of sessions.values()) send(o.ws, { t: 'info', lines: [text] });
    },
    kick: (s: CmdSession, reason: string): void => {
      const target = sessions.get(s.id);
      if (!target) return;
      send(target.ws, { t: 'error', message: `You were removed: ${reason}` });
      const ws = target.ws;
      target.ws = null;
      dropSession(target);
      ws?.close();
    },
    log: (line: string): void => {
      if (!opts.quiet) console.log(`[admin] ${line}`);
    },
  };
  const purgeTimer = setInterval(() => accounts.purge(), 3_600_000);
  purgeTimer.unref();
  httpServer.on('error', () => {});

  const dropSession = (s: Session): void => {
    if (s.dropTimer) clearTimeout(s.dropTimer);
    sessions.delete(s.id);
    byToken.delete(s.token);
    const i = world.players.findIndex((p) => p.id === s.id);
    if (i >= 0) world.players.splice(i, 1);
  };

  const setAway = (id: number, away: boolean): void => {
    const p = world.players.find((q) => q.id === id);
    if (p) p.away = away; // an away body is inert: it releases plates and cannot be hurt, pushed or stomped
  };

  const detach = (s: Session): void => {
    s.ws = null;
    setAway(s.id, true);
    s.queue.length = 0;
    s.dropTimer = setTimeout(() => dropSession(s), graceMs);
  };

  const join = (ws: WebSocket, msg: Record<string, unknown>, ip: string): Session | null => {
    let welcomeExtra: { name?: string; role?: Role; claim?: ClaimInfo | null; claimToken?: string } = {};
    let s = typeof msg.token === 'string' ? byToken.get(msg.token) : undefined;
    if (s) {
      if (s.dropTimer) clearTimeout(s.dropTimer);
      s.dropTimer = null;
      s.needFull = true;
      setAway(s.id, false);
      const old = s.ws;
      s.ws = ws;
      s.queue.length = 0;
      old?.close(); // stale socket; its close handler sees it no longer owns the session
    } else {
      if (sessions.size >= maxPlayers) {
        send(ws, { t: 'error', message: 'server full' });
        ws.close();
        return null;
      }
      // who may use this name? (guests claim free names for 7 days; registered names need their password)
      const rawName = typeof msg.name === 'string' ? msg.name.replace(/[^\x20-\x7e]/g, '').trim().slice(0, MAX_NAME).trim() : '';
      const id = nextId++;
      let name = cleanName(rawName, id);
      let key = '';
      let role: Role = 'player';
      let claim: ClaimInfo | null = null;
      let claimToken: string | undefined;
      if (nameKey(rawName)) {
        const now = (opts.now ?? Date.now)();
        const f = authFails.get(ip);
        if (f && f.resetAt > now && f.n >= AUTH_FAILS_MAX) {
          send(ws, { t: 'error', message: 'Too many wrong passwords. Wait a few minutes and try again.' });
          ws.close();
          nextId--;
          return null;
        }
        const r = accounts.authorize(rawName, typeof msg.pass === 'string' ? msg.pass : undefined, typeof msg.claim === 'string' ? msg.claim : undefined);
        if (!r.ok) {
          if (r.failed) {
            const cur = f && f.resetAt > now ? f : { n: 0, resetAt: now + AUTH_FAILS_WINDOW_MS };
            cur.n++;
            authFails.set(ip, cur);
          }
          send(ws, { t: 'error', message: r.error });
          ws.close();
          nextId--;
          return null;
        }
        ({ name, role, claim, claimToken, key } = r);
      }
      s = {
        id,
        token: randomUUID(),
        name,
        look: parseLookCode(msg.look) ?? defaultLookCode(id),
        lookTokens: LOOK_BURST,
        lookRefillAt: Date.now(),
        ws,
        queue: [],
        buttons: 0,
        ack: 0,
        dropTimer: null,
        needFull: true,
        key,
        role,
        god: false,
        cmdTokens: CMD_BURST,
        cmdRefillAt: Date.now(),
      };
      welcomeExtra = { name, role, claim, claimToken };
      sessions.set(id, s);
      byToken.set(s.token, s);
      world.players.push(createPlayer(id, level)); // ids are monotonic, so the array stays sorted
    }
    if (!welcomeExtra.role) welcomeExtra = { name: s.name, role: s.role, claim: accounts.claimOf(s.key) }; // re-attach
    send(ws, { t: 'welcome', id: s.id, token: s.token, tick: world.tick, level: level.name, look: s.look, v: PROTOCOL_VERSION, ...welcomeExtra });
    // roster backfill: the joiner learns everyone's look now; everyone learns the joiner's look
    for (const o of sessions.values()) {
      send(ws, { t: 'look', id: o.id, look: o.look });
      if (o !== s) send(o.ws, { t: 'look', id: s.id, look: s.look });
    }
    return s;
  };

  wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress ?? '?';
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
          if (!sess) sess = join(ws, m, ip);
          break;
        case 'cmd': {
          if (!sess || typeof m.line !== 'string') break;
          const now = Date.now();
          const gained = Math.floor((now - sess.cmdRefillAt) / CMD_REFILL_MS);
          if (gained > 0) {
            sess.cmdTokens = Math.min(CMD_BURST, sess.cmdTokens + gained);
            sess.cmdRefillAt += gained * CMD_REFILL_MS;
          }
          if (sess.cmdTokens < 1) return send(ws, { t: 'info', lines: ['Slow down: too many commands.'] });
          sess.cmdTokens--;
          const res = runCommand(cmdCtx, sess, m.line.slice(0, MAX_COMMAND));
          send(ws, { t: 'info', lines: res.lines });
          if (res.account) send(ws, { t: 'account', ...res.account });
          break;
        }
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

  const broadcast = (withLooks: boolean, fullFrame: boolean): void => {
    const players: NetPlayer[] = world.players.map((p) => {
      const s = sessions.get(p.id)!;
      const np: NetPlayer = { id: p.id, name: s.name, ack: s.ack, connected: s.ws !== null, state: clonePlayer(p) };
      if (withLooks) np.look = s.look;
      return np;
    });
    const delta = encoder.delta(world);
    const json = JSON.stringify({ t: 'snap', tick: world.tick, players, world: fullFrame ? encoder.full(world) : delta } satisfies ServerMsg);
    let fullJson: string | null = null;
    for (const s of sessions.values()) {
      if (s.needFull && !fullFrame) {
        // a client that missed earlier deltas gets complete state this frame
        fullJson ??= JSON.stringify({ t: 'snap', tick: world.tick, players, world: encoder.full(world) } satisfies ServerMsg);
        send(s.ws, fullJson);
      } else {
        send(s.ws, json);
      }
      if (s.ws) s.needFull = false;
    }
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
      if (s.god) {
        const p = world.players.find((q) => q.id === s.id);
        if (p) p.invuln = 1_000_000; // developer god mode: nothing hurts
      }
    }
    stepWorld(level, world, inputs);
    if (world.tick % SNAPSHOT_EVERY === 0) {
      snapCount++;
      broadcast(snapCount % SNAPSHOT_LOOK_EVERY === 0, snapCount % SNAPSHOT_FULL_EVERY === 0);
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
    level,
    maxPlayers,
    accounts,
    close: () =>
      new Promise<void>((resolve) => {
        clearInterval(loop);
        clearInterval(purgeTimer);
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
