// Helpers for fitting the 224-px-tall backdrops into the taller 16:9 view.
import { Graphics, type Texture } from 'pixi.js';

/** Colour (0xRRGGBB) of the first pixel row of a standalone texture, or null if it is not opaque there. */
export function topColor(tex: Texture): number | null {
  try {
    const res = tex.source.resource as CanvasImageSource | undefined;
    if (!res) return null;
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    const g = c.getContext('2d', { willReadFrequently: true });
    if (!g) return null;
    g.drawImage(res, 0, 0, 1, 1, 0, 0, 1, 1);
    const d = g.getImageData(0, 0, 1, 1).data;
    return d[3] >= 250 ? (d[0] << 16) | (d[1] << 8) | d[2] : null;
  } catch {
    return null;
  }
}

/** A flat rectangle covering the screen from y=0 down to `h`, in the colour of the layer's top row (extends a sky upward). */
export function topCap(tex: Texture, w: number, h: number): Graphics | null {
  if (h <= 0) return null;
  const col = topColor(tex);
  return col === null ? null : new Graphics().rect(0, 0, w, h).fill(col);
}

/**
 * Rows [start, end) of the widest fully transparent horizontal band of a texture (at least `min` rows), or null.
 * Used to cut a foreground layer in two: what hangs from the top of the screen stays there and what sits on the
 * ground moves down with the ground, instead of the whole thing sliding as one piece.
 */
export function transparentBand(tex: Texture, min = 8): { start: number; end: number } | null {
  try {
    const res = tex.source.resource as CanvasImageSource | undefined;
    if (!res) return null;
    const w = tex.frame.width;
    const h = tex.frame.height;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    if (!g) return null;
    g.drawImage(res, 0, 0);
    const d = g.getImageData(0, 0, w, h).data;
    let best: { start: number; end: number } | null = null;
    let run = -1;
    for (let y = 0; y <= h; y++) {
      let empty = y < h;
      for (let x = 0; empty && x < w; x++) if (d[(y * w + x) * 4 + 3] !== 0) empty = false;
      if (empty) {
        if (run < 0) run = y;
      } else if (run >= 0) {
        if (y - run >= min && (!best || y - run > best.end - best.start)) best = { start: run, end: y };
        run = -1;
      }
    }
    return best;
  } catch {
    return null;
  }
}
