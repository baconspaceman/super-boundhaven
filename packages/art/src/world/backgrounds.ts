// Parallax backgrounds. Every layer is painted on a horizontally WRAPPING canvas (Canvas.wrapX) so the
// left/right edges are continuous by construction. Layers are 224px tall (one full native screen), y offset 0.
// North-star rules applied: friendly flat-shaded 2-4 tone shapes, dithering ONLY for the sky bands,
// lower contrast + cooler than the playfield, one clear mood per set (day / sunset / caverns).
import type { Bitmap } from '../core';
import { Canvas, bayer4, hash2, mix, paintSpheres, periodicNoise, type Sphere } from './paint';
import { CAVE_ROCK, CRY_C, CRY_M, shard } from './props';

export type BgSet = 'meadow' | 'meadow_sunset' | 'caverns';

export interface BackgroundLayer {
  name: string;
  /** PNG file name inside packages/art/assets */
  file: string;
  /** camera-scroll factor: 0 = fixed to screen, 1 = moves with the world */
  parallax: number;
  /** top y offset on the 224px-tall screen */
  y: number;
  /** repeats horizontally */
  tileX: boolean;
  w: number;
  h: number;
  /** ambient self-scroll in px/second (clouds drifting), added to the parallax scroll */
  drift: number;
  /** draw order relative to gameplay */
  z: 'back' | 'front';
}

const H = 224;
const W = 512;
const TAU = Math.PI * 2;

const L = (set: string, name: string, parallax: number, extra: Partial<BackgroundLayer> = {}): BackgroundLayer => ({
  name,
  file: `world_bg_${set}_${name}.png`,
  parallax,
  y: 0,
  tileX: true,
  w: W,
  h: H,
  drift: 0,
  z: 'back',
  ...extra,
});

const dayLayers = (set: string): BackgroundLayer[] => [
  L(set, 'sky', 0, { w: 256 }),
  L(set, 'sun', 0.02, { w: 256, tileX: false }),
  L(set, 'clouds_far', 0.06, { drift: 2 }),
  L(set, 'mountains', 0.12),
  L(set, 'clouds_near', 0.2, { drift: 6 }),
  L(set, 'hills_mid', 0.32),
  L(set, 'hills_near', 0.55),
  L(set, 'foreground', 1, { z: 'front' }),
];

/** Draw order: first = farthest. */
export const BACKGROUNDS: Record<BgSet, BackgroundLayer[]> = {
  meadow: dayLayers('meadow'),
  meadow_sunset: dayLayers('meadow_sunset'),
  caverns: [L('caverns', 'deep', 0.08), L('caverns', 'far', 0.22), L('caverns', 'mid', 0.45), L('caverns', 'near', 1, { z: 'front' })],
};

// ---------- themes ----------
interface Theme {
  skyStops: string[];
  skyEdges: number[];
  sun: { x: number; y: number; r: number; disc: string[]; halo: [string, string]; ray: string };
  birds: string;
  cloudFar: string[];
  cloudNear: string[];
  underTint: string;
  mtn: { lit: string[]; shade: string[]; snowLit: string; snowShade: string; haze: string; gully: string; glint: string };
  hillMid: { tones: string[]; hedge: string; rim: string; tree: string[]; wall: string[]; roof: string[]; blade: string };
  hillNear: { rim: string; lit: string; body: string; shade: string; dark: string; tick: string; shrub: string[]; bloom: [string, string, string] };
  fg: { dark: string; dark2: string; rim: string };
}

const DAY: Theme = {
  skyStops: ['#2a3a9c', '#3a52b8', '#4a6ccc', '#5d88dc', '#74a4ea', '#92c0f2', '#b4d8f6', '#d8ecf4', '#f6ecd2', '#fcdcae', '#fdc49c'],
  skyEdges: [18, 40, 60, 80, 98, 116, 132, 146, 158, 170],
  sun: { x: 190, y: 58, r: 15, disc: ['#ffc85a', '#ffe07c', '#fff6b8'], halo: ['#fff6c450', '#fff0b02c'], ray: '#fffbe03a' },
  birds: '#4a5ca6',
  cloudFar: ['#6684d8', '#819ee4', '#9db8ee', '#bcd2f6'],
  cloudNear: ['#8a9ed8', '#b4c6ee', '#dce8fa', '#ffffff'],
  underTint: '#d8aac0',
  mtn: { lit: ['#8492d4', '#98a6de'], shade: ['#6674b8', '#5462a6'], snowLit: '#fbfdff', snowShade: '#c4d4f2', haze: '#d4d0ec', gully: '#5a68ae', glint: '#b4c0ec' },
  hillMid: {
    tones: ['#62b090', '#56a488', '#6cb894', '#7cb084'],
    hedge: '#3e8c78',
    rim: '#b6e0c4',
    tree: ['#3a8470', '#2e7462', '#58a88c'],
    wall: ['#ddd2cc', '#e8d8c4', '#d0c8d4'],
    roof: ['#b8707e', '#a25e86', '#c4806e'],
    blade: '#8a7aa8',
  },
  hillNear: {
    rim: '#d8fa7a',
    lit: '#8ce04e',
    body: '#48b04c',
    shade: '#2a8a4c',
    dark: '#1e6a4c',
    tick: '#b4f060',
    shrub: ['#1a5a4c', '#2a8a4c', '#4cb852', '#92dc5c'],
    bloom: ['#ff9ad0', '#ffe66a', '#ff6e8a'],
  },
  fg: { dark: '#14424e', dark2: '#1e5a52', rim: '#34905a' },
};

const SUNSET: Theme = {
  skyStops: ['#2a2278', '#3c2a8c', '#56349c', '#763ca6', '#9c449e', '#c04e94', '#e05e86', '#f67a78', '#ff9a6e', '#ffba70', '#ffd888'],
  skyEdges: [16, 34, 52, 70, 88, 106, 124, 140, 154, 168],
  sun: { x: 162, y: 138, r: 24, disc: ['#ff8a3c', '#ffb250', '#ffe090'], halo: ['#ffc07a52', '#ff9a6c30'], ray: '#ffd0903c' },
  birds: '#3a2868',
  cloudFar: ['#8a4898', '#a4589e', '#c070a4', '#dc90ac'],
  cloudNear: ['#6e3688', '#b25c98', '#f27c88', '#ffb68a'],
  underTint: '#a0508c',
  mtn: { lit: ['#9a4c9c', '#b2589e'], shade: ['#703c90', '#5c3284'], snowLit: '#ffc8a0', snowShade: '#d27ca8', haze: '#e47890', gully: '#542a7c', glint: '#dc78a8' },
  hillMid: {
    tones: ['#7a4a94', '#8a5498', '#6c4090', '#965c9a'],
    hedge: '#5a3682',
    rim: '#f08aa0',
    tree: ['#4a2e7a', '#3c2470', '#6a4490'],
    wall: ['#f0c8b8', '#f8d4b0', '#e0bcc8'],
    roof: ['#a8507a', '#8a3c7c', '#c4607a'],
    blade: '#6a3c84',
  },
  hillNear: {
    rim: '#ffe488',
    lit: '#c0d052',
    body: '#6eaa48',
    shade: '#3c824c',
    dark: '#2a5e4c',
    tick: '#e4ec6c',
    shrub: ['#24484c', '#3c7a48', '#68a84c', '#c4d25a'],
    bloom: ['#ffb8d8', '#fff08a', '#ff8aa0'],
  },
  fg: { dark: '#2a1a58', dark2: '#3a2468', rim: '#c05c88' },
};

// ---------- helpers ----------
const wrapD = (x: number, xi: number, w: number) => ((((x - xi + w / 2) % w) + w) % w) - w / 2;

function ridge(base: number, terms: [amp: number, freq: number, phase: number][], w: number): (x: number) => number {
  return (x) => {
    let y = base;
    for (const [a, f, p] of terms) y += a * Math.sin((TAU * f * x) / w + p);
    return y;
  };
}

// =====================================================================
// MEADOW (day + sunset share the drawing code; only the Theme differs)
// =====================================================================
function sky(T: Theme): Canvas {
  const c = new Canvas(256, H, {}, true);
  const S = T.skyStops;
  const E = T.skyEdges;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < 256; x++) {
      let band = 0;
      while (band < E.length && y >= E[band]) band++;
      let col = S[band];
      // the ONLY dithering in the set: an ordered-dither seam (+-3 rows) between sky bands
      for (let b = 0; b < E.length; b++) {
        const e = E[b];
        if (y >= e - 3 && y < e + 3) col = (y - (e - 3) + 0.5) / 6 > bayer4(x, y) ? S[b + 1] : S[b];
      }
      c.px(x, y, col);
    }
  return c;
}

function sun(T: Theme): Canvas {
  const c = new Canvas(256, H, {});
  const { x: sx, y: sy, r, disc, halo } = T.sun;
  // flat concentric halo bands (translucent), hard edges
  for (let y = 0; y < H; y++)
    for (let x = 0; x < 256; x++) {
      const d = Math.hypot(x + 0.5 - sx, y + 0.5 - sy);
      if (d < r + 1) continue;
      if (d < r + 10) c.px(x, y, halo[0]);
      else if (d < r + 24) c.px(x, y, halo[1]);
    }
  paintSpheres(c, [{ cx: sx, cy: sy, rx: r }], { ramp: disc, light: [-0.3, -0.4, 0.85], dither: 0, bias: 0.15 });
  // tiny distant birds (V shapes)
  const bird = (bx: number, by: number) => {
    for (const [dx, dy] of [[0, 0], [1, 1], [2, 2], [3, 1], [4, 0]] as const) c.px(bx + dx, by + dy, T.birds);
  };
  bird(40, 40);
  bird(54, 47);
  bird(33, 52);
  return c;
}

function cloud(c: Canvas, cx: number, cy: number, w: number, h: number, ramp: string[], seed: number, flat = 1): void {
  const base = Math.floor(cy + h / 2);
  const lobes: Sphere[] = [];
  const n = Math.max(3, Math.round(w / 15));
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const hump = Math.sin(t * Math.PI);
    const r = h * (0.28 + 0.26 * hump + hash2(i, seed, 3) * 0.1);
    lobes.push({ cx: cx - w / 2 + t * w + (hash2(i, seed, 5) - 0.5) * 4, cy: base - r * 0.85 * flat, rx: r * 1.08 / Math.sqrt(flat), ry: r * flat });
  }
  for (let i = 0; i < 2; i++) {
    const t = 0.3 + 0.4 * hash2(i, seed, 9) + i * 0.15;
    const r = h * (0.3 + hash2(i, seed, 11) * 0.12);
    lobes.push({ cx: cx - w / 2 + t * w, cy: base - h * 0.55 - r * 0.3, rx: r * 1.1, ry: r });
  }
  // hard-banded toon shading (no dither): highlight top-left, shaded belly
  paintSpheres(c, lobes, { ramp, light: [-0.5, -0.75, 0.4], dither: 0, bias: -0.04, wrap: c.w, mask: (_x, y) => y <= base });
  // flat shaded belly: last two rows
  for (let y = base - 1; y <= base; y++)
    for (let x = Math.floor(cx - w / 2 - 8); x <= Math.ceil(cx + w / 2 + 8); x++) if (c.has(x, y)) c.px(x, y, ramp[0]);
}

function cloudsFar(T: Theme): Canvas {
  const c = new Canvas(W, H, {}, true);
  const items: [number, number, number, number][] = [
    [50, 28, 80, 14],
    [165, 52, 64, 10],
    [290, 22, 94, 15],
    [372, 60, 58, 9],
    [455, 36, 76, 13],
    [110, 82, 50, 8],
    [228, 90, 62, 9],
  ];
  items.forEach(([x, y, w, h], i) => cloud(c, x, y, w, h, T.cloudFar, 20 + i, 0.62));
  return c;
}

function cloudsNear(T: Theme): Canvas {
  const c = new Canvas(W, H, {}, true);
  const items: [number, number, number, number][] = [
    [70, 74, 110, 38],
    [230, 108, 92, 30],
    [350, 64, 120, 42],
    [470, 112, 76, 26],
    [170, 40, 56, 20],
  ];
  items.forEach(([x, y, w, h], i) => cloud(c, x, y, w, h, T.cloudNear, 40 + i));
  return c;
}

function mountains(T: Theme): Canvas {
  const c = new Canvas(W, H, {}, true);
  const base = 160;
  const peaks: [xi: number, h: number, slope: number][] = [
    [40, 84, 1.0],
    [150, 62, 0.95],
    [262, 98, 1.05],
    [376, 70, 1.0],
    [462, 52, 0.9],
  ];
  const M = T.mtn;
  const top = (x: number) => {
    let m = 0;
    for (const [xi, h, s] of peaks) m = Math.max(m, h - Math.abs(wrapD(x, xi, W)) * s);
    // chunky rock steps (quantized, 4px wide) instead of per-pixel jitter
    m += Math.floor(periodicNoise(Math.floor(x / 4) * 4, W, 5, 24) * 3) - 1;
    return Math.round(base - Math.max(m, 10));
  };
  // rolling mist bands (wavy, so they read as atmosphere rather than a horizontal slab)
  const hz = (x: number) => 118 + 5 * Math.sin((TAU * x) / W * 3 + 1) + 3 * Math.sin((TAU * x) / W * 7);
  const hazeAt = (col: string, x: number, y: number) => (y >= hz(x) + 16 ? mix(col, M.haze, 0.7) : y >= hz(x) ? mix(col, M.haze, 0.34) : col);
  for (let x = 0; x < W; x++) {
    const y0 = top(x);
    let pk = 0;
    let best = 1e9;
    let side = 1;
    peaks.forEach(([xi], i) => {
      const d = Math.abs(wrapD(x, xi, W));
      if (d < best) {
        best = d;
        pk = i;
        side = wrapD(x, xi, W) < 0 ? -1 : 1;
      }
    });
    const peakY = base - peaks[pk][1];
    // zig-zag snow line: triangle wave, 12px period, anchored to the peak
    const tri = Math.abs((((wrapD(x, peaks[pk][0], W) + 600) % 12) / 12) * 2 - 1);
    const snowY = peakY + 16 + Math.round(tri * 7);
    for (let y = y0; y < H; y++) {
      const d = y - y0;
      const face = side < 0 ? M.lit : M.shade;
      let col = d < 14 ? face[1] : face[0];
      if (y < snowY) col = side < 0 ? M.snowLit : M.snowShade;
      c.px(x, y, hazeAt(col, x, y));
    }
  }
  // gullies: clean 1px diagonal creases running down each face (no texture noise)
  for (const [xi, h] of peaks) {
    for (const s of [-1, 1] as const) {
      for (let k = 0; k < 3; k++) {
        let gx = xi + s * (7 + k * 11);
        let gy = top(gx) + 14 + k * 3;
        const len = 18 + k * 6 - (h < 70 ? 6 : 0);
        for (let t = 0; t < len; t++) {
          if (gy > 112) break;
          c.px(gx, gy, hazeAt(s < 0 ? M.glint : M.gully, gx, gy));
          gy++;
          if (t % 2 === 1) gx += s;
        }
      }
    }
  }
  // landmark: a floating haven islet with a crystal shard, tucked between two peaks
  const ix = 330;
  const iy = 66;
  const isl: Sphere[] = [{ cx: ix, cy: iy, rx: 13, ry: 4 }];
  paintSpheres(c, isl, { ramp: [M.shade[1], M.shade[0], M.lit[0], M.lit[1]], dither: 0, light: [-0.4, -0.8, 0.4] });
  for (let i = 0; i < 9; i++) {
    const half = 11 - i * 1.2;
    c.hline(Math.round(ix - half), iy + 4 + i, Math.max(1, Math.round(half * 2)), i % 3 === 0 ? M.shade[1] : M.shade[0]);
  }
  c.hline(ix - 12, iy - 1, 25, T === DAY ? '#7cd04c' : '#a8c050');
  c.hline(ix - 11, iy - 2, 23, T === DAY ? '#9ce05a' : '#c4d25a');
  for (const [dx, h2, col] of [[-3, 9, '#ff6cd0'], [1, 13, '#5cecf4'], [5, 7, '#ff6cd0']] as const) {
    for (let k = 0; k < h2; k++) {
      const w2 = k < 3 ? 1 : 2;
      c.hline(ix + dx, iy - 3 - k, w2, col);
    }
    c.px(ix + dx, iy - 3 - h2 + 1, '#ffffff');
  }
  return c;
}

function hillsMid(T: Theme): Canvas {
  const c = new Canvas(W, H, {}, true);
  const R = ridge(150, [[9, 1, 0.6], [6, 3, 1.9], [3, 7, 0.3]], W);
  const Hm = T.hillMid;
  for (let x = 0; x < W; x++) {
    const y0 = Math.round(R(x));
    const patch = Math.floor((x + 20) / 64);
    const kind = Math.floor(hash2(patch, 3, 12) * 3); // 0 rows, 1 meadow, 2 diagonal crop
    for (let y = y0; y < H; y++) {
      const d = y - y0;
      // rows get thicker toward the viewer (cheap perspective)
      const row = Math.floor(Math.sqrt(d * 1.3));
      let col = Hm.tones[(row + patch) % 4];
      if (kind === 1) col = Hm.tones[(patch + 2) % 4];
      else if (kind === 2) col = (x + y) % 8 < 4 ? Hm.tones[(patch + 1) % 4] : Hm.tones[(patch + 3) % 4];
      if (kind === 0 && Math.floor(Math.sqrt((d + 1) * 1.3)) !== row) col = Hm.hedge;
      if (d < 3) col = Hm.tones[0];
      if (d === 0) col = Hm.rim;
      c.px(x, y, col);
    }
  }
  // distant tree line: round-topped clumps
  for (let x = 0; x < W; x += 3) {
    if (hash2(x, 1, 44) < 0.35) continue;
    const h = 2 + Math.floor(hash2(x, 2, 44) * 4);
    const y0 = Math.round(R(x));
    const col = hash2(x, 3, 44) < 0.5 ? Hm.tree[0] : Hm.tree[1];
    for (let k = 0; k < h; k++) for (let i = -1; i <= 1; i++) if (Math.abs(i) <= (k === h - 1 ? 0 : 1)) c.px(x + i, y0 - 1 - k, col);
    c.px(x - 1, y0 - h, Hm.tree[2]);
  }
  // village of tiny houses
  const house = (hx: number, tone: number) => {
    const y0 = Math.round(R(hx + 3));
    const walls = Hm.wall[tone % 3];
    const roofs = Hm.roof[tone % 3];
    c.rect(hx, y0 - 5, 7, 5, walls);
    c.hline(hx + 1, y0 - 6, 5, roofs);
    c.hline(hx, y0 - 5, 7, roofs);
    c.hline(hx + 2, y0 - 7, 3, roofs);
    c.px(hx + 2, y0 - 3, Hm.blade);
    c.px(hx + 5, y0 - 3, Hm.blade);
    c.vline(hx + 6, y0 - 5, 5, mix(walls, Hm.blade, 0.3));
  };
  house(92, 0);
  house(103, 1);
  house(112, 2);
  house(100, 2);
  const sy = Math.round(R(123));
  c.rect(122, sy - 9, 3, 9, Hm.wall[0]);
  c.px(123, sy - 10, Hm.roof[0]);
  c.px(123, sy - 11, Hm.roof[0]);
  c.px(123, sy - 12, '#ffe8a0');
  // windmill landmark
  const wx = 330;
  const wy = Math.round(R(wx));
  for (let i = 0; i < 16; i++) {
    const half = 4 - Math.floor(i / 5);
    for (let k = -half; k <= half; k++) c.px(wx + k, wy - i, k < 0 ? Hm.wall[0] : mix(Hm.wall[0], Hm.blade, 0.55));
  }
  c.hline(wx - 3, wy - 16, 7, Hm.roof[1]);
  c.hline(wx - 2, wy - 17, 5, Hm.roof[0]);
  c.px(wx, wy - 18, Hm.roof[0]);
  c.px(wx, wy - 4, Hm.blade);
  c.px(wx, wy - 5, Hm.blade);
  const hub: [number, number] = [wx, wy - 14];
  const blade = (dx: number, dy: number) => {
    for (let t = 1; t <= 9; t++) {
      c.px(hub[0] + Math.round(dx * t), hub[1] + Math.round(dy * t), Hm.blade);
      if (t > 3) c.px(hub[0] + Math.round(dx * t) + (dy === 0 ? 0 : 1), hub[1] + Math.round(dy * t) + (dy === 0 ? 1 : 0), Hm.wall[1]);
    }
  };
  blade(0.7, -0.7);
  blade(-0.7, 0.7);
  blade(0.7, 0.7);
  blade(-0.7, -0.7);
  c.px(hub[0], hub[1], '#fff0b8');
  return c;
}

function hillsNear(T: Theme): Canvas {
  const c = new Canvas(W, H, {}, true);
  const R = ridge(176, [[12, 1, 2.2], [8, 2, 0.4], [4, 5, 1.1]], W);
  const N = T.hillNear;
  for (let x = 0; x < W; x++) {
    const y0 = Math.round(R(x));
    const s = R(x + 6) - R(x - 6);
    // lightK: 1 when the slope faces the sun (down to the left), 0 when it faces away
    const k = Math.max(0, Math.min(1, 0.5 - s / 9));
    const dA = 3 + Math.round(k * 7);
    const dB = dA + 12 + Math.round(k * 10);
    const dC = dB + 18;
    for (let y = y0; y < H; y++) {
      const d = y - y0;
      let col = d < dA ? N.lit : d < dB ? N.body : d < dC ? N.shade : N.dark;
      if (d === 0) col = N.rim;
      else if (d === 1 && k > 0.35) col = N.rim;
      c.px(x, y, col);
    }
  }
  // hand-placed grass ticks + blossoms inside the body band
  for (let x = 3; x < W; x += 6) {
    if (hash2(x, 6, 61) < 0.45) continue;
    const y0 = Math.round(R(x));
    const y = y0 + 9 + Math.floor(hash2(x, 7, 61) * 12);
    c.px(x, y, N.tick);
    c.px(x - 1, y - 1, N.tick);
    c.px(x + 1, y - 1, N.tick);
    if (hash2(x, 8, 61) < 0.2) {
      c.px(x + 3, y - 3, N.bloom[0]);
      c.px(x + 4, y - 3, N.bloom[1]);
      c.px(x + 3, y - 4, N.bloom[1]);
    }
  }
  // round shrubs on the ridge, flat 4-tone shading
  const shrubs: Sphere[] = [];
  for (let x = 14; x < W - 10; x += 38 + Math.floor(hash2(x, 1, 70) * 26)) {
    const r = 5 + Math.floor(hash2(x, 2, 70) * 4);
    const y0 = Math.round(R(x));
    shrubs.push({ cx: x, cy: y0 - r * 0.4, rx: r * 1.15, ry: r });
    shrubs.push({ cx: x + r, cy: y0 - r * 0.15, rx: r * 0.85, ry: r * 0.75 });
  }
  paintSpheres(c, shrubs, { ramp: N.shrub, dither: 0, tex: 0.8, texScale: 4, texSeed: 9, wrap: W });
  shrubs.forEach((s, i) => {
    if (i % 2 === 0 && hash2(s.cx, 4, 71) < 0.6) {
      c.px(s.cx - 1, s.cy - 1, N.bloom[2]);
      c.px(s.cx + 2, s.cy, N.bloom[2]);
    }
  });
  return c;
}

function foreground(T: Theme): Canvas {
  const c = new Canvas(W, H, {}, true);
  const { dark, dark2, rim } = T.fg;
  // grass blades rising from the bottom edge (silhouette; lighter rim on the sunny side)
  for (let x = 0; x < W; x += 2) {
    const h = 5 + Math.floor(hash2(x, 1, 81) * 10) + (Math.floor(x / 64) % 2 ? 0 : 3);
    const lean = hash2(x, 2, 81) < 0.5 ? -1 : 1;
    for (let k = 0; k < h; k++) {
      const off = Math.round((lean * k * k) / (h * 3.2));
      const y = H - 1 - k;
      c.px(x + off, y, k > h - 4 ? dark2 : dark);
      c.px(x + off + 1, y, dark);
      if (k > 2 && k < h - 2) c.px(x + off, y, rim);
    }
  }
  c.rect(0, H - 4, W, 4, dark);
  // chunky leaf clusters hanging from the top edge (flat 3-tone, sparse so they never hide play)
  const clusters: [number, number][] = [
    [40, 1],
    [210, -1],
    [330, 1],
    [470, -1],
  ];
  const lf: Sphere[] = [];
  for (const [cx, dir] of clusters) {
    lf.push({ cx, cy: 1, rx: 13, ry: 8 });
    lf.push({ cx: cx + dir * 14, cy: 4, rx: 11, ry: 9 });
    lf.push({ cx: cx - dir * 12, cy: 3, rx: 9, ry: 8 });
    lf.push({ cx: cx + dir * 4, cy: 12, rx: 7, ry: 7 });
    lf.push({ cx: cx - dir * 10, cy: 13, rx: 5, ry: 5 });
  }
  paintSpheres(c, lf, { ramp: [dark, dark2, T.fg.rim], light: [-0.5, -0.4, 0.75], dither: 0, bias: -0.1, wrap: W, tex: 0.5, texScale: 4 });
  return c;
}

// =====================================================================
// CAVERNS
// =====================================================================
function cavernDeep(): Canvas {
  const c = new Canvas(W, H, {}, true);
  const bands = ['#160e52', '#1c1264', '#241a78', '#2c228c', '#241a78', '#1c1264', '#160e52'];
  const edges = [26, 64, 104, 144, 178, 206];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let band = 0;
      while (band < edges.length && y >= edges[band]) band++;
      let col = bands[band];
      for (let b = 0; b < edges.length; b++) {
        const e = edges[b];
        if (y >= e - 3 && y < e + 3) col = (y - (e - 3) + 0.5) / 6 > bayer4(x, y) ? bands[b + 1] : bands[b];
      }
      c.px(x, y, col);
    }
  // big soft rock swells, flat two-tone
  const swell: Sphere[] = [];
  for (let i = 0; i < 9; i++) swell.push({ cx: i * 57 + hash2(i, 1, 2) * 30, cy: 100 + hash2(i, 2, 2) * 60, rx: 46 + hash2(i, 3, 2) * 26, ry: 16 + hash2(i, 4, 2) * 12 });
  paintSpheres(c, swell, { ramp: ['#241a78', '#2c228c', '#342a9a'], light: [-0.3, -0.8, 0.5], dither: 0, wrap: W });
  // light shafts: flat translucent beams
  for (const sx of [70, 240, 410]) {
    for (let y = 0; y < 170; y++) {
      const half = 5 + y * 0.1;
      const cx = sx + y * 0.35;
      for (let x = Math.floor(cx - half); x <= cx + half; x++) c.px(x, y, Math.abs(x - cx) < half * 0.45 ? '#9ad0ff22' : '#9ad0ff12');
    }
  }
  // glow-worm pin lights
  for (let i = 0; i < 40; i++) {
    const x = Math.floor(hash2(i, 1, 90) * W);
    const y = Math.floor(hash2(i, 2, 90) * 190);
    c.px(x, y, i % 5 === 0 ? '#ff8ae0' : '#52eaf4');
  }
  return c;
}

function stalTeeth(c: Canvas, dir: 'down' | 'up', baseEdge: number, minL: number, maxL: number, widthMin: number, widthMax: number, ramp: string[], seed: number): void {
  let x = 0;
  const w = c.w;
  let i = 0;
  while (x < w) {
    const tw = widthMin + Math.floor(hash2(i, seed, 1) * (widthMax - widthMin));
    const len = minL + Math.floor(hash2(i, seed, 2) * (maxL - minL));
    const cx = x + tw / 2;
    for (let k = 0; k < len + baseEdge; k++) {
      const t = k < baseEdge ? 0 : (k - baseEdge) / len;
      const half = k < baseEdge ? tw / 2 + 2 : Math.max(0.5, (tw / 2) * (1 - t * 0.95));
      const y = dir === 'down' ? k : c.h - 1 - k;
      for (let xx = Math.round(cx - half); xx <= Math.round(cx + half - 0.5); xx++) {
        const u = (xx - (cx - half)) / Math.max(1, half * 2);
        c.px(xx, y, u < 0.3 ? ramp[2] : u < 0.7 ? ramp[1] : ramp[0]);
      }
    }
    x += tw + Math.floor(hash2(i, seed, 3) * 3);
    i++;
  }
}

function cavernFar(): Canvas {
  const c = new Canvas(W, H, {}, true);
  const ramp = ['#2a2078', '#342a88', '#40349a'];
  stalTeeth(c, 'down', 8, 14, 62, 10, 22, ramp, 1);
  stalTeeth(c, 'up', 10, 10, 46, 12, 24, ramp, 2);
  for (const px of [150, 372]) {
    for (let y = 0; y < H; y++) {
      const w = 7 + Math.round(Math.sin(y / 14) * 1.4) + (y < 30 || y > 190 ? 3 : 0);
      for (let x = px - w; x <= px + w; x++) {
        const u = (x - (px - w)) / (w * 2);
        c.px(x, y, u < 0.3 ? ramp[2] : u < 0.72 ? ramp[1] : ramp[0]);
      }
    }
  }
  const cc = (cx: number, by: number, ramp2: string[]) => {
    shard(c, cx, by, 6, 14, -1, ramp2.map((h) => mix(h, '#2a2078', 0.5)), false);
    shard(c, cx + 5, by, 5, 9, 1, ramp2.map((h) => mix(h, '#2a2078', 0.55)), false);
  };
  cc(84, H - 10, CRY_C);
  cc(258, H - 8, CRY_M);
  cc(440, H - 10, CRY_C);
  return c;
}

function cavernMid(): Canvas {
  const c = new Canvas(W, H, {}, true);
  const ramp = [CAVE_ROCK[1], CAVE_ROCK[2], CAVE_ROCK[3]].map((h) => mix(h, '#2a2078', 0.3));
  stalTeeth(c, 'down', 10, 18, 60, 14, 28, ramp, 7);
  stalTeeth(c, 'up', 12, 12, 40, 16, 30, ramp, 8);
  const glow = (cx: number, cy: number, r: number, col: string, col2: string) => {
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++) {
        const d = Math.hypot(x - cx, (y - cy) * 1.15) / r;
        if (d < 1 && !c.has(x, y)) c.px(x, y, d < 0.55 ? col : col2);
      }
  };
  const cluster = (cx: number, by: number, big: boolean, m: boolean) => {
    const r = m ? CRY_M : CRY_C;
    glow(cx, by - (big ? 18 : 10), big ? 34 : 22, m ? '#c4329e30' : '#22acd030', m ? '#c4329e18' : '#22acd018');
    shard(c, cx, by, big ? 9 : 6, big ? 30 : 16, -2, r, false);
    shard(c, cx + (big ? 8 : 5), by, big ? 8 : 5, big ? 20 : 11, 2, m ? CRY_C : CRY_M, false);
    shard(c, cx - (big ? 8 : 5), by, big ? 6 : 4, big ? 13 : 8, -1, r, false);
  };
  cluster(60, H - 14, true, false);
  cluster(200, H - 12, false, true);
  cluster(330, H - 14, true, true);
  cluster(465, H - 12, false, false);
  for (const x of [120, 270, 400]) {
    glow(x, 34, 18, '#22acd034', '#22acd01a');
    for (let k = 0; k < 4; k++) {
      c.vline(x + k - 2, 14, 12 + (k % 2) * 6, CRY_C[k % 3]);
      c.px(x + k - 2, 14 + 12 + (k % 2) * 6, CRY_C[3]);
    }
  }
  return c;
}

function cavernNear(): Canvas {
  const c = new Canvas(W, H, {}, true);
  const ramp = ['#0a0628', '#120c38', '#1c1450'];
  stalTeeth(c, 'down', 4, 10, 38, 18, 36, ramp, 11);
  stalTeeth(c, 'up', 4, 6, 22, 20, 40, ramp, 12);
  // keep only the ceiling fringe + floor fringe so the near layer never hides gameplay
  for (let y = 40; y < H - 18; y++) for (let x = 0; x < W; x++) c.clear(x, y);
  // low mist banks: flat translucent lobes
  const mist: Sphere[] = [];
  for (let i = 0; i < 7; i++) mist.push({ cx: i * 76 + hash2(i, 1, 4) * 30, cy: 182 + hash2(i, 2, 4) * 8, rx: 40 + hash2(i, 3, 4) * 20, ry: 6 + hash2(i, 4, 4) * 4 });
  const tmp = new Canvas(W, H, {}, true);
  paintSpheres(tmp, mist, { ramp: ['#c4b4f81c', '#c4b4f82a'], dither: 0, wrap: W });
  c.blit(tmp, 0, 0);
  return c;
}

export function buildBackground(set: BgSet, name: string): Canvas {
  const T = set === 'meadow_sunset' ? SUNSET : DAY;
  switch (`${set === 'caverns' ? 'caverns' : 'meadow'}:${name}`) {
    case 'meadow:sky':
      return sky(T);
    case 'meadow:sun':
      return sun(T);
    case 'meadow:clouds_far':
      return cloudsFar(T);
    case 'meadow:mountains':
      return mountains(T);
    case 'meadow:clouds_near':
      return cloudsNear(T);
    case 'meadow:hills_mid':
      return hillsMid(T);
    case 'meadow:hills_near':
      return hillsNear(T);
    case 'meadow:foreground':
      return foreground(T);
    case 'caverns:deep':
      return cavernDeep();
    case 'caverns:far':
      return cavernFar();
    case 'caverns:mid':
      return cavernMid();
    case 'caverns:near':
      return cavernNear();
    default:
      throw new Error(`unknown background ${set}:${name}`);
  }
}

export function buildBackgroundBitmap(set: BgSet, layer: BackgroundLayer): Bitmap {
  return buildBackground(set, layer.name).toBitmap();
}
