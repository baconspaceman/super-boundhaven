import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import type { NetPlayer, ServerMsg } from '@sbh/protocol';
import { BTN } from '@sbh/sim';
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
  last<T extends ServerMsg['t']>(t: T) {
    return [...this.msgs].reverse().find((m) => m.t === t) as Extract<ServerMsg, { t: T }> | undefined;
  }
  player(id: number): NetPlayer | undefined {
    return this.last('snap')?.players.find((p) => p.id === id);
  }
}

async function until(cond: () => boolean, ms = 3000): Promise<void> {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error('timeout');
    await new Promise((r) => setTimeout(r, 10));
  }
}

async function joined(name: string, token?: string): Promise<{ c: Client; id: number; token: string }> {
  const c = new Client(server.port);
  await c.open();
  c.send({ t: 'join', name, token });
  await until(() => !!c.last('welcome'));
  const w = c.last('welcome')!;
  return { c, id: w.id, token: w.token };
}

const start = async (graceMs = 10_000) => (server = await createGameServer({ port: 0, graceMs }));

afterEach(async () => {
  for (const c of clients.splice(0)) c.ws.terminate();
  await server.close();
});

describe('game server', () => {
  it('two clients see both players in snapshots', async () => {
    await start();
    const a = await joined('alice');
    const b = await joined('bob');
    expect(a.id).not.toBe(b.id);
    for (const { c } of [a, b]) {
      await until(() => (c.last('snap')?.players.length ?? 0) === 2);
      expect(c.last('snap')!.players.map((p) => p.name)).toEqual(['alice', 'bob']);
    }
  });

  it('applies inputs: x moves and ack advances', async () => {
    await start();
    const a = await joined('a');
    await until(() => !!a.c.player(a.id));
    const x0 = a.c.player(a.id)!.state.x;
    for (let seq = 1; seq <= 30; seq++) a.c.send({ t: 'input', seq, buttons: BTN.RIGHT });
    await until(() => a.c.player(a.id)!.ack === 30);
    expect(a.c.player(a.id)!.state.x).toBeGreaterThan(x0);
  });

  it('sanitizes names and echoes pings', async () => {
    await start();
    const a = await joined('  hi\u0000\u0007there  ');
    await until(() => !!a.c.player(a.id));
    expect(a.c.player(a.id)!.name).toBe('hithere');
    const d = await joined('');
    await until(() => !!d.c.player(d.id));
    expect(d.c.player(d.id)!.name).toBe(`Player${d.id}`);
    a.c.send({ t: 'ping', ts: 1234 });
    await until(() => !!a.c.last('pong'));
    expect(a.c.last('pong')!.ts).toBe(1234);
  });

  it('reconnect with token keeps id and state', async () => {
    await start();
    const a = await joined('a');
    for (let seq = 1; seq <= 20; seq++) a.c.send({ t: 'input', seq, buttons: BTN.RIGHT });
    await until(() => a.c.player(a.id)?.ack === 20);
    a.c.ws.close();
    await until(() => a.c.closed);
    await until(() => server.world.players.length === 1);
    const x = server.world.players[0].x;
    expect(x).toBeGreaterThan(0);
    const b = await joined('ignored', a.token);
    expect(b.id).toBe(a.id);
    expect(b.token).toBe(a.token);
    await until(() => b.c.player(a.id)?.connected === true);
    expect(b.c.player(a.id)!.state.x).toBeGreaterThanOrEqual(x);
    expect(server.world.players).toHaveLength(1);
  });

  it('token join on a live session replaces the stale socket', async () => {
    await start();
    const a = await joined('a');
    const b = await joined('a', a.token);
    expect(b.id).toBe(a.id);
    await until(() => a.c.closed);
    await until(() => b.c.player(b.id)?.connected === true);
    expect(server.world.players).toHaveLength(1);
  });

  it('survives malformed messages', async () => {
    await start();
    const a = await joined('a');
    const junk: unknown[] = [
      'not json',
      '42',
      'null',
      '[]',
      { t: 'input' },
      { t: 'input', seq: 'x', buttons: {} },
      { t: 'join', name: 5 },
      { t: 'ping', ts: 'x' },
      { t: 'nope' },
      '{"t":"input","seq":1e999,"buttons":1e999}',
      { t: 'input', seq: 1.7, buttons: 255 },
    ];
    for (const j of junk) a.c.send(j);
    a.c.ws.send(Buffer.from([1, 2, 3]));
    const big = new Client(server.port);
    await big.open();
    big.send('x'.repeat(5000));
    await until(() => big.closed);
    const b = await joined('b');
    await until(() => !!b.c.player(b.id));
    expect(a.c.ws.readyState).toBe(WebSocket.OPEN);
    await until(() => a.c.player(a.id)?.ack === 1);
  });

  it('ignores input before join', async () => {
    await start();
    const c = new Client(server.port);
    await c.open();
    c.send({ t: 'input', seq: 5, buttons: BTN.RIGHT });
    c.send({ t: 'join', name: 'late' });
    await until(() => !!c.last('welcome'));
    const id = c.last('welcome')!.id;
    await until(() => !!c.player(id));
    expect(c.player(id)!.ack).toBe(0);
  });

  it('rejects the 17th client', async () => {
    await start();
    for (let i = 0; i < 16; i++) await joined(`p${i}`);
    const c = new Client(server.port);
    await c.open();
    c.send({ t: 'join', name: 'extra' });
    await until(() => c.closed);
    expect(c.last('error')).toBeDefined();
    expect(c.last('welcome')).toBeUndefined();
    expect(server.world.players).toHaveLength(16);
  });

  it('removes a disconnected player after the grace period', async () => {
    await start(150);
    const a = await joined('a');
    const b = await joined('b');
    await until(() => b.c.last('snap')?.players.length === 2);
    a.c.ws.close();
    await until(() => b.c.player(a.id)?.connected === false);
    await until(() => b.c.last('snap')?.players.length === 1);
    expect(server.world.players.map((p) => p.id)).toEqual([b.id]);
    const again = await joined('a', a.token); // token is dead: fresh id
    expect(again.id).not.toBe(a.id);
  });

  it('close() drops clients', async () => {
    await start();
    const a = await joined('a');
    await server.close();
    await until(() => a.c.closed);
  });
});
