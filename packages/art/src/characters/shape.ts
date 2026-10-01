// Procedural cel-shaded primitives (clean banded clusters, top-left light). Output is char rows so
// everything can be combined with hand-drawn ASCII stamps and the sel-out outline pass.
import { makeCanvas, stamp, type Canvas } from './compose';

export type Ramp3 = [string, string, string];

export interface EllipseOpts {
  /** alt ramp used on the lower-front of the shape (belly/muzzle). */
  belly?: { ramp: Ramp3; minNy: number; minNx?: number };
  /** thresholds for light/mid bands (0..1 lambert). */
  bands?: [number, number];
  /** restrict drawing to rows >= y0 (for half domes). */
  flatBottom?: boolean;
}

/** Shaded filled ellipse. Returns w x h rows, '.' outside. */
export function shadedEllipse(w: number, h: number, ramp: Ramp3, opts: EllipseOpts = {}): string[] {
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const rx = w / 2;
  const ry = h / 2;
  const [t1, t2] = opts.bands ?? [0.7, 0.2];
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    let r = '';
    for (let x = 0; x < w; x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      const r2 = nx * nx + ny * ny;
      if (r2 > 1) {
        r += '.';
        continue;
      }
      const nz = Math.sqrt(Math.max(0, 1 - r2));
      const I = -0.5 * nx - 0.62 * ny + 0.6 * nz;
      const useBelly = opts.belly && ny > opts.belly.minNy && nx > (opts.belly.minNx ?? -2);
      const rp = useBelly ? opts.belly!.ramp : ramp;
      r += I > t1 ? rp[0] : I > t2 ? rp[1] : rp[2];
    }
    rows.push(r);
  }
  return rows;
}

/** Overlay src rows onto dst rows (same-size or smaller) at offset; '.' is transparent. Returns new rows. */
export function compose(w: number, h: number, layers: { rows: string[]; x: number; y: number; remap?: Record<string, string> }[]): string[] {
  const c: Canvas = makeCanvas(w, h);
  for (const l of layers) stamp(c, l.rows, l.x, l.y, l.remap);
  return c.map((r) => r.join(''));
}

export function flipV(rows: string[]): string[] {
  return [...rows].reverse();
}
export function flipRows(rows: string[]): string[] {
  return rows.map((r) => r.split('').reverse().join(''));
}

/** Put char `ch` on every cell of the rows that matches `from` (used to recolor stamps). */
export function mapChars(rows: string[], m: Record<string, string>): string[] {
  return rows.map((r) => r.replace(/./g, (c) => m[c] ?? c));
}

/** Remove single-pixel islands (no 4-neighbour of same-layer opaque). Keeps authoring clean. */
export function despeckle(rows: string[]): string[] {
  const h = rows.length;
  const w = rows[0].length;
  const op = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && rows[y][x] !== '.';
  return rows.map((r, y) => r.replace(/./g, (c, x) => (c !== '.' && !op(x + 1, y) && !op(x - 1, y) && !op(x, y + 1) && !op(x, y - 1) ? '.' : c)));
}
