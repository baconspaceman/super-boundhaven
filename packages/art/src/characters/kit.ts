// Small helpers shared by creature / mount / fx authoring (palette-indexed char canvases).
import { fromRows, type Bitmap, type Palette } from '../core';
import { canvasRows, makeCanvas, outlineRows, stamp, type Canvas, type OutlineMap } from './compose';
import { ramp3, type Seed } from './pal';

/** ramps: strings of tone chars light->dark, e.g. 'ABC'. Outline = darkest (shade side) / mid (lit side). */
export function outlineFor(ramps: string[], fixed: Record<string, [string, string]> = {}): OutlineMap {
  const m: OutlineMap = {};
  for (const r of ramps) for (const ch of r) m[ch] = { dark: r[r.length - 1], lit: r.length > 2 ? r[1] : r[r.length - 1] };
  for (const [k, [d, l]] of Object.entries(fixed)) m[k] = { dark: d, lit: l };
  return m;
}

export function palFrom(pairs: Record<string, string | Seed>, ramps: Record<string, Seed> = {}): Palette {
  const pal: Palette = { P: '#2b2350', W: '#f6f3ff' };
  for (const [k, v] of Object.entries(ramps)) ramp3(...v).forEach((hex, i) => (pal[k[i]] = hex));
  for (const [k, v] of Object.entries(pairs)) pal[k] = typeof v === 'string' ? v : ramp3(...v)[1];
  return pal;
}

export class Sprite {
  c: Canvas;
  constructor(
    public w: number,
    public h: number,
  ) {
    this.c = makeCanvas(w, h);
  }
  put(rows: string[], x: number, y: number, remap?: Record<string, string>) {
    stamp(this.c, rows, x, y, remap);
    return this;
  }
  rows() {
    return canvasRows(this.c);
  }
  /** Outline whole sprite; result is (w+2)x(h+2). */
  outlined(omap: OutlineMap): string[] {
    return outlineRows(this.rows(), omap);
  }
  bitmap(omap: OutlineMap | null, pal: Palette): Bitmap {
    return fromRows(omap ? this.outlined(omap) : this.rows(), pal);
  }
}

export function flipVRows(rows: string[]): string[] {
  return [...rows].reverse();
}
export function flipHRows(rows: string[]): string[] {
  return rows.map((r) => r.split('').reverse().join(''));
}
