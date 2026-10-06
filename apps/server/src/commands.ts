// Console commands. Everyone gets /help /whoami /register /renew; the developer account gets the rest.
// Every function here works on the authoritative world, so nothing a client sends can bypass it: the role comes
// from the server's own session record, never from the message.
import { MAX_COMMAND, type ClaimInfo, type Role } from '@sbh/protocol';
import { ITEMS, TILE, hardResetRoom, type Level, type PlayerState, type World } from '@sbh/sim';
import { nameKey, type AccountStore } from './accounts';

export interface CmdSession {
  id: number;
  name: string;
  key: string; // nameKey, '' for anonymous guests
  role: Role;
  god: boolean;
}

export interface CmdContext {
  world: World;
  level: Level;
  store: AccountStore;
  sessions: () => Iterable<CmdSession>;
  announce: (text: string) => void;
  kick: (s: CmdSession, reason: string) => void;
  log: (line: string) => void;
}

export interface CmdResult {
  lines: string[];
  /** The caller's role/claim changed: send an `account` message. */
  account?: { role: Role; claim: ClaimInfo | null };
}

const BIG = 2_000_000_000;

const fmtClaim = (c: ClaimInfo | null): string => {
  if (!c) return 'no claim on this name (anonymous guest)';
  if (c.kind === 'account') return 'registered account (name is yours for good)';
  const left = Math.max(0, (c.expiresAt ?? 0) - Date.now());
  const days = Math.floor(left / 86_400_000);
  const hours = Math.floor((left % 86_400_000) / 3_600_000);
  return `guest claim, ${days}d ${hours}h left (type /renew to extend by 7 days, /register <email> <password> to keep it)`;
};

const PLAYER_HELP = [
  '/help                           this list',
  '/whoami                         your name, role and how long you hold it',
  '/register <email> <password>    keep your name for good (password: 8+ characters)',
  '/renew                          hold your guest name for another 7 days',
];

const ADMIN_HELP = [
  'Developer commands:',
  '/who                            players: id, name, role, position',
  '/items                          everything /give can create',
  '/give <item> <n> [player]       add items (shard); player = name without spaces or id',
  '/tp <x> <y> [player]            teleport to pixel coordinates (y = feet)',
  '/tp <player> [who]              teleport to a player',
  '/cp <n> [player]                teleport to checkpoint n (0 = first)',
  '/god [on|off]                   no damage',
  '/doors open|close <id|all>      force doors (close = stop forcing)',
  '/buttons light <id|all>         light big buttons for good',
  '/levers on|off <id|all>',
  '/kill enemies                   defeat every enemy',
  '/reset                          reset the room, send everyone to the start',
  '/announce <text>                message to everyone',
  '/kick <player> [reason]',
  '/ban <name> [hours] [reason]    hours omitted = permanent',
  '/unban <name>',
  '/free <name>                    release a name claim or account',
];

export function runCommand(ctx: CmdContext, self: CmdSession, rawLine: string): CmdResult {
  const line = rawLine.slice(0, MAX_COMMAND).replace(/[\u0000-\u001f]/g, ' ').trim();
  const body = line.replace(/^\//, '');
  const [cmdRaw = '', ...args] = body.split(/\s+/);
  const cmd = cmdRaw.toLowerCase();
  const out = (...lines: string[]): CmdResult => ({ lines });
  const admin = self.role === 'admin';
  const find = (q?: string): CmdSession | undefined => {
    if (!q) return self;
    const k = nameKey(q);
    const n = Number(q);
    for (const s of ctx.sessions()) if (s.key === k || (Number.isInteger(n) && s.id === n)) return s;
    return undefined;
  };
  const body_ = (s: CmdSession): PlayerState | undefined => ctx.world.players.find((p) => p.id === s.id);
  const num = (v: string | undefined): number | null => (v !== undefined && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

  // ---- everyone ----
  switch (cmd) {
    case '':
    case 'help':
      return out(...PLAYER_HELP, ...(admin ? ADMIN_HELP : []));
    case 'whoami':
      return out(`You are ${self.name} (${self.role === 'admin' ? 'developer' : 'player'}), ${fmtClaim(ctx.store.claimOf(self.key))}.`);
    case 'renew': {
      if (!self.key) return out('Anonymous guests have no name to renew. Join with a name first.');
      const r = ctx.store.renew(self.key);
      if (typeof r === 'string') return out(r);
      return { lines: [`Renewed. ${fmtClaim(r)}`], account: { role: self.role, claim: r } };
    }
    case 'register': {
      const [email, pass] = args;
      if (!self.key) return out('Join with a name first.');
      if (!email || !pass) return out('Usage: /register <email> <password>');
      const r = ctx.store.register(self.key, email, pass);
      if (typeof r === 'string') return out(r);
      return {
        lines: ['Registered. This name is now yours for good: joining with it will ask for your password.', 'Note: emails are not verified yet, so keep your password safe; there is no reset by mail.'],
        account: { role: self.role, claim: r },
      };
    }
  }

  if (!admin) return out(`Unknown command "/${cmd}". Type /help.`);

  // ---- developer ----
  switch (cmd) {
    case 'who': {
      const rows = [...ctx.sessions()].map((s) => {
        const p = body_(s);
        return `#${s.id} ${s.name} [${s.role}${s.god ? ', god' : ''}] ${p ? `(${Math.round(p.x)}, ${Math.round(p.y)}) shards ${p.shards}` : ''}`;
      });
      return out(...(rows.length ? rows : ['nobody']));
    }
    case 'items':
      return out(...Object.values(ITEMS).map((i) => `${i.id}: ${i.name} (max ${i.max})`), 'Only shards exist so far; gear, mounts and powerups will be added to this list.');
    case 'give': {
      const item = ITEMS[(args[0] ?? '').toLowerCase()];
      const n = num(args[1]);
      if (!item || n === null) return out('Usage: /give <item> <amount> [player]. Items: ' + Object.keys(ITEMS).join(', '));
      const t = find(args[2]);
      const p = t && body_(t);
      if (!t || !p) return out('No such player.');
      const amount = Math.max(-item.max, Math.min(item.max, Math.trunc(n)));
      if (item.id === 'shard') p.shards = Math.max(0, Math.min(item.max, p.shards + amount));
      ctx.log(`give ${item.id} ${amount} -> ${t.name} by ${self.name}`);
      return out(`${t.name} now has ${p.shards} ${item.name.toLowerCase()}s.`);
    }
    case 'tp':
    case 'cp': {
      const lvl = ctx.level;
      let target: CmdSession | undefined;
      let x: number;
      let y: number;
      if (cmd === 'cp') {
        const i = num(args[0]);
        const cp = i === null ? undefined : lvl.checkpoints[Math.trunc(i)];
        if (!cp) return out(`Checkpoint 0 to ${lvl.checkpoints.length - 1} only.`);
        target = find(args[1]);
        ({ x, y } = cp);
      } else if (num(args[0]) !== null && num(args[1]) !== null) {
        target = find(args[2]);
        x = num(args[0])!;
        y = num(args[1])!;
      } else {
        const dest = body_(find(args[0]) ?? self);
        if (!args[0] || !dest) return out('Usage: /tp <x> <y> [player]   or   /tp <player> [who]');
        target = find(args[1]);
        x = dest.x;
        y = dest.y;
      }
      const p = target && body_(target);
      if (!target || !p) return out('No such player.');
      p.x = Math.max(8, Math.min(lvl.width * TILE - 8, x));
      p.y = Math.max(0, Math.min((lvl.height + 1) * TILE, y));
      p.prevY = p.y;
      p.vx = 0;
      p.vy = 0;
      p.onGround = false;
      p.pound = 0;
      p.slam = 0;
      ctx.log(`tp ${target.name} -> ${Math.round(p.x)},${Math.round(p.y)} by ${self.name}`);
      return out(`Moved ${target.name} to (${Math.round(p.x)}, ${Math.round(p.y)}).`);
    }
    case 'god': {
      const on = args[0] ? args[0].toLowerCase() !== 'off' : !self.god;
      self.god = on;
      const p = body_(self);
      if (p && !on) p.invuln = 0;
      return out(`God mode ${on ? 'on' : 'off'}.`);
    }
    case 'doors': {
      const mode = args[0];
      const ids = pickIds(args[1], ctx.level.doors.length);
      if ((mode !== 'open' && mode !== 'close') || !ids) return out(`Usage: /doors open|close <id|all> (0 to ${ctx.level.doors.length - 1})`);
      ctx.level.links.forEach((l, i) => {
        if (ids.includes(l.door)) ctx.world.linger[i] = mode === 'open' ? BIG : 0;
      });
      ctx.log(`doors ${mode} ${args[1]} by ${self.name}`);
      return out(mode === 'open' ? `Holding door(s) ${ids.join(', ')} open.` : `Stopped forcing door(s) ${ids.join(', ')}; plates and levers decide again.`);
    }
    case 'buttons': {
      const ids = pickIds(args[1], ctx.level.buttons.length);
      if (args[0] !== 'light' || !ids) return out(`Usage: /buttons light <id|all> (${ctx.level.buttons.length} on this level)`);
      for (const id of ids) ctx.world.buttons[id] = BIG;
      return out(`Lit button(s) ${ids.join(', ')}.`);
    }
    case 'levers': {
      const on = args[0] === 'on';
      const ids = pickIds(args[1], ctx.level.levers.length);
      if ((args[0] !== 'on' && args[0] !== 'off') || !ids) return out(`Usage: /levers on|off <id|all> (${ctx.level.levers.length} on this level)`);
      for (const id of ids) {
        if (ctx.level.levers[id].reset) continue;
        ctx.world.levers[id].on = on;
        ctx.world.levers[id].t = on && ctx.level.levers[id].ticks > 0 ? BIG : 0;
      }
      return out(`Levers ${on ? 'on' : 'off'}.`);
    }
    case 'kill': {
      if (args[0] !== 'enemies') return out('Usage: /kill enemies');
      for (const e of ctx.world.enemies) {
        e.alive = false;
        e.t = BIG;
      }
      return out('Every enemy is down until the next /reset.');
    }
    case 'reset':
      hardResetRoom(ctx.level, ctx.world);
      ctx.log(`reset by ${self.name}`);
      return out('Room reset.');
    case 'announce': {
      const text = args.join(' ').trim();
      if (!text) return out('Usage: /announce <text>');
      ctx.announce(`[Developer] ${text}`);
      return out('Sent.');
    }
    case 'kick': {
      const t = find(args[0]);
      if (!args[0] || !t) return out('Usage: /kick <player> [reason]');
      if (t.role === 'admin') return out('You cannot kick a developer.');
      ctx.kick(t, args.slice(1).join(' ') || 'kicked by a developer');
      ctx.log(`kick ${t.name} by ${self.name}`);
      return out(`Kicked ${t.name}.`);
    }
    case 'ban': {
      const key = nameKey(args[0] ?? '');
      if (!key) return out('Usage: /ban <name> [hours] [reason]');
      const h = num(args[1]);
      const reason = args.slice(h === null ? 1 : 2).join(' ');
      if (!ctx.store.ban(key, h, reason)) return out('That name cannot be banned.');
      for (const s of [...ctx.sessions()]) if (s.key === key) ctx.kick(s, 'banned');
      ctx.log(`ban ${key} ${h ?? 'forever'} by ${self.name}`);
      return out(`Banned "${args[0]}" ${h === null ? 'permanently' : `for ${h} h`}.`);
    }
    case 'unban':
      return out(ctx.store.unban(nameKey(args[0] ?? '')) ? 'Unbanned.' : 'That name was not banned.');
    case 'free': {
      const key = nameKey(args[0] ?? '');
      if (!key) return out('Usage: /free <name>');
      return out(ctx.store.release(key) ? `Released "${args[0]}". Anyone can take it now.` : 'Nothing to release for that name.');
    }
    default:
      return out(`Unknown command "/${cmd}". Type /help.`);
  }
}

/** "all" or a single id (validated against the count); null if invalid. */
function pickIds(arg: string | undefined, count: number): number[] | null {
  if (arg === 'all') return Array.from({ length: count }, (_, i) => i);
  const n = Number(arg);
  return arg !== undefined && Number.isInteger(n) && n >= 0 && n < count ? [n] : null;
}
