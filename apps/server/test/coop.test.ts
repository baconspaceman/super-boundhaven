import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { PROTOCOL_VERSION, applyNetWorld, createWorldView, type NetPlayer, type ServerMsg, type WorldView } from '@sbh/protocol';
import { BTN, BTN_MASK, COOP_IDS, COOP_ROOM, TILE } from '@sbh/sim';
import { drive } from '../../../packages/sim/test/bots';
import { createGameServer, type GameServer } from '../src/server';

let server: GameServer;
const clients: Client[] = [];
const stops: (() => void)[] = [];

class Client {
  ws: WebSocket;
  msgs: ServerMsg[] = [];
  view: WorldView = createWorldView();
  closed = false;
  constructor(port: number) {
    this.ws = new WebSocket(`ws://127.0.0.1:${port}`);
    this.ws.on('message', (d) => {
      const m = JSON.parse(d.toString()) as ServerMsg;
      this.msgs.push(m);
      if (m.t === 'snap' && m.world) applyNetWorld(this.view, m.world); // exactly what a client does
    });
    this.ws.on('close', () => (this.closed = true));
    this.ws.on('error', () => {});
    clients.push(this);
  }
  open = () => new Promise<void>((r) => (this.ws.readyState === WebSocket.OPEN ? r() : this.ws.once('open', () => r())));
  send = (m: unknown) => this.ws.send(JSON.stringify(m));
  last<T extends ServerMsg['t']>(t: T) {
    return [...this.msgs].reverse().find((m) => m.t === t) as Extract<ServerMsg, { t: T }> | undefined;
  }
  player(id: number): NetPlayer | undefined {
    return this.last('snap')?.players.find((p) => p.id === id);
  }
}

async function until(cond: () => boolean, ms = 8000): Promise<void> {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error('timeout');
    await new Promise((r) => setTimeout(r, 10));
  }
}

async function joined(name: string): Promise<{ c: Client; id: number }> {
  const c = new Client(server.port);
  await c.open();
  c.send({ t: 'join', name });
  await until(() => !!c.last('welcome'));
  return { c, id: c.last('welcome')!.id };
}

/** A tiny client-side autopilot: reads its own snapshot state, sends one input per frame like a real client. */
function autopilot(c: Client, id: number, targetX: () => number): void {
  const st = { jump: 0 };
  let seq = 0;
  const iv = setInterval(() => {
    const me = c.player(id)?.state;
    if (!me || c.ws.readyState !== WebSocket.OPEN) return;
    c.send({ t: 'input', seq: ++seq, buttons: drive(COOP_ROOM, me, targetX(), st) });
  }, 16);
  stops.push(() => clearInterval(iv));
}

afterEach(async () => {
  for (const s of stops.splice(0)) s();
  for (const c of clients.splice(0)) c.ws.terminate();
  await server.close();
});

const px = (col: number) => col * TILE + TILE / 2;
const plate = (n: keyof typeof COOP_IDS.plate) => px(COOP_ROOM.plates[COOP_IDS.plate[n]].col);

describe('co-op room over WebSocket', () => {
  it('serves the coopRoom level and tells clients its name and protocol version', async () => {
    server = await createGameServer({ port: 0, levelName: 'coopRoom' });
    expect(server.level.name).toBe('coopRoom');
    expect(server.maxPlayers).toBe(4);
    const { c } = await joined('a');
    expect(c.last('welcome')!.level).toBe('coopRoom');
    expect(c.last('welcome')!.v).toBe(PROTOCOL_VERSION);
    await until(() => !!c.last('snap'));
    expect(c.last('snap')!.world?.full).toBe(1); // first snapshot carries complete world state
    expect(c.last('snap')!.world!.enemies).toHaveLength(COOP_ROOM.enemies.length);
  });

  it('rejects unknown levels and a 5th player', async () => {
    await expect(createGameServer({ port: 0, levelName: 'nope' })).rejects.toThrow(/unknown level/);
    server = await createGameServer({ port: 0, levelName: 'coopRoom' });
    for (let i = 0; i < 4; i++) await joined(`p${i}`);
    const c = new Client(server.port);
    await c.open();
    c.send({ t: 'join', name: 'extra' });
    await until(() => c.closed);
    expect(c.last('error')).toBeDefined();
    expect(server.world.players).toHaveLength(4);
  });

  it('masks inputs to the six defined buttons', async () => {
    server = await createGameServer({ port: 0 }); // playground
    const { c, id } = await joined('a');
    for (let seq = 1; seq <= 5; seq++) c.send({ t: 'input', seq, buttons: 0xffff });
    await until(() => c.player(id)?.ack === 5);
    expect(BTN_MASK).toBe(63);
    // no crash and the extra bits did nothing odd: still a valid player
    expect(Number.isFinite(c.player(id)!.state.x)).toBe(true);
  });

  it('two clients clear gate 0 by holding both plates through real inputs, and the door state reaches both', async () => {
    server = await createGameServer({ port: 0, levelName: 'coopRoom' });
    const a = await joined('alice');
    const b = await joined('bob');
    await until(() => !!a.c.player(a.id) && !!b.c.player(b.id));
    autopilot(a.c, a.id, () => plate('A'));
    autopilot(b.c, b.id, () => plate('B'));
    await until(() => a.c.view.dynamic[COOP_IDS.door.gate0] === true && b.c.view.dynamic[COOP_IDS.door.gate0] === true, 12000);
    expect(a.c.view.plates[COOP_IDS.plate.A] && a.c.view.plates[COOP_IDS.plate.B]).toBe(true);
    expect(server.world.dynamic[COOP_IDS.door.gate0]).toBe(true);
  }, 20000);

  it('a lone player cannot open it; a dropped partner releases their plate', async () => {
    server = await createGameServer({ port: 0, levelName: 'coopRoom', graceMs: 5000 });
    const a = await joined('alice');
    const b = await joined('bob');
    await until(() => !!a.c.player(a.id) && !!b.c.player(b.id));
    autopilot(a.c, a.id, () => plate('A'));
    autopilot(b.c, b.id, () => plate('B'));
    await until(() => a.c.view.dynamic[COOP_IDS.door.gate0] === true, 12000);
    // bob drops: his body stays for the grace period but is inert
    b.c.ws.terminate();
    await until(() => a.c.player(b.id)?.connected === false);
    await until(() => a.c.view.plates[COOP_IDS.plate.B] !== true);
    expect(server.world.players.find((p) => p.id === b.id)!.away).toBe(true);
    // gate closes once the linger window is over (alice still holds plate A)
    await until(() => a.c.view.dynamic[COOP_IDS.door.gate0] !== true, 12000);
    expect(server.world.plates[COOP_IDS.plate.A]).toBe(true);
  }, 30000);

  it('a reconnecting player is solid again and gets a full world frame', async () => {
    server = await createGameServer({ port: 0, levelName: 'coopRoom', graceMs: 5000 });
    const a = await joined('alice');
    const token = a.c.last('welcome')!.token;
    await until(() => !!a.c.player(a.id));
    a.c.ws.terminate();
    await until(() => server.world.players[0].away === true);
    const c2 = new Client(server.port);
    await c2.open();
    c2.send({ t: 'join', name: 'x', token });
    await until(() => !!c2.last('welcome'));
    await until(() => c2.msgs.some((m) => m.t === 'snap'));
    const firstSnap = c2.msgs.find((m) => m.t === 'snap') as Extract<ServerMsg, { t: 'snap' }>;
    expect(firstSnap.world?.full).toBe(1);
    expect(server.world.players[0].away).toBe(false);
  });
});
