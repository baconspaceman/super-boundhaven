import type { World } from '@sbh/sim';

/** Enemy: [id, x, y, flags] with x,y quantized to 1/8 px. flags: bit0 alive, bit1 facing right. */
export type NetEnemy = [id: number, x: number, y: number, flags: number];
/** Lever: [id, on (0|1), ticks left (timed levers)]. */
export type NetLever = [id: number, on: number, t: number];

/**
 * Dynamic world state carried by a snapshot (the `world` field of `snap`).
 *  - `doors`/`plates` are always complete lists (open door ids / pressed plate ids) and only present when changed.
 *  - `levers`/`enemies` are partial on delta frames (only entries that changed since the previous snapshot) and
 *    complete on full frames.
 *  - `full: 1` marks a full frame: the receiver clears its view first. Sent to a new/reconnected client, every
 *    SNAPSHOT_FULL_EVERY snapshots (self-heal), and when `epoch` (room resets) changes.
 */
export interface NetWorld {
  full?: 1;
  epoch: number;
  doors?: number[];
  plates?: number[];
  levers?: NetLever[];
  enemies?: NetEnemy[];
}

const q = (v: number): number => Math.round(v * 8) / 8;

function openDoors(w: World): number[] {
  const out: number[] = [];
  for (const k in w.dynamic) if (w.dynamic[k]) out.push(Number(k));
  return out.sort((a, b) => a - b);
}

function pressedPlates(w: World): number[] {
  const out: number[] = [];
  for (let i = 0; i < w.plates.length; i++) if (w.plates[i]) out.push(i);
  return out;
}

const enemyTuple = (e: World['enemies'][number]): NetEnemy => [e.id, q(e.x), q(e.y), (e.alive ? 1 : 0) | (e.dir > 0 ? 2 : 0)];
const leverTuple = (l: World['levers'][number]): NetLever => [l.id, l.on ? 1 : 0, l.t];
const sameTuple = (a: number[], b: number[]): boolean => a.length === b.length && a.every((v, i) => v === b[i]);

export interface WorldEncoder {
  /** Delta against the previous call (stateful: call once per broadcast snapshot). Undefined when nothing changed. */
  delta(world: World): NetWorld | undefined;
  /** Complete state; stateless. */
  full(world: World): NetWorld;
}

export function createWorldEncoder(): WorldEncoder {
  let lastEpoch = -1;
  let lastDoors = '';
  let lastPlates = '';
  const lastEnemy: NetEnemy[] = [];
  const lastLever: NetLever[] = [];

  const full = (world: World): NetWorld => ({
    full: 1,
    epoch: world.room.resets,
    doors: openDoors(world),
    plates: pressedPlates(world),
    levers: world.levers.map(leverTuple),
    enemies: world.enemies.map(enemyTuple),
  });

  return {
    full,
    delta(world) {
      const doors = openDoors(world);
      const plates = pressedPlates(world);
      const doorsKey = doors.join(',');
      const platesKey = plates.join(',');
      if (world.room.resets !== lastEpoch) {
        lastEpoch = world.room.resets;
        lastDoors = doorsKey;
        lastPlates = platesKey;
        lastEnemy.length = 0;
        lastLever.length = 0;
        const f = full(world);
        for (const e of f.enemies!) lastEnemy[e[0]] = e;
        for (const l of f.levers!) lastLever[l[0]] = l;
        return f;
      }
      const out: NetWorld = { epoch: lastEpoch };
      let changed = false;
      if (doorsKey !== lastDoors) {
        out.doors = doors;
        lastDoors = doorsKey;
        changed = true;
      }
      if (platesKey !== lastPlates) {
        out.plates = plates;
        lastPlates = platesKey;
        changed = true;
      }
      for (const l of world.levers) {
        const t = leverTuple(l);
        if (lastLever[l.id] && sameTuple(lastLever[l.id], t)) continue;
        lastLever[l.id] = t;
        (out.levers ??= []).push(t);
        changed = true;
      }
      for (const e of world.enemies) {
        const t = enemyTuple(e);
        if (lastEnemy[e.id] && sameTuple(lastEnemy[e.id], t)) continue;
        lastEnemy[e.id] = t;
        (out.enemies ??= []).push(t);
        changed = true;
      }
      return changed ? out : undefined;
    },
  };
}

/** What a client keeps from snapshots. `dynamic` is passed straight to stepPlayer as the 5th argument. */
export interface WorldView {
  epoch: number;
  dynamic: Record<number, boolean>; // door id -> open
  plates: Record<number, boolean>; // plate id -> pressed
  levers: Map<number, { on: boolean; t: number }>;
  enemies: Map<number, { x: number; y: number; dir: number; alive: boolean }>;
}

export function createWorldView(): WorldView {
  return { epoch: 0, dynamic: {}, plates: {}, levers: new Map(), enemies: new Map() };
}

function setSet(target: Record<number, boolean>, ids: number[]): void {
  for (const k of Object.keys(target)) delete target[Number(k)];
  for (const id of ids) target[id] = true;
}

export function applyNetWorld(view: WorldView, nw: NetWorld): void {
  if (nw.full) {
    view.levers.clear();
    view.enemies.clear();
  }
  view.epoch = nw.epoch;
  if (nw.doors) setSet(view.dynamic, nw.doors);
  if (nw.plates) setSet(view.plates, nw.plates);
  if (nw.levers) for (const [id, on, t] of nw.levers) view.levers.set(id, { on: on === 1, t });
  if (nw.enemies) {
    for (const [id, x, y, f] of nw.enemies) view.enemies.set(id, { x, y, dir: f & 2 ? 1 : -1, alive: (f & 1) !== 0 });
  }
}
