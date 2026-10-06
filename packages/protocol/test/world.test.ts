import { describe, expect, it } from 'vitest';
import { BTN, COOP_IDS, COOP_ROOM as L, POUND_ROOM, createPlayer, createWorld, stepWorld, type World } from '@sbh/sim';
import {
  PROTOCOL_VERSION,
  applyNetWorld,
  createWorldEncoder,
  createWorldView,
  type NetWorld,
  type ServerMsg,
} from '../src/index';

const q = (v: number) => Math.round(v * 8) / 8;

function expectViewMatches(view: ReturnType<typeof createWorldView>, w: World) {
  for (const d of L.doors) expect(!!view.dynamic[d.id]).toBe(!!w.dynamic[d.id]);
  for (let i = 0; i < w.plates.length; i++) expect(!!view.plates[i]).toBe(w.plates[i]);
  for (let i = 0; i < w.buttons.length; i++) expect(!!view.buttons[i]).toBe(w.buttons[i] > 0);
  for (const l of w.levers) expect(view.levers.get(l.id)).toEqual({ on: l.on, t: l.t });
  for (const e of w.enemies) {
    const v = view.enemies.get(e.id)!;
    expect(v).toEqual({ x: q(e.x), y: q(e.y), dir: e.dir > 0 ? 1 : -1, alive: e.alive });
  }
}

/** Over-the-wire: every frame goes through JSON like the real server. */
const wire = (nw: NetWorld | undefined): NetWorld | undefined => (nw ? (JSON.parse(JSON.stringify(nw)) as NetWorld) : undefined);

describe('protocol v4', () => {
  it('is version 4', () => {
    expect(PROTOCOL_VERSION).toBe(4);
  });

  it('delta frames rebuild the world on a client, including a late full frame', () => {
    const w = createWorld(L);
    for (let i = 1; i <= 2; i++) w.players.push(createPlayer(i, L));
    const enc = createWorldEncoder();
    const live = createWorldView(); // follows every frame
    const late = createWorldView(); // joins midway, from a full frame
    let frames = 0;
    let sentBytes = 0;
    let fullBytes = 0;
    for (let t = 0; t < 1500; t++) {
      // two players walk onto the plates, then walk away again
      const onPlates = t < 700;
      const in1 = onPlates ? (w.players[0].x < 184 ? BTN.RIGHT : 0) : BTN.LEFT;
      const in2 = onPlates ? (w.players[1].x < 584 ? BTN.RIGHT | BTN.RUN : 0) : BTN.LEFT;
      if (t === 800) w.levers[COOP_IDS.lever.timed].on = true; // exercise lever deltas
      stepWorld(L, w, { 1: in1, 2: in2 });
      if (t % 3 !== 2) continue;
      frames++;
      const d = wire(enc.delta(w));
      if (d) {
        sentBytes += JSON.stringify(d).length;
        applyNetWorld(live, d);
      }
      if (t === 602) {
        const f = wire(enc.full(w))!;
        fullBytes = JSON.stringify(f).length;
        expect(f.full).toBe(1);
        applyNetWorld(late, f);
      } else if (t > 602 && d) {
        applyNetWorld(late, d);
      }
      expectViewMatches(live, w);
      if (t >= 602) expectViewMatches(late, w);
    }
    expect(frames).toBeGreaterThan(400);
    expect(live.dynamic[COOP_IDS.door.gate0]).toBeFalsy();
    // deltas are far smaller than resending everything every frame
    expect(sentBytes).toBeLessThan(fullBytes * frames * 0.5);
  });

  it('a room reset forces a full frame (epoch change)', () => {
    const w = createWorld(L);
    const enc = createWorldEncoder();
    stepWorld(L, w, {});
    expect(enc.delta(w)!.full).toBe(1); // first frame is always full
    stepWorld(L, w, {});
    const quiet = enc.delta(w);
    expect(quiet === undefined || quiet.full === undefined).toBe(true);
    w.room.resets++;
    const d = enc.delta(w)!;
    expect(d.full).toBe(1);
    expect(d.epoch).toBe(w.room.resets);
    const view = createWorldView();
    view.levers.set(99, { on: true, t: 1 }); // stale leftovers vanish on a full frame
    applyNetWorld(view, d);
    expect(view.levers.has(99)).toBe(false);
  });

  it('snap messages with world state and 6-bit input stay JSON round-trippable', () => {
    const w = createWorld(L);
    w.players.push(createPlayer(1, L));
    const enc = createWorldEncoder();
    stepWorld(L, w, {});
    const msg: ServerMsg = { t: 'snap', tick: w.tick, players: [{ id: 1, name: 'a', ack: 0, connected: true, state: w.players[0] }], world: enc.full(w) };
    const back = JSON.parse(JSON.stringify(msg)) as typeof msg;
    expect(back).toEqual(msg);
    expect(back.t === 'snap' && back.world!.enemies!.length).toBe(L.enemies.length);
    expect(back.t === 'snap' && back.players[0].state.crouching).toBe(false);
    expect(BTN.CROUCH | BTN.ACTION).toBe(48);
  });
});

describe('big buttons on the wire', () => {
  it('lit buttons ride the snapshot as a list and clear when the timer runs out', () => {
    const w = createWorld(POUND_ROOM);
    const enc = createWorldEncoder();
    const view = createWorldView();
    applyNetWorld(view, wire(enc.delta(w))!); // first frame is full
    expect(view.buttons).toEqual({});
    w.buttons[0] = 3;
    const lit = wire(enc.delta(w))!;
    expect(lit.buttons).toEqual([0]);
    applyNetWorld(view, lit);
    expect(view.buttons[0]).toBe(true);
    expect(enc.delta(w)).toBeUndefined(); // unchanged while still lit
    w.buttons[0] = 0;
    const dark = wire(enc.delta(w))!;
    expect(dark.buttons).toEqual([]);
    applyNetWorld(view, dark);
    expect(view.buttons[0]).toBeUndefined();
    expect(wire(enc.full(w))!.buttons).toEqual([]);
  });
});
