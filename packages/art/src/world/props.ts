// Non-colliding decoration props (both regions). Every sprite is deterministic + original.
// Props use softer, hue-tinted outlines (never the deep terrain outline) so they never read as collidable ground.
import type { Bitmap } from '../core';
import { Canvas, hash2, mapInks, outlineOuter, paintSpheres, tintSunset, type Sphere } from './paint';
import type { RegionId } from './tileset';

export interface PropDef {
  id: string;
  region: RegionId;
  /** atlas frame keys (1 = static) */
  frames: string[];
  /** animation speed (frames/sec); 0 = static */
  fps: number;
  w: number;
  h: number;
  /** point inside the sprite that sits on the anchor surface (ground contact / ceiling attach) */
  anchor: { x: number; y: number };
  placement: 'ground' | 'ceiling' | 'water' | 'free';
  /** draw behind or in front of the player/tiles */
  layer: 'back' | 'front';
  solid: false;
}

// ---------- shared ramps (dark -> light) ----------
const FOL = ['#173f52', '#235f48', '#34884a', '#5cb250', '#94d85a', '#d0f276'];
const FOL_BACK = ['#143a52', '#1e5a4c', '#2a7a4c', '#3c9a52', '#62bc58'];
const BARK = ['#2e1c40', '#4e2e48', '#7a4a4c', '#a8705a', '#d09a70'];
const ROCK = ['#34345c', '#545a8c', '#7c84b8', '#a8b0dc', '#d4daf4'];
const WOODC = ['#5e3a48', '#a86a40', '#d68a40', '#fbd77c'];
export const WATER = ['#173e8c', '#2468c8', '#3c98e8', '#7cd0fc', '#d8f8ff'];

const mk = (w: number, h: number, wrap = false) => new Canvas(w, h, {}, wrap);

/** Inner-outline helper: recolor edge pixels to the darkest tone of their neighbourhood ramp. */
function softOutline(c: Canvas, col: string): void {
  const toSet: [number, number][] = [];
  for (let y = 0; y < c.h; y++)
    for (let x = 0; x < c.w; x++) {
      if (!c.has(x, y)) continue;
      if (!c.has(x - 1, y) || !c.has(x + 1, y) || !c.has(x, y - 1) || !c.has(x, y + 1)) toSet.push([x, y]);
    }
  for (const [x, y] of toSet) c.px(x, y, col);
}

// ---------- foliage ----------
function foliage(c: Canvas, back: Sphere[], front: Sphere[], seed: number, outline = '#10304a'): void {
  // flat, hard-banded toon shading (north star: chunky clusters, no noise/dither on props)
  paintSpheres(c, back, { ramp: FOL_BACK, light: [-0.5, -0.7, 0.4], bias: -0.1, dither: 0, tex: 1.0, texScale: 4, texSeed: seed });
  paintSpheres(c, front, { ramp: FOL.slice(0, 5), light: [-0.5, -0.7, 0.4], dither: 0, tex: 1.2, texScale: 4, texSeed: seed + 3, bias: -0.09 });
  outlineOuter(c, outline);
  // bright rim on the sun-facing (top-left) silhouette, chunky 2px runs only
  const rim: [number, number][] = [];
  for (let y = 1; y < c.h; y++)
    for (let x = 1; x < c.w; x++) {
      if (c.has(x, y) && c.get(x, y) !== outline && !c.has(x - 1, y - 1) && !c.has(x, y - 1) === !c.has(x - 1, y)) rim.push([x, y]);
    }
  for (const [x, y] of rim) c.px(x, y, FOL[5]);
}

function bush(w: number, h: number, lobes: [number, number, number][], berries: [number, number][], seed: number): Canvas {
  const c = mk(w, h);
  const sp: Sphere[] = lobes.map(([cx, cy, r]) => ({ cx, cy, rx: r, ry: r * 0.92 }));
  foliage(c, sp.map((s) => ({ ...s, cy: s.cy + 1, rx: s.rx + 1 })), sp, seed);
  for (const [bx, by] of berries) {
    c.px(bx, by, '#e8485e');
    c.px(bx + 1, by, '#b82c54');
    c.px(bx, by - 1, '#ffb0b0');
    c.px(bx + 1, by + 1, '#7a1c4c');
  }
  return c;
}

function tree(kind: 'small' | 'large'): Canvas {
  const large = kind === 'large';
  const W = large ? 72 : 44;
  const H = large ? 104 : 64;
  const c = mk(W, H);
  const cx = W >> 1;
  // trunk
  const trunkTop = large ? 52 : 34;
  const tw = large ? 12 : 7;
  const x0 = cx - (tw >> 1);
  for (let y = trunkTop; y < H; y++) {
    const flare = y > H - (large ? 12 : 6) ? Math.floor((y - (H - (large ? 12 : 6))) / (large ? 3 : 3)) : 0;
    for (let x = x0 - flare; x < x0 + tw + flare; x++) {
      const u = (x - (x0 - flare)) / (tw + flare * 2);
      let col = u < 0.22 ? BARK[3] : u < 0.55 ? BARK[2] : u < 0.85 ? BARK[1] : BARK[0];
      // bark: a few chunky vertical grooves instead of speckle
      const gx = Math.floor(u * (tw + flare * 2));
      if ((gx === 2 || gx === (large ? 7 : 4)) && (y + gx * 5) % 12 < 6 && u > 0.2 && u < 0.85) col = BARK[0];
      c.px(x, y, col);
    }
  }
  // root spurs
  const gy = H - 1;
  c.hline(x0 - (large ? 6 : 4), gy, 3, BARK[1]);
  c.hline(x0 + tw + (large ? 3 : 1), gy, 3, BARK[0]);
  // canopy
  const back: Sphere[] = [];
  const front: Sphere[] = [];
  if (large) {
    back.push(
      { cx: 18, cy: 34, rx: 16 },
      { cx: 54, cy: 34, rx: 16 },
      { cx: 36, cy: 26, rx: 20 },
      { cx: 30, cy: 46, rx: 13 },
      { cx: 44, cy: 47, rx: 12 },
    );
    front.push(
      { cx: 14, cy: 38, rx: 12, ry: 10 },
      { cx: 58, cy: 38, rx: 12, ry: 10 },
      { cx: 25, cy: 27, rx: 15, ry: 13 },
      { cx: 47, cy: 27, rx: 15, ry: 13 },
      { cx: 36, cy: 17, rx: 14, ry: 12 },
      { cx: 36, cy: 34, rx: 16, ry: 12 },
      { cx: 24, cy: 45, rx: 10, ry: 8 },
      { cx: 49, cy: 45, rx: 10, ry: 8 },
    );
  } else {
    back.push({ cx: 14, cy: 22, rx: 11 }, { cx: 30, cy: 22, rx: 11 }, { cx: 22, cy: 15, rx: 12 });
    front.push(
      { cx: 12, cy: 24, rx: 9, ry: 8 },
      { cx: 32, cy: 24, rx: 9, ry: 8 },
      { cx: 22, cy: 13, rx: 11, ry: 10 },
      { cx: 22, cy: 24, rx: 12, ry: 9 },
      { cx: 16, cy: 18, rx: 8, ry: 7 },
      { cx: 29, cy: 18, rx: 8, ry: 7 },
    );
  }
  foliage(c, back, front, large ? 11 : 5);
  // a couple of fruit/blossoms for charm (large)
  if (large) {
    for (const [x, y] of [
      [20, 40],
      [50, 30],
      [38, 48],
      [30, 22],
    ]) {
      c.px(x, y, '#ff6e8a');
      c.px(x + 1, y, '#e8485e');
      c.px(x, y + 1, '#b82c54');
    }
  }
  return c;
}

// ---------- small flora (2-frame sway) ----------
const STEM = ['#1d5a44', '#2e8a4a', '#62c056'];
function flower(kind: 'red' | 'yellow' | 'blue', frame: number): Canvas {
  const c = mk(10, 14);
  const sway = frame === 0 ? 0 : 1;
  const col = {
    red: ['#9c2458', '#e8485e', '#ff9c9c'],
    yellow: ['#c48a1c', '#ffd83c', '#fff6a8'],
    blue: ['#4a3cb4', '#8a78ee', '#d0c8ff'],
  }[kind];
  // stem (curves by sway)
  const pts: [number, number][] = [
    [4, 13],
    [4, 12],
    [4, 11],
    [4 + (sway ? 0 : 0), 10],
    [4 + sway, 9],
    [4 + sway, 8],
    [4 + sway, 7],
  ];
  for (const [x, y] of pts) c.px(x, y, STEM[1]);
  for (const [x, y] of pts) c.px(x - 1, y, STEM[0] === '' ? '' : c.get(x - 1, y));
  c.px(3, 12, STEM[1]);
  c.px(2, 11, STEM[2]);
  c.px(3, 11, STEM[1]);
  c.px(5, 10, STEM[2]);
  c.px(6, 9, STEM[2]);
  c.px(5, 11, STEM[0]);
  const hx = 4 + sway;
  if (kind === 'red') {
    // tulip-ish cup
    c.stamp(hx - 2, 2, ['.a.a.', 'abbba', 'abbbc', '.bbc.', '..c..'], { a: col[2], b: col[1], c: col[0] });
  } else if (kind === 'yellow') {
    // daisy
    c.stamp(hx - 2, 3, ['.bab.', 'bbsbb', 'absba', '.bab.'].map((r) => r), { a: col[2], b: col[1], s: '#e88a1c' });
    c.px(hx - 1, 4, col[2]);
    c.px(hx + 1, 3, col[0]);
  } else {
    // bell cluster
    c.stamp(hx - 2, 3, ['.ab.a.', 'abbabb', 'bbcbbc', '.c..c.'].map((r) => r.slice(0, 5)), { a: col[2], b: col[1], c: col[0] });
    c.px(hx + 2, 6, col[1]);
    c.px(hx + 2, 7, col[0]);
  }
  return c;
}

function tuft(variant: number, frame: number): Canvas {
  const c = mk(12, 9);
  const blades: [number, number, number][] =
    variant === 0
      ? [
          [3, 5, -1],
          [5, 7, 0],
          [7, 6, 1],
          [9, 4, 1],
        ]
      : variant === 1
        ? [
            [2, 4, -1],
            [4, 6, -1],
            [6, 8, 0],
            [8, 6, 1],
            [10, 4, 1],
          ]
        : [
            [4, 5, 0],
            [6, 7, 1],
            [8, 5, 1],
          ];
  for (const [bx, h, lean] of blades) {
    for (let k = 0; k < h; k++) {
      const t = k / h;
      const off = Math.round(lean * (frame ? -1 : 1) * t * 1.6 + (frame ? 1 : 0) * t);
      const col = k > h - 3 ? STEM[2] : k > 1 ? STEM[1] : STEM[0];
      c.px(bx + off, 8 - k, col);
    }
  }
  c.hline(2, 8, 9, STEM[0]);
  return c;
}

function tallGrass(frame: number): Canvas {
  const c = mk(16, 16);
  const blades: [number, number, number][] = [
    [2, 9, -1],
    [4, 13, -1],
    [6, 11, 0],
    [8, 15, 1],
    [10, 12, 1],
    [12, 10, 1],
    [14, 8, 0],
  ];
  for (const [bx, h, lean] of blades) {
    for (let k = 0; k < h; k++) {
      const t = k / h;
      const off = Math.round(lean * t * 2) + (frame ? Math.round(t * 2) : 0) - (frame ? 0 : Math.round(t));
      const col = k > h - 4 ? STEM[2] : k > 4 ? STEM[1] : STEM[0];
      c.px(bx + off, 15 - k, col);
      if (k > 3 && k < h - 2 && (bx + k) % 3 === 0) c.px(bx + off + 1, 15 - k, STEM[0]);
    }
  }
  c.hline(1, 15, 14, STEM[0]);
  return c;
}

// ---------- mushrooms (original violet / teal toadstools) ----------
function mushroom(kind: 'violet' | 'teal' | 'cluster'): Canvas {
  const cap =
    kind === 'teal'
      ? ['#0e4a5c', '#178a8a', '#2cc4a4', '#7cf0c8', '#d0fff0']
      : ['#3c1c64', '#6a3a9a', '#9c5ac8', '#d08af0', '#f0c8ff'];
  const one = (w: number, h: number, capR: number): Canvas => {
    const c = mk(w, h);
    const cx = w / 2;
    const capH = Math.round(capR * 0.8);
    const stalkW = Math.max(3, Math.round(capR * 0.7));
    // stalk
    for (let y = capH; y < h - 1; y++)
      for (let x = 0; x < stalkW; x++) {
        const sx = Math.floor(cx - stalkW / 2) + x;
        c.px(sx, y, x === 0 ? '#f4ead6' : x === stalkW - 1 ? '#a48c88' : '#dcc8b4');
      }
    c.hline(Math.floor(cx - stalkW / 2) - 1, h - 1, stalkW + 2, '#a48c88');
    // cap
    paintSpheres(c, [{ cx, cy: capH - 0.5, rx: capR, ry: capH }], { ramp: cap, dither: 0.6, bias: 0.05 });
    // gills shadow: cut the lower half-row flat
    for (let x = 0; x < w; x++) for (let y = capH; y < capH + 1; y++) if (c.has(x, y) && Math.abs(x + 0.5 - cx) > stalkW / 2) c.px(x, y, cap[0]);
    for (let x = 0; x < w; x++) for (let y = capH + 1; y < capH + 3; y++) if (Math.abs(x + 0.5 - cx) > stalkW / 2 + 0.5 && c.get(x, y) !== '') c.px(x, y, '');
    // spots
    for (const [sx, sy] of [
      [cx - capR * 0.45, capH * 0.45],
      [cx + capR * 0.2, capH * 0.3],
      [cx + capR * 0.55, capH * 0.72],
    ]) {
      c.px(sx, sy, '#fff0d0');
      c.px(sx + 1, sy, '#f4d8b0');
    }
    softOutline(c, cap[0]);
    return c;
  };
  if (kind === 'cluster') {
    const c = mk(26, 16);
    c.blit(one(10, 12, 5), 0, 4);
    c.blit(one(14, 16, 7), 8, 0);
    c.blit(one(8, 9, 4), 18, 7);
    return c;
  }
  return kind === 'violet' ? one(14, 14, 6.5) : one(10, 10, 4.5);
}

// ---------- rocks ----------
function rock(w: number, h: number, lobes: [number, number, number, number][], moss: boolean, seed: number): Canvas {
  const c = mk(w, h);
  const sp = lobes.map(([cx, cy, rx, ry]) => ({ cx, cy, rx, ry }));
  paintSpheres(c, sp, { ramp: ROCK, dither: 0.55, tex: 0.6, texSeed: seed });
  softOutline(c, ROCK[0]);
  // flat shadowed base
  c.hline(1, h - 1, w - 2, ROCK[0]);
  if (moss) {
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        if (!c.has(x, y)) continue;
        if (c.has(x, y - 1)) continue;
        // moss on the top surface only
        const n = hash2(x, y, seed);
        if (n < 0.75 && c.get(x, y) !== ROCK[0]) {
          c.px(x, y, FOL[3]);
          if (c.has(x, y + 1) && n < 0.45) c.px(x, y + 1, FOL[2]);
          if (x % 3 === 0) c.px(x, y - 1, FOL[4]);
        }
      }
    }
  }
  return c;
}

// ---------- wood pieces ----------
function fencePiece(kind: 'l' | 'm' | 'r' | 'broken'): Canvas {
  const c = mk(16, 18);
  const post = (x: number, top: number) => {
    c.rect(x, top, 4, 18 - top, WOODC[2]);
    c.vline(x, top, 18 - top, WOODC[3]);
    c.vline(x + 3, top, 18 - top, WOODC[1]);
    c.hline(x, top, 4, WOODC[3]);
    c.px(x + 3, top, WOODC[1]);
    c.px(x, top, '');
    c.px(x + 3, top, '');
    c.hline(x, 17, 4, WOODC[0]);
  };
  const rail = (y: number, x0: number, x1: number) => {
    c.hline(x0, y, x1 - x0, WOODC[3]);
    c.hline(x0, y + 1, x1 - x0, WOODC[2]);
    c.hline(x0, y + 2, x1 - x0, WOODC[1]);
  };
  if (kind === 'l') {
    rail(6, 6, 16);
    rail(11, 6, 16);
    post(2, 3);
  } else if (kind === 'r') {
    rail(6, 0, 10);
    rail(11, 0, 10);
    post(10, 3);
  } else if (kind === 'm') {
    rail(6, 0, 16);
    rail(11, 0, 16);
    post(6, 4);
  } else {
    rail(6, 0, 7);
    rail(11, 0, 16);
    post(10, 7);
    c.px(7, 7, WOODC[1]);
    c.px(8, 8, WOODC[0]);
  }
  c.px(1, 14, '#8ab04a');
  return c;
}

function signpost(): Canvas {
  const c = mk(24, 30);
  // post
  c.rect(10, 8, 4, 22, WOODC[2]);
  c.vline(10, 8, 22, WOODC[3]);
  c.vline(13, 8, 22, WOODC[1]);
  c.hline(9, 29, 6, WOODC[0]);
  // board
  c.rect(2, 2, 20, 11, WOODC[2]);
  c.hline(2, 2, 20, WOODC[3]);
  c.hline(2, 3, 20, WOODC[3]);
  c.hline(2, 12, 20, WOODC[0]);
  c.vline(2, 2, 11, WOODC[3]);
  c.vline(21, 2, 11, WOODC[1]);
  c.px(2, 2, '');
  c.px(21, 2, '');
  c.px(2, 12, '');
  c.px(21, 12, '');
  // arrow glyph
  for (let x = 6; x <= 16; x++) c.px(x, 7, WOODC[0]);
  c.px(15, 6, WOODC[0]);
  c.px(15, 8, WOODC[0]);
  c.px(14, 5, WOODC[0]);
  c.px(14, 9, WOODC[0]);
  c.px(4, 4, '#4a3020');
  c.px(19, 10, '#4a3020');
  return c;
}

function bridgePiece(kind: 'l' | 'm' | 'r'): Canvas {
  const c = mk(16, 20);
  // deck planks y=10..13
  for (let y = 10; y <= 13; y++) for (let x = 0; x < 16; x++) c.px(x, y, y === 10 ? WOODC[3] : y === 13 ? WOODC[0] : WOODC[2]);
  for (const sx of [3, 8, 13]) for (let y = 10; y <= 12; y++) c.px(sx, y, WOODC[1]);
  c.hline(0, 14, 16, WOODC[0]);
  for (let x = 0; x < 16; x += 2) c.px(x, 15, WOODC[0]);
  // rope rail
  const ropeY = (x: number) => 4 + Math.round(Math.sin((x / 15) * Math.PI) * 1.5);
  for (let x = 0; x < 16; x++) {
    c.px(x, ropeY(x), '#e8d09c');
    c.px(x, ropeY(x) + 1, '#a07c58');
  }
  const pole = (x: number) => {
    c.rect(x, 2, 3, 12, WOODC[2]);
    c.vline(x, 2, 12, WOODC[3]);
    c.vline(x + 2, 2, 12, WOODC[1]);
    c.px(x, 2, '');
    c.px(x + 2, 2, '');
    c.px(x + 1, 2, WOODC[3]);
  };
  if (kind === 'l') pole(0);
  if (kind === 'r') pole(13);
  if (kind === 'm') for (const x of [5]) for (let y = 6; y < 10; y++) c.px(x, y, '#a07c58');
  return c;
}

function vine(part: 'top' | 'mid' | 'end', frame: number): Canvas {
  const c = mk(16, 16);
  const sway = (y: number) => (frame ? Math.round(Math.sin(y / 3) * 1.4) : Math.round(Math.cos(y / 3) * 1.4));
  const sx = 8;
  for (let y = 0; y < 16; y++) {
    const x = sx + sway(y + (part === 'end' ? 0 : 0));
    c.px(x, y, STEM[1]);
    c.px(x + 1, y, STEM[0]);
    if (y % 6 === 2) {
      // leaf pair
      c.stamp(x - 4, y, ['..b', 'bbc'], { b: FOL[3], c: FOL[1] });
      c.stamp(x + 2, y + 1, ['b..', 'cbb'], { b: FOL[2], c: FOL[1] });
      c.px(x - 4, y, FOL[5]);
    }
  }
  if (part === 'top') {
    c.rect(2, 0, 12, 2, '#235f48');
    for (let x = 2; x < 14; x += 2) c.px(x, 2, '#34884a');
    c.hline(3, 0, 6, FOL[4]);
  }
  if (part === 'end') {
    const x = sx + sway(15);
    c.stamp(x - 2, 11, ['.bbb.', 'bdbbb', '.bbb.'].map((r) => r), { b: '#ff9ad0', d: '#fff0f8' });
    c.px(x, 14, '#b82c6c');
  }
  return c;
}

function log(): Canvas {
  const c = mk(36, 16);
  // body
  for (let y = 2; y < 15; y++)
    for (let x = 4; x < 36; x++) {
      const t = (y - 2) / 12;
      let col = t < 0.15 ? BARK[4] : t < 0.4 ? BARK[3] : t < 0.7 ? BARK[2] : t < 0.88 ? BARK[1] : BARK[0];
      if ((x * 3 + y * 5) % 17 === 0 && t > 0.2 && t < 0.85) col = BARK[0];
      c.px(x, y, col);
    }
  // end-grain ellipse
  for (let y = 2; y < 15; y++)
    for (let x = 0; x < 9; x++) {
      const nx = (x - 4.5) / 4.5;
      const ny = (y - 8) / 6.4;
      const d = nx * nx + ny * ny;
      if (d < 1) {
        const ring = Math.floor(Math.sqrt(d) * 4);
        c.px(x, y, ring === 3 ? BARK[2] : ring === 2 ? '#e8c090' : ring === 1 ? '#c89868' : '#ecc898');
      }
    }
  // moss top
  for (let x = 6; x < 34; x++) {
    const h = 2 + Math.round(Math.sin(x * 0.9) + hash2(x, 3, 4) * 1.6);
    for (let y = 1; y < 2 + h; y++) {
      if (y > 1 + h - 1 && hash2(x, y, 9) < 0.5) continue;
      c.px(x, y, y === 1 ? FOL[4] : y < 3 ? FOL[3] : FOL[2]);
    }
  }
  // tiny shelf mushrooms
  c.stamp(22, 10, ['.bbb.', 'bbbbb'], { b: '#d08af0' });
  c.px(23, 10, '#f0c8ff');
  softOutline(c, BARK[0]);
  return c;
}

// ---------- water ----------
/** 16x16 water surface tile: 4 frames, seamless horizontally and loops after 4 frames. */
function waterTop(frame: number, pal: string[] = WATER): Canvas {
  const c = mk(16, 16, true);
  const rows = [pal[3], pal[3], pal[2], pal[2], pal[2], pal[1], pal[1], pal[1], pal[1], pal[1], pal[0], pal[0], pal[0], pal[0], pal[0], pal[0]];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) c.px(x, y, rows[y]);
  // crest line scrolling 2px/frame, period 8
  for (let x = 0; x < 16; x++) {
    const p = (x - frame * 2 + 16) % 8;
    if (p < 3) c.px(x, 0, pal[4]);
    if (p === 1) c.px(x, 1, pal[4]);
    if (p === 4 || p === 5) c.px(x, 0, pal[3]);
    // fringe of the surface
    if (p === 6 || p === 7) c.px(x, 0, '');
  }
  // body ripples
  for (let x = 0; x < 16; x++) {
    const p = (x + frame * 2) % 8;
    if (p < 2) c.px(x, 4, pal[3]);
    if (p === 4 || p === 5) c.px(x, 7, pal[2]);
    if (p === 0 || p === 1) c.px(x, 10, pal[1]);
  }
  // dither into the deep
  for (let x = 0; x < 16; x++) {
    if ((x + 1) % 2 === 0) c.px(x, 9, pal[0]);
    if (x % 2 === 0) c.px(x, 12, pal[1]);
  }
  // twinkle
  if (frame === 1) {
    c.px(3, 3, pal[4]);
    c.px(2, 3, pal[3]);
    c.px(4, 3, pal[3]);
    c.px(3, 2, pal[3]);
    c.px(3, 4, pal[3]);
  }
  if (frame === 3) {
    c.px(11, 5, pal[4]);
    c.px(10, 5, pal[3]);
    c.px(12, 5, pal[3]);
    c.px(11, 4, pal[3]);
    c.px(11, 6, pal[3]);
  }
  return c;
}
function waterBody(frame: number, pal: string[] = WATER): Canvas {
  const c = mk(16, 16, true);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) c.px(x, y, y < 6 ? pal[1] : y < 12 ? pal[0] : pal[0]);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      // checker dither between bands
      if (y === 5 && x % 2 === 0) c.px(x, y, pal[0]);
      if (y === 6 && x % 2 === 1) c.px(x, y, pal[1]);
    }
  for (let x = 0; x < 16; x++) {
    const p = (x - frame * 2 + 16) % 8;
    if (p < 3) c.px(x, 2, pal[2]);
    if (p === 5 || p === 6) c.px(x, 8, pal[1]);
    if (p === 1 || p === 2) c.px(x, 13, pal[1]);
  }
  if (frame === 2) {
    c.px(6, 9, pal[3]);
    c.px(5, 9, pal[2]);
    c.px(7, 9, pal[2]);
  }
  return c;
}

function fallPiece(part: 'top' | 'mid' | 'foot', frame: number): Canvas {
  const c = mk(16, 16);
  const pal = WATER;
  const x0 = 2;
  const x1 = 13;
  for (let y = 0; y < 16; y++)
    for (let x = x0; x <= x1; x++) {
      const u = (x - x0) / (x1 - x0);
      const phase = (y + frame * 4 + (x % 3) * 3) % 12;
      let col = u < 0.25 ? pal[3] : u < 0.7 ? pal[2] : pal[1];
      if (phase < 3) col = u < 0.6 ? pal[4] : pal[3];
      else if (phase === 6 || phase === 7) col = pal[1];
      c.px(x, y, col);
    }
  // foam edges
  for (let y = 0; y < 16; y++) {
    c.px(x0 - 1, y, (y + frame * 4) % 5 < 2 ? pal[4] : pal[3]);
    c.px(x1 + 1, y, (y + frame * 4) % 6 < 2 ? pal[3] : pal[1]);
  }
  if (part === 'top') {
    // lip: rounded curve at the top
    for (let x = x0 - 1; x <= x1 + 1; x++) for (let y = 0; y < 3; y++) if (y + 1 < Math.abs(x - 7.5) / 2.6 - 0.5) c.px(x, y, '');
    c.hline(x0, 2, x1 - x0 + 1, pal[4]);
  }
  if (part === 'foot') {
    for (let y = 9; y < 16; y++) for (let x = 0; x < 16; x++) c.px(x, y, '');
    // mist burst
    const r = [4, 5, 4][frame % 3];
    const spl: Sphere[] = [
      { cx: 5, cy: 12, rx: r, ry: 3 },
      { cx: 10.5, cy: 12.5, rx: r, ry: 3 },
      { cx: 8, cy: 11, rx: 5, ry: 3.4 },
    ];
    paintSpheres(c, spl, { ramp: [pal[2], pal[3], pal[4], '#ffffff'], dither: 0.7, bias: 0.1 });
    // body of water below the mist
    for (let x = 0; x < 16; x++) for (let y = 13; y < 16; y++) c.px(x, y, y === 13 ? pal[3] : y === 14 ? pal[2] : pal[1]);
    c.px(1 + frame * 5, 10, pal[4]);
    c.px(12 - frame * 3, 9, pal[4]);
  }
  return c;
}

function lily(frame: number): Canvas {
  const c = mk(12, 6);
  c.stamp(0, 1, ['.bbbbbb.', 'bbddbbbb', 'bbbbbbb.', '.cbbbc..'].map((r) => r), { b: FOL[3], c: FOL[1], d: FOL[5] });
  c.px(4, 1, '#d0f276');
  if (frame) {
    c.px(9, 0, '#ff9ad0');
    c.px(10, 0, '#ffe0f0');
    c.px(10, 1, '#ff9ad0');
  } else {
    c.px(9, 1, '#ff9ad0');
    c.px(10, 1, '#ffe0f0');
  }
  return c;
}

// ---------- caverns ----------
export const CRY_M = ['#7a1670', '#c4329e', '#ff6cd0', '#ffc0f0'];
export const CRY_C = ['#0e5c88', '#22acd0', '#5cecf4', '#c8ffff'];
export const CAVE_ROCK = ['#221a4c', '#403478', '#6654a8', '#9a86d8', '#c4b4f8'];

export function shard(c: Canvas, cx: number, baseY: number, w: number, h: number, lean: number, ramp: string[], glow: boolean): void {
  // pointed hex prism: left facet lit, right facet dark, bright core line
  const top = baseY - h;
  for (let y = top; y <= baseY; y++) {
    const t = (y - top) / h;
    const half = t < 0.25 ? (t / 0.25) * (w / 2) : w / 2;
    const off = lean * (1 - t);
    const x0 = Math.round(cx + off - half);
    const x1 = Math.round(cx + off + half - 1);
    for (let x = x0; x <= x1; x++) {
      const u = (x - x0) / Math.max(1, x1 - x0);
      let col = u < 0.34 ? ramp[2] : u < 0.72 ? ramp[1] : ramp[0];
      if (u < 0.2 && t > 0.15 && t < 0.8) col = ramp[3];
      if (glow && u < 0.5 && t > 0.3 && t < 0.6) col = ramp[3];
      c.px(x, y, col);
    }
  }
  c.px(Math.round(cx + lean), top, ramp[3]);
}

function crystals(size: 's' | 'm' | 'l', frame: number): Canvas {
  const dims = { s: [20, 18], m: [32, 28], l: [46, 44] }[size];
  const c = mk(dims[0], dims[1]);
  const g = frame === 1;
  if (size === 's') {
    shard(c, 7, 17, 6, 12, -1, CRY_C, g);
    shard(c, 13, 17, 5, 8, 1, CRY_M, g);
  } else if (size === 'm') {
    shard(c, 10, 27, 8, 22, -2, CRY_M, g);
    shard(c, 19, 27, 7, 15, 2, CRY_C, g);
    shard(c, 25, 27, 5, 9, 1, CRY_M, g);
    shard(c, 4, 27, 4, 8, -1, CRY_C, g);
  } else {
    shard(c, 15, 43, 10, 34, -3, CRY_C, g);
    shard(c, 28, 43, 11, 28, 2, CRY_M, g);
    shard(c, 22, 43, 8, 40, 0, CRY_M, g);
    shard(c, 38, 43, 7, 17, 3, CRY_C, g);
    shard(c, 6, 43, 6, 14, -2, CRY_M, g);
  }
  // rocky base
  for (let x = 1; x < c.w - 1; x++) {
    c.px(x, c.h - 1, CAVE_ROCK[1]);
    if (x % 3 !== 0) c.px(x, c.h - 2, CAVE_ROCK[2]);
  }
  softOutline(c, '#14103c');
  // sparkle on glow frame
  if (g) {
    const sx = Math.floor(c.w * 0.3);
    c.px(sx, 3, '#ffffff');
    c.px(sx - 1, 3, CRY_C[3]);
    c.px(sx + 1, 3, CRY_C[3]);
    c.px(sx, 2, CRY_C[3]);
    c.px(sx, 4, CRY_C[3]);
  }
  return c;
}

function stalactite(len: number, w: number, hangs: 'down' | 'up'): Canvas {
  const c = mk(w, len);
  for (let i = 0; i < len; i++) {
    const t = i / (len - 1);
    const half = Math.max(0.5, (w / 2) * (1 - t * 0.92));
    const y = hangs === 'down' ? i : len - 1 - i;
    const x0 = Math.round(w / 2 - half);
    const x1 = Math.round(w / 2 + half - 1);
    for (let x = x0; x <= x1; x++) {
      const u = (x - x0) / Math.max(1, x1 - x0);
      let col = u < 0.3 ? CAVE_ROCK[3] : u < 0.65 ? CAVE_ROCK[2] : CAVE_ROCK[1];
      if (u < 0.12) col = CAVE_ROCK[4];
      // banding rings every few rows
      if (i % 5 === 3 && u > 0.15) col = col === CAVE_ROCK[3] ? CAVE_ROCK[2] : CAVE_ROCK[1];
      c.px(x, y, col);
    }
  }
  softOutline(c, '#14103c');
  return c;
}

function drip(frame: number): Canvas {
  const c = mk(8, 28);
  // 0: bead forming at the tip, 1: falling, 2: falling faster, 3: splash at bottom
  const W = CRY_C;
  if (frame === 0) {
    c.px(3, 0, W[1]);
    c.px(4, 0, W[1]);
    c.px(3, 1, W[2]);
    c.px(4, 1, W[1]);
    c.px(3, 2, W[3]);
    c.px(4, 2, W[2]);
    c.px(3, 3, W[2]);
    c.px(4, 3, W[1]);
  } else if (frame === 1) {
    c.px(3, 11, W[2]);
    c.px(4, 11, W[1]);
    c.px(3, 12, W[3]);
    c.px(4, 12, W[2]);
    c.px(3, 13, W[2]);
    c.px(4, 13, W[1]);
    c.px(3, 10, W[1]);
  } else if (frame === 2) {
    c.px(3, 20, W[2]);
    c.px(4, 21, W[3]);
    c.px(3, 21, W[2]);
    c.px(4, 22, W[1]);
    c.px(3, 22, W[2]);
    c.px(3, 19, W[1]);
    c.px(3, 18, W[0]);
  } else {
    c.hline(1, 26, 6, W[2]);
    c.hline(0, 27, 8, W[1]);
    c.px(3, 24, W[3]);
    c.px(2, 25, W[3]);
    c.px(5, 25, W[3]);
    c.px(3, 27, W[3]);
  }
  return c;
}

function lampMushroom(size: 's' | 'l', frame: number): Canvas {
  const big = size === 'l';
  const w = big ? 26 : 16;
  const h = big ? 28 : 18;
  const c = mk(w, h);
  const capR = big ? 10 : 6;
  const cx = w / 2;
  const capH = Math.round(capR * 0.75);
  const cy = big ? 9 : 6;
  // soft glow halo (translucent, dithered rings)
  const halo = frame ? '#52eaf430' : '#52eaf418';
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.1);
      if (d > capR - 1 && d < capR + (frame ? 7 : 5) && (x + y) % 2 === 0) c.px(x, y, halo);
    }
  // stalk
  const sw = big ? 5 : 3;
  for (let y = cy + capH - 1; y < h - 1; y++)
    for (let x = 0; x < sw; x++) c.px(Math.floor(cx - sw / 2) + x, y, x === 0 ? '#f8f2ff' : x === sw - 1 ? '#8a78c8' : '#c4b4f8');
  c.hline(Math.floor(cx - sw / 2) - 1, h - 1, sw + 2, '#6654a8');
  const cap = frame ? ['#0a3c78', '#1680c0', '#2cc0e4', '#7cf0f8', '#d8ffff'] : ['#0a3470', '#1268a8', '#1ea8d4', '#5ce0f0', '#b8fcff'];
  paintSpheres(c, [{ cx, cy: cy, rx: capR, ry: capH }], { ramp: cap, light: [-0.5, -0.7, 0.4], dither: 0, bias: -0.06 });
  // dark outline so the lamp reads as a prop, not as terrain
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (c.get(x, y) === cap[0]) c.px(x, y, '#0a2458');
  for (const [sx, sy] of [
    [cx - capR * 0.4, cy - capH * 0.35],
    [cx + capR * 0.3, cy - capH * 0.15],
    [cx - capR * 0.05, cy + capH * 0.25],
  ]) {
    c.px(sx, sy, '#ff9ae0');
    if (big) c.px(sx + 1, sy, '#ff6cd0');
  }
  return c;
}

// ---------- registry ----------
export interface PropSet {
  defs: PropDef[];
  frames: Record<string, Canvas>;
}

function add(set: PropSet, region: RegionId, id: string, frames: Canvas[], fps: number, anchor: { x: number; y: number } | 'bottom' | 'top', placement: PropDef['placement'], layer: PropDef['layer']): void {
  const names = frames.map((_, i) => (frames.length === 1 ? id : `${id}_${i}`));
  names.forEach((n, i) => (set.frames[n] = frames[i]));
  const f = frames[0];
  const a = anchor === 'bottom' ? { x: f.w >> 1, y: f.h } : anchor === 'top' ? { x: f.w >> 1, y: 0 } : anchor;
  set.defs.push({ id, region, frames: names, fps, w: f.w, h: f.h, anchor: a, placement, layer, solid: false });
}

export function buildMeadowProps(): PropSet {
  const s: PropSet = { defs: [], frames: {} };
  const R: RegionId = 'meadow';
  add(s, R, 'bush_s', [bush(22, 15, [[7, 9, 6], [14, 9, 6], [11, 6, 6]], [[6, 8]], 1)], 0, 'bottom', 'ground', 'back');
  add(s, R, 'bush_l', [bush(38, 24, [[9, 15, 8], [19, 12, 10], [29, 15, 8], [15, 16, 8], [24, 17, 8]], [[8, 14], [24, 10], [30, 16], [17, 18]], 2)], 0, 'bottom', 'ground', 'back');
  add(s, R, 'tree_s', [tree('small')], 0, 'bottom', 'ground', 'back');
  add(s, R, 'tree_l', [tree('large')], 0, 'bottom', 'ground', 'back');
  for (const k of ['red', 'yellow', 'blue'] as const) add(s, R, `flower_${k}`, [flower(k, 0), flower(k, 1)], 2, 'bottom', 'ground', 'back');
  for (let v = 0; v < 3; v++) add(s, R, `tuft_${v}`, [tuft(v, 0), tuft(v, 1)], 2, 'bottom', 'ground', 'front');
  add(s, R, 'tall_grass', [tallGrass(0), tallGrass(1)], 2, 'bottom', 'ground', 'front');
  add(s, R, 'mush_violet', [mushroom('violet')], 0, 'bottom', 'ground', 'back');
  add(s, R, 'mush_teal', [mushroom('teal')], 0, 'bottom', 'ground', 'back');
  add(s, R, 'mush_cluster', [mushroom('cluster')], 0, 'bottom', 'ground', 'back');
  add(s, R, 'rock_s', [rock(12, 8, [[6, 5, 5.5, 3.6]], false, 3)], 0, 'bottom', 'ground', 'back');
  add(s, R, 'rock_m', [rock(20, 13, [[6, 8, 6, 5], [13, 7, 7, 6]], true, 4)], 0, 'bottom', 'ground', 'back');
  add(s, R, 'rock_l', [rock(30, 20, [[9, 12, 9, 8], [20, 11, 10, 9], [15, 7, 8, 7]], true, 5)], 0, 'bottom', 'ground', 'back');
  add(s, R, 'fence_l', [fencePiece('l')], 0, 'bottom', 'ground', 'back');
  add(s, R, 'fence_m', [fencePiece('m')], 0, 'bottom', 'ground', 'back');
  add(s, R, 'fence_r', [fencePiece('r')], 0, 'bottom', 'ground', 'back');
  add(s, R, 'fence_broken', [fencePiece('broken')], 0, 'bottom', 'ground', 'back');
  add(s, R, 'signpost', [signpost()], 0, 'bottom', 'ground', 'back');
  add(s, R, 'bridge_l', [bridgePiece('l')], 0, { x: 8, y: 10 }, 'free', 'back');
  add(s, R, 'bridge_m', [bridgePiece('m')], 0, { x: 8, y: 10 }, 'free', 'back');
  add(s, R, 'bridge_r', [bridgePiece('r')], 0, { x: 8, y: 10 }, 'free', 'back');
  for (const p of ['top', 'mid', 'end'] as const) add(s, R, `vine_${p}`, [vine(p, 0), vine(p, 1)], 1.5, 'top', 'ceiling', 'front');
  add(s, R, 'log_mossy', [log()], 0, 'bottom', 'ground', 'back');
  add(s, R, 'water_top', [0, 1, 2, 3].map((f) => waterTop(f)), 6, 'top', 'water', 'front');
  add(s, R, 'water_body', [0, 1, 2, 3].map((f) => waterBody(f)), 6, 'top', 'water', 'front');
  add(s, R, 'fall_top', [0, 1, 2].map((f) => fallPiece('top', f)), 9, 'top', 'free', 'back');
  add(s, R, 'fall_mid', [0, 1, 2].map((f) => fallPiece('mid', f)), 9, 'top', 'free', 'back');
  add(s, R, 'fall_foot', [0, 1, 2].map((f) => fallPiece('foot', f)), 9, 'top', 'free', 'front');
  add(s, R, 'lily', [lily(0), lily(1)], 1, 'top', 'water', 'front');
  return s;
}

export function buildSunsetProps(): PropSet {
  const base = buildMeadowProps();
  const frames: Record<string, Canvas> = {};
  for (const [k, v] of Object.entries(base.frames)) frames[k] = mapInks(v, tintSunset);
  return { defs: base.defs.map((d) => ({ ...d, region: 'meadow_sunset' as RegionId })), frames };
}

export function buildCavernProps(): PropSet {
  const s: PropSet = { defs: [], frames: {} };
  const R: RegionId = 'caverns';
  for (const z of ['s', 'm', 'l'] as const) add(s, R, `crystal_${z}`, [crystals(z, 0), crystals(z, 1)], 1.6, 'bottom', 'ground', 'back');
  add(s, R, 'stalactite_s', [stalactite(14, 7, 'down')], 0, 'top', 'ceiling', 'back');
  add(s, R, 'stalactite_m', [stalactite(24, 10, 'down')], 0, 'top', 'ceiling', 'back');
  add(s, R, 'stalactite_l', [stalactite(40, 14, 'down')], 0, 'top', 'ceiling', 'back');
  add(s, R, 'stalagmite_s', [stalactite(12, 7, 'up')], 0, 'bottom', 'ground', 'back');
  add(s, R, 'stalagmite_m', [stalactite(22, 10, 'up')], 0, 'bottom', 'ground', 'back');
  add(s, R, 'stalagmite_l', [stalactite(34, 14, 'up')], 0, 'bottom', 'ground', 'back');
  add(s, R, 'drip', [0, 1, 2, 3].map((f) => drip(f)), 3, 'top', 'ceiling', 'front');
  add(s, R, 'lamp_s', [lampMushroom('s', 0), lampMushroom('s', 1)], 1.3, 'bottom', 'ground', 'back');
  add(s, R, 'lamp_l', [lampMushroom('l', 0), lampMushroom('l', 1)], 1.3, 'bottom', 'ground', 'back');
  const CW = ['#0e2a6a', '#1a64b8', '#2cb4d8', '#7cf0f4', '#d8ffff'];
  add(s, R, 'water_top', [0, 1, 2, 3].map((f) => waterTop(f, CW)), 6, 'top', 'water', 'front');
  add(s, R, 'water_body', [0, 1, 2, 3].map((f) => waterBody(f, CW)), 6, 'top', 'water', 'front');
  // shared flora that also thrives underground (bio-luminescent tint)
  add(s, R, 'mush_violet', [mushroom('violet')], 0, 'bottom', 'ground', 'back');
  add(s, R, 'mush_teal', [mushroom('teal')], 0, 'bottom', 'ground', 'back');
  add(s, R, 'mush_cluster', [mushroom('cluster')], 0, 'bottom', 'ground', 'back');
  add(s, R, 'rock_s', [rock(12, 8, [[6, 5, 5.5, 3.6]], false, 13)], 0, 'bottom', 'ground', 'back');
  add(s, R, 'rock_m', [rock(20, 13, [[6, 8, 6, 5], [13, 7, 7, 6]], false, 14)], 0, 'bottom', 'ground', 'back');
  add(s, R, 'bridge_l', [bridgePiece('l')], 0, { x: 8, y: 10 }, 'free', 'back');
  add(s, R, 'bridge_m', [bridgePiece('m')], 0, { x: 8, y: 10 }, 'free', 'back');
  add(s, R, 'bridge_r', [bridgePiece('r')], 0, { x: 8, y: 10 }, 'free', 'back');
  return s;
}

export function canvasesToBitmaps(set: PropSet): Record<string, Bitmap> {
  const o: Record<string, Bitmap> = {};
  for (const [k, v] of Object.entries(set.frames)) o[k] = v.toBitmap();
  return o;
}
