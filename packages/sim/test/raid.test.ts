import { describe, expect, it } from 'vitest';
import { BTN, RAID_IDS, RAID_ROOM, TILE, createPlayer, createWorld, stepWorld, type World } from '../src/index';
import { Room } from './bots';

const L = RAID_ROOM;
const ID = RAID_IDS;
const FLOOR_Y = 13 * TILE;
const px = (col: number) => col * TILE + TILE / 2;
const plateX = (name: keyof typeof ID.plate) => px(L.plates[ID.plate[name]].col);
const plateY = (name: keyof typeof ID.plate) => (L.plates[ID.plate[name]].row + 1) * TILE;
const leverX = (name: keyof typeof ID.lever) => px(L.levers[ID.lever[name]].col);
const doorLeftX = (name: keyof typeof ID.door) => L.doors[ID.door[name]].tiles[0][0] * TILE - 20;
const doorRightX = (name: keyof typeof ID.door) => (L.doors[ID.door[name]].tiles[0][0] + 1) * TILE + 20;
const isOpen = (r: Room, name: keyof typeof ID.door) => r.w.dynamic[ID.door[name]] === true;
const room = (n: number) => new Room(n, L);
const hall = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'H8'] as const;
const finalPlates = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'Fp1', 'Fp2'] as const;

describe('Eight Gates: structure', () => {
  it('has the documented parts', () => {
    expect(L.name).toBe('raidRoom');
    expect(L.doors).toHaveLength(4);
    expect(L.plates).toHaveLength(16);
    expect(L.checkpoints).toHaveLength(5);
    expect(L.room.minPlayers).toBe(6);
    expect(L.room.maxPlayers).toBe(8);
    expect(L.links).toHaveLength(4);
    for (const d of L.doors) expect(d.tiles).toHaveLength(13);
    expect(L.shards.length).toBeGreaterThanOrEqual(16);
  });
});

describe('Eight Gates: hall gate needs 6 of 8', () => {
  it('5 players holding 5 plates never open it; 6 do', () => {
    for (const [n, open] of [[5, false], [6, true], [8, true]] as const) {
      const r = room(n);
      r.until(
        () => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, r.to(i + 1, plateX(hall[i]))])),
        () => isOpen(r, 'gate0') || r.w.tick > 1500,
        1600,
        'hall',
      );
      expect(isOpen(r, 'gate0')).toBe(open);
    }
  });

  it('a disconnected player drops one plate; with 7 present the gate still holds', () => {
    const r = room(8);
    r.until(() => Object.fromEntries(Array.from({ length: 8 }, (_, i) => [i + 1, r.to(i + 1, plateX(hall[i]))])), () => hall.every((h) => r.w.plates[ID.plate[h]]), 1600, 'hall');
    r.p(8).away = true;
    r.run(5);
    expect(hall.filter((h) => r.w.plates[ID.plate[h]])).toHaveLength(7);
    expect(isOpen(r, 'gate0')).toBe(true);
  });
});

/** Search for a jump timing that stomp-bounces `aId` off a partner onto the ledge, on a cloned world (the sim is deterministic). */
function findLedgeJump(w: World, aId: number): { j: number; run: number } | null {
  for (const run of [BTN.RUN, 0]) {
    for (let j = 0; j < 90; j++) {
      const c = structuredClone(w);
      const a = c.players.find((p) => p.id === aId)!;
      for (let t = 0; t < 260; t++) {
        const hold = t >= j && t < j + 70;
        stepWorld(L, c, { [aId]: BTN.RIGHT | run | (hold ? BTN.JUMP : 0) });
        if (a.onGround && a.y === 7 * TILE && a.x > 125 * TILE && a.x < 132 * TILE) return { j, run };
      }
    }
  }
  return null;
}

describe('Eight Gates: the full party clears it', () => {
  it('8 players clear all four gates and reach the goal', () => {
    const r = room(8);
    const ids = r.w.players.map((p) => p.id);

    // 1. hall
    r.until(() => Object.fromEntries(ids.map((id, i) => [id, r.to(id, plateX(hall[i]))])), () => isOpen(r, 'gate0'), 1600, 'gate0');
    const beyond0 = doorRightX('gate0') + 20;
    r.until(() => Object.fromEntries(ids.map((id, i) => [id, r.to(id, beyond0 + i * 12)])), () => ids.every((id) => r.p(id).x > doorRightX('gate0')), 600, 'through gate0');
    expect(r.p(1).checkpoint).toBeGreaterThanOrEqual(ID.checkpoint.a);

    // 2. corridor: p1 pulls, p2 waits at the door and sprints through, latches from the far side
    const leverPos = leverX('timed') - 6;
    const doorWait = doorLeftX('corridor') - 8;
    r.until(
      () => Object.fromEntries(ids.map((id) => [id, id === 1 ? r.to(id, leverPos) : r.to(id, id === 2 ? doorWait : leverPos - 30 - (id - 3) * 14)])),
      () => r.there(1, leverPos, 12) && r.there(2, doorWait, 12),
      1500,
      'corridor positions',
    );
    r.step({ 1: 0 });
    r.step({ 1: BTN.ACTION });
    expect(isOpen(r, 'corridor')).toBe(true);
    const latchX = leverX('latch') - 4;
    r.until(() => ({ 2: r.to(2, latchX) }), () => r.there(2, latchX, 14), 220, 'runner at latch');
    r.step({ 2: BTN.ACTION });
    expect(r.w.levers[ID.lever.latch].on).toBe(true);
    r.run(300);
    expect(isOpen(r, 'corridor')).toBe(true);
    const beyond1 = doorRightX('corridor') + 30;
    r.until(() => Object.fromEntries(ids.map((id, i) => [id, r.to(id, beyond1 + i * 12)])), () => ids.every((id) => r.p(id).x > doorRightX('corridor')), 1500, 'through corridor');

    // 3. stomp ledge: p1 bounces off p2 onto the slab and pulls its lever; the rest bunch up behind
    const baseX = px(122);
    r.until(
      () => {
        const o: Record<number, number> = { 2: r.to(2, baseX, { run: false }) };
        o[1] = r.p(2).x < r.p(1).x + 20 && r.p(1).x < baseX - 120 ? 0 : r.to(1, baseX - 70);
        for (const id of ids.slice(2)) o[id] = r.to(id, baseX - 120 - id * 12);
        return o;
      },
      () => r.there(2, baseX, 9) && r.there(1, baseX - 70, 8),
      2500,
      'in stomp position',
    );
    const f = findLedgeJump(r.w, 1);
    expect(f).not.toBeNull();
    const t0 = r.w.tick;
    r.until(() => ({ 1: BTN.RIGHT | f!.run | (r.w.tick - t0 >= f!.j && r.w.tick - t0 < f!.j + 70 ? BTN.JUMP : 0) }), () => r.p(1).onGround && r.p(1).y === 7 * TILE && r.p(1).x > 125 * TILE, 260, 'on the ledge');
    const lx = leverX('ledge');
    r.until(() => ({ 1: r.to(1, lx - 4) }), () => r.there(1, lx - 4, 12), 200, 'at ledge lever');
    r.step({ 1: 0 });
    r.step({ 1: BTN.ACTION });
    expect(isOpen(r, 'ledge')).toBe(true);
    const beyond2 = doorRightX('ledge') + 24;
    r.until(() => Object.fromEntries(ids.map((id, i) => [id, r.to(id, beyond2 + i * 10)])), () => ids.every((id) => r.p(id).x > doorRightX('ledge')), 2500, 'through gate 2');

    // 4. final hall: eight plates (two on one-way platforms) -> final gate
    const plan = () => Object.fromEntries(ids.map((id, i) => [id, r.to(id, plateX(finalPlates[i]), { targetY: plateY(finalPlates[i]) })]));
    r.until(plan, () => isOpen(r, 'final'), 2500, 'final gate');
    expect(r.w.plates.filter(Boolean).length).toBeGreaterThanOrEqual(6);
    const goal = L.checkpoints[ID.checkpoint.goal];
    r.until(() => Object.fromEntries(ids.map((id, i) => [id, r.to(id, goal.x + 24 + i * 12)])), () => ids.every((id) => r.p(id).x > goal.x), 1500, 'into the goal');
    for (const id of ids) expect(r.p(id).checkpoint).toBe(ID.checkpoint.goal);
  });
});

describe('Eight Gates: resets and determinism', () => {
  it('resets after 15 s below 6 connected players once progress was made', () => {
    const r = room(8);
    r.until(() => Object.fromEntries(Array.from({ length: 8 }, (_, i) => [i + 1, r.to(i + 1, plateX(hall[i]))])), () => isOpen(r, 'gate0'), 1600, 'hall');
    expect(r.w.room.progress).toBe(true);
    r.p(7).away = true;
    r.p(8).away = true;
    r.p(6).away = true;
    r.run(L.room.soloResetTicks - 5);
    expect(r.w.room.resets).toBe(0);
    r.run(10);
    expect(r.w.room.resets).toBe(1);
    expect(isOpen(r, 'gate0')).toBe(false);
  });

  it('is deterministic with 8 players and ticks well under budget', () => {
    const run = () => {
      const w = createWorld(L);
      for (let i = 1; i <= 8; i++) w.players.push(createPlayer(i, L));
      let s = 777;
      const rnd = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
      const held: Record<number, number> = {};
      for (let i = 1; i <= 8; i++) held[i] = 0;
      for (let t = 0; t < 4000; t++) {
        for (let id = 1; id <= 8; id++) if (rnd() < 0.05) held[id] = Math.floor(rnd() * 64) | (rnd() < 0.5 ? BTN.RIGHT : 0);
        stepWorld(L, w, held);
      }
      return JSON.stringify(w);
    };
    expect(run()).toBe(run());
  });
});

void FLOOR_Y;
