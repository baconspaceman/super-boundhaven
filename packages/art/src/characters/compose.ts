// Character sprite composition helpers. Sprites are built on char-index canvases (one char = one
// palette slot) so outline / shading passes work on *indices*, never on RGB. Browser-safe.
import { createBitmap, fromRows, hexToRGBA, type Bitmap, type Palette } from '../core';

export type Canvas = string[][];

export interface OutlineEntry {
  /** outline char on shadow side (bottom/right edges) */
  dark: string;
  /** outline char on lit side (top/left edges): lighter = "sel-out" */
  lit: string;
}
export type OutlineMap = Record<string, OutlineEntry>;

export function makeCanvas(w: number, h: number): Canvas {
  return Array.from({ length: h }, () => Array<string>(w).fill('.'));
}

export function canvasRows(c: Canvas): string[] {
  return c.map((r) => r.join(''));
}

export function canvasFromRows(rows: string[]): Canvas {
  const w = Math.max(...rows.map((r) => r.length));
  return rows.map((r) => r.padEnd(w, '.').split(''));
}

/** Throws on ragged rows so authoring typos are caught early. */
export function assertRect(rows: string[], name: string): void {
  const w = rows[0].length;
  rows.forEach((r, i) => {
    if (r.length !== w) throw new Error(`${name}: row ${i} has width ${r.length}, expected ${w}`);
  });
}

/** Place ASCII rows on the canvas ('.' = transparent). Optional char remap. */
export function stamp(c: Canvas, rows: string[], x: number, y: number, remap?: Record<string, string>): void {
  rows.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      const ch = row[rx];
      if (ch === '.') continue;
      const tx = x + rx;
      const ty = y + ry;
      if (ty < 0 || ty >= c.length || tx < 0 || tx >= c[0].length) continue;
      c[ty][tx] = remap?.[ch] ?? ch;
    }
  });
}

/** Pad rows by 1px on every side and draw a sel-out outline. Result is (w+2)x(h+2). */
export function outlineRows(rows: string[], omap: OutlineMap): string[] {
  const h = rows.length;
  const w = rows[0].length;
  const out = makeCanvas(w + 2, h + 2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y + 1][x + 1] = rows[y][x];
  const get = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? '.' : rows[y][x]);
  for (let y = -1; y <= h; y++)
    for (let x = -1; x <= w; x++) {
      if (get(x, y) !== '.') continue;
      let dark: string | null = null;
      let lit: string | null = null;
      // neighbours: right/below of an empty cell means the empty cell is on the lit (top/left) edge.
      const nb: [number, number, boolean][] = [
        [x + 1, y, true],
        [x, y + 1, true],
        [x - 1, y, false],
        [x, y - 1, false],
      ];
      for (const [nx, ny, isLit] of nb) {
        const ch = get(nx, ny);
        if (ch === '.') continue;
        const e = omap[ch];
        if (!e) continue;
        if (isLit) lit = lit ?? e.lit;
        else dark = dark ?? e.dark;
      }
      const pick = dark ?? lit;
      if (pick) out[y + 1][x + 1] = pick;
    }
  return canvasRows(out);
}

/** Outline then stamp so the content (not the outline) lands at (x,y). */
export function stampOutlined(
  c: Canvas,
  rows: string[],
  x: number,
  y: number,
  omap: OutlineMap,
  remap?: Record<string, string>,
): void {
  const src = remap ? rows.map((r) => r.replace(/./g, (ch) => remap[ch] ?? ch)) : rows;
  stamp(c, outlineRows(src, omap), x - 1, y - 1);
}

export function toBitmap(c: Canvas, pal: Palette): Bitmap {
  return fromRows(canvasRows(c), pal);
}

export function mirrorRows(rows: string[]): string[] {
  return rows.map((r) => r.split('').reverse().join(''));
}

/** Bresenham points. */
export function linePoints(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const pts: [number, number][] = [];
  let dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  let dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    pts.push([x, y]);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  dx = 0;
  return pts;
}

/**
 * Draw a thick limb as rows. Mask of 2x2 blocks along the line, then auto-shaded:
 * pixels with empty top/left neighbour -> light, empty bottom/right -> dark, else mid.
 * `ramp` = [light, mid, dark] chars. `endCap` marks the last `capLen` path steps with `capRamp`.
 */
export function shadedLimb(
  w: number,
  h: number,
  pts: [number, number][],
  ramp: [string, string, string],
  thick = 2,
  capRamp?: [string, string, string],
  capFrom = pts.length,
): string[] {
  const mask: number[][] = Array.from({ length: h }, () => Array<number>(w).fill(0)); // 0 empty,1 body,2 cap
  pts.forEach(([px, py], i) => {
    for (let dy = 0; dy < thick; dy++)
      for (let dx = 0; dx < thick; dx++) {
        const x = px + dx;
        const y = py + dy;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const v = i >= capFrom ? 2 : 1;
        if (mask[y][x] !== 2) mask[y][x] = v;
      }
  });
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : mask[y][x]);
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    let r = '';
    for (let x = 0; x < w; x++) {
      const v = mask[y][x];
      if (!v) {
        r += '.';
        continue;
      }
      const rp = v === 2 && capRamp ? capRamp : ramp;
      const topLeftEmpty = !at(x, y - 1) || !at(x - 1, y);
      const botRightEmpty = !at(x, y + 1) || !at(x + 1, y);
      r += topLeftEmpty && !botRightEmpty ? rp[0] : botRightEmpty && !topLeftEmpty ? rp[2] : rp[1];
    }
    rows.push(r);
  }
  return rows;
}

// ---- generic analysis helpers (used by tests + palette slot checks) ----

export function countColors(b: Bitmap): number {
  const s = new Set<number>();
  for (let i = 0; i < b.data.length; i += 4) {
    if (b.data[i + 3] === 0) continue;
    s.add((b.data[i] << 16) | (b.data[i + 1] << 8) | b.data[i + 2]);
  }
  return s.size;
}

/** Count opaque pixels with zero opaque 8-neighbours ("stray pixels"). */
export function countStrays(b: Bitmap): number {
  let n = 0;
  const op = (x: number, y: number) => x >= 0 && y >= 0 && x < b.w && y < b.h && b.data[(y * b.w + x) * 4 + 3] > 0;
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++) {
      if (!op(x, y)) continue;
      let any = false;
      for (let dy = -1; dy <= 1 && !any; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && op(x + dx, y + dy)) any = true;
      if (!any) n++;
    }
  return n;
}

export function scaleBitmap(b: Bitmap, k: number): Bitmap {
  const o = createBitmap(b.w * k, b.h * k);
  for (let y = 0; y < o.h; y++)
    for (let x = 0; x < o.w; x++) {
      const s = (Math.floor(y / k) * b.w + Math.floor(x / k)) * 4;
      o.data.set(b.data.subarray(s, s + 4), (y * o.w + x) * 4);
    }
  return o;
}

export function fillRect(b: Bitmap, x: number, y: number, w: number, h: number, hex: string): void {
  const c = hexToRGBA(hex);
  for (let yy = y; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++) {
      if (xx < 0 || yy < 0 || xx >= b.w || yy >= b.h) continue;
      b.data.set(c, (yy * b.w + xx) * 4);
    }
}
