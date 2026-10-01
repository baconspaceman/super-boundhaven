// Layer primitives for the paper-doll: authored *mask* rows (digits 0/1/2 pick a color slot, letters
// are literal palette chars) -> shaded char rows with flat hand-placed 3-tone shading.
import { CHAR_SLOT, SLOT_CHARS, type SlotName } from './palettes';
import type { OutlineMap } from './compose';

/** A mask layer placed in some local space (head cell, torso space...). */
export interface MaskLayer {
  rows: string[];
  x: number;
  y: number;
}

/** digit -> slot used when shading a mask. */
export type SlotMap = Partial<Record<'0' | '1' | '2' | '3', SlotName>>;

/**
 * Flat 3-tone shading for mask rows. A pixel is light when the cell above (same slot) is missing,
 * dark when the cell below is missing (or right, for wide forms), else mid. Thin (1px) features are mid.
 */
export function shadeMask(rows: string[], map: SlotMap): string[] {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const at = (x: number, y: number) => (x < 0 || y < 0 || y >= h || x >= rows[y].length ? '.' : rows[y][x]);
  return rows.map((row, y) => {
    let out = '';
    for (let x = 0; x < w; x++) {
      const c = row[x] ?? '.';
      const slot = map[c as '0'];
      if (!slot) {
        out += c;
        continue;
      }
      const tri = SLOT_CHARS[slot];
      const top = at(x, y - 1) !== c;
      const bot = at(x, y + 1) !== c;
      const left = at(x - 1, y) !== c;
      const right = at(x + 1, y) !== c;
      let idx = 1;
      if (top && !bot) idx = 0;
      else if (bot && !top) idx = 2;
      else if (!top && !bot) idx = left && !right ? 0 : right && !left ? 2 : 1;
      out += tri[Math.min(idx, tri.length - 1)];
    }
    return out;
  });
}

/** Shift each palette char one tone darker inside its slot (for far-side limbs / depth). */
export function darkenRows(rows: string[]): string[] {
  return rows.map((r) =>
    r.replace(/./g, (ch) => {
      const s = CHAR_SLOT[ch];
      if (!s) return ch;
      return s.chars[Math.min(s.chars.length - 1, s.idx + 1)];
    }),
  );
}

/** Sel-out outline map derived from slots: dark edge = slot's darkest, lit edge = slot's mid. */
export const OUTLINE_MAP: OutlineMap = (() => {
  const m: OutlineMap = {};
  for (const [ch, s] of Object.entries(CHAR_SLOT)) {
    const dark = s.chars[s.chars.length - 1];
    const lit = s.chars.length > 2 ? s.chars[1] : dark;
    m[ch] = { dark, lit };
  }
  m.P = { dark: 'P', lit: 'P' };
  m.W = { dark: 'P', lit: 'P' };
  return m;
})();

/** Turn the last `n` rows (by bbox) of a mask from slot '1' to '2' (dip-dye tips). */
export function tintTips(rows: string[], n = 3): string[] {
  let last = -1;
  rows.forEach((r, y) => {
    if (/[12]/.test(r)) last = y;
  });
  return rows.map((r, y) => (y > last - n ? r.replace(/1/g, '2') : r));
}

/** Streak: a 2-wide diagonal-ish lock near the front edge becomes slot '2'. */
export function tintStreak(rows: string[]): string[] {
  let xmax = -1;
  rows.forEach((r) => {
    for (let x = 0; x < r.length; x++) if (r[x] === '1') xmax = Math.max(xmax, x);
  });
  return rows.map((r, y) => {
    const chars = r.split('');
    for (let x = 0; x < chars.length; x++) if (chars[x] === '1' && x >= xmax - 5 - Math.floor(y / 3) && x <= xmax - 3 - Math.floor(y / 3)) chars[x] = '2';
    return chars.join('');
  });
}

export function allTo2(rows: string[]): string[] {
  return rows.map((r) => r.replace(/1/g, '2'));
}

/** Top rows shift by `lean` px (+ = toward +x) decaying to 0 at the bottom row. Canvas widens as needed. */
export function leanRows(rows: string[], lean: number, pow = 1.3): { rows: string[]; ox: number } {
  if (!lean) return { rows, ox: 0 };
  const n = rows.length;
  const shifts = rows.map((_, i) => Math.round(lean * Math.pow(1 - i / Math.max(1, n - 1), pow)));
  const minS = Math.min(0, ...shifts);
  const maxS = Math.max(0, ...shifts);
  const w = Math.max(...rows.map((r) => r.length)) + maxS - minS;
  return {
    ox: minS,
    rows: rows.map((r, i) => {
      const off = shifts[i] - minS;
      return '.'.repeat(off) + r.padEnd(w - off, '.');
    }),
  };
}
