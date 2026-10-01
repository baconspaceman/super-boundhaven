// Pixel painter used by the world art. Browser-safe. Everything deterministic (no Math.random).
import { createBitmap, hexToRGBA, type Bitmap, type Palette } from '../core';

/** Deterministic PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer hash of two ints (+ salt) -> [0,1). Stable across platforms. */
export function hash2(a: number, b: number, s = 0): number {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(s | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
/** Ordered-dither threshold in (0,1). */
export function bayer4(x: number, y: number): number {
  return (BAYER4[y & 3][x & 3] + 0.5) / 16;
}

/**
 * A paintable pixel canvas. Each pixel stores an "ink": a palette character (resolved through `pal`)
 * or a literal '#rrggbb'. Empty string = transparent. Optional horizontal wrap for seamless layers.
 */
export class Canvas {
  readonly ink: string[];
  constructor(
    readonly w: number,
    readonly h: number,
    readonly pal: Palette = {},
    readonly wrapX = false,
  ) {
    this.ink = new Array<string>(w * h).fill('');
  }

  inb(x: number, y: number): boolean {
    return y >= 0 && y < this.h && (this.wrapX || (x >= 0 && x < this.w));
  }
  private idx(x: number, y: number): number {
    if (this.wrapX) x = ((x % this.w) + this.w) % this.w;
    return y * this.w + x;
  }
  px(x: number, y: number, c: string | null | undefined): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (!this.inb(x, y)) return;
    const i = this.idx(x, y);
    if (c && c.length === 9 && c[0] === '#') {
      // translucent ink over an existing pixel blends into an opaque literal (keeps single-canvas layers opaque)
      const a = parseInt(c.slice(7, 9), 16) / 255;
      const under = this.resolve(this.ink[i]);
      if (under && under[3] === 255 && a < 1) {
        const [r, g, b] = hexToRGBA(c);
        const h = (v: number) => Math.round(v).toString(16).padStart(2, '0');
        this.ink[i] = `#${h(r * a + under[0] * (1 - a))}${h(g * a + under[1] * (1 - a))}${h(b * a + under[2] * (1 - a))}`;
        return;
      }
    }
    this.ink[i] = c && c !== '.' ? c : '';
  }
  clear(x: number, y: number): void {
    if (this.inb(x, y)) this.ink[this.idx(x, y)] = '';
  }
  get(x: number, y: number): string {
    x = Math.floor(x);
    y = Math.floor(y);
    if (!this.inb(x, y)) return '';
    return this.ink[this.idx(x, y)];
  }
  has(x: number, y: number): boolean {
    return this.get(x, y) !== '';
  }
  rect(x: number, y: number, w: number, h: number, c: string): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
  }
  hline(x: number, y: number, len: number, c: string): void {
    for (let i = 0; i < len; i++) this.px(x + i, y, c);
  }
  vline(x: number, y: number, len: number, c: string): void {
    for (let j = 0; j < len; j++) this.px(x, y + j, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: string): void {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }
  /** Stamp ASCII rows ('.' = skip, ' ' = skip). Characters are palette chars or keys of `map`. */
  stamp(x: number, y: number, rows: string[], map?: Record<string, string>): void {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '.' || ch === ' ') continue;
        this.px(x + i, y + j, map ? (map[ch] ?? ch) : ch);
      }
    });
  }
  blit(src: Canvas, dx: number, dy: number): void {
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) {
        const c = src.ink[y * src.w + x];
        if (c) this.px(dx + x, dy + y, c);
      }
  }
  flipH(): Canvas {
    const o = new Canvas(this.w, this.h, this.pal, this.wrapX);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) o.ink[y * this.w + (this.w - 1 - x)] = this.ink[y * this.w + x];
    return o;
  }
  clone(): Canvas {
    const o = new Canvas(this.w, this.h, this.pal, this.wrapX);
    o.ink.splice(0, o.ink.length, ...this.ink);
    return o;
  }
  crop(x: number, y: number, w: number, h: number): Canvas {
    const o = new Canvas(w, h, this.pal);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) o.ink[j * w + i] = this.get(x + i, y + j);
    return o;
  }
  resolve(ink: string): [number, number, number, number] | null {
    if (!ink) return null;
    const hex = ink[0] === '#' ? ink : this.pal[ink];
    if (!hex) return null;
    return hexToRGBA(hex);
  }
  toBitmap(): Bitmap {
    const b = createBitmap(this.w, this.h);
    for (let i = 0; i < this.ink.length; i++) {
      const rgba = this.resolve(this.ink[i]);
      if (!rgba) continue;
      b.data.set(rgba, i * 4);
    }
    return b;
  }
  /** Replace every pixel whose ink is in `map`. */
  remap(map: Record<string, string>): Canvas {
    const o = this.clone();
    for (let i = 0; i < o.ink.length; i++) if (map[o.ink[i]] !== undefined) o.ink[i] = map[o.ink[i]];
    return o;
  }
}

export function fromAscii(rows: string[], pal: Palette): Canvas {
  const w = Math.max(...rows.map((r) => r.length));
  const c = new Canvas(w, rows.length, pal);
  c.stamp(0, 0, rows);
  return c;
}

// ---------- shaded spheres (foliage, bushes, clouds, boulders) ----------

export interface Sphere {
  cx: number;
  cy: number;
  rx: number;
  ry?: number;
  /** brightness bias for this lobe (-1..1) */
  bias?: number;
}

export interface SphereOpts {
  /** ramp dark -> light (ink strings) */
  ramp: string[];
  /** light direction (toward light), need not be normalized */
  light?: [number, number, number];
  /** ordered dither strength in ramp-steps (0 = hard bands) */
  dither?: number;
  /** global brightness bias */
  bias?: number;
  /** leaf-clump texture amplitude in ramp-steps */
  tex?: number;
  texScale?: number;
  texSeed?: number;
  /** horizontal wrap width for seamless painting */
  wrap?: number;
  /** only paint where predicate true */
  mask?: (x: number, y: number) => boolean;
}

/** Union of lit ellipsoids, quantized to a ramp with ordered dithering between bands. */
export function paintSpheres(c: Canvas, spheres: Sphere[], o: SphereOpts): void {
  const L = o.light ?? [-0.5, -0.62, 0.6];
  const ln = Math.hypot(L[0], L[1], L[2]);
  const lx = L[0] / ln;
  const ly = L[1] / ln;
  const lz = L[2] / ln;
  const n = o.ramp.length;
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const s of spheres) {
    x0 = Math.min(x0, s.cx - s.rx - 1);
    x1 = Math.max(x1, s.cx + s.rx + 1);
    y0 = Math.min(y0, s.cy - (s.ry ?? s.rx) - 1);
    y1 = Math.max(y1, s.cy + (s.ry ?? s.rx) + 1);
  }
  for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(c.h - 1, Math.ceil(y1)); y++) {
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      if (o.mask && !o.mask(x, y)) continue;
      let bestZ = -1;
      let bestLit = 0;
      for (const s of spheres) {
        const ry = s.ry ?? s.rx;
        let dx = x + 0.5 - s.cx;
        if (o.wrap) {
          dx = ((((dx + o.wrap / 2) % o.wrap) + o.wrap) % o.wrap) - o.wrap / 2;
        }
        const nx = dx / s.rx;
        const ny = (y + 0.5 - s.cy) / ry;
        const d2 = nx * nx + ny * ny;
        if (d2 >= 1) continue;
        const z = Math.sqrt(1 - d2);
        // prefer the lobe whose surface faces the viewer most (creates creases between lobes)
        const score = z + (s.bias ?? 0) * 0.2;
        if (score > bestZ) {
          bestZ = score;
          bestLit = nx * lx + ny * ly + z * lz + (s.bias ?? 0) * 0.35;
        }
      }
      if (bestZ < 0) continue;
      let t = bestLit * 0.5 + 0.5 + (o.bias ?? 0);
      if (o.tex) {
        const sc = o.texScale ?? 3;
        // leaf clumps: hashed cells, offset per-row for a non-grid look
        const gx = Math.floor((x + (Math.floor(y / sc) % 2) * (sc / 2)) / sc);
        const gy = Math.floor(y / sc);
        t += (hash2(((gx % 1000) + 1000) % 1000, gy, o.texSeed ?? 7) - 0.5) * o.tex * 0.25;
      }
      const d = o.dither ?? 0.5;
      let i = Math.floor(t * n + (bayer4(x, y) - 0.5) * d);
      i = Math.max(0, Math.min(n - 1, i));
      c.px(x, y, o.ramp[i]);
    }
  }
}

/** Put a 1px outline (in `ink`) into transparent pixels 4-adjacent to painted pixels. */
export function outlineOuter(c: Canvas, ink: string, only?: (x: number, y: number) => boolean): void {
  const add: [number, number][] = [];
  for (let y = 0; y < c.h; y++)
    for (let x = 0; x < c.w; x++) {
      if (c.has(x, y)) continue;
      if (only && !only(x, y)) continue;
      if (c.has(x - 1, y) || c.has(x + 1, y) || c.has(x, y - 1) || c.has(x, y + 1)) add.push([x, y]);
    }
  for (const [x, y] of add) c.px(x, y, ink);
}

/** Recolor painted pixels that touch transparency (inner outline). */
export function outlineInner(c: Canvas, ink: string | ((x: number, y: number, old: string) => string)): void {
  const set: [number, number, string][] = [];
  for (let y = 0; y < c.h; y++)
    for (let x = 0; x < c.w; x++) {
      if (!c.has(x, y)) continue;
      if (!c.has(x - 1, y) || !c.has(x + 1, y) || !c.has(x, y - 1) || !c.has(x, y + 1)) {
        set.push([x, y, typeof ink === 'string' ? ink : ink(x, y, c.get(x, y))]);
      }
    }
  for (const [x, y, v] of set) c.px(x, y, v);
}

/** Smooth periodic 1D value noise (period = `period` samples), output 0..1. */
export function periodicNoise(x: number, period: number, seed: number, octaveCell: number): number {
  const cells = Math.max(1, Math.round(period / octaveCell));
  const fx = (((x / period) % 1) + 1) % 1 * cells;
  const i = Math.floor(fx);
  const t = fx - i;
  const a = hash2(i % cells, 0, seed);
  const b = hash2((i + 1) % cells, 0, seed);
  const s = t * t * (3 - 2 * t);
  return a + (b - a) * s;
}

/** Blend two hex colors. */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRGBA(a);
  const [br, bg, bb] = hexToRGBA(b);
  const h = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  return `#${h(ar + (br - ar) * t)}${h(ag + (bg - ag) * t)}${h(ab + (bb - ab) * t)}`;
}

/** Composite a bitmap at integer position onto a destination bitmap (alpha-over, binary). */
export function blitBitmap(dst: Bitmap, src: Bitmap, dx: number, dy: number): void {
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      const tx = dx + x;
      const ty = dy + y;
      if (tx < 0 || ty < 0 || tx >= dst.w || ty >= dst.h) continue;
      const s = (y * src.w + x) * 4;
      const a = src.data[s + 3];
      if (a === 0) continue;
      const d = (ty * dst.w + tx) * 4;
      if (a === 255) {
        dst.data.set(src.data.subarray(s, s + 4), d);
      } else {
        const k = a / 255;
        for (let i = 0; i < 3; i++) dst.data[d + i] = src.data[s + i] * k + dst.data[d + i] * (1 - k);
        dst.data[d + 3] = Math.max(dst.data[d + 3], a);
      }
    }
}

/** Warm "sunset" grade for a hex color: lights drift toward amber, shadows toward plum. Deterministic. */
export function tintSunset(hex: string): string {
  const [r, g, b, a] = hexToRGBA(hex);
  const lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
  const base = hex.slice(0, 7);
  let out = mix(base, '#ff9a5c', 0.16 + 0.12 * lum);
  if (lum < 0.5) out = mix(out, '#5c2a86', 0.3 * (0.5 - lum) * 2 * 0.6);
  return a < 255 ? out + Math.round(a).toString(16).padStart(2, '0') : out;
}

/** New canvas with every literal/palette ink mapped through fn (hex -> hex). */
export function mapInks(c: Canvas, fn: (hex: string) => string): Canvas {
  const o = new Canvas(c.w, c.h, {}, c.wrapX);
  for (let i = 0; i < c.ink.length; i++) {
    const ink = c.ink[i];
    if (!ink) continue;
    const hex = ink[0] === '#' ? ink : c.pal[ink];
    if (hex) o.ink[i] = fn(hex);
  }
  return o;
}
