import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { defaultLookCode, encodeLook, randomLook, SNAPSHOT_LOOK_EVERY, type ServerMsg } from '@sbh/protocol';
import { createGameServer, type GameServer } from '../src/server';

let server: GameServer;
const clients: Client[] = [];

class Client {
  ws: WebSocket;
  msgs: ServerMsg[] = [];
  closed = false;
  constructor(port: number) {
    this.ws = new WebSocket(`ws://127.0.0.1:${port}`);
    this.ws.on('message', (d) => this.msgs.push(JSON.parse(d.toString())));
    this.ws.on('close', () => (this.closed = true));
    this.ws.on('error', () => {});
    clients.push(this);
  }
  open = () => new Promise<void>((r) => (this.ws.readyState === WebSocket.OPEN ? r() : this.ws.once('open', () => r())));
  send = (m: unknown) => this.ws.send(typeof m === 'string' ? m : JSON.stringify(m));
  welcome = () => this.msgs.find((m) => m.t === 'welcome') as Extract<ServerMsg, { t: 'welcome' }> | undefined;
  /** latest look message seen for a player id */
  lookOf = (id: number) =>
    [...this.msgs].reverse().find((m): m is Extract<ServerMsg, { t: 'look' }> => m.t === 'look' && m.id === id)?.look;
  errors = () => this.msgs.filter((m) => m.t === 'error').length;
}

async function until(cond: () => boolean, ms = 3000): Promise<void> {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error('timeout');
    await new Promise((r) => setTimeout(r, 10));
  }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function joined(join: Record<string, unknown>) {
  const c = new Client(server.port);
  await c.open();
  c.send({ t: 'join', ...join });
  await until(() => !!c.welcome());
  const w = c.welcome()!;
  return { c, id: w.id, token: w.token, look: w.look };
}

const A = encodeLook(randomLook(1001));
const B = encodeLook(randomLook(2002));
const C = encodeLook(randomLook(3003));

afterEach(async () => {
  for (const c of clients.splice(0)) c.ws.terminate();
  await server.close();
});

describe('look sync', () => {
  it('accepts a valid look on join and echoes it in welcome', async () => {
    server = await createGameServer({ port: 0 });
    const a = await joined({ name: 'a', look: A });
    expect(a.look).toBe(A);
    expect(a.c.welcome()!.v).toBe(5); // PROTOCOL_VERSION bumped for accounts
  });

  it.each([
    ['missing', undefined],
    ['wrong type', 1234],
    ['garbage', 'not a look!!'],
    ['empty', ''],
    ['wrong version char', '2' + A.slice(1)],
    ['truncated', A.slice(0, 10)],
    ['oversized (in-frame)', 'A'.repeat(800)],
    ['object', { skin: 1 }],
  ])('falls back to a deterministic default for %s look on join', async (_n, bad) => {
    server = await createGameServer({ port: 0 });
    const a = await joined({ name: 'a', look: bad });
    expect(a.look).toBe(defaultLookCode(a.id));
    expect(a.c.errors()).toBe(0);
  });

  it('survives a >1 KB look frame without crashing the server', async () => {
    server = await createGameServer({ port: 0 });
    const a = await joined({ name: 'a', look: A });
    const evil = new Client(server.port);
    await evil.open();
    evil.send({ t: 'join', name: 'evil', look: 'x'.repeat(4096) });
    await until(() => evil.closed); // maxPayload closes the socket
    const b = await joined({ name: 'b', look: B });
    expect(b.c.lookOf(a.id)).toBe(A);
  });

  it('relays looks to other clients: backfill on join, broadcast for later joiners', async () => {
    server = await createGameServer({ port: 0 });
    const a = await joined({ name: 'a', look: A });
    const b = await joined({ name: 'b', look: B });
    await until(() => a.c.lookOf(b.id) === B);
    expect(b.c.lookOf(a.id)).toBe(A); // backfilled
    expect(b.c.lookOf(b.id)).toBe(B);
  });

  it('setLook updates live and broadcasts to everyone', async () => {
    server = await createGameServer({ port: 0 });
    const a = await joined({ name: 'a', look: A });
    const b = await joined({ name: 'b', look: B });
    a.c.send({ t: 'setLook', look: C });
    await until(() => b.c.lookOf(a.id) === C && a.c.lookOf(a.id) === C);
  });

  it('rejects an invalid setLook and keeps the old look', async () => {
    server = await createGameServer({ port: 0 });
    const a = await joined({ name: 'a', look: A });
    a.c.send({ t: 'setLook', look: 'zzz' });
    a.c.send({ t: 'setLook', look: 42 });
    a.c.send({ t: 'setLook', look: 'B'.repeat(100000).slice(0, 900) });
    await until(() => a.c.errors() >= 3);
    expect(a.c.lookOf(a.id)).toBe(A);
  });

  it('rate limits setLook (burst of 3, then refill)', async () => {
    server = await createGameServer({ port: 0 });
    const a = await joined({ name: 'a', look: A });
    const looks = [1, 2, 3, 4, 5, 6].map((i) => encodeLook(randomLook(9000 + i)));
    for (const l of looks) a.c.send({ t: 'setLook', look: l });
    await until(() => a.c.errors() >= 3);
    await sleep(100);
    expect(a.c.lookOf(a.id)).toBe(looks[2]); // first 3 applied, rest dropped
    expect(a.c.errors()).toBe(3);
    await sleep(1100); // one token refilled
    a.c.send({ t: 'setLook', look: looks[5] });
    await until(() => a.c.lookOf(a.id) === looks[5]);
  });

  it('keeps the look across a token reconnect and ignores a new join look', async () => {
    server = await createGameServer({ port: 0 });
    const a = await joined({ name: 'a', look: A });
    a.c.send({ t: 'setLook', look: C });
    await until(() => a.c.lookOf(a.id) === C);
    a.c.ws.close();
    await until(() => a.c.closed);
    const again = await joined({ name: 'a', token: a.token, look: B });
    expect(again.id).toBe(a.id);
    expect(again.look).toBe(C);
  });

  it('snapshots carry looks only on the 1 Hz fallback frames', async () => {
    server = await createGameServer({ port: 0 });
    const a = await joined({ name: 'a', look: A });
    const snaps: { look?: string }[] = [];
    a.c.ws.on('message', (d) => {
      const m = JSON.parse(d.toString());
      if (m.t === 'snap') snaps.push(m.players[0]);
    });
    await until(() => snaps.length >= SNAPSHOT_LOOK_EVERY + 2, 6000);
    const withLook = snaps.filter((p) => p.look !== undefined);
    expect(withLook.length).toBeGreaterThanOrEqual(1);
    expect(withLook.every((p) => p.look === A)).toBe(true);
    expect(snaps.length - withLook.length).toBeGreaterThan(withLook.length);
  });
});
