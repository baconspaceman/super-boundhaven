import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { PROTOCOL_VERSION, applyNetWorld, createWorldView, type ServerMsg, type WorldView } from '@sbh/protocol';
import { RAID_ROOM } from '@sbh/sim';
import { createGameServer, type GameServer } from '../src/server';

let server: GameServer;
const clients: Client[] = [];

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
      if (m.t === 'snap' && m.world) applyNetWorld(this.view, m.world);
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
}

async function until(cond: () => boolean, ms = 8000): Promise<void> {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error('timeout');
    await new Promise((r) => setTimeout(r, 10));
  }
}

async function joined(name: string): Promise<Client> {
  const c = new Client(server.port);
  await c.open();
  c.send({ t: 'join', name });
  await until(() => !!c.last('welcome'));
  return c;
}

afterEach(async () => {
  for (const c of clients.splice(0)) c.ws.terminate();
  await server.close();
});

describe('raid room over WebSocket', () => {
  it('serves raidRoom for up to 8 players and rejects a 9th', async () => {
    server = await createGameServer({ port: 0, levelName: 'raidRoom' });
    expect(server.level.name).toBe('raidRoom');
    expect(server.maxPlayers).toBe(8);
    const first = await joined('p0');
    expect(first.last('welcome')!.level).toBe('raidRoom');
    expect(first.last('welcome')!.v).toBe(PROTOCOL_VERSION);
    for (let i = 1; i < 8; i++) await joined(`p${i}`);
    const extra = new Client(server.port);
    await extra.open();
    extra.send({ t: 'join', name: 'ninth' });
    await until(() => extra.closed);
    await until(() => first.last('snap')?.players.length === 8);
    expect(first.last('snap')!.players).toHaveLength(8);
    expect(first.last('snap')!.world!.enemies).toHaveLength(RAID_ROOM.enemies.length);
  });
});
