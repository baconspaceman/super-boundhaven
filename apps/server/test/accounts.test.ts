import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { GUEST_CLAIM_MS, type ServerMsg } from '@sbh/protocol';
import { AccountStore, nameKey } from '../src/accounts';
import { createGameServer, type GameServer } from '../src/server';

const DAY = 24 * 60 * 60 * 1000;

describe('AccountStore: names, claims and accounts', () => {
  it('normalises names so look-alikes are the same name', () => {
    expect(nameKey('Bacon Spaceman')).toBe('baconspaceman');
    expect(nameKey('bacon_SPACEMAN!')).toBe('baconspaceman');
    expect(nameKey('!!!')).toBe('');
  });

  it('a guest holds a free name for 7 days, others cannot take it, and it lapses unless renewed', () => {
    let t = 1_000_000;
    const s = new AccountStore({ now: () => t });
    const a = s.authorize('Mario', undefined, undefined);
    expect(a.ok && a.claim?.kind === 'guest' && a.claimToken).toBeTruthy();
    const token = a.ok ? a.claimToken! : '';
    expect(s.authorize('mario', undefined, undefined).ok).toBe(false); // someone else
    expect(s.authorize('MARIO', undefined, 'wrong').ok).toBe(false);
    expect(s.authorize('mario', undefined, token).ok).toBe(true); // the owner
    t += 6 * DAY;
    expect(s.authorize('mario', undefined, token).ok).toBe(true);
    const r = s.renew(nameKey('mario'));
    expect(typeof r).toBe('object');
    t += 6 * DAY; // 12 days since the first claim, 6 since the renewal
    expect(s.authorize('mario', undefined, 'nope').ok).toBe(false);
    t += 2 * DAY; // renewal lapsed
    const stranger = s.authorize('mario', undefined, undefined);
    expect(stranger.ok).toBe(true); // free again: anyone can take it
    expect(s.authorize('mario', undefined, token).ok).toBe(false); // the old token no longer works
  });

  it('an expired claim cannot be renewed; the owner just claims again if the name is still free', () => {
    let t = 0;
    const s = new AccountStore({ now: () => t });
    s.authorize('Luigi');
    t += GUEST_CLAIM_MS + 1;
    expect(typeof s.renew('luigi')).toBe('string');
    expect(s.authorize('Luigi').ok).toBe(true);
  });

  it('registering with an email keeps the name for good and needs the password afterwards', () => {
    let t = 0;
    const s = new AccountStore({ now: () => t });
    const g = s.authorize('Peach');
    expect(g.ok).toBe(true);
    expect(typeof s.register('peach', 'not-an-email', 'longenough')).toBe('string');
    expect(typeof s.register('peach', 'p@example.com', 'short')).toBe('string');
    expect(typeof s.register('peach', 'p@example.com', 'long-enough-1')).toBe('object');
    t += 365 * DAY;
    expect(s.authorize('Peach').ok).toBe(false); // needs the password
    expect(s.authorize('Peach', 'wrong-password').ok).toBe(false);
    const ok = s.authorize('peach', 'long-enough-1');
    expect(ok.ok && ok.claim).toEqual({ kind: 'account', expiresAt: null });
    expect(typeof s.register('peach', 'p@example.com', 'long-enough-1')).toBe('string'); // already registered
  });

  it('one email can hold at most 3 names', () => {
    const s = new AccountStore();
    for (const n of ['n1', 'n2', 'n3']) {
      s.authorize(n);
      expect(typeof s.register(n, 'same@example.com', 'long-enough-1')).toBe('object');
    }
    s.authorize('n4');
    expect(typeof s.register('n4', 'same@example.com', 'long-enough-1')).toBe('string');
  });

  it('the developer name is reserved until a password exists, then needs it and is an admin', () => {
    const open = new AccountStore({ adminName: 'baconspaceman' });
    expect(open.hasAdmin()).toBe(false);
    expect(open.authorize('Bacon Spaceman').ok).toBe(false);
    expect(open.authorize('baconspaceman', 'anything').ok).toBe(false);

    const s = new AccountStore({ adminName: 'baconspaceman', adminPassword: 'a-very-long-dev-password' });
    expect(s.hasAdmin()).toBe(true);
    expect(s.authorize('baconspaceman').ok).toBe(false);
    expect(s.authorize('BaconSpaceman', 'nope').ok).toBe(false);
    const r = s.authorize('BaconSpaceman', 'a-very-long-dev-password');
    expect(r.ok && r.role).toBe('admin');
    expect(s.ban(nameKey('baconspaceman'), null, '')).toBe(false); // cannot ban or release the developer
    expect(s.release(nameKey('baconspaceman'))).toBe(false);
  });

  it('bans block a name, expire on time and can be lifted', () => {
    let t = 0;
    const s = new AccountStore({ now: () => t });
    s.ban('troll', 1, 'rude');
    expect(s.authorize('Troll').ok).toBe(false);
    t += 2 * 3_600_000;
    expect(s.authorize('Troll').ok).toBe(true);
    s.ban('troll2', null, '');
    expect(s.unban('troll2')).toBe(true);
  });

  it('persists to a private file and reloads it, without storing a plain password', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sbh-acc-'));
    try {
      const file = join(dir, 'accounts.json');
      const a = new AccountStore({ file, adminPassword: 'dev-password-12345' });
      a.authorize('Toad');
      a.register('toad', 'toad@example.com', 'mushroom-pass-1');
      const raw = readFileSync(file, 'utf8');
      expect(raw).not.toContain('mushroom-pass-1');
      expect(raw).not.toContain('dev-password-12345');
      if (process.platform !== 'win32') expect(statSync(file).mode & 0o077).toBe(0);
      const b = new AccountStore({ file });
      expect(b.hasAdmin()).toBe(true);
      expect(b.authorize('toad', 'mushroom-pass-1').ok).toBe(true);
      expect(b.authorize('toad', 'wrong').ok).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---- over the wire ------------------------------------------------------------------------------

let server: GameServer;
const sockets: WebSocket[] = [];
afterEach(async () => {
  for (const w of sockets.splice(0)) w.terminate();
  await server?.close();
});

class Client {
  ws: WebSocket;
  msgs: ServerMsg[] = [];
  closed = false;
  constructor(port: number) {
    this.ws = new WebSocket(`ws://127.0.0.1:${port}`);
    this.ws.on('message', (d) => this.msgs.push(JSON.parse(d.toString()) as ServerMsg));
    this.ws.on('close', () => (this.closed = true));
    this.ws.on('error', () => {});
    sockets.push(this.ws);
  }
  open = () => new Promise<void>((r) => (this.ws.readyState === WebSocket.OPEN ? r() : this.ws.once('open', () => r())));
  send = (m: unknown) => this.ws.send(JSON.stringify(m));
  last<T extends ServerMsg['t']>(t: T) {
    return [...this.msgs].reverse().find((m) => m.t === t) as Extract<ServerMsg, { t: T }> | undefined;
  }
  infoText = () => this.msgs.filter((m): m is Extract<ServerMsg, { t: 'info' }> => m.t === 'info').flatMap((m) => m.lines).join('\n');
}
const until = async (cond: () => boolean, ms = 4000) => {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error('timeout');
    await new Promise((r) => setTimeout(r, 10));
  }
};
async function connect(extra: Record<string, unknown>): Promise<Client> {
  const c = new Client(server.port);
  await c.open();
  c.send({ t: 'join', ...extra });
  await until(() => !!c.last('welcome') || !!c.last('error'));
  return c;
}
const start = async () => {
  server = await createGameServer({ port: 0, accountsFile: null, adminPassword: 'a-very-long-dev-password', quiet: true });
};

describe('names and accounts over the wire', () => {
  it('claims a free name, refuses a second person, and lets the owner back in with the claim token', async () => {
    await start();
    const a = await connect({ name: 'Yoshi' });
    const w = a.last('welcome')!;
    expect(w.role).toBe('player');
    expect(w.claim?.kind).toBe('guest');
    expect(w.claimToken).toBeTruthy();
    const b = await connect({ name: 'yoshi' });
    expect(b.last('error')?.message).toMatch(/taken/);
    await until(() => b.closed);
    const c = await connect({ name: 'Yoshi', claim: w.claimToken });
    expect(c.last('welcome')?.claim?.kind).toBe('guest');
    expect(c.last('welcome')?.claimToken).toBeUndefined(); // the token is only ever sent once
  });

  it('/register makes the name permanent: joining then needs the password, with rate-limited guessing', async () => {
    await start();
    const a = await connect({ name: 'Daisy' });
    a.send({ t: 'cmd', line: '/register daisy@example.com super-secret-1' });
    await until(() => !!a.last('account'));
    expect(a.last('account')?.claim?.kind).toBe('account');
    const noPass = await connect({ name: 'Daisy' });
    expect(noPass.last('error')?.message).toMatch(/password/);
    const wrong = await connect({ name: 'Daisy', pass: 'nope-nope-1' });
    expect(wrong.last('error')?.message).toMatch(/Wrong password/);
    const ok = await connect({ name: 'Daisy', pass: 'super-secret-1' });
    expect(ok.last('welcome')?.claim).toEqual({ kind: 'account', expiresAt: null });
    for (let i = 0; i < 10; i++) await connect({ name: 'Daisy', pass: `bad-guess-${i}` });
    const locked = await connect({ name: 'Daisy', pass: 'super-secret-1' });
    expect(locked.last('error')?.message).toMatch(/Too many/);
  });
});

describe('developer account', () => {
  async function dev() {
    return connect({ name: 'baconspaceman', pass: 'a-very-long-dev-password' });
  }

  it('is reserved: wrong or missing password cannot join', async () => {
    await start();
    expect((await connect({ name: 'baconspaceman' })).last('error')?.message).toMatch(/reserved/);
    expect((await connect({ name: 'Bacon Spaceman', pass: 'wrong-wrong-1' })).last('error')?.message).toMatch(/Wrong password/);
    const d = await dev();
    expect(d.last('welcome')?.role).toBe('admin');
  });

  it('can give shards, teleport, god, force doors and announce; players cannot', async () => {
    await start();
    const d = await dev();
    const p = await connect({ name: 'Player One' });
    const dId = d.last('welcome')!.id;
    const body = (id: number) => server.world.players.find((q) => q.id === id)!;

    d.send({ t: 'cmd', line: '/give shard 25' });
    await until(() => body(dId).shards === 25);
    d.send({ t: 'cmd', line: '/give shard 5 playerone' });
    await until(() => body(p.last('welcome')!.id).shards === 5);
    d.send({ t: 'cmd', line: '/tp 100 120' });
    await until(() => Math.round(body(dId).x) === 100);
    d.send({ t: 'cmd', line: '/god on' });
    await until(() => body(dId).invuln > 1000);
    d.send({ t: 'cmd', line: '/announce hello everyone' });
    await until(() => p.infoText().includes('hello everyone'));

    // a normal player gets nothing from developer commands, and cannot fake a role
    p.send({ t: 'cmd', line: '/give shard 999' });
    p.send({ t: 'cmd', line: '/tp 5 5' });
    p.send({ t: 'cmd', role: 'admin', line: '/god on' } as never);
    await until(() => (p.infoText().match(/Unknown command/g) ?? []).length >= 3);
    expect(body(p.last('welcome')!.id).shards).toBe(5);
    expect(body(p.last('welcome')!.id).invuln).toBeLessThan(1000);
  });

  it('can kick and ban; a banned name cannot rejoin until unbanned', async () => {
    await start();
    const d = await dev();
    const p = await connect({ name: 'Rude Person' });
    d.send({ t: 'cmd', line: '/ban rudeperson 2 being rude' });
    await until(() => p.closed);
    const again = await connect({ name: 'RudePerson' });
    expect(again.last('error')?.message).toMatch(/banned/);
    d.send({ t: 'cmd', line: '/unban rudeperson' });
    await until(() => d.infoText().includes('Unbanned'));
    // unbanned, but the original guest still holds the name for its 7 days
    expect((await connect({ name: 'RudePerson' })).last('error')?.message).toMatch(/taken/);
  });

  it('whoami reports role and claim; /free releases a name', async () => {
    await start();
    const d = await dev();
    const g = await connect({ name: 'Wario' });
    g.send({ t: 'cmd', line: '/whoami' });
    await until(() => g.infoText().includes('guest claim'));
    d.send({ t: 'cmd', line: '/free wario' });
    await until(() => d.infoText().includes('Released'));
    const other = await connect({ name: 'wario' });
    expect(other.last('welcome')).toBeTruthy();
  });
});
