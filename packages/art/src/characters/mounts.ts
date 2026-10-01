// Mount roster (all face RIGHT, like the hero): frog "Boing Toad" (green), ground dino "Stompadon"
// (terracotta), flying dino "Skydrake" (sky-blue), cheetah "Dashcat" (gold). Every mount has a bare
// variant and a saddled variant, a per-frame rider seat anchor table and rider pose hints.
// OPTIONAL stretch slot: a wolf is NOT included (unconfirmed by the owner).
import type { Bitmap } from '../core';
import { linePoints } from './compose';
import { flipHRows, outlineFor, palFrom, Sprite } from './kit';
import { shadedEllipse } from './shape';
import { shadedLimb } from './compose';
import { buildFxFrames } from './fx';

export type MountName = 'frog' | 'dino' | 'drake' | 'cheetah';
export const MOUNT_NAMES: MountName[] = ['frog', 'dino', 'drake', 'cheetah'];

const SEED: Record<MountName, { body: [number, number, number]; belly: [number, number, number]; accent: [number, number, number] }> = {
  frog: { body: [118, 0.6, 0.44], belly: [60, 0.6, 0.82], accent: [18, 0.85, 0.56] },
  dino: { body: [14, 0.62, 0.5], belly: [44, 0.6, 0.82], accent: [200, 0.65, 0.5] },
  drake: { body: [205, 0.66, 0.54], belly: [50, 0.6, 0.84], accent: [44, 0.92, 0.56] },
  cheetah: { body: [38, 0.85, 0.54], belly: [48, 0.6, 0.86], accent: [24, 0.5, 0.26] },
};

function pal(name: MountName) {
  const s = SEED[name];
  const p = palFrom({}, { ABC: s.body, DEF: s.belly, GHI: s.accent, JKL: [352, 0.7, 0.5] });
  return p;
}
const OUT = outlineFor(['ABC', 'DEF', 'GHI', 'JKL']);

type R3 = [string, string, string];
const BODY: R3 = ['A', 'B', 'C'];
const BELLY: R3 = ['D', 'E', 'F'];
const ACC: R3 = ['G', 'H', 'I'];

function limb(s: Sprite, x0: number, y0: number, x1: number, y1: number, ramp: R3, thick = 3) {
  const pts = linePoints(x0, y0, x1, y1);
  s.put(shadedLimb(s.w, s.h, pts, ramp, thick), 0, 0);
}

function eye(s: Sprite, x: number, y: number, blink = false) {
  if (blink) s.put(['PPP'], x, y + 1);
  else s.put(['WWP', 'WWP', '.PP'].map((r) => r), x, y);
}

export interface MountFrame {
  bitmap: Bitmap;
  seat: [number, number];
  rider: 'sit' | 'lean' | 'grip';
}

interface Built {
  s: Sprite;
  seat: [number, number];
  rider: 'sit' | 'lean' | 'grip';
}

function saddleAt(s: Sprite, seat: [number, number], on: boolean) {
  if (!on) return;
  s.put(['.JJJJJ.', 'JKKKKKL', 'LLLLLLL'], seat[0] - 3, seat[1] - 1);
}

// ---------------- FROG ----------------
interface FrogP {
  sq?: number; // squash (px body lowered)
  legs?: 'fold' | 'jump' | 'fall';
  lift?: number;
  puff?: boolean;
  blink?: boolean;
  open?: boolean;
  tongue?: number; // px length
  saddle: boolean;
}
function frog(p: FrogP): Built {
  const s = new Sprite(34, 28);
  const sq = p.sq ?? 0;
  const lift = p.lift ?? 0;
  const gy = 27 - lift; // ground line
  const by = gy - 14 + sq;
  // back leg (far) + front leg
  if (p.legs === 'jump') {
    limb(s, 8, by + 8, 1, by + 12, BODY, 4);
    s.put(shadedEllipse(7, 3, BODY), 0, by + 11);
  } else if (p.legs === 'fall') {
    limb(s, 9, by + 8, 5, gy - 2, BODY, 4);
    s.put(shadedEllipse(7, 3, BODY), 3, gy - 2);
  } else {
    s.put(shadedEllipse(10, 9 - sq, BODY), 4, gy - 9 + sq);
    s.put(shadedEllipse(9, 3, BODY), 4, gy - 3);
  }
  // body
  s.put(shadedEllipse(22, 14 - sq, BODY, { belly: { ramp: BELLY, minNy: 0.3, minNx: -0.3 } }), 5, by + (p.puff ? 0 : 0));
  if (p.puff) s.put(shadedEllipse(9, 6, BELLY), 17, by + 8);
  // head bulge + eyes
  s.put(shadedEllipse(12, 9, BODY), 19, by + 1);
  eye(s, 20, by - 3, p.blink);
  eye(s, 25, by - 3, p.blink);
  // mouth + nostril
  s.put(p.open ? ['PPPPPP', 'PGGGGP', '.PPPP.'] : ['.PPPPPP'], 24, by + 7);
  s.put(['PP'], 28, by + 3);
  if (p.tongue) {
    s.put(['HHHH'.padEnd(p.tongue, 'H')], 30, by + 8);
    s.put(['GG', 'GG'], 30 + p.tongue - 1, by + 7);
  }
  // front leg
  if (p.legs === 'jump') limb(s, 22, by + 10, 29, by + 12, BODY, 3);
  else if (p.legs === 'fall') limb(s, 22, by + 10, 28, gy - 2, BODY, 3);
  else {
    s.put(shadedEllipse(6, 7 - Math.floor(sq / 2), BODY), 21, gy - 7 + Math.floor(sq / 2));
    s.put(shadedEllipse(7, 3, BODY), 21, gy - 3);
  }
  const seat: [number, number] = [14, by + 1];
  saddleAt(s, seat, p.saddle);
  return { s, seat, rider: 'sit' };
}

// ---------------- DINO (ground) ----------------
interface DinoP {
  step?: number; // 0..3 trot phase
  bob?: number;
  lean?: number; // charge lean (px head drop)
  mouth?: boolean;
  lift?: number;
  legs?: 'trot' | 'tuck' | 'spread';
  saddle: boolean;
  pound?: boolean;
}
function dino(p: DinoP): Built {
  const s = new Sprite(40, 32);
  const bob = p.bob ?? 0;
  const lift = p.lift ?? 0;
  const gy = 31 - lift;
  const by = gy - 19 + bob;
  const lean = p.lean ?? 0;
  // tail
  limb(s, 6, by + 8, 0, by + 12 + lean, BODY, 4);
  // back plates (accent)
  for (const x of [10, 15, 20]) s.put(['.G.', 'GGH', 'GHH'], x, by - 3);
  // legs far
  const ph = p.step ?? 0;
  const legSet = p.legs === 'tuck' ? [[-3, -3], [3, -3]] : p.legs === 'spread' ? [[-6, 0], [6, 0]] : [[[-2, 0], [2, -2], [0, 0], [-2, -2]][ph], [[2, -2], [-2, 0], [0, -2], [2, 0]][ph]];
  const leg = (x: number, dx: number, lf: number, ramp: R3) => {
    const top = by + 12;
    const foot = gy - 1 - (p.legs === 'tuck' ? 3 : Math.max(0, -lf));
    limb(s, x, top, x + dx, foot - 2, ramp, 4);
    s.put(['HHH', 'HHH'], x + dx - 1, foot - 1 > gy - 2 ? gy - 2 : foot - 1);
  };
  leg(10, legSet[1][0], legSet[1][1], BODY);
  leg(22, legSet[0][0], legSet[0][1], BODY);
  // body
  s.put(shadedEllipse(26, 18, BODY, { belly: { ramp: BELLY, minNy: 0.35, minNx: -0.2 } }), 5, by);
  // neck + head
  s.put(shadedEllipse(12, 12, BODY), 23, by - 2 + lean);
  s.put(shadedEllipse(13, 11, BODY), 26, by + 1 + lean);
  s.put(['.G.', 'GHG', 'GH.'], 35, by - 2 + lean); // nose horn
  eye(s, 28, by + 1 + lean);
  s.put(p.mouth ? ['PPPP', 'PGGP', '.PP.'] : ['PPPPP'], 30, by + 8 + lean);
  // arm
  s.put(['BB', 'BC'], 27, by + 11);
  limb(s, 14, by + 12, 13 + legSet[0][0], gy - 3, BODY, 4);
  s.put(['HHH', 'HHH'], 12 + legSet[0][0], gy - 2);
  const seat: [number, number] = [14, by + 1];
  saddleAt(s, seat, p.saddle);
  return { s, seat, rider: p.lean ? 'lean' : 'sit' };
}

// ---------------- DRAKE (flying) ----------------
const WING_UP = [
  '..........GG..',
  '.........GHH..',
  '........GHHH..',
  '.......GHHHH..',
  '......GHHHHH..',
  '.....GHHHHHH..',
  '....GGHHHHHH..',
  '...G.GHHHHH...',
  '..G..GHHHH....',
  '.G...GHH......',
];
const WING_MID = [
  '.........GG...',
  '.......GGHHH..',
  '....GGGHHHHH..',
  '..GGGHHHHHHH..',
  '.G.GHHHHHHH...',
  'G..GHHHHHH....',
  '...GHHHH......',
  '....GH........',
];
const WING_DOWN = [
  '.........G....',
  '........GH....',
  '.......GHH....',
  '.....GGHHH....',
  '....GHHHHH....',
  '..GGHHHHHH....',
  '.GHHHHHHH.....',
  'GHHHHHHH......',
  'GG.HHHH.......',
  '...GHH........',
];
const WING_GLIDE = [
  'GGGGGGGGGGGGGGGGG',
  '.GHHHHHHHHHHHHHG.',
  '..GHHHHHHHHHHHG..',
  '...GG.HHHHHH.GG..',
];
function drake(p: { wing: 'up' | 'mid' | 'down' | 'glide' | 'fold'; bob?: number; saddle: boolean; lift?: number; legs?: boolean; mouth?: boolean; lean?: number }): Built {
  const s = new Sprite(44, 34);
  const bob = p.bob ?? 0;
  const by = 15 + bob;
  const lean = p.lean ?? 0;
  // far wing behind
  const W = { up: WING_UP, mid: WING_MID, down: WING_DOWN, glide: WING_GLIDE, fold: ['GG.', 'GHH', '.HH'] }[p.wing];
  if (p.wing === 'glide') s.put(W, 4, by - 4);
  else if (p.wing !== 'fold') s.put(W, 4, p.wing === 'down' ? by - 1 : by - 11 + (p.wing === 'mid' ? 4 : 0));
  // tail
  limb(s, 8, by + 4, 0, by + 8 - lean, BODY, 3);
  s.put(['.GG', 'GGH', '.GG'], 0, by + 6 - lean);
  // body
  s.put(shadedEllipse(22, 12, BODY, { belly: { ramp: BELLY, minNy: 0.3, minNx: -0.2 } }), 7, by);
  // legs tucked
  if (p.legs !== false) {
    limb(s, 16, by + 10, 15, by + 15, BODY, 3);
    limb(s, 23, by + 10, 25, by + 15, BODY, 3);
    s.put(['HHH'], 14, by + 15);
    s.put(['HHH'], 24, by + 15);
  }
  // neck + head
  limb(s, 27, by + 3, 31, by - 3 + lean, BODY, 4);
  s.put(shadedEllipse(11, 9, BODY), 29, by - 7 + lean);
  s.put(['.GG.', 'GHHH', 'GH..'], 37, by - 6 + lean); // beak crest
  s.put(['.GGG', 'GGH.', 'GH..'], 29, by - 11 + lean); // head crest
  eye(s, 32, by - 6 + lean);
  s.put(p.mouth ? ['PPPP', 'PGGP'] : ['PPPP'], 35, by - 1 + lean);
  // near wing in front (flap)
  if (p.wing === 'up') s.put(WING_UP.slice(3), 10, by - 6);
  else if (p.wing === 'down') s.put(WING_DOWN.slice(4), 10, by + 3);
  else if (p.wing === 'mid') s.put(WING_MID.slice(2), 10, by - 3);
  else if (p.wing === 'glide') s.put(WING_GLIDE.slice(1), 14, by + 1);
  const seat: [number, number] = [18, by - 2];
  saddleAt(s, seat, p.saddle);
  return { s, seat, rider: 'grip' };
}

// ---------------- CHEETAH ----------------
interface CatP {
  pose: 'stand' | 'reach' | 'gather' | 'leap' | 'fall' | 'crouch' | 'dash';
  bob?: number;
  saddle: boolean;
  mouth?: boolean;
  lift?: number;
}
function cheetah(p: CatP): Built {
  const s = new Sprite(46, 26);
  const gy = 25 - (p.lift ?? 0);
  const bob = p.bob ?? 0;
  const crouch = p.pose === 'crouch' ? 3 : 0;
  const by = gy - 13 + bob + crouch;
  // tail (curl up)
  limb(s, 7, by + 4, 1, by - 2, BODY, 3);
  s.put(['PP'], 0, by - 4);
  // leg poses: [backX, backFootX, frontX, frontFootX, footY offsets]
  const L: Record<string, [number, number, number, number]> = {
    stand: [0, 0, 0, 0],
    reach: [-7, -5, 7, 5],
    gather: [5, 4, -5, -4],
    leap: [-9, -6, 10, 6],
    fall: [3, 2, 4, 3],
    crouch: [-2, -2, 2, 2],
    dash: [-9, -6, 10, 6],
  };
  const [bx, bfx, fx, ffx] = L[p.pose];
  const airborne = p.pose === 'leap' || p.pose === 'dash' || p.pose === 'fall';
  const footY = (up: number) => (airborne ? by + 12 + up : gy - 2);
  // far legs
  limb(s, 11, by + 8, 11 + bx + 2, footY(0), BODY, 3);
  limb(s, 28, by + 8, 28 + fx + 2, footY(0), BODY, 3);
  // body
  s.put(shadedEllipse(28, 11, BODY, { belly: { ramp: BELLY, minNy: 0.4, minNx: -0.3 } }), 6, by);
  // spots
  for (const [x, y] of [[12, 2], [16, 4], [20, 2], [24, 4], [14, 7], [19, 7], [9, 5]]) {
    s.put(['HH', 'HH'.replace('H', 'I')], x, by + y);
  }
  // near legs
  limb(s, 9, by + 8, 9 + bfx, footY(1), BODY, 3);
  limb(s, 26, by + 8, 26 + ffx, footY(1), BODY, 3);
  s.put(['HHH'], 8 + bfx, footY(1) + 1);
  s.put(['HHH'], 25 + ffx, footY(1) + 1);
  // head + neck
  limb(s, 30, by + 3, 33, by - 1, BODY, 4);
  s.put(shadedEllipse(11, 9, BODY), 33, by - 4 + crouch / 3);
  s.put(['.G.', 'GHG'], 34, by - 6); // ears
  s.put(['.G.', 'GHG'], 38, by - 6);
  eye(s, 37, by - 2);
  s.put(['II', '.I'], 36, by + 1); // tear line
  s.put(p.mouth ? ['PPP', 'PGP'] : ['PPP'], 40, by + 3);
  s.put(['PP'], 43, by - 1);
  if (p.pose === 'dash') {
    for (const [x, y, l] of [[0, by + 1, 8], [0, by + 6, 6], [2, by + 10, 5]]) s.put(['W'.repeat(l)], x, y);
  }
  const seat: [number, number] = [18, by + 1];
  saddleAt(s, seat, p.saddle);
  return { s, seat, rider: p.pose === 'dash' || p.pose === 'leap' || p.pose === 'reach' ? 'lean' : 'sit' };
}

// ------------------------------------------------------------------------------------------
export interface MountAnim {
  frames: string[];
  fps: number;
  loop: boolean;
  ticks: number[];
}

type Maker = (saddle: boolean) => Built;
const SPEC: Record<MountName, Record<string, Maker[]>> = {
  frog: {
    idle: [(sd) => frog({ saddle: sd }), (sd) => frog({ saddle: sd, puff: true, blink: false })],
    hop: [(sd) => frog({ saddle: sd, sq: 3 }), (sd) => frog({ saddle: sd, legs: 'jump', lift: 4 }), (sd) => frog({ saddle: sd, legs: 'jump', lift: 6 }), (sd) => frog({ saddle: sd, legs: 'fall', lift: 3 })],
    jump: [(sd) => frog({ saddle: sd, legs: 'jump', lift: 6 })],
    fall: [(sd) => frog({ saddle: sd, legs: 'fall', lift: 5 })],
    land: [(sd) => frog({ saddle: sd, sq: 4 }), (sd) => frog({ saddle: sd, sq: 2 })],
    charge: [(sd) => frog({ saddle: sd, sq: 4, puff: true }), (sd) => frog({ saddle: sd, sq: 5, puff: true, open: false })],
    superjump: [(sd) => frog({ saddle: sd, legs: 'jump', lift: 9, open: true })],
    tongue: [(sd) => frog({ saddle: sd, tongue: 6, open: true }), (sd) => frog({ saddle: sd, tongue: 14, open: true })],
  },
  dino: {
    idle: [(sd) => dino({ saddle: sd }), (sd) => dino({ saddle: sd, bob: 1 })],
    trot: [0, 1, 2, 3].map((i) => (sd: boolean) => dino({ saddle: sd, step: i, bob: i % 2 })),
    jump: [(sd) => dino({ saddle: sd, legs: 'tuck', lift: 5 })],
    fall: [(sd) => dino({ saddle: sd, legs: 'spread', lift: 4, mouth: true })],
    land: [(sd) => dino({ saddle: sd, bob: 3, legs: 'spread' }), (sd) => dino({ saddle: sd, bob: 1 })],
    charge: [(sd) => dino({ saddle: sd, lean: 3, step: 0 }), (sd) => dino({ saddle: sd, lean: 4, step: 2, bob: 1, mouth: true })],
    pound: [(sd) => dino({ saddle: sd, legs: 'tuck', lift: 7 }), (sd) => dino({ saddle: sd, bob: 4, legs: 'spread' })],
  },
  drake: {
    idle: [(sd) => drake({ saddle: sd, wing: 'fold' }), (sd) => drake({ saddle: sd, wing: 'fold', bob: 1 })],
    flap: [(sd) => drake({ saddle: sd, wing: 'up' }), (sd) => drake({ saddle: sd, wing: 'mid', bob: 1 }), (sd) => drake({ saddle: sd, wing: 'down', bob: 2 }), (sd) => drake({ saddle: sd, wing: 'mid', bob: 1 })],
    glide: [(sd) => drake({ saddle: sd, wing: 'glide', lean: 1, legs: false })],
    jump: [(sd) => drake({ saddle: sd, wing: 'up' })],
    fall: [(sd) => drake({ saddle: sd, wing: 'glide', lean: 2, legs: false })],
    land: [(sd) => drake({ saddle: sd, wing: 'fold', bob: 3 }), (sd) => drake({ saddle: sd, wing: 'fold', bob: 1 })],
  },
  cheetah: {
    idle: [(sd) => cheetah({ pose: 'stand', saddle: sd }), (sd) => cheetah({ pose: 'stand', saddle: sd, bob: 1 })],
    gallop: [(sd) => cheetah({ pose: 'reach', saddle: sd, lift: 2 }), (sd) => cheetah({ pose: 'fall', saddle: sd, bob: 1 }), (sd) => cheetah({ pose: 'gather', saddle: sd, bob: 1 }), (sd) => cheetah({ pose: 'leap', saddle: sd, lift: 2 })],
    jump: [(sd) => cheetah({ pose: 'leap', saddle: sd, lift: 4 })],
    fall: [(sd) => cheetah({ pose: 'fall', saddle: sd, lift: 4, mouth: true })],
    land: [(sd) => cheetah({ pose: 'crouch', saddle: sd }), (sd) => cheetah({ pose: 'stand', saddle: sd, bob: 1 })],
    dash: [(sd) => cheetah({ pose: 'dash', saddle: sd, lift: 2 }), (sd) => cheetah({ pose: 'dash', saddle: sd, lift: 3, mouth: true })],
  },
};

const TICKS: Record<string, number> = { idle: 30, hop: 7, trot: 7, flap: 6, gallop: 4, glide: 30, jump: 15, fall: 15, land: 6, charge: 8, superjump: 15, tongue: 6, pound: 8, dash: 4 };
const LOOPS = new Set(['idle', 'hop', 'trot', 'flap', 'gallop', 'dash', 'charge']);

/** MOUNT_ANIMS[mount][anim] -> frame names `mount_<mount>/<anim>_<i>` (bare) — saddled uses prefix `mountr_`. */
export const MOUNT_ANIMS: Record<MountName, Record<string, MountAnim>> = {} as never;
/** Seat anchor per frame (saddle top-centre, frame px, pre-flip) + suggested rider pose. Bare and saddled share anchors. */
export const MOUNT_ANCHORS: Record<string, { seat: [number, number]; rider: 'sit' | 'lean' | 'grip' }> = {};

for (const m of MOUNT_NAMES) {
  for (const [an, makers] of Object.entries(SPEC[m])) makers.forEach((mk, i) => { const b = mk(false); const v: { seat: [number, number]; rider: 'sit' | 'lean' | 'grip' } = { seat: [b.seat[0] + 1, b.seat[1] + 1], rider: b.rider }; MOUNT_ANCHORS[`mount_${m}/${an}_${i}`] = v; MOUNT_ANCHORS[`mountr_${m}/${an}_${i}`] = v; });
  for (let i = 0; i < 3; i++) { MOUNT_ANCHORS[`mount_${m}/summon_in_${i}`] = MOUNT_ANCHORS[`mount_${m}/idle_0`]; MOUNT_ANCHORS[`mount_${m}/summon_out_${i}`] = MOUNT_ANCHORS[`mount_${m}/idle_0`]; }
  (MOUNT_ANIMS as Record<string, Record<string, MountAnim>>)[m] = {};
  for (const [a, makers] of Object.entries(SPEC[m])) {
    const t = TICKS[a] ?? 8;
    (MOUNT_ANIMS[m] as Record<string, MountAnim>)[a] = {
      frames: makers.map((_, i) => `mount_${m}/${a}_${i}`),
      fps: Math.round((60 / t) * 10) / 10,
      loop: LOOPS.has(a),
      ticks: makers.map(() => t),
    };
  }
  (MOUNT_ANIMS[m] as Record<string, MountAnim>).summon_in = { frames: [0, 1, 2].map((i) => `mount_${m}/summon_in_${i}`), fps: 12, loop: false, ticks: [5, 5, 5] };
  (MOUNT_ANIMS[m] as Record<string, MountAnim>).summon_out = { frames: [0, 1, 2].map((i) => `mount_${m}/summon_out_${i}`), fps: 12, loop: false, ticks: [5, 5, 5] };
}

function shrinkY(b: Bitmap, keep: number): Bitmap {
  const h = Math.max(3, Math.round(b.h * keep));
  const out = { w: b.w, h: b.h, data: new Uint8ClampedArray(b.data.length) };
  for (let y = 0; y < h; y++) {
    const sy = Math.min(b.h - 1, Math.floor((y * b.h) / h));
    const dy = b.h - h + y; // bottom-anchored
    out.data.set(b.data.subarray(sy * b.w * 4, (sy + 1) * b.w * 4), dy * b.w * 4);
  }
  return out;
}

function poofOver(base: Bitmap, fx: Bitmap): Bitmap {
  // centre the FX puff on the bottom-middle of the base frame
  const out = { w: Math.max(base.w, fx.w), h: Math.max(base.h, fx.h), data: new Uint8ClampedArray(Math.max(base.w, fx.w) * Math.max(base.h, fx.h) * 4) };
  const put = (b: Bitmap, ox: number, oy: number) => {
    for (let y = 0; y < b.h; y++)
      for (let x = 0; x < b.w; x++) {
        const s = (y * b.w + x) * 4;
        if (b.data[s + 3] === 0) continue;
        out.data.set(b.data.subarray(s, s + 4), ((y + oy) * out.w + x + ox) * 4);
      }
  };
  return (put(base, Math.floor((out.w - base.w) / 2), out.h - base.h), out.data.length ? out : out);
}
void poofOver;

/** Frames for one mount: bare (`mount_<m>/…`) and saddled (`mountr_<m>/…`), with the puff-in/out frames. */
export function buildMountFrames(m: MountName): Record<string, Bitmap> {
  const out: Record<string, Bitmap> = {};
  const palette = pal(m);
  const fx = buildFxFrames();
  for (const [a, makers] of Object.entries(SPEC[m])) {
    makers.forEach((mk, i) => {
      for (const saddle of [false, true]) {
        const b = mk(saddle);
        const name = `${saddle ? 'mountr' : 'mount'}_${m}/${a}_${i}`;
        out[name] = b.s.bitmap(OUT, palette);
        if (!saddle) MOUNT_ANCHORS[`mount_${m}/${a}_${i}`] = { seat: [b.seat[0] + 1, b.seat[1] + 1], rider: b.rider };
        else MOUNT_ANCHORS[`mountr_${m}/${a}_${i}`] = { seat: [b.seat[0] + 1, b.seat[1] + 1], rider: b.rider };
      }
    });
  }
  // summon: puff grows a mount out of the cloud
  const idle = out[`mount_${m}/idle_0`];
  const puffs = [fx['fx/poof_1'], fx['fx/poof_2'], fx['fx/poof_3']];
  for (let i = 0; i < 3; i++) {
    const keep = [0.45, 0.75, 1][i];
    const body = i === 2 ? idle : shrinkY(idle, keep);
    const comp = compositeCentered(body, i === 2 ? null : puffs[i]);
    out[`mount_${m}/summon_in_${i}`] = comp;
    out[`mount_${m}/summon_out_${2 - i}`] = comp;
    MOUNT_ANCHORS[`mount_${m}/summon_in_${i}`] = { seat: [MOUNT_ANCHORS[`mount_${m}/idle_0`].seat[0], MOUNT_ANCHORS[`mount_${m}/idle_0`].seat[1]], rider: 'sit' };
    MOUNT_ANCHORS[`mount_${m}/summon_out_${2 - i}`] = MOUNT_ANCHORS[`mount_${m}/summon_in_${i}`];
  }
  return out;
}

function compositeCentered(body: Bitmap, fx: Bitmap | null): Bitmap {
  const w = Math.max(body.w, fx?.w ?? 0);
  const h = Math.max(body.h, fx?.h ?? 0);
  const out = { w: body.w, h: body.h, data: new Uint8ClampedArray(body.w * body.h * 4) };
  void w;
  void h;
  out.data.set(body.data);
  if (fx) {
    // overlay the cloud (cropped/centred to body size), behind-most pixels only where body is empty
    const ox = Math.floor((fx.w - body.w) / 2);
    const oy = Math.floor((fx.h - body.h) / 2) + 6;
    for (let y = 0; y < body.h; y++)
      for (let x = 0; x < body.w; x++) {
        const fxp = ((y + oy) * fx.w + x + ox) * 4;
        if (x + ox < 0 || y + oy < 0 || x + ox >= fx.w || y + oy >= fx.h || fx.data[fxp + 3] === 0) continue;
        if (out.data[(y * body.w + x) * 4 + 3] === 0) out.data.set(fx.data.subarray(fxp, fxp + 4), (y * body.w + x) * 4);
      }
  }
  return out;
}

export function buildAllMountFrames(): Record<MountName, Record<string, Bitmap>> {
  const o = {} as Record<MountName, Record<string, Bitmap>>;
  for (const m of MOUNT_NAMES) o[m] = buildMountFrames(m);
  return o;
}

export const MOUNT_PALETTES = Object.fromEntries(MOUNT_NAMES.map((m) => [m, pal(m)]));
export { flipHRows };
