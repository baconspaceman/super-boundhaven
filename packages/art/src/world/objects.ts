// Gameplay-object art: one-way platforms, spikes, gates, plates, levers, checkpoint flags, shards.
// Browser-safe + deterministic. Colour language (north star: gameplay layer = highest contrast):
//   gold  (s/S/A)  = "needs action" (locked lock, waiting plate, timer ring)
//   cyan  (a/b/k)  = "powered / done" (pressed plate, open gate, lit emblem)
//   coral (r/R)    = lever knobs + hazards (spike base stripes)
//   structure (stone x/y/z/w, timber p/q/c) is tinted per region; the warm/cool accents stay identical everywhere
//   so a player reads them instantly in any biome.
import { packSheet, type AtlasEntry, type Bitmap, type Palette } from '../core';
import { buildFxFrames, FX_PAL } from '../characters/fx';
import { Canvas, outlineOuter, tintSunset } from './paint';
import type { RegionId } from './tileset';

const S = 16;

/** Accent colours shared by every region (identical hexes => identical meaning everywhere). */
const ACCENT: Palette = {
  t: '#fff6ea', // near-white
  s: '#ffe44a', // gold bright
  S: '#ffb02e', // gold mid
  A: '#d86a1c', // gold shade (amber)
  r: '#ff5a6e', // coral
  R: '#b8284e', // coral dark
  e: '#f4f8ff', // steel light
  f: '#a8c0e8', // steel mid
  g: '#5878b0', // steel dark
  a: '#5fddbf', // cyan light  (matches the shard ramp)
  b: '#24cfdb', // cyan mid
  k: '#165f79', // cyan dark
  u: '#c9b8ff', // idle banner light (indigo: clearly not grey, clearly not the gold of an active flag)
  v: '#8a74f0', // idle banner mid
  m: '#4d3bb8', // idle banner dark
};

const OBJ_PAL: Record<'meadow' | 'caverns', Palette> = {
  meadow: {
    ...ACCENT,
    O: '#2c2148', // outline (hue-matched to the tile outlines, never pure black)
    x: '#dcdcf0', // stone light
    y: '#9a9ec8',
    z: '#5e6298',
    w: '#3a3a72', // stone deepest (gate interior)
    p: '#fbd77c', // timber light
    q: '#d68a40',
    c: '#7c4850',
  },
  caverns: {
    ...ACCENT,
    O: '#180f3c',
    x: '#c4d2f0',
    y: '#8090c4',
    z: '#4c5690',
    w: '#241e5c',
    p: '#b89484',
    q: '#846058',
    c: '#483a88',
  },
};

function palFor(region: RegionId): Palette {
  if (region === 'caverns') return OBJ_PAL.caverns;
  if (region === 'meadow') return OBJ_PAL.meadow;
  // sunset = same warm grade as the sunset tileset (applied to every slot)
  return Object.fromEntries(Object.entries(OBJ_PAL.meadow).map(([k, v]) => [k, v ? tintSunset(v) : v]));
}

// ---------------------------------------------------------------- helpers
function sheet(pal: Palette, w = S, h = S): Canvas {
  return new Canvas(w, h, pal);
}

/** ASCII rows -> canvas (rows may be fewer than h: the rest stays empty). Strict widths catch typos. */
function ascii(pal: Palette, rows: string[], w = S, h = S, yOff = 0): Canvas {
  const c = sheet(pal, w, h);
  rows.forEach((r, j) => {
    if (r.length !== w) throw new Error(`objects: row ${j} has width ${r.length}, expected ${w}: "${r}"`);
    c.stamp(0, yOff + j, [r]);
  });
  return c;
}

function plus(c: Canvas, cx: number, cy: number, r: number, ink: string, core?: string): void {
  for (let i = -r; i <= r; i++) {
    c.px(cx + i, cy, ink);
    c.px(cx, cy + i, ink);
  }
  if (core) c.px(cx, cy, core);
}

// ---------------------------------------------------------------- one-way platforms
// A thin pale slatted lip with visible gaps + two hanging pegs: reads "ledge you can drop through",
// never confusable with the thick solid timber platform tiles.
function onewayMid(pal: Palette): Canvas {
  return ascii(pal, [
    'OOOOOOOOOOOOOOOO',
    'ttttqttttqtttqtt',
    'ppppcppppcpppcpp',
    'qqqqcqqqqcqqqcqq',
    'OOOOOOOOOOOOOOOO',
    '.OqO........OqO.',
    '.OqO........OqO.',
    '..O..........O..',
  ]);
}
function onewayLeft(pal: Palette): Canvas {
  const c = onewayMid(pal);
  c.clear(0, 0);
  c.clear(0, 4);
  for (let y = 1; y <= 3; y++) c.px(0, y, 'O');
  c.px(1, 1, 't');
  return c;
}

// ---------------------------------------------------------------- spikes
function spike(pal: Palette, glint: boolean): Canvas {
  const c = sheet(pal);
  const tops = 1;
  const base = 12;
  // slate-steel blades (not white): lit left edge, dark right edge, coral tips so the hazard reads at a glance
  for (const cx of [2.5, 8.5, 13.5]) {
    for (let y = tops; y < base; y++) {
      const hw = Math.min(2.5, 0.5 + (y - tops) * 0.22);
      for (let x = 0; x < S; x++) {
        const d = x + 0.5 - cx;
        if (Math.abs(d) > hw) continue;
        c.px(x, y, d < -0.6 ? 'f' : d > 0.4 ? 'g' : 'y');
      }
    }
    for (let y = tops; y < tops + 3; y++) c.px(Math.floor(cx), y, y === tops ? 't' : 'r');
    c.px(Math.floor(cx) + 1, tops + 2, 'R');
  }
  outlineOuter(c, 'O');
  // hazard base: coral stripes
  for (let x = 0; x < S; x++) {
    c.px(x, 12, 'O');
    c.px(x, 13, x % 4 < 2 ? 'r' : 'R');
    c.px(x, 14, (x + 2) % 4 < 2 ? 'r' : 'R');
    c.px(x, 15, 'O');
  }
  if (glint) {
    // moving glint: highlight streak down the second spike + tiny sparkle
    for (let y = 4; y <= 7; y++) c.px(8, y, 'e');
    plus(c, 8, 0, 1, 't');
  }
  return c;
}

// ---------------------------------------------------------------- gate (carved stone + glowing coil lock)
const DOOR_NORMAL = 'OxyOwxywwxywOyzO';
const DOOR_DASH = 'OxyOwxysSxywOyzO';
const DOOR_BAR = ['OxyOxxxxxxxxOyzO', 'OxyOyyyyyyyyOyzO', 'OxyOzzzzzzzzOyzO'];

function doorMid(pal: Palette): Canvas {
  const rows: string[] = [];
  for (let y = 0; y < S; y++) {
    if (y >= 7 && y <= 9) rows.push(DOOR_BAR[y - 7]);
    else if ((y >= 3 && y <= 5) || (y >= 11 && y <= 13)) rows.push(DOOR_DASH);
    else rows.push(DOOR_NORMAL);
  }
  return ascii(pal, rows);
}
function doorCap(pal: Palette): Canvas {
  const rows = [
    '.OOOOOOOOOOOOOO.',
    'OxxxxxxxxxxxxxyO',
    'OxyyyyyyyyyyyyzO',
    'OxyyyOOOOOOyyzzO',
    'OxyyyOtssSOyyzzO',
    'OxyyyOsOOAOyyzzO',
    'OxyyyOSAAAOyyzzO',
    'OxyyyOOOOOOyyzzO',
    'OxyOzzzzzzzzOyzO',
    DOOR_NORMAL,
    DOOR_NORMAL,
    DOOR_DASH,
    DOOR_DASH,
    DOOR_DASH,
    DOOR_NORMAL,
    DOOR_NORMAL,
  ];
  return ascii(pal, rows);
}
function doorBase(pal: Palette): Canvas {
  const rows = [
    DOOR_NORMAL,
    DOOR_NORMAL,
    DOOR_NORMAL,
    'OxyOwOOOOOOwOyzO',
    'OxyOwOtssSOwOyzO',
    'OxyOwOsOOAOwOyzO',
    'OxyOwOSAAAOwOyzO',
    'OxyOwOOOOOOwOyzO',
    DOOR_NORMAL,
    DOOR_NORMAL,
    DOOR_NORMAL,
    'OxxxxxxxxxxxxxyO',
    'OxyyyyyyyyyyyyzO',
    'OyyyyyyyyyyyyzzO',
    'OzzzzzzzzzzzzzzO',
    'OOOOOOOOOOOOOOOO',
  ];
  return ascii(pal, rows);
}
/** Stone pillars either side of an open passage, lit by a cyan seam; `y0..y1` rows. */
function openPillars(c: Canvas, y0: number, y1: number): void {
  for (let y = y0; y <= y1; y++) {
    c.px(0, y, 'O');
    c.px(1, y, 'x');
    c.px(2, y, 'y');
    c.px(3, y, 'O');
    c.px(4, y, 'k');
    c.px(11, y, 'k');
    c.px(12, y, 'O');
    c.px(13, y, 'y');
    c.px(14, y, 'z');
    c.px(15, y, 'O');
  }
}

/** Open gate, top tile: the lintel keeps its lock (turned cyan = unlocked) over an empty passage, the raised bars show as teeth. */
function doorOpenCap(pal: Palette): Canvas {
  const c = ascii(pal, [
    '.OOOOOOOOOOOOOO.',
    'OxxxxxxxxxxxxxyO',
    'OxyyyyyyyyyyyyzO',
    'OxyyyOOOOOOyyzzO',
    'OxyyyOtbbkOyyzzO',
    'OxyyyObOOkOyyzzO',
    'OxyyyOkkkkOyyzzO',
    'OxyyyOOOOOOyyzzO',
    'OzzzzzzzzzzzzzzO',
  ]);
  openPillars(c, 9, 15);
  for (const x of [5, 7, 9, 11]) {
    c.px(x, 9, 'z');
    c.px(x, 10, 'O');
  }
  return c;
}

/** Open gate, every other tile: just the two pillars and the cyan seams, with light drifting up the passage. */
function doorOpen(pal: Palette, shimmer: number): Canvas {
  const c = sheet(pal);
  openPillars(c, 0, 15);
  const ry = (15 - shimmer * 4) & 15;
  for (const x of [4, 11]) {
    c.px(x, ry, 'a');
    c.px(x, (ry + 1) & 15, 'b');
  }
  c.px(6 + (shimmer % 2) * 3, (ry + 6) & 15, 'a');
  c.px(9 - (shimmer % 2) * 3, (ry + 11) & 15, 'b');
  return c;
}

// ---------------------------------------------------------------- pressure plate (bottom 8 px)
const SLAB = ['OxxxxxxxxxxxxxyO', 'OxyyyyyyyyyyyyzO', 'OyyyyyyyyyyyyzzO', 'OOOOOOOOOOOOOOOO'];
function plateUp(pal: Palette): Canvas {
  return ascii(pal, ['..OOOOOOOOOOOO..', '.OtsssssssssSSO.', '.OSSSSSSSSSSAAO.', '..OOOOOOOOOOOO..', ...SLAB], S, S, 8);
}
function plateDown(pal: Palette): Canvas {
  const c = sheet(pal);
  c.stamp(0, 12, ['OxxOOOOOOOOOOxyO', 'OxyOaaaaaaaaOyzO', 'OxyObbbbbbbbOyzO', 'OOOOOOOOOOOOOOOO']);
  return c;
}
function plateGlow(pal: Palette, f: number): Canvas {
  const c = sheet(pal);
  // pulsing arch just above the pressed pad + rising sparkles
  const widths = [5, 8, 10, 7];
  const w = widths[f];
  const x0 = 8 - Math.floor(w / 2);
  for (let i = 0; i < w; i++) c.px(x0 + i, 11, i === 0 || i === w - 1 ? 'b' : 'a');
  if (f >= 1) for (let i = 2; i < w - 2; i++) c.px(x0 + i, 10, 'b');
  const sp: [number, number][][] = [
    [[4, 8], [11, 9]],
    [[3, 6], [12, 7], [8, 5]],
    [[5, 3], [10, 4], [13, 6]],
    [[7, 2], [3, 4], [12, 3]],
  ];
  for (const [x, y] of sp[f]) plus(c, x, y, f === 1 || f === 2 ? 1 : 0, 'a', 't');
  return c;
}

// ---------------------------------------------------------------- levers
function leverBase(pal: Palette): Canvas {
  const c = sheet(pal);
  c.stamp(0, 11, [
    '...OOOOOOOOOO...',
    '..OxxxxxxxxxyO..',
    '.OxyyyyyyyyyyzO.',
    '.OyyyyyyyyyyzzO.',
    '.OOOOOOOOOOOOOO.',
  ]);
  // gold pivot plate
  c.stamp(6, 12, ['OOOO', 'OtsO', 'OSAO']);
  return c;
}
/** `on`: knob cyan ("powered", same language as plates and gates); off: coral. */
function leverArm(pal: Palette, tipX: number, tipY: number, on: boolean): Canvas {
  const c = leverBase(pal);
  // chunky 3 px arm from the pivot up to the knob: dark rim, lit core
  const ax = tipX + 1;
  const ay = tipY + 3;
  c.line(8, 11, ax, ay, 'g');
  c.line(7, 11, ax - 1, ay, 'f');
  c.line(9, 11, ax + 1, ay, 'g');
  c.line(8, 10, ax, ay - 1, 'e');
  // knob 6x6 ball with a bright highlight
  const k = on
    ? ['..tabb.', '.tabbbk', 'abbbbbk', 'bbbbbkk', 'bbbbkkk', '.bkkkk.', '..kkk..']
    : ['..ttrr.', '.trrrrR', 'trrrrrR', 'rrrrrRR', 'rrrrRRR', '.rRRRR.', '..RRR..'];
  c.stamp(ax - 3, tipY - 3, k);
  outlineOuter(c, 'O', (_x, y) => y <= 10);
  return c;
}
function leverReset(pal: Palette): Canvas {
  const c = leverBase(pal);
  c.vline(7, 9, 3, 'f');
  c.vline(8, 9, 3, 'g');
  // knob: cyan ball 10 wide, circular arrow in white
  const cx = 8;
  const cy = 5;
  for (let y = 0; y < 11; y++)
    for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.hypot(dx, dy);
      if (d > 5) continue;
      const lit = -dx * 0.6 - dy * 0.8;
      c.px(x, y, lit > 2.5 ? 'a' : lit > -1.5 ? 'b' : 'k');
    }
  const ring: [number, number][] = [[1, 0], [2, 0], [0, 1], [0, 2], [4, 2], [0, 3], [4, 3], [1, 4], [2, 4], [3, 4], [3, 0], [4, 0], [4, 1]];
  for (const [x, y] of ring) c.px(cx - 2 + x, cy - 2 + y, 't');
  outlineOuter(c, 'O', (_x, y) => y <= 10);
  return c;
}
function leverTimer(pal: Palette, k: number): Canvas {
  const c = sheet(pal);
  const frac = (6 - k) / 6; // k=0 full ring ... k=5 last sixth
  const cx = 8;
  const cy = 7.5;
  const ink = k <= 2 ? 's' : k <= 4 ? 'S' : 'r';
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.hypot(dx, dy);
      if (d < 5.7 || d > 7.3) continue;
      const ang = (Math.atan2(dx, -dy) / (Math.PI * 2) + 1) % 1; // 0 = top, clockwise
      c.px(x, y, ang <= frac ? ink : 'w');
    }
  outlineOuter(c, 'O', (x, y) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > 7.3);
  return c;
}

// ---------------------------------------------------------------- checkpoint flag (16x32, anchor bottom-center)
const FLAG_BASE = ['..OOOOOOOOOOOO..', '.OxxxxxxxxxxxyO.', '.OxyyyyyyyyyyzO.', 'OyyyyyyyyyyyyzzO', 'OOOOOOOOOOOOOOOO'];
function flag(pal: Palette, active: boolean, f: number): Canvas {
  const W = 16;
  const H = 32;
  const c = new Canvas(W, H, pal);
  const amp = active ? 1.5 : 1.1;
  // pole
  for (let y = 5; y <= 27; y++) {
    c.px(4, y, 'f');
    c.px(5, y, 'g');
  }
  // finial
  const fin = active ? ['.ss.', 'tssS', 'sSSA', '.AA.'] : ['.uu.', 'uuuv', 'uvvm', '.mm.'];
  c.stamp(3, 1, fin);
  // banner: 10 wide x 8 tall, rippled
  const ramp = active ? ['t', 's', 's', 'S', 'S', 'S', 'A', 'A'] : ['u', 'u', 'v', 'v', 'v', 'v', 'm', 'm'];
  for (let x = 6; x < 16; x++) {
    const phase = (f / 4) * Math.PI * 2 - (x - 6) * 0.62;
    const off = Math.round(Math.sin(phase) * amp * Math.min(1, (x - 5) / 4));
    const y0 = 6 + off;
    for (let j = 0; j < 8; j++) {
      if (x === 14 && (j === 3 || j === 4)) continue;
      if (x === 15 && j >= 2 && j <= 5) continue;
      c.px(x, y0 + j, ramp[j]);
    }
    // shard emblem (diamond) rides the cloth
    const edge = active ? 'a' : 'u';
    const core = active ? 't' : 'x';
    if (x === 8 || x === 10) c.px(x, y0 + 3, edge);
    if (x === 9) {
      c.px(x, y0 + 2, edge);
      c.px(x, y0 + 3, core);
      c.px(x, y0 + 4, edge);
    }
  }
  outlineOuter(c, 'O', (_x, y) => y <= 27);
  c.stamp(0, 27, FLAG_BASE);
  if (active) {
    const sp: [number, number, number][] = [[12, 2, 1], [14, 4, 0], [11, 1, 0], [13, 3, 1]];
    const [sx, sy, r] = sp[f];
    plus(c, sx, sy, r, 't');
    if (r === 0) c.px(sx + 2, sy + 2, 'a');
  }
  return c;
}

// ---------------------------------------------------------------- shards
function shardGet(f: number): Canvas {
  const c = new Canvas(S, S, FX_PAL);
  const px = (x: number, y: number, ch: string) => c.px(x, y, ch);
  const rays = (len: number, ch: string, tip: string) => {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const L = k % 2 ? len * 0.65 : len;
      for (let r = 2; r <= L; r++) px(Math.round(7.5 + Math.cos(a) * r), Math.round(7.5 + Math.sin(a) * r), r >= L - 0.5 ? tip : ch);
    }
  };
  if (f === 0) {
    rays(4, 'G', 'W');
    plus(c, 7, 7, 2, 'W');
    c.rect(7, 7, 2, 2, 'W');
  } else if (f === 1) {
    rays(7, 'H', 'W');
    c.rect(6, 6, 4, 4, 'G');
    c.rect(7, 7, 2, 2, 'W');
  } else if (f === 2) {
    const dots: [number, number, string][] = [[1, 7, 'G'], [14, 8, 'G'], [7, 1, 'W'], [8, 14, 'G'], [3, 3, 'H'], [12, 3, 'G'], [3, 12, 'A'], [12, 12, 'H']];
    for (const [x, y, ch] of dots) {
      px(x, y, ch);
      if (ch === 'W') px(x, y + 1, 'G');
    }
    plus(c, 7, 7, 1, 'G', 'W');
  } else {
    const dots: [number, number, string][] = [[0, 6, 'G'], [15, 9, 'H'], [8, 0, 'G'], [7, 15, 'A'], [2, 2, 'W'], [13, 2, 'G'], [2, 13, 'G'], [13, 13, 'A']];
    for (const [x, y, ch] of dots) px(x, y, ch);
  }
  return c;
}
function linkDot(pal: Palette, f: number): Canvas {
  const c = sheet(pal, 4, 4);
  c.stamp(0, 0, f === 0 ? ['.ss.', 'sttS', 'sSSA', '.AA.'] : ['.SS.', 'SssA', 'SSAA', '.AA.']);
  return c;
}

// ---------------------------------------------------------------- registry
export type ObjectRegion = 'meadow' | 'meadow_sunset' | 'caverns';

export interface ObjectAnim {
  frames: string[];
  fps: number;
  loop: boolean;
}

const seq = (name: string, n: number): string[] => Array.from({ length: n }, (_, i) => `obj/${name}_${i}`);

/** Animation clips (same for every region). lever_timer is value-driven: frame = min(5, floor(elapsed/total*6)); fps 0. */
export const OBJECT_ANIMS: Record<string, ObjectAnim> = {
  flag_idle: { frames: seq('flag_idle', 4), fps: 6, loop: true },
  flag_active: { frames: seq('flag_active', 4), fps: 8, loop: true },
  shard_spin: { frames: seq('shard_pickup', 6), fps: 10, loop: true },
  shard_get: { frames: seq('shard_get', 4), fps: 16, loop: false },
  door_open: { frames: seq('door_open', 4), fps: 6, loop: true },
  plate_glow: { frames: seq('plate_glow', 4), fps: 9, loop: true },
  lever_timer: { frames: seq('lever_timer', 6), fps: 0, loop: false },
  link_dot: { frames: seq('link_dot', 2), fps: 4, loop: true },
  spike_glint: { frames: ['obj/spike', 'obj/spike', 'obj/spike', 'obj/spike_1'], fps: 3, loop: true },
};

/** Every frame name that exists in every region atlas. */
export const OBJECT_FRAME_NAMES: string[] = [
  'obj/oneway_l',
  'obj/oneway_m',
  'obj/oneway_r',
  'obj/spike',
  'obj/spike_1',
  'obj/door_cap',
  'obj/door_mid',
  'obj/door_base',
  'obj/door_open_cap',
  ...seq('door_open', 4),
  'obj/plate_up',
  'obj/plate_down',
  ...seq('plate_glow', 4),
  'obj/lever_off',
  'obj/lever_on',
  ...seq('lever_timer', 6),
  'obj/lever_reset',
  ...seq('flag_idle', 4),
  ...seq('flag_active', 4),
  ...seq('shard_pickup', 6),
  ...seq('shard_get', 4),
  ...seq('link_dot', 2),
];

function toBitmaps(frames: Record<string, Canvas>): Record<string, Bitmap> {
  const out: Record<string, Bitmap> = {};
  for (const n of OBJECT_FRAME_NAMES) {
    if (n.startsWith('obj/shard_pickup_')) continue; // filled from the fx shard below
    const c = frames[n];
    if (!c) throw new Error(`objects: missing frame ${n}`);
    out[n] = c.toBitmap();
  }
  return out;
}

/** Build every object frame for a region (RGBA bitmaps keyed by frame name). */
const frameCache = new Map<RegionId, Record<string, Bitmap>>();
export function buildObjectFrames(region: RegionId): Record<string, Bitmap> {
  const hit = frameCache.get(region);
  if (hit) return hit;
  const pal = palFor(region);
  const f: Record<string, Canvas> = {};
  const m = onewayMid(pal);
  f['obj/oneway_m'] = m;
  f['obj/oneway_l'] = onewayLeft(pal);
  f['obj/oneway_r'] = onewayLeft(pal).flipH();
  f['obj/spike'] = spike(pal, false);
  f['obj/spike_1'] = spike(pal, true);
  f['obj/door_cap'] = doorCap(pal);
  f['obj/door_mid'] = doorMid(pal);
  f['obj/door_base'] = doorBase(pal);
  f['obj/door_open_cap'] = doorOpenCap(pal);
  for (let i = 0; i < 4; i++) f[`obj/door_open_${i}`] = doorOpen(pal, i);
  f['obj/plate_up'] = plateUp(pal);
  f['obj/plate_down'] = plateDown(pal);
  for (let i = 0; i < 4; i++) f[`obj/plate_glow_${i}`] = plateGlow(pal, i);
  f['obj/lever_off'] = leverArm(pal, 4, 4, false);
  f['obj/lever_on'] = leverArm(pal, 12, 4, true);
  for (let i = 0; i < 6; i++) f[`obj/lever_timer_${i}`] = leverTimer(pal, i);
  f['obj/lever_reset'] = leverReset(pal);
  for (let i = 0; i < 4; i++) {
    f[`obj/flag_idle_${i}`] = flag(pal, false, i);
    f[`obj/flag_active_${i}`] = flag(pal, true, i);
    f[`obj/shard_get_${i}`] = shardGet(i);
  }
  for (let i = 0; i < 2; i++) f[`obj/link_dot_${i}`] = linkDot(pal, i);
  const bm = toBitmaps(f as Record<string, Canvas>);
  // shard pickups: crop the character-fx shard so the pickup is pixel-identical to the fx shard
  const fx = buildFxFrames();
  for (let i = 0; i < 6; i++) {
    const src = fx[`fx/shard_${i}`];
    const dst = { w: S, h: S, data: new Uint8ClampedArray(S * S * 4) };
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (y + 1 < src.h && x < src.w) dst.data.set(src.data.subarray(((y + 1) * src.w + x) * 4, ((y + 1) * src.w + x) * 4 + 4), (y * S + x) * 4);
    bm[`obj/shard_pickup_${i}`] = dst;
  }
  // order frames canonically
  const ordered: Record<string, Bitmap> = {};
  for (const n of OBJECT_FRAME_NAMES) ordered[n] = bm[n];
  frameCache.set(region, ordered);
  return ordered;
}

export interface ObjectSet {
  /** PNG file name inside packages/art/assets */
  file: string;
  /** atlas JSON file name */
  atlas: string;
  frames: Record<string, AtlasEntry>;
  anims: Record<string, ObjectAnim>;
}

const ATLAS_W = 256;

function objectSet(region: ObjectRegion): ObjectSet {
  const { atlas } = packSheet(buildObjectFrames(region), ATLAS_W, 1);
  return { file: `world_objects_${region}.png`, atlas: `world_objects_${region}.json`, frames: atlas, anims: OBJECT_ANIMS };
}

/** Atlas registry, mirrors TILESETS: load `OBJECTS[region].file`, then draw `frames[name]` rects. */
export const OBJECTS: Record<ObjectRegion, ObjectSet> = {
  meadow: objectSet('meadow'),
  meadow_sunset: objectSet('meadow_sunset'),
  caverns: objectSet('caverns'),
};

/** Packed sheet bitmap for a region (used by the build script and tests). */
export function buildObjectSheet(region: ObjectRegion): { sheet: Bitmap; frames: Record<string, Bitmap> } {
  const frames = buildObjectFrames(region);
  const { sheet } = packSheet(frames, ATLAS_W, 1);
  return { sheet, frames };
}

