import { describe, expect, it } from 'vitest';
import { BTN, COOP_IDS, COOP_ROOM, TILE, createPlayer, createWorld, stepWorld, type World } from '../src/index';
import { Room } from './bots';

const L = COOP_ROOM;
const ID = COOP_IDS;
const FLOOR_Y = 13 * TILE;
const px = (col: number) => col * TILE + TILE / 2;
const plateX = (name: keyof typeof ID.plate) => px(L.plates[ID.plate[name]].col);
const plateY = (name: keyof typeof ID.plate) => (L.plates[ID.plate[name]].row + 1) * TILE;
const leverX = (name: keyof typeof ID.lever) => px(L.levers[ID.lever[name]].col);
const doorLeftX = (name: keyof typeof ID.door) => L.doors[ID.door[name]].tiles[0][0] * TILE - 20;
const doorRightX = (name: keyof typeof ID.door) => (L.doors[ID.door[name]].tiles[0][0] + 1) * TILE + 20;
const isOpen = (r: Room, name: keyof typeof ID.door) => r.w.dynamic[ID.door[name]] === true;
const cp = (i: number) => L.checkpoints[i];

/** Phases A and B: gate 0 (two plates), then the timed-lever corridor. Returns the room with the team beyond gate 1. */
function sprint(n: number) {
  const r = new Room(n);
  const runner = n >= 3 ? 3 : 2; // waits at the corridor door and sprints through it
  const planA = () => {
    const o: Record<number, number> = { 1: r.to(1, plateX('A')), 2: r.to(2, plateX('B')) };
    if (n >= 3) o[3] = r.to(3, plateX('B') + 32); // waits just before the gate
    return o;
  };
  r.until(planA, () => isOpen(r, 'gate0'), 900, 'gate0 open');
  expect(r.w.plates[ID.plate.A] && r.w.plates[ID.plate.B]).toBe(true);

  const planThrough = () => {
    const o: Record<number, number> = {
      1: r.to(1, leverX('timed') - 6),
      2: r.to(2, runner === 2 ? doorLeftX('corridor') - 8 : leverX('timed') + 60),
    };
    if (n >= 3) o[3] = r.to(3, doorLeftX('corridor') - 8);
    return o;
  };
  const allThrough = () => r.w.players.every((p) => p.x > doorRightX('gate0'));
  r.until(planThrough, allThrough, 400, 'through gate0'); // within the linger window
  expect(cp(ID.checkpoint.a).x).toBeGreaterThan(doorRightX('gate0'));

  // B: timed lever far from the door; the runner waits at the door and sprints
  r.until(planThrough, () => r.there(1, leverX('timed') - 6, 12) && r.there(runner, doorLeftX('corridor') - 8, 12), 900, 'in position');
  expect(isOpen(r, 'corridor')).toBe(false);
  r.step({ 1: 0 });
  r.step({ 1: BTN.ACTION });
  const tOpen = r.w.tick;
  expect(r.w.levers[ID.lever.timed].on).toBe(true);
  expect(isOpen(r, 'corridor')).toBe(true);
  // runner through the door, then latch it from the far side
  const latchX = leverX('latch') - 4;
  r.until(() => ({ [runner]: r.to(runner, latchX) }), () => r.there(runner, latchX, 14), 200, 'runner at latch');
  expect(r.w.tick - tOpen).toBeLessThan(TIMED);
  r.step({ [runner]: BTN.ACTION });
  expect(r.w.levers[ID.lever.latch].on).toBe(true);
  r.run(TIMED); // the 5 s timer runs out; the latch keeps the door open
  expect(r.w.levers[ID.lever.timed].on).toBe(false);
  expect(isOpen(r, 'corridor')).toBe(true);
  // the rest of the team walks through (more than 5 s of running from the lever)
  const beyond = doorRightX('corridor') + 30;
  const planRest = () => {
    const o: Record<number, number> = { 1: r.to(1, beyond) };
    if (n >= 3) o[2] = r.to(2, beyond + 10);
    return o;
  };
  r.until(planRest, () => r.p(1).x >= beyond - 8 && (n < 3 || r.p(2).x >= beyond + 2), 800, 'team beyond the corridor door');
  return r;
}

const TIMED = 300;

/** Search for a jump timing that stomp-bounces `a` off `b` onto the ledge, on a cloned world (the sim is deterministic). */
function findLedgeJump(w: World, aId: number): { j: number; run: number } | null {
  for (const run of [BTN.RUN, 0]) {
    for (let j = 0; j < 90; j++) {
      const c = structuredClone(w);
      const a = c.players.find((p) => p.id === aId)!;
      for (let t = 0; t < 260; t++) {
        const hold = t >= j && t < j + 70;
        stepWorld(L, c, { [aId]: BTN.RIGHT | run | (hold ? BTN.JUMP : 0) });
        if (a.onGround && a.y === 7 * TILE && a.x > 118 * TILE && a.x < 125 * TILE) return { j, run };
      }
    }
  }
  return null;
}
const climbInput = (t: number, f: { j: number; run: number }) => BTN.RIGHT | f.run | (t >= f.j && t < f.j + 70 ? BTN.JUMP : 0);

describe('Twin Plates: structure', () => {
  it('has the documented parts', () => {
    expect(L.name).toBe('coopRoom');
    expect(L.doors).toHaveLength(4);
    expect(L.plates).toHaveLength(6);
    expect(L.checkpoints).toHaveLength(4);
    expect(L.room.minPlayers).toBe(2);
    expect(L.room.maxPlayers).toBe(4);
    expect(L.enemies.map((e) => e.kind).sort()).toEqual([0, 1, 2]);
    expect(L.shards.length).toBeGreaterThanOrEqual(12);
    expect(L.links).toHaveLength(4);
    // door tiles are full height so nothing flies over a gate
    for (const d of L.doors) expect(d.tiles).toHaveLength(13);
  });
});

describe('Twin Plates: solo cannot', () => {
  it('open gate 0: plates are too far apart for one body (never two held at once)', () => {
    const w = createWorld(L);
    const p = createPlayer(1, L);
    w.players.push(p);
    let maxHeld = 0;
    for (let x = px(2); x < px(39); x += 2) {
      p.x = x;
      p.y = FLOOR_Y - TILE; // standing on the floor, row 12 feet = floor top y=208
      p.y = FLOOR_Y;
      p.prevY = p.y;
      p.vy = 0;
      p.invuln = 99;
      stepWorld(L, w, {});
      stepWorld(L, w, {});
      maxHeld = Math.max(maxHeld, w.plates.filter(Boolean).length);
    }
    expect(maxHeld).toBe(1);
    // and a whole solo run from the spawn never opens it
    const r = new Room(1);
    let ever = false;
    r.until(() => ({ 1: r.to(1, 39 * TILE) }), () => (ever = ever || isOpen(r, 'gate0')) || r.there(1, 39 * TILE - 20, 30), 900, 'solo to gate');
    r.run(120);
    expect(ever).toBe(false);
    expect(r.p(1).x).toBeLessThan(40 * TILE);
  });

  it('beat the timed corridor: pulling then sprinting never reaches the door in time', () => {
    const r = new Room(1);
    const p = r.p(1);
    // start just past gate 0 (what a team would have got a solo player through) at the lever
    p.x = leverX('timed') - 6;
    p.y = FLOOR_Y;
    p.prevY = p.y;
    r.run(10);
    r.step({ 1: 0 });
    r.step({ 1: BTN.ACTION });
    expect(r.w.levers[ID.lever.timed].on).toBe(true);
    let maxX = 0;
    const doorX = L.doors[ID.door.corridor].tiles[0][0] * TILE;
    for (let t = 0; t < 400; t++) {
      r.step({ 1: r.to(1, 110 * TILE) });
      maxX = Math.max(maxX, p.x);
    }
    expect(maxX).toBeLessThan(doorX - 7 + 0.01); // stuck on this side
    expect(isOpen(r, 'corridor')).toBe(false);
    expect(r.p(1).deaths).toBe(0); // it is a clean "too slow", not a death trap
  });

  it('reach the ledge without a partner (no timing of any run-jump works)', () => {
    let best = Infinity;
    for (const startX of [105 * TILE, 110 * TILE, 114 * TILE]) {
      for (let j = 0; j < 90; j++) {
        const r = new Room(1);
        const p = r.p(1);
        p.x = startX;
        p.y = FLOOR_Y;
        p.prevY = p.y;
        r.run(4);
        for (let t = 0; t < 260; t++) {
          r.step({ 1: BTN.RIGHT | BTN.RUN | (t >= j && t < j + 70 ? BTN.JUMP : 0) });
          if (p.deaths === 0) best = Math.min(best, p.y);
        }
      }
    }
    expect(best).toBeGreaterThan(7 * TILE + 8); // never got near the 112 px ledge top
  });

  it('pass the final gate with two players (any two plates)', () => {
    const plates = ['Pa', 'Pc', 'Pd'] as const;
    for (let i = 0; i < plates.length; i++) {
      for (let j = i + 1; j < plates.length; j++) {
        const r = new Room(2);
        for (const [id, name] of [[1, plates[i]], [2, plates[j]]] as const) {
          const p = r.p(id);
          p.x = plateX(name);
          p.y = FLOOR_Y;
          p.prevY = p.y;
        }
        r.run(500);
        expect(r.w.plates.filter(Boolean)).toHaveLength(2);
        expect(isOpen(r, 'final')).toBe(false);
      }
    }
  });
});

/** Phase C: climber stomp-bounces off base onto the ledge, pulls its lever, everyone walks through gate 2. */
function stompLedge(r: Room, climber: number, base: number, helpers: number[]) {
  const baseX = px(115);
  r.until(
    () => {
      const o: Record<number, number> = { [base]: r.to(base, baseX, { run: false }) };
      o[climber] = r.p(base).x < r.p(climber).x + 20 && r.p(climber).x < baseX - 120 ? 0 : r.to(climber, baseX - 70);
      for (const h of helpers) o[h] = r.to(h, baseX - 120 - h * 12);
      return o;
    },
    () => r.there(base, baseX, 9) && r.there(climber, baseX - 70, 8),
    1500,
    'in stomp position',
  );
  const f = findLedgeJump(r.w, climber);
  expect(f).not.toBeNull();
  const t0 = r.w.tick;
  r.until(() => ({ [climber]: climbInput(r.w.tick - t0, f!) }), () => r.p(climber).onGround && r.p(climber).y === 7 * TILE && r.p(climber).x > 118 * TILE, 260, 'on the ledge');
  const lx = leverX('ledge');
  r.until(() => ({ [climber]: r.to(climber, lx - 4) }), () => r.there(climber, lx - 4, 12), 200, 'at ledge lever');
  r.step({ [climber]: 0 });
  r.step({ [climber]: BTN.ACTION });
  expect(r.w.levers[ID.lever.ledge].on).toBe(true);
  expect(isOpen(r, 'ledge')).toBe(true);
  const all = r.w.players.map((p) => p.id);
  const beyond = doorRightX('ledge') + 24;
  r.until(() => Object.fromEntries(all.map((id, i) => [id, r.to(id, beyond + i * 10)])), () => all.every((id, i) => r.p(id).x >= beyond + i * 10 - 10), 1500, 'through gate 2');
}

describe('Twin Plates: the team clears it', () => {
  it('2 players clear gate 0, the timed corridor and the stomp ledge (and stop at the final gate)', () => {
    const r = sprint(2);
    stompLedge(r, 2, 1, []);
    expect(r.p(1).checkpoint).toBeGreaterThanOrEqual(ID.checkpoint.b);
    expect(isOpen(r, 'final')).toBe(false);
  });

  for (const n of [3, 4]) {
    it(`${n} players clear the whole room`, () => {
      const r = sprint(3);
      if (n === 4) {
        const p4 = createPlayer(4, L);
        p4.x = r.p(1).x - 20;
        p4.y = r.p(1).y;
        p4.prevY = p4.y;
        p4.checkpoint = ID.checkpoint.b;
        r.w.players.push(p4);
        r.bots.set(4, { jump: 0 });
      }
      stompLedge(r, 1, 2, n === 4 ? [3, 4] : [3]);
      const all = r.w.players.map((p) => p.id);

      // D: three plates (Pa floor, Pb one-way platform, Pc floor) -> final gate
      const assign: Record<number, 'Pa' | 'Pb' | 'Pc' | 'Pd'> = { 1: 'Pa', 2: 'Pb', 3: 'Pc', 4: 'Pd' };
      const planD = () => Object.fromEntries(all.map((id) => [id, r.to(id, plateX(assign[id]), { targetY: plateY(assign[id]) })]));
      r.until(planD, () => isOpen(r, 'final'), 1500, 'final gate');
      expect(r.w.plates.filter(Boolean).length).toBeGreaterThanOrEqual(3);
      const goal = cp(ID.checkpoint.goal);
      r.until(() => Object.fromEntries(all.map((id, i) => [id, r.to(id, goal.x + 24 + i * 12)])), () => all.every((id) => r.p(id).x > goal.x), 1200, 'into the goal');
      for (const id of all) {
        expect(r.p(id).checkpoint).toBe(ID.checkpoint.goal);
        expect(r.p(id).shards).toBeGreaterThan(0);
      }
    });
  }
});

describe('Twin Plates: disconnects and resets', () => {
  /** Two players hold both plates of gate 0 and the gate opens. */
  function opened() {
    const r = new Room(2);
    r.until(() => ({ 1: r.to(1, plateX('A')), 2: r.to(2, plateX('B')) }), () => isOpen(r, 'gate0'), 900, 'gate0 open');
    return r;
  }

  it('a disconnected (away) player releases its plate and the gate closes again', () => {
    const r = opened();
    r.p(2).away = true;
    r.run(2);
    expect(r.w.plates[ID.plate.B]).toBe(false);
    r.run(310);
    expect(isOpen(r, 'gate0')).toBe(false);
  });

  it('does not deadlock: someone stranded behind a gate with no latch is freed by the far-side latch', () => {
    const r = new Room(2);
    // player 1 stuck before the closed corridor door; player 2 beyond it (e.g. after respawning at checkpoint b)
    const p1 = r.p(1);
    const p2 = r.p(2);
    p1.x = doorLeftX('corridor') - 10;
    p1.y = FLOOR_Y;
    p1.prevY = p1.y;
    p2.x = doorRightX('corridor') + 10;
    p2.y = FLOOR_Y;
    p2.prevY = p2.y;
    r.run(10);
    expect(isOpen(r, 'corridor')).toBe(false);
    r.until(() => ({ 2: r.to(2, leverX('latch') - 4) }), () => r.there(2, leverX('latch') - 4, 14), 300, 'p2 at latch');
    r.step({ 2: BTN.ACTION });
    expect(isOpen(r, 'corridor')).toBe(true);
    r.until(() => ({ 1: r.to(1, doorRightX('corridor') + 40) }), () => r.p(1).x > doorRightX('corridor') + 30, 300, 'p1 through');
  });

  it('a reset lever clears levers/enemies and closes doors without moving anyone', () => {
    const r = new Room(2);
    const lx = leverX('reset0');
    r.p(1).x = lx;
    r.p(1).y = FLOOR_Y;
    r.p(1).prevY = r.p(1).y;
    r.w.levers[ID.lever.latch].on = true;
    r.w.levers[ID.lever.timed].on = true;
    r.w.levers[ID.lever.timed].t = 200;
    r.w.enemies[0].alive = false;
    r.w.enemies[0].t = 500;
    r.run(3);
    expect(isOpen(r, 'corridor')).toBe(true);
    const epoch = r.w.room.resets;
    const before = r.p(1).x;
    r.step({ 1: 0 });
    r.step({ 1: BTN.ACTION });
    expect(r.w.levers[ID.lever.latch].on).toBe(false);
    expect(r.w.levers[ID.lever.timed].on).toBe(false);
    expect(isOpen(r, 'corridor')).toBe(false);
    expect(r.w.enemies[0].alive).toBe(true);
    expect(r.w.room.resets).toBe(epoch + 1);
    expect(Math.abs(r.p(1).x - before)).toBeLessThan(3);
  });

  it('resets after 10 s with fewer than 2 connected players, once progress was made', () => {
    const r = opened();
    expect(r.w.room.progress).toBe(true);
    r.p(2).away = true; // partner disconnects
    r.p(1).shards = 5;
    r.run(L.room.soloResetTicks - 5);
    expect(r.w.room.resets).toBe(0);
    r.run(10);
    expect(r.w.room.resets).toBe(1);
    expect(r.w.room.progress).toBe(false);
    expect(isOpen(r, 'gate0')).toBe(false);
    expect(r.p(1).x).toBe(L.spawn.x); // back at the entrance
    expect(r.p(1).checkpoint).toBe(-1);
    expect(r.p(1).shards).toBe(5); // never lose collected shards
  });

  it('resets after 10 s empty, but a fresh room never nags a lone visitor', () => {
    const fresh = new Room(1);
    fresh.run(L.room.soloResetTicks * 3);
    expect(fresh.w.room.resets).toBe(0);
    expect(fresh.p(1).x).toBe(L.spawn.x);

    const r = opened();
    r.p(1).away = true;
    r.p(2).away = true;
    r.run(L.room.emptyResetTicks + 5);
    expect(r.w.room.resets).toBe(1);
    expect(isOpen(r, 'gate0')).toBe(false);
    // a player who reconnects within the window keeps the progress
    const keep = opened();
    keep.p(1).away = true;
    keep.p(2).away = true;
    keep.run(L.room.emptyResetTicks - 20);
    keep.p(1).away = false;
    keep.p(2).away = false;
    keep.run(60);
    expect(keep.w.room.resets).toBe(0);
  });
});

describe('determinism', () => {
  it('a long scripted multi-player run reproduces bit for bit', () => {
    const run = () => {
      const w = createWorld(L);
      for (let i = 1; i <= 4; i++) w.players.push(createPlayer(i, L));
      let s = 12345;
      const rnd = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
      const held: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
      for (let t = 0; t < 6000; t++) {
        for (let id = 1; id <= 4; id++) {
          if (rnd() < 0.05) held[id] = Math.floor(rnd() * 64) | (rnd() < 0.5 ? BTN.RIGHT : 0);
        }
        stepWorld(L, w, held);
      }
      return JSON.stringify(w);
    };
    const a = run();
    expect(a).toBe(run());
    expect(a.length).toBeGreaterThan(500);
  });

  it('16 players tick well under budget', () => {
    const w = createWorld(L);
    for (let i = 1; i <= 16; i++) w.players.push(createPlayer(i, L));
    let s = 99;
    const rnd = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
    const inputs: Record<number, number> = {};
    for (let i = 1; i <= 16; i++) inputs[i] = 0;
    for (let t = 0; t < 600; t++) {
      for (let i = 1; i <= 16; i++) if (rnd() < 0.05) inputs[i] = Math.floor(rnd() * 64);
      stepWorld(L, w, inputs); // warm up
    }
    const N = 6000;
    const t0 = performance.now();
    for (let t = 0; t < N; t++) {
      for (let i = 1; i <= 16; i++) if (rnd() < 0.05) inputs[i] = Math.floor(rnd() * 64);
      stepWorld(L, w, inputs);
    }
    const avg = (performance.now() - t0) / N;
    console.log(`[bench] 16 players, coopRoom: ${avg.toFixed(4)} ms/tick`);
    expect(avg).toBeLessThan(0.5);
  });
});
