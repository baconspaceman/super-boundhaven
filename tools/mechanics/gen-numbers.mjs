#!/usr/bin/env node
// Generates docs/mechanics/generated/NUMBERS.md from the live sim (config + measured derived quantities).
//
//   npx tsx tools/mechanics/gen-numbers.mjs            write the file
//   npx tsx tools/mechanics/gen-numbers.mjs --check    exit 1 if the committed file is stale
//
// Also exports buildNumbers() so packages/sim/test/mechanics-doc.test.ts can assert freshness and check the
// <!--num:key-->value<!--/num--> tags quoted in the hand-written docs. Pure and deterministic: no clocks, no randomness.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as SIM from '@sbh/sim';
import * as PROTO from '@sbh/protocol';
import { INTERP_DELAY_MS, MAX_PENDING, SNAP_ERR_PX } from '../../apps/client/src/game.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const OUT_REL = 'docs/mechanics/generated/NUMBERS.md';
export const HEADER = 'GENERATED - do not edit; run npm run docs:mechanics';

const {
  MOVEMENT: M,
  RULES,
  BTN,
  BTN_MASK,
  TILE,
  TICK_RATE,
  SCREEN_W,
  SCREEN_H,
  LEVELS,
  PLAYGROUND,
  COOP_ROOM,
  COOP_IDS,
  createPlayer,
  createWorld,
  stepPlayer,
  stepWorld,
  parseLevel,
} = SIM;

// ---------------------------------------------------------------------------------------------------------
// Descriptions. A config key without an entry here makes generation FAIL, so new tunables must be documented.
// ---------------------------------------------------------------------------------------------------------

/** [unit, meaning] */
const MOVEMENT_DOC = {
  halfWidth: ['px', 'half of the hitbox width (x is the body center): the body is 2 x halfWidth wide'],
  height: ['px', 'standing hitbox height (feet to head)'],
  crouchHeight: ['px', 'hitbox height while crouching (fits a 1-tile gap)'],
  crouchMax: ['px/tick', 'ground speed cap while crouching'],
  dropTicks: ['ticks', 'one-way platforms are ignored this long after a drop-through'],
  walkMax: ['px/tick', 'top ground speed without RUN'],
  runMax: ['px/tick', 'top ground speed with RUN'],
  accel: ['px/tick^2', 'ground acceleration toward the max speed'],
  skid: ['px/tick^2', 'ground deceleration while the input opposes the motion'],
  friction: ['px/tick^2', 'ground deceleration with no horizontal input'],
  overspeedDecel: ['px/tick^2', 'ground deceleration while faster than the current max with input held (crouch slide, run released)'],
  airAccel: ['px/tick^2', 'air acceleration toward the max speed AND air braking against the motion; there is no air drag'],
  jumpVel: ['px/tick', 'initial upward speed (stored as a positive number)'],
  runBonus: ['(px/tick) per (px/tick)', 'extra jump speed per unit of |vx| at takeoff'],
  gravityHeld: ['px/tick^2', 'gravity while rising with JUMP held'],
  gravityFall: ['px/tick^2', 'gravity while falling, or rising with JUMP released (the variable-jump cut)'],
  maxFall: ['px/tick', 'terminal fall speed'],
  coyoteTicks: ['ticks', 'grace after leaving ground in which a jump still works (0 disables)'],
  bufferTicks: ['ticks', 'a JUMP press this recent is remembered until landing (0 disables)'],
  padVel: ['px/tick', 'bounce pad launch speed (JUMP not held at touchdown)'],
  padHeldVel: ['px/tick', 'bounce pad launch speed with JUMP held at touchdown'],
  stompVel: ['px/tick', 'stomp bounce speed (player or enemy), JUMP not held'],
  stompHeldVel: ['px/tick', 'stomp bounce speed with JUMP held'],
  stompPushDown: ['px/tick', 'minimum downward speed forced on a stomped player'],
  stompWindow: ['px', 'player-vs-player stomp: max px the stomper feet may be below the victim head'],
  stompTolerance: ['px', 'player-vs-player stomp: px of slack for "was above the head last tick"'],
  pushMax: ['px/tick', 'max separation applied to two overlapping players per tick (shared between both)'],
  slopeSnap: ['px', 'a grounded body this far above a slope surface still snaps down to it'],
  slopeInset: ['px', 'bottom px of the body ignored by horizontal wall checks while grounded (lets 45 degree steps pass)'],
};

const RULES_DOC = {
  invulnTicks: ['ticks', 'respawn invulnerability (hurt or pit)'],
  actionReachX: ['px', 'ACTION horizontal reach to a lever center'],
  actionReachY: ['px', 'ACTION vertical reach (body center to lever center)'],
  enemyRespawnTicks: ['ticks', 'a stomped enemy returns after this long'],
  walkerSpeed: ['px/tick', 'ground patroller speed (kinds 0 and 2)'],
  flyerSpeed: ['px/tick', 'sine flyer horizontal speed (kind 1)'],
  enemyHalfWidth: ['px', 'enemy half width (hitbox 12 wide)'],
  enemyHeight: ['px', 'enemy hitbox height'],
  enemyGravity: ['px/tick^2', 'walker gravity'],
  enemyMaxFall: ['px/tick', 'walker terminal fall speed'],
  stompWindow: ['px', 'enemy stomp: max px the feet may be below the enemy top'],
  stompSlack: ['px', 'enemy stomp: max px the previous feet may be below the enemy top'],
};

const ROOM_DOC = {
  minPlayers: ['players', 'default room: connected players needed to hold progress'],
  soloResetTicks: ['ticks', 'default room: progress + fewer than minPlayers for this long => hard reset'],
  emptyResetTicks: ['ticks', 'default room: progress + nobody for this long => hard reset'],
};

const BTN_DOC = {
  LEFT: 'move left',
  RIGHT: 'move right',
  JUMP: 'jump (variable height while held)',
  RUN: 'run speed',
  CROUCH: 'hitbox 16, slow slide, drop through one-way platforms',
  ACTION: 'rising edge only: lever reach test',
};

// ---------------------------------------------------------------------------------------------------------
// Tag registry: every value a doc may quote is registered here as a string.
// ---------------------------------------------------------------------------------------------------------

const tags = new Map();
const reg = (key, value) => {
  if (tags.has(key)) throw new Error(`duplicate tag ${key}`);
  tags.set(key, String(value));
  return String(value);
};
const f = (v, n = 1) => v.toFixed(n);

// ---------------------------------------------------------------------------------------------------------
// Measurement harness: runs the REAL sim on tiny synthetic levels.
// ---------------------------------------------------------------------------------------------------------

const FLOOR_ROW = 13;
const FLOOR_Y = FLOOR_ROW * TILE; // 208
const grid = (w, h, draw) => {
  const g = Array.from({ length: h }, () => Array(w).fill('.'));
  draw(g);
  return g.map((r) => r.join(''));
};
const fill = (g, r1, r2, c1, c2, ch) => {
  for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) g[r][c] = ch;
};
const mkLevel = (name, w, draw) =>
  parseLevel(
    name,
    grid(w, 16, (g) => {
      fill(g, FLOOR_ROW, 15, 0, w - 1, '#');
      draw?.(g);
    }),
  );
const FLAT = mkLevel('flat', 240);

function mk(level, x, y = FLOOR_Y) {
  const p = createPlayer(1, level);
  p.x = x;
  p.y = y;
  p.prevY = y;
  for (let i = 0; i < 3; i++) stepPlayer(level, p, 0);
  return p;
}

/** One jump from a steady speed. kind: stand | walk | run; hold = ticks JUMP stays down (Infinity = whole rise). */
function jumpTrial(kind, hold, cfg = M) {
  const p = mk(FLAT, 40);
  const base = kind === 'stand' ? 0 : kind === 'walk' ? BTN.RIGHT : BTN.RIGHT | BTN.RUN;
  const target = kind === 'walk' ? cfg.walkMax : kind === 'run' ? cfg.runMax : 0;
  for (let i = 0; i < 300 && kind !== 'stand' && p.vx < target - 1e-9; i++) stepPlayer(FLAT, p, base, cfg);
  const x0 = p.x;
  let minY = p.y;
  let t = 0;
  for (; t < 400; t++) {
    stepPlayer(FLAT, p, base | (t < hold ? BTN.JUMP : 0), cfg);
    minY = Math.min(minY, p.y);
    if (t > 0 && p.onGround) {
      t++;
      break;
    }
  }
  return { apex: FLOOR_Y - minY, air: t, dist: p.x - x0, takeoff: cfg.jumpVel + Math.abs(target) * cfg.runBonus };
}

/**
 * Number of jump-press ticks (out of every tick of a straight approach) that clear a `g`-tile pit. The press tick
 * maps to a takeoff position, so this is the TIMING WINDOW in ticks: 0 = impossible, 1 = frame-perfect.
 */
function gapWindow(g, run, cfg = M) {
  const GC = 14;
  const L = mkLevel('gap', 120, (gr) => fill(gr, FLOOR_ROW, 15, GC, GC + g - 1, '.'));
  const far = (GC + g) * TILE;
  let n = 0;
  for (let j = 0; j < 260; j++) {
    const p = mk(L, 24);
    for (let t = 0; t < j + 130; t++) {
      stepPlayer(L, p, BTN.RIGHT | (run ? BTN.RUN : 0) | (t >= j && t < j + 60 ? BTN.JUMP : 0), cfg);
      if (p.deaths > 0) break;
      if (p.onGround && p.y === FLOOR_Y && p.x > far - cfg.halfWidth + 0.01) {
        n++;
        break;
      }
    }
  }
  return n;
}

/** Timing window (ticks) for clearing a 1-tile-thin wall `h` tiles tall. */
function wallWindow(h, run, cfg = M) {
  const WC = 20;
  const L = mkLevel('wall', 80, (g) => fill(g, FLOOR_ROW - h, FLOOR_ROW - 1, WC, WC, '#'));
  let n = 0;
  for (let j = 0; j < 200; j++) {
    const p = mk(L, 40);
    for (let t = 0; t < j + 100; t++) {
      stepPlayer(L, p, BTN.RIGHT | (run ? BTN.RUN : 0) | (t >= j && t < j + 60 ? BTN.JUMP : 0), cfg);
      if (p.x > (WC + 1) * TILE + cfg.halfWidth) {
        n++;
        break;
      }
    }
  }
  return n;
}

/** Timing window (ticks) for crossing a patch of  spike tiles on the floor without being hurt. */
function spikeWindow(w, run, cfg = M) {
  const SC = 14;
  const L = mkLevel('spikes', 120, (g) => fill(g, FLOOR_ROW - 1, FLOOR_ROW - 1, SC, SC + w - 1, '^'));
  const far = (SC + w) * TILE;
  let n = 0;
  for (let j = 0; j < 260; j++) {
    const p = mk(L, 24);
    for (let t = 0; t < j + 130; t++) {
      stepPlayer(L, p, BTN.RIGHT | (run ? BTN.RUN : 0) | (t >= j && t < j + 60 ? BTN.JUMP : 0), cfg);
      if (p.deaths > 0) break;
      if (p.onGround && p.y === FLOOR_Y && p.x > far + cfg.halfWidth) {
        n++;
        break;
      }
    }
  }
  return n;
}

/** Window table for sizes 1..max; stops after the first impossible size. */
function windows(fn, run, max) {
  const out = [];
  for (let s = 1; s <= max; s++) {
    const n = fn(s, run);
    out.push(n);
    if (n === 0) break;
  }
  return out;
}
const maxOf = (win) => win.filter((n) => n > 0).length;

/** Tallest wide ledge (tiles) one can land on top of. */
function maxLedgeTiles(run, cfg = M) {
  const WC = 20;
  let best = 0;
  for (let h = 1; h <= 10; h++) {
    const L = mkLevel('ledge', 80, (g) => fill(g, FLOOR_ROW - h, FLOOR_ROW - 1, WC, 70, '#'));
    let ok = false;
    for (let j = 0; j < 200 && !ok; j++) {
      const p = mk(L, 40);
      for (let t = 0; t < j + 100; t++) {
        stepPlayer(L, p, BTN.RIGHT | (run ? BTN.RUN : 0) | (t >= j && t < j + 60 ? BTN.JUMP : 0), cfg);
        if (p.onGround && p.y === FLOOR_Y - h * TILE && p.x > WC * TILE) {
          ok = true;
          break;
        }
      }
    }
    if (ok) best = h;
    else break;
  }
  return best;
}

function padApex(held, cfg = M) {
  const L = mkLevel('pad', 60, (g) => {
    g[FLOOR_ROW - 1][14] = 'B';
  });
  const top = (FLOOR_ROW - 1) * TILE;
  const p = createPlayer(1, L);
  p.x = 14 * TILE + 8;
  p.y = top - 2;
  p.prevY = p.y;
  p.vy = 1;
  let minY = p.y;
  for (let t = 0; t < 120; t++) {
    stepPlayer(L, p, held ? BTN.JUMP : 0, cfg);
    minY = Math.min(minY, p.y);
  }
  return top - minY;
}

/** Feet apex above the victim head after a stomp bounce (player-vs-player; enemies use the same velocities). */
function stompRise(held, cfg = M) {
  const w = createWorld(FLAT);
  const b = mk(FLAT, 200);
  b.id = 2;
  const a = createPlayer(1, FLAT);
  a.x = 200;
  a.y = FLOOR_Y - cfg.height - 14;
  a.prevY = a.y;
  a.vy = 2;
  w.players.push(a, b);
  let minY = Infinity;
  for (let t = 0; t < 120; t++) {
    stepWorld(FLAT, w, { 1: held ? BTN.JUMP : 0 }, cfg);
    if (t > 3) minY = Math.min(minY, a.y);
  }
  return FLOOR_Y - cfg.height - minY;
}

function ticksToSpeed(run) {
  const p = mk(FLAT, 40);
  const target = run ? M.runMax : M.walkMax;
  const x0 = p.x;
  for (let t = 1; t < 300; t++) {
    stepPlayer(FLAT, p, BTN.RIGHT | (run ? BTN.RUN : 0));
    if (p.vx >= target - 1e-9) return { ticks: t, dist: p.x - x0 };
  }
  throw new Error('never reached speed');
}

function skidFromRun() {
  const p = mk(FLAT, 120);
  for (let i = 0; i < 100; i++) stepPlayer(FLAT, p, BTN.RIGHT | BTN.RUN);
  const x0 = p.x;
  for (let t = 1; t < 100; t++) {
    stepPlayer(FLAT, p, BTN.LEFT | BTN.RUN);
    if (p.vx <= 0) return { ticks: t, dist: p.x - x0 };
  }
  throw new Error('never stopped');
}

function coastFromRun() {
  const p = mk(FLAT, 120);
  for (let i = 0; i < 100; i++) stepPlayer(FLAT, p, BTN.RIGHT | BTN.RUN);
  const x0 = p.x;
  for (let t = 1; t < 200; t++) {
    stepPlayer(FLAT, p, 0);
    if (p.vx === 0) return { ticks: t, dist: p.x - x0 };
  }
  throw new Error('never stopped');
}

function crouchSlideFromRun() {
  const p = mk(FLAT, 120);
  for (let i = 0; i < 100; i++) stepPlayer(FLAT, p, BTN.RIGHT | BTN.RUN);
  const x0 = p.x;
  for (let t = 1; t < 200; t++) {
    stepPlayer(FLAT, p, BTN.RIGHT | BTN.CROUCH);
    if (p.vx <= M.crouchMax + 1e-9) return { ticks: t, dist: p.x - x0 };
  }
  throw new Error('slide never ended');
}

/** Ticks to cover `dist` px from a standing start, flat ground, nothing in the way. */
function ticksToCover(dist, run, cfg = M) {
  const p = mk(FLAT, 40);
  const x0 = p.x;
  for (let t = 1; t < 5000; t++) {
    stepPlayer(FLAT, p, BTN.RIGHT | (run ? BTN.RUN : 0), cfg);
    if (p.x - x0 >= dist) return t;
  }
  throw new Error('never covered');
}

/** Latest tick after leaving a ledge (0 = the tick the body leaves) on which a fresh JUMP press still jumps. */
function coyoteLate() {
  const L = mkLevel('coy', 80, (g) => fill(g, FLOOR_ROW, 15, 14, 79, '.'));
  const run = (pressAt) => {
    const p = mk(L, 12 * TILE);
    let left = -1;
    let jumped = false;
    for (let t = 0; t < 120; t++) {
      stepPlayer(L, p, BTN.RIGHT | (pressAt !== null && t === pressAt ? BTN.JUMP : 0));
      if (left < 0 && !p.onGround) left = t;
      if (pressAt !== null && t >= pressAt && p.vy < -3) jumped = true;
    }
    return { left, jumped };
  };
  const left = run(null).left;
  if (left < 0) throw new Error('coyote probe never left the ledge');
  let best = -1;
  for (let k = 0; k <= 12; k++) if (run(left + k).jumped) best = k;
  return best;
}

/** Latest press (ticks before the landing tick) that is still remembered and jumps on touchdown. */
function bufferEarly() {
  const H = 60;
  const drop = (pressAt) => {
    const p = mk(FLAT, 100, FLOOR_Y - H);
    p.onGround = false;
    let landed = -1;
    let jumped = false;
    for (let t = 0; t < 120; t++) {
      stepPlayer(FLAT, p, pressAt !== null && t >= pressAt && t < pressAt + 6 ? BTN.JUMP : 0);
      if (landed < 0 && p.onGround) landed = t;
      if (landed >= 0 && t > landed && p.vy < -3) jumped = true;
    }
    return { landed, jumped };
  };
  const landed = drop(null).landed;
  let best = -1;
  for (let k = 0; k <= 12; k++) if (landed - k >= 0 && drop(landed - k).jumped) best = k;
  return best;
}

/** Free fall from rest: ticks and px until terminal speed. */
function fallToTerminal() {
  let v = 0;
  let y = 0;
  let t = 0;
  while (v < M.maxFall) {
    v = Math.min(v + M.gravityFall, M.maxFall);
    y += v;
    t++;
  }
  return { ticks: t, dist: y };
}

// ---------------------------------------------------------------------------------------------------------
// Static scans of the two shipped levels (loud if the layout drifts from what the docs describe).
// ---------------------------------------------------------------------------------------------------------

function colHeight(level, col) {
  let h = 0;
  for (let r = level.height - 1; r >= 0; r--) {
    if (level.tiles[r][col] === '#' && r < 12) h++;
    else if (h > 0) break;
  }
  return h;
}

function playgroundGates() {
  const L = PLAYGROUND;
  const groundRow = 12;
  // pit: first run of empty tiles in the ground row
  let pitStart = -1;
  let pitLen = 0;
  for (let c = 0; c < L.width; c++) {
    if (L.tiles[groundRow][c] === '.') {
      if (pitStart < 0) pitStart = c;
      pitLen++;
    } else if (pitStart >= 0) break;
  }
  const wall4 = colHeight(L, 74);
  const wall6 = colHeight(L, 84);
  if (pitStart !== 40 || pitLen !== 5 || wall4 !== 4 || wall6 !== 6 || L.tiles[11][50] !== 'B') {
    throw new Error(`playground layout drifted: pit ${pitStart}+${pitLen}, walls ${wall4}/${wall6}. Update tools/mechanics/gen-numbers.mjs and the docs`);
  }
  return { pitStart, pitLen, wall4, wall6, groundY: (groundRow) * TILE, padCol: 50, platTop: 4 * TILE, padTop: 11 * TILE };
}

// ---------------------------------------------------------------------------------------------------------
// Netcode constants: protocol and client are imported, server constants are parsed from source (the server
// module opens sockets on use, so it is not imported).
// ---------------------------------------------------------------------------------------------------------

function serverConst(src, name) {
  const m = src.match(new RegExp(`const ${name}\\s*=\\s*([0-9_]+)`));
  if (!m) throw new Error(`apps/server/src/server.ts: const ${name} not found (update gen-numbers.mjs)`);
  return Number(m[1].replace(/_/g, ''));
}

// ---------------------------------------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------------------------------------

export function buildNumbers() {
  tags.clear();
  const out = [];
  const w = (s = '') => out.push(s);

  // ---- guards: undocumented config keys fail generation
  for (const k of Object.keys(M)) if (!MOVEMENT_DOC[k]) throw new Error(`MOVEMENT.${k} has no entry in MOVEMENT_DOC (gen-numbers.mjs)`);
  for (const k of Object.keys(MOVEMENT_DOC)) if (!(k in M)) throw new Error(`MOVEMENT_DOC.${k} no longer exists in MOVEMENT`);
  for (const k of Object.keys(RULES)) if (k !== 'defaultRoom' && !RULES_DOC[k]) throw new Error(`RULES.${k} has no entry in RULES_DOC (gen-numbers.mjs)`);
  for (const k of Object.keys(RULES.defaultRoom)) if (!ROOM_DOC[k]) throw new Error(`RULES.defaultRoom.${k} has no entry in ROOM_DOC`);
  for (const k of Object.keys(BTN)) if (!BTN_DOC[k]) throw new Error(`BTN.${k} has no entry in BTN_DOC`);

  w(`<!-- ${HEADER} -->`);
  w('<!-- source: packages/sim/src/config.ts, levels, protocol constants, apps/server/src/server.ts, apps/client/src/game.ts -->');
  w('');
  w('# Mechanics numbers (generated)');
  w('');
  w('Every value below is read from the live code or measured by running the real `stepPlayer` / `stepWorld` on small synthetic levels. Measured rows say "sim" and are authoritative over any closed-form estimate. Hand-written docs quote these with `<!--num:key-->value<!--/num-->` tags; `packages/sim/test/mechanics-doc.test.ts` fails if a quoted value drifts.');
  w('');

  // ---- units
  w('## Units and global constants');
  w('');
  w('| tag | value | unit | meaning |');
  w('|---|---|---|---|');
  const gc = [
    ['TICK_RATE', TICK_RATE, 'Hz', 'fixed sim rate (one tick = 1/60 s = 16.667 ms)'],
    ['TILE', TILE, 'px', 'tile edge'],
    ['SCREEN_W', SCREEN_W, 'px', 'native screen width (16 tiles)'],
    ['SCREEN_H', SCREEN_H, 'px', 'native screen height (14 tiles)'],
    ['BTN_MASK', BTN_MASK, 'bits', 'all six input bits; the server masks every input with it'],
  ];
  for (const [k, v, u, d] of gc) w(`| \`${k}\` | ${reg(k, v)} | ${u} | ${d} |`);
  w('');
  w('### Input bits (`BTN`)');
  w('');
  w('| tag | value | meaning |');
  w('|---|---|---|');
  for (const [k, v] of Object.entries(BTN)) w(`| \`BTN.${k}\` | ${reg('BTN.' + k, v)} | ${BTN_DOC[k]} |`);
  w('');

  // ---- MOVEMENT
  w('## MOVEMENT (`packages/sim/src/config.ts`)');
  w('');
  w('| tag | value | unit | meaning |');
  w('|---|---|---|---|');
  for (const k of Object.keys(M)) w(`| \`${k}\` | ${reg(k, M[k])} | ${MOVEMENT_DOC[k][0]} | ${MOVEMENT_DOC[k][1]} |`);
  w('');

  // ---- RULES
  w('## RULES (`packages/sim/src/config.ts`)');
  w('');
  w('| tag | value | unit | meaning |');
  w('|---|---|---|---|');
  for (const k of Object.keys(RULES)) {
    if (k === 'defaultRoom') continue;
    w(`| \`rules.${k}\` | ${reg('rules.' + k, RULES[k])} | ${RULES_DOC[k][0]} | ${RULES_DOC[k][1]} |`);
  }
  for (const k of Object.keys(RULES.defaultRoom)) {
    w(`| \`room.${k}\` | ${reg('room.' + k, RULES.defaultRoom[k])} | ${ROOM_DOC[k][0]} | ${ROOM_DOC[k][1]} |`);
  }
  w('');

  // ---- derived: speeds and time
  w('## Derived: speeds, time, ground handling (sim)');
  w('');
  w('| tag | value | unit | how |');
  w('|---|---|---|---|');
  const row = (k, v, u, how) => w(`| \`${k}\` | ${reg(k, v)} | ${u} | ${how} |`);
  row('d.tickMs', f(1000 / TICK_RATE, 3), 'ms', '1000 / TICK_RATE');
  row('d.walkPxPerSec', f(M.walkMax * TICK_RATE, 0), 'px/s', 'walkMax x 60');
  row('d.walkTilesPerSec', f((M.walkMax * TICK_RATE) / TILE, 2), 'tiles/s', 'walkMax x 60 / 16');
  row('d.runPxPerSec', f(M.runMax * TICK_RATE, 0), 'px/s', 'runMax x 60');
  row('d.runTilesPerSec', f((M.runMax * TICK_RATE) / TILE, 2), 'tiles/s', 'runMax x 60 / 16');
  row('d.crouchTilesPerSec', f((M.crouchMax * TICK_RATE) / TILE, 2), 'tiles/s', 'crouchMax x 60 / 16');
  const wk = ticksToSpeed(false);
  const rn = ticksToSpeed(true);
  row('d.walkAccelTicks', wk.ticks, 'ticks', 'sim: standing start to walkMax holding RIGHT');
  row('d.walkAccelDist', f(wk.dist, 1), 'px', 'sim: distance covered during that');
  row('d.runAccelTicks', rn.ticks, 'ticks', 'sim: standing start to runMax holding RIGHT+RUN');
  row('d.runAccelDist', f(rn.dist, 1), 'px', 'sim: distance covered during that');
  const sk = skidFromRun();
  row('d.skidTicks', sk.ticks, 'ticks', 'sim: from runMax, hold the opposite direction until vx <= 0');
  row('d.skidDist', f(sk.dist, 1), 'px', 'sim: distance covered while skidding to a stop');
  const co = coastFromRun();
  row('d.coastTicks', co.ticks, 'ticks', 'sim: from runMax, release everything until vx = 0');
  row('d.coastDist', f(co.dist, 1), 'px', 'sim: distance covered while coasting to a stop');
  const cs = crouchSlideFromRun();
  row('d.slideTicks', cs.ticks, 'ticks', 'sim: from runMax, hold CROUCH+RIGHT until vx <= crouchMax (overspeedDecel bleeds the speed)');
  row('d.slideDist', f(cs.dist, 1), 'px', 'sim: distance covered during that slide');
  const ft = fallToTerminal();
  row('d.terminalTicks', ft.ticks, 'ticks', 'free fall from rest with gravityFall until maxFall');
  row('d.terminalDist', f(ft.dist, 1), 'px', 'distance fallen by then');
  const cl = coyoteLate();
  const bf = bufferEarly();
  row('d.coyoteLate', cl, 'ticks', 'sim: last tick after leaving a ledge (0 = the leaving tick) on which a fresh JUMP press still jumps');
  row('d.bufferEarly', bf, 'ticks', 'sim: earliest JUMP press before the landing tick that still produces a jump on touchdown');
  w('');

  // ---- derived: jumps
  w('## Derived: jumps (sim, flat ground, feet apex above takeoff)');
  w('');
  w('"held" = JUMP held for the whole rise; "tap" = JUMP down for 1 tick only. Takeoff speed = jumpVel + |vx| x runBonus. "closed form" = v^2 / (2 g), the continuous estimate; the sim row is authoritative (the discrete integrator lands a few px lower).');
  w('');
  w('| case | takeoff vy | apex px | apex tiles | air ticks | air distance px | closed form px |');
  w('|---|---|---|---|---|---|---|');
  const cases = [
    ['stand', 'standing', Infinity],
    ['walk', 'walking', Infinity],
    ['run', 'running', Infinity],
    ['stand', 'standing', 1],
    ['walk', 'walking', 1],
    ['run', 'running', 1],
  ];
  const J = {};
  for (const [kind, label, hold] of cases) {
    const r = jumpTrial(kind, hold);
    const mode = hold === 1 ? 'Tap' : 'Held';
    const id = kind + mode;
    J[id] = r;
    const closed = (r.takeoff * r.takeoff) / (2 * (hold === 1 ? M.gravityFall : M.gravityHeld));
    reg(`d.apex.${id}`, f(r.apex, 1));
    reg(`d.apexTiles.${id}`, f(r.apex / TILE, 2));
    reg(`d.air.${id}`, r.air);
    reg(`d.dist.${id}`, f(r.dist, 0));
    reg(`d.takeoff.${id}`, f(r.takeoff, 2));
    w(`| ${label} ${mode.toLowerCase()} | ${f(r.takeoff, 2)} | ${f(r.apex, 1)} | ${f(r.apex / TILE, 2)} | ${r.air} | ${f(r.dist, 0)} | ${f(closed, 1)} |`);
  }
  w('');
  w('Tags: `d.apex.<case>`, `d.apexTiles.<case>`, `d.air.<case>`, `d.dist.<case>`, `d.takeoff.<case>` with case = `standHeld walkHeld runHeld standTap walkTap runTap`.');
  w('');

  // ---- derived: clearances
  w('## Derived: what a body can clear (sim, best timing over every jump tick)');
  w('');
  w('| tag | value | unit | meaning |');
  w('|---|---|---|---|');
  const gapWalk = windows(gapWindow, false, 16);
  const gapRun = windows(gapWindow, true, 16);
  const wallWalk = windows(wallWindow, false, 10);
  const wallRun = windows(wallWindow, true, 10);
  row('d.maxGap.walk', maxOf(gapWalk), 'tiles', 'widest pit crossable walking (landing grounded on the far side)');
  row('d.maxGap.run', maxOf(gapRun), 'tiles', 'widest pit crossable running');
  row('d.maxWall.walk', maxOf(wallWalk), 'tiles', 'tallest 1-tile-thin wall cleared walking');
  row('d.maxWall.run', maxOf(wallRun), 'tiles', 'tallest 1-tile-thin wall cleared running');
  row('d.maxLedge.walk', maxLedgeTiles(false), 'tiles', 'tallest wide ledge landed on top of, walking');
  row('d.maxLedge.run', maxLedgeTiles(true), 'tiles', 'tallest wide ledge landed on top of, running');
  w('');
  w('A gap of `d.maxGap.run` tiles is the HARD LIMIT with perfect timing: required content must sit well inside it (see LEVEL_DESIGN_GUIDE.md tier table).');
  w('');
  w('### Timing windows (ticks of jump-press timing that still succeed; 0 = impossible, 1 = frame-perfect)');
  w('');
  w('Each tick of a straight approach at steady speed is one possible press time; the window is how many of them clear the obstacle. 60 ticks = 1 s. Pits are measured grounded-landing on the far side; walls are thin (1 tile) and cleared when the body is fully past. JUMP is held for 60 ticks from the press.');
  w('');
  w('| pit width (tiles) | walk window | run window |');
  w('|---|---|---|');
  for (let g = 1; g <= Math.max(gapWalk.length, gapRun.length); g++) {
    const a = gapWalk[g - 1] ?? 0;
    const b = gapRun[g - 1] ?? 0;
    reg(`d.gapWin.walk.${g}`, a);
    reg(`d.gapWin.run.${g}`, b);
    w(`| ${g} | ${a} | ${b} |`);
  }
  w('');
  w('| wall height (tiles) | walk window | run window |');
  w('|---|---|---|');
  for (let h = 1; h <= Math.max(wallWalk.length, wallRun.length); h++) {
    const a = wallWalk[h - 1] ?? 0;
    const b = wallRun[h - 1] ?? 0;
    reg(`d.wallWin.walk.${h}`, a);
    reg(`d.wallWin.run.${h}`, b);
    w(`| ${h} | ${a} | ${b} |`);
  }
  w('');
  const spikeWalk = windows(spikeWindow, false, 16);
  const spikeRun = windows(spikeWindow, true, 16);
  w('| spike patch width (tiles, on the floor) | walk window | run window |');
  w('|---|---|---|');
  for (let n = 1; n <= Math.max(spikeWalk.length, spikeRun.length); n++) {
    const a = spikeWalk[n - 1] ?? 0;
    const b = spikeRun[n - 1] ?? 0;
    reg(`d.spikeWin.walk.${n}`, a);
    reg(`d.spikeWin.run.${n}`, b);
    w(`| ${n} | ${a} | ${b} |`);
  }
  w('');
  w('| tag | value | unit | meaning |');
  w('|---|---|---|---|');
  row('d.maxSpike.walk', maxOf(spikeWalk), 'tiles', 'widest floor spike patch crossable walking (landing past it unhurt)');
  row('d.maxSpike.run', maxOf(spikeRun), 'tiles', 'widest floor spike patch crossable running');
  w('');
  w('Tags: `d.gapWin.<walk|run>.<tiles>`, `d.wallWin.<walk|run>.<tiles>`, `d.spikeWin.<walk|run>.<tiles>`.');
  w('');
  w('### Tier limits (largest obstacle whose timing window is at least the tier floor)');
  w('');
  w('The window floors are a PROPOSAL (design targets in `LEVEL_DESIGN_GUIDE.md`, derived from the completion targets in `docs/design/DIFFICULTY_PHILOSOPHY.md`); the sizes are computed from the windows above.');
  w('');
  w('| tier | window floor (ticks) | pit walk | pit run | wall/ledge walk | wall/ledge run | floor spikes walk | floor spikes run |');
  w('|---|---|---|---|---|---|---|---|');
  const lim = (win, floor) => {
    let n = 0;
    for (const x of win) {
      if (x >= floor) n++;
      else break;
    }
    return n;
  };
  const TIER_FLOORS = { T0: 20, T1: 15, T2: 15, T3: 8, T4: 5, T5: 2 };
  for (const [tier, floor] of Object.entries(TIER_FLOORS)) {
    const vals = [lim(gapWalk, floor), lim(gapRun, floor), lim(wallWalk, floor), lim(wallRun, floor), lim(spikeWalk, floor), lim(spikeRun, floor)];
    reg(`d.tier.${tier}.floor`, floor);
    ['pitWalk', 'pitRun', 'wallWalk', 'wallRun', 'spikeWalk', 'spikeRun'].forEach((k, i) => reg(`d.tier.${tier}.${k}`, vals[i]));
    w(`| ${tier} | ${floor} | ${vals.join(' | ')} |`);
  }
  w('');
  w('Tags: `d.tier.<T0..T5>.<floor|pitWalk|pitRun|wallWalk|wallRun|spikeWalk|spikeRun>`.');
  w('');

  // ---- derived: pads and stomps
  w('## Derived: bounce pad and stomp (sim)');
  w('');
  w('| tag | value | unit | meaning |');
  w('|---|---|---|---|');
  const pt = padApex(false);
  const ph = padApex(true);
  const st = stompRise(false);
  const sh = stompRise(true);
  row('d.padApex.tap', f(pt, 1), 'px', 'feet apex above the pad top, JUMP not held at touchdown');
  row('d.padApex.held', f(ph, 1), 'px', 'feet apex above the pad top, JUMP held');
  row('d.padApexTiles.held', f(ph / TILE, 2), 'tiles', 'held pad apex in tiles');
  row('d.stompRise.tap', f(st, 1), 'px', 'feet apex above the victim HEAD after a stomp, JUMP not held');
  row('d.stompRise.held', f(sh, 1), 'px', 'feet apex above the victim head, JUMP held');
  row('d.stompApexFloor.held', f(sh + M.height, 1), 'px', 'held stomp off a grounded standing partner: feet apex above THEIR feet (head height + rise)');
  row('d.stompApexFloor.tap', f(st + M.height, 1), 'px', 'tap stomp off a grounded standing partner: feet apex above their feet');
  row('d.enemyStompApex.held', f(sh + RULES.enemyHeight, 1), 'px', 'held stomp off a walker standing on a floor: feet apex above THE ENEMY FEET (enemy height + rise): a solo player can use an enemy as a stepping stone');
  row('d.stompApexFloorCrouch.held', f(sh + M.crouchHeight, 1), 'px', 'held stomp off a CROUCHING grounded partner (their head is 16, not 28, above their feet)');
  w('');
  w('Enemy stomps use the same `stompVel` / `stompHeldVel`, so the rise is the same measured from the enemy top.');
  w('');

  // ---- playground gates
  const G = playgroundGates();
  w('## Skill gates of the `playground` level');
  w('');
  w('| gate | layout | needs (px) | walk solo | run solo | held stomp off a partner |');
  w('|---|---|---|---|---|---|');
  const pitPx = G.pitLen * TILE;
  const walkGap = Number(tags.get('d.maxGap.walk'));
  const runGap = Number(tags.get('d.maxGap.run'));
  const walkWall = Number(tags.get('d.maxWall.walk'));
  const runWall = Number(tags.get('d.maxWall.run'));
  const yn = (b) => (b ? 'clears' : 'cannot');
  reg('pg.pitTiles', G.pitLen);
  reg('pg.wall4Tiles', G.wall4);
  reg('pg.wall6Tiles', G.wall6);
  reg('pg.pitPx', pitPx);
  reg('pg.wall4Px', G.wall4 * TILE);
  reg('pg.wall6Px', G.wall6 * TILE);
  w(`| pit (cols ${G.pitStart}-${G.pitStart + G.pitLen - 1}) | ${G.pitLen} tiles wide | ${pitPx} wide | ${yn(walkGap >= G.pitLen)} | ${yn(runGap >= G.pitLen)} | n/a |`);
  w(`| 4-tile wall (col 74) | ${G.wall4} tiles tall | ${G.wall4 * TILE} | ${yn(walkWall >= G.wall4)} | ${yn(runWall >= G.wall4)} | n/a |`);
  w(`| 6-tile wall (col 84) | ${G.wall6} tiles tall | ${G.wall6 * TILE} | ${yn(walkWall >= G.wall6)} | ${yn(runWall >= G.wall6)} | ${yn(sh + M.height >= G.wall6 * TILE)} (apex ${f(sh + M.height, 1)} px) |`);
  const padNeed = G.padTop - G.platTop;
  reg('pg.padNeedPx', padNeed);
  w(`| high platform via bounce pad (col 50 to row 4) | platform top ${G.platTop}px, pad top ${G.padTop}px | ${padNeed} above the pad | tap ${f(pt, 1)}: ${yn(pt >= padNeed)} | held ${f(ph, 1)}: ${yn(ph >= padNeed)} | n/a |`);
  w('');

  // ---- co-op derived
  const C = COOP_ROOM;
  const ID = COOP_IDS;
  const lever = (n) => C.levers[ID.lever[n]];
  const plate = (n) => C.plates[ID.plate[n]];
  const doorCol = (n) => C.doors[ID.door[n]].tiles[0][0];
  const lx = (n) => lever(n).col * TILE + TILE / 2;
  const timed = lever('timed');
  const doorLeft = doorCol('corridor') * TILE - M.halfWidth;
  const corridorDist = doorLeft - (lx('timed') - 6);
  const corridorTicks = ticksToCover(corridorDist, true);
  w('## Skill gates of the `coopRoom` level (derived from the level data and the sim)');
  w('');
  w('| tag | value | unit | meaning |');
  w('|---|---|---|---|');
  row('coop.corridorTimerTicks', timed.ticks, 'ticks', 'timed lever duration (levers[timed].ticks)');
  row('coop.corridorDistPx', f(corridorDist, 0), 'px', 'from the puller (standing 6 px left of the lever) to the corridor door face minus the body half width');
  row('coop.corridorRunTicks', corridorTicks, 'ticks', 'sim: best case, running from a standing start over flat ground with no obstacles');
  row('coop.corridorShortTicks', corridorTicks - timed.ticks, 'ticks', 'ticks the puller is TOO SLOW by even with no spikes in the way (must be > 0 for the gate to need a partner)');
  const slabTop = 7 * TILE;
  const slabAbove = FLOOR_Y - slabTop;
  row('coop.ledgeAbovePx', slabAbove, 'px', 'ledge top above the floor (slab at row 7)');
  row('coop.soloBestPx', f(J.runHeld.apex, 1), 'px', 'best solo feet apex (running held jump)');
  row('coop.stompBestPx', f(sh + M.height, 1), 'px', 'feet apex of a held stomp off a grounded standing partner');
  row('coop.ledgeSoloMargin', f(slabAbove - J.runHeld.apex, 1), 'px', 'how far short a solo run-jump falls (must be > 0)');
  row('coop.ledgeStompMargin', f(sh + M.height - slabAbove, 1), 'px', 'how far a held stomp clears the ledge top (must be > 0)');
  row('coop.gate0DistTiles', plate('B').col - plate('A').col, 'tiles', 'plate A to plate B');
  row('coop.gate0Linger', C.links[0].linger, 'ticks', 'gate 0 stays open this long after a plate lapses');
  row('coop.gate0RunTicks', ticksToCover((doorCol('gate0') - plate('A').col) * TILE, true), 'ticks', 'sim: plate A holder running to the gate 0 column (flat, no obstacles)');
  row('coop.finalNeed', C.links[3].need, 'plates', 'plates that must be held at once for the final gate');
  row('coop.finalPlates', C.links[3].plates.length, 'plates', 'plates linked to the final gate');
  row('coop.finalLinger', C.links[3].linger, 'ticks', 'final gate linger');
  row('coop.minPlayers', C.room.minPlayers, 'players', 'coopRoom room.minPlayers');
  row('coop.maxPlayers', C.room.maxPlayers, 'players', 'coopRoom room.maxPlayers');
  w('');
  w('### Door links');
  w('');
  w('| door | col | plates | levers | need | linger (ticks) |');
  w('|---|---|---|---|---|---|');
  for (const l of C.links) {
    w(`| ${l.door} | ${C.doors[l.door].tiles[0][0]} | ${(l.plates ?? []).join(', ') || '-'} | ${(l.levers ?? []).join(', ') || '-'} | ${l.need ?? (l.plates ? 'all' : '-')} | ${l.linger ?? 0} |`);
  }
  w('');

  // ---- level registry
  w('## Level registry (`LEVELS`)');
  w('');
  w('| level | size (tiles) | spawn px (x, feet y) | checkpoints | shards | enemies (walker/flyer/spiky) | plates | levers (timed/reset) | doors | links | room (min/max players, solo reset, empty reset) |');
  w('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [name, L] of Object.entries(LEVELS)) {
    const kinds = [0, 1, 2].map((k) => L.enemies.filter((e) => e.kind === k).length).join('/');
    const lv = `${L.levers.length} (${L.levers.filter((x) => x.ticks > 0).length}/${L.levers.filter((x) => x.reset).length})`;
    const r = L.room;
    w(`| ${name} | ${L.width} x ${L.height} | ${L.spawn.x}, ${L.spawn.y} | ${L.checkpoints.length} | ${L.shards.length} | ${kinds} | ${L.plates.length} | ${lv} | ${L.doors.length} | ${L.links.length} | ${r.minPlayers}/${r.maxPlayers ?? '-'}, ${r.soloResetTicks}, ${r.emptyResetTicks} |`);
    reg(`lv.${name}.width`, L.width);
    reg(`lv.${name}.height`, L.height);
    reg(`lv.${name}.shards`, L.shards.length);
  }
  w('');

  // ---- netcode
  const serverSrc = readFileSync(resolve(ROOT, 'apps/server/src/server.ts'), 'utf8');
  const graceM = serverSrc.match(/graceMs\s*\?\?\s*([0-9_]+)/);
  if (!graceM) throw new Error('graceMs default not found in server.ts');
  const net = [
    ['net.PROTOCOL_VERSION', PROTO.PROTOCOL_VERSION, '', 'welcome.v'],
    ['net.SNAPSHOT_EVERY', PROTO.SNAPSHOT_EVERY, 'ticks', 'a snapshot is broadcast every Nth tick'],
    ['net.snapshotHz', f(TICK_RATE / PROTO.SNAPSHOT_EVERY, 0), 'Hz', 'TICK_RATE / SNAPSHOT_EVERY'],
    ['net.snapshotMs', f((1000 * PROTO.SNAPSHOT_EVERY) / TICK_RATE, 0), 'ms', 'time between snapshots'],
    ['net.SNAPSHOT_FULL_EVERY', PROTO.SNAPSHOT_FULL_EVERY, 'snapshots', 'every Nth snapshot is a full world frame (1 Hz)'],
    ['net.SNAPSHOT_LOOK_EVERY', PROTO.SNAPSHOT_LOOK_EVERY, 'snapshots', 'every Nth snapshot carries every look (1 Hz)'],
    ['net.MAX_NAME', PROTO.MAX_NAME, 'chars', 'player name length cap'],
    ['net.INTERP_DELAY_MS', INTERP_DELAY_MS, 'ms', 'client renders remote players this far in the past'],
    ['net.MAX_PENDING', MAX_PENDING, 'inputs', 'client keeps this many unacked inputs for replay (2 s)'],
    ['net.SNAP_ERR_PX', SNAP_ERR_PX, 'px', 'reconcile error above this is snapped, not smoothed (also remote interpolation teleport)'],
    ['net.MAX_PLAYERS', serverConst(serverSrc, 'MAX_PLAYERS'), 'players', 'hard server cap (a level room.maxPlayers can lower it)'],
    ['net.MAX_PAYLOAD', serverConst(serverSrc, 'MAX_PAYLOAD'), 'bytes', 'ws frame cap; larger frames close the socket'],
    ['net.QUEUE_MAX', serverConst(serverSrc, 'QUEUE_MAX'), 'inputs', 'per-player input queue length that triggers a trim'],
    ['net.QUEUE_TRIM', serverConst(serverSrc, 'QUEUE_TRIM'), 'inputs', 'queue is cut down to the newest N inputs on overflow'],
    ['net.MAX_CATCHUP', serverConst(serverSrc, 'MAX_CATCHUP'), 'ticks', 'max sim ticks the server runs per timer wake-up'],
    ['net.LOOP_MS', serverConst(serverSrc, 'LOOP_MS'), 'ms', 'server timer period'],
    ['net.graceMs', Number(graceM[1].replace(/_/g, '')), 'ms', 'default token re-attach grace (the body is `away` meanwhile)'],
    ['net.LOOK_BURST', serverConst(serverSrc, 'LOOK_BURST'), 'messages', 'setLook token bucket capacity'],
    ['net.LOOK_REFILL_MS', serverConst(serverSrc, 'LOOK_REFILL_MS'), 'ms', 'setLook token refill period'],
  ];
  w('## Netcode constants');
  w('');
  w('| tag | value | unit | meaning |');
  w('|---|---|---|---|');
  for (const [k, v, u, d] of net) w(`| \`${k}\` | ${reg(k, v)} | ${u} | ${d} |`);
  w('');

  // ---- tag index
  w('## Tag index');
  w('');
  w('All registered tags, in order. Docs may quote any of them as `<!--num:TAG-->value<!--/num-->`.');
  w('');
  w('```');
  for (const [k, v] of tags) w(`${k} = ${v}`);
  w('```');
  w('');

  return { markdown: out.join('\n'), tags: new Map(tags) };
}

// ---------------------------------------------------------------------------------------------------------
// --sensitivity: how far each tunable can move before a shipped skill gate flips. Slow (about a minute), so it is
// NOT part of NUMBERS.md; the result is pasted (as a dated static table) into docs/mechanics/TUNING_GUIDE.md.
// ---------------------------------------------------------------------------------------------------------

function gateSet(cfg) {
  const C = COOP_ROOM;
  const ID = COOP_IDS;
  const lever = C.levers[ID.lever.timed];
  const corridorDoor = C.doors[ID.door.corridor].tiles[0][0] * TILE - cfg.halfWidth;
  const corridorDist = corridorDoor - (lever.col * TILE + TILE / 2 - 6);
  const gate0Dist = (C.doors[ID.door.gate0].tiles[0][0] - C.plates[ID.plate.A].col) * TILE;
  const slab = FLOOR_Y - 7 * TILE;
  const stompApex = stompRise(true, cfg) + cfg.height;
  const runApex = jumpTrial('run', Infinity, cfg).apex;
  const padHeld = padApex(true, cfg);
  const padTap = padApex(false, cfg);
  const padNeed = 11 * TILE - 4 * TILE;
  return [
    ['pit5 walk fails', gapWindow(5, false, cfg) === 0],
    ['pit5 run clears', gapWindow(5, true, cfg) > 0],
    ['wall4 walk fails', wallWindow(4, false, cfg) === 0],
    ['wall4 run clears', wallWindow(4, true, cfg) > 0],
    ['wall6 solo run fails', wallWindow(6, true, cfg) === 0],
    ['wall6 held stomp clears', stompApex >= 6 * TILE],
    ['pad held reaches platform', padHeld >= padNeed],
    ['pad tap does not', padTap < padNeed],
    ['coop ledge solo fails', runApex < slab - 8],
    ['coop ledge stomp clears', stompApex >= slab],
    ['corridor needs a partner', ticksToCover(corridorDist, true, cfg) > C.levers[ID.lever.timed].ticks],
    ['gate0 holder makes it (1.3x margin)', ticksToCover(gate0Dist, true, cfg) * 1.3 < C.links[0].linger],
  ];
}

function sensitivity() {
  const base = gateSet(M);
  const bad = base.filter(([, ok]) => !ok);
  if (bad.length) throw new Error(`baseline gates already broken: ${bad.map((b) => b[0]).join(', ')}`);
  const pct = [0.01, 0.02, 0.03, 0.05, 0.075, 0.1, 0.15, 0.2, 0.3, 0.5];
  const ints = [1, 2, 3, 4, 6, 8];
  const floats = ['jumpVel', 'runBonus', 'gravityHeld', 'gravityFall', 'walkMax', 'runMax', 'accel', 'airAccel', 'padVel', 'padHeldVel', 'stompVel', 'stompHeldVel'];
  const whole = ['coyoteTicks', 'halfWidth', 'height'];
  const lines = ['| param | default | lowest value that keeps every gate | highest value that keeps every gate | first break going down | first break going up |', '|---|---|---|---|---|---|'];
  for (const k of [...floats, ...whole]) {
    const d = M[k];
    const res = {};
    for (const dir of [-1, 1]) {
      let safe = d;
      let brk = null;
      const steps = whole.includes(k) ? ints.map((n) => n) : pct;
      for (const s of steps) {
        const v = whole.includes(k) ? d + dir * s : Math.round(d * (1 + dir * s) * 10000) / 10000;
        if (v < 0 || (k === 'coyoteTicks' && v < 0)) break;
        const fails = gateSet({ ...M, [k]: v }).filter(([, ok]) => !ok).map(([n]) => n);
        if (fails.length) {
          brk = `${v}: ${fails.join(', ')}`;
          break;
        }
        safe = v;
      }
      res[dir] = { safe, brk };
    }
    lines.push(`| \`${k}\` | ${d} | ${res[-1].safe} | ${res[1].safe} | ${res[-1].brk ?? 'none in range'} | ${res[1].brk ?? 'none in range'} |`);
  }
  console.log(lines.join('\n'));
}

export const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
export const outPath = () => resolve(ROOT, OUT_REL);

function main() {
  if (process.argv.includes('--sensitivity')) return sensitivity();
  const check = process.argv.includes('--check');
  const { markdown } = buildNumbers();
  const target = outPath();
  if (check) {
    const have = existsSync(target) ? read(OUT_REL) : null;
    if (have !== markdown) {
      console.error(`${OUT_REL} is stale or missing. Run: npm run docs:mechanics`);
      process.exit(1);
    }
    console.log(`${OUT_REL} is up to date`);
    return;
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, markdown, 'utf8');
  console.log(`wrote ${OUT_REL} (${markdown.split('\n').length} lines)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
