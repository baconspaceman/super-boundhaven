// Pixel-art toolkit. Sprites are authored as palette-indexed ASCII rows in code, turned into RGBA
// bitmaps, packed into sheets + atlas JSON, and exported as PNG by scripts/build-art.ts.
// Browser-safe: no Node imports here (PNG encoding lives in png.ts).

/** Map a single character to a '#rrggbb' / '#rrggbbaa' color, or null/'' for transparent. '.' is always transparent. */
export type Palette = Record<string, string | null>;

export interface Bitmap {
  w: number;
  h: number;
  data: Uint8ClampedArray; // RGBA, row-major
}

export interface AtlasEntry {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function createBitmap(w: number, h: number): Bitmap {
  return { w, h, data: new Uint8ClampedArray(w * h * 4) };
}

export function hexToRGBA(hex: string): [number, number, number, number] {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [
    parseInt(n.slice(0, 2), 16),
    parseInt(n.slice(2, 4), 16),
    parseInt(n.slice(4, 6), 16),
    n.length >= 8 ? parseInt(n.slice(6, 8), 16) : 255,
  ];
}

/** Build a bitmap from equal-length ASCII rows. Unknown characters throw (catches typos). */
export function fromRows(rows: string[], pal: Palette): Bitmap {
  const w = Math.max(...rows.map((r) => r.length));
  const b = createBitmap(w, rows.length);
  rows.forEach((row, y) => {
    for (let x = 0; x < w; x++) {
      const ch = row[x] ?? '.';
      if (ch === '.') continue;
      if (!(ch in pal)) throw new Error(`Unknown palette char '${ch}' at ${x},${y}`);
      const col = pal[ch];
      if (!col) continue;
      const [r, g, bl, a] = hexToRGBA(col);
      const i = (y * w + x) * 4;
      b.data[i] = r;
      b.data[i + 1] = g;
      b.data[i + 2] = bl;
      b.data[i + 3] = a;
    }
  });
  return b;
}

export function cloneBitmap(b: Bitmap): Bitmap {
  return { w: b.w, h: b.h, data: new Uint8ClampedArray(b.data) };
}

export function flipH(b: Bitmap): Bitmap {
  const o = createBitmap(b.w, b.h);
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++) {
      const s = (y * b.w + x) * 4;
      const d = (y * b.w + (b.w - 1 - x)) * 4;
      o.data.set(b.data.subarray(s, s + 4), d);
    }
  return o;
}

/** Copy src onto dst at (dx,dy) with alpha-over (opaque/transparent pixels only; no partial blend needed for pixel art). */
export function blit(dst: Bitmap, src: Bitmap, dx: number, dy: number): void {
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      const tx = dx + x;
      const ty = dy + y;
      if (tx < 0 || ty < 0 || tx >= dst.w || ty >= dst.h) continue;
      const s = (y * src.w + x) * 4;
      if (src.data[s + 3] === 0) continue;
      dst.data.set(src.data.subarray(s, s + 4), (ty * dst.w + tx) * 4);
    }
}

/** Replace exact colors (hex -> hex). Used for palette-swap player customization. */
export function recolor(b: Bitmap, map: Record<string, string>): Bitmap {
  const o = cloneBitmap(b);
  const lut = new Map<number, [number, number, number, number]>();
  for (const [from, to] of Object.entries(map)) {
    const [r, g, bl] = hexToRGBA(from);
    lut.set((r << 16) | (g << 8) | bl, hexToRGBA(to));
  }
  for (let i = 0; i < o.data.length; i += 4) {
    if (o.data[i + 3] === 0) continue;
    const hit = lut.get((o.data[i] << 16) | (o.data[i + 1] << 8) | o.data[i + 2]);
    if (hit) o.data.set(hit, i);
  }
  return o;
}

/** Pack named frames into a single sheet (simple shelf packer) plus an atlas. */
export function packSheet(
  frames: Record<string, Bitmap>,
  maxWidth = 512,
  pad = 1,
): { sheet: Bitmap; atlas: Record<string, AtlasEntry> } {
  const names = Object.keys(frames);
  let x = 0;
  let y = 0;
  let rowH = 0;
  let sheetW = 0;
  const atlas: Record<string, AtlasEntry> = {};
  for (const n of names) {
    const f = frames[n];
    if (x + f.w > maxWidth) {
      x = 0;
      y += rowH + pad;
      rowH = 0;
    }
    atlas[n] = { x, y, w: f.w, h: f.h };
    x += f.w + pad;
    rowH = Math.max(rowH, f.h);
    sheetW = Math.max(sheetW, x - pad);
  }
  const sheet = createBitmap(sheetW, y + rowH);
  for (const n of names) blit(sheet, frames[n], atlas[n].x, atlas[n].y);
  return { sheet, atlas };
}
