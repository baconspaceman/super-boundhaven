// Paper-doll color system. Every sprite layer is palette-indexed by *slot chars*: each slot is a
// 3-tone ramp (light/mid/dark) that a CharacterLook fills with a named color. Browser-safe.
import type { Palette } from '../core';
import { hslToHex, ramp2, ramp3, type Seed } from './pal';

export type SlotName =
  | 'skin'
  | 'hair'
  | 'hair2'
  | 'top1'
  | 'top2'
  | 'bot1'
  | 'bot2'
  | 'shoe1'
  | 'shoe2'
  | 'hat1'
  | 'hat2'
  | 'back1'
  | 'back2'
  | 'acc1'
  | 'acc2'
  | 'eye';

/** chars are [light, mid, dark] (eye has 2). P = ink, W = white are fixed. */
export const SLOT_CHARS: Record<SlotName, string> = {
  skin: 'ABC',
  hair: 'DEF',
  hair2: 'GHI',
  top1: 'JKL',
  top2: 'MNO',
  bot1: 'QRS',
  bot2: 'TUV',
  shoe1: 'XYZ',
  shoe2: 'abc',
  hat1: 'def',
  hat2: 'ghi',
  back1: 'jkl',
  back2: 'mno',
  acc1: 'pqr',
  acc2: 'stu',
  eye: 'vw',
};

export const FIXED = { ink: 'P', white: 'W' } as const;
export const INK_HEX = '#2b2350';
export const WHITE_HEX = '#f6f3ff';

/** char -> slot triple (for darken / outline). */
export const CHAR_SLOT: Record<string, { chars: string; idx: number }> = {};
for (const chars of Object.values(SLOT_CHARS)) for (let i = 0; i < chars.length; i++) CHAR_SLOT[chars[i]] = { chars, idx: i };

export interface NamedColor {
  name: string;
  seed: Seed;
}

export const SKIN_TONES: NamedColor[] = [
  { name: 'Porcelain', seed: [22, 0.55, 0.83] },
  { name: 'Ivory', seed: [26, 0.6, 0.77] },
  { name: 'Peach', seed: [24, 0.66, 0.71] },
  { name: 'Sand', seed: [30, 0.56, 0.65] },
  { name: 'Honey', seed: [30, 0.6, 0.57] },
  { name: 'Tan', seed: [26, 0.55, 0.5] },
  { name: 'Caramel', seed: [24, 0.55, 0.44] },
  { name: 'Bronze', seed: [22, 0.5, 0.38] },
  { name: 'Cocoa', seed: [18, 0.46, 0.3] },
  { name: 'Espresso', seed: [14, 0.42, 0.23] },
  { name: 'Rosewood', seed: [350, 0.36, 0.58] },
  { name: 'Moss', seed: [110, 0.32, 0.58] },
  { name: 'Periwinkle', seed: [240, 0.42, 0.72] },
  { name: 'Orchid', seed: [300, 0.34, 0.68] },
];

export const HAIR_COLORS: NamedColor[] = [
  { name: 'Jet', seed: [255, 0.3, 0.17] },
  { name: 'Espresso', seed: [20, 0.42, 0.21] },
  { name: 'Chestnut', seed: [20, 0.56, 0.33] },
  { name: 'Auburn', seed: [12, 0.62, 0.38] },
  { name: 'Ginger', seed: [22, 0.88, 0.5] },
  { name: 'Honey', seed: [44, 0.72, 0.56] },
  { name: 'Platinum', seed: [52, 0.6, 0.8] },
  { name: 'Silver', seed: [225, 0.14, 0.74] },
  { name: 'Slate', seed: [225, 0.22, 0.42] },
  { name: 'Cobalt', seed: [220, 0.75, 0.47] },
  { name: 'Teal', seed: [178, 0.7, 0.4] },
  { name: 'Mint', seed: [150, 0.6, 0.55] },
  { name: 'Violet', seed: [270, 0.55, 0.46] },
  { name: 'Bubblegum', seed: [330, 0.72, 0.68] },
  { name: 'Crimson', seed: [352, 0.76, 0.46] },
  { name: 'Lavender', seed: [285, 0.5, 0.74] },
];

export const EYE_COLORS: NamedColor[] = [
  { name: 'Brown', seed: [24, 0.62, 0.36] },
  { name: 'Hazel', seed: [40, 0.52, 0.42] },
  { name: 'Amber', seed: [40, 0.92, 0.52] },
  { name: 'Green', seed: [125, 0.5, 0.42] },
  { name: 'Teal', seed: [178, 0.72, 0.42] },
  { name: 'Sky', seed: [200, 0.82, 0.54] },
  { name: 'Blue', seed: [226, 0.72, 0.52] },
  { name: 'Violet', seed: [270, 0.56, 0.54] },
  { name: 'Rose', seed: [336, 0.62, 0.56] },
  { name: 'Storm', seed: [220, 0.14, 0.5] },
];

/** Shared by every per-item primary/secondary slot (24 colors = 5 bits). */
export const ITEM_COLORS: NamedColor[] = [
  { name: 'Crimson', seed: [354, 0.72, 0.5] },
  { name: 'Coral', seed: [8, 0.78, 0.64] },
  { name: 'Orange', seed: [26, 0.9, 0.54] },
  { name: 'Gold', seed: [45, 0.92, 0.55] },
  { name: 'Lime', seed: [80, 0.66, 0.5] },
  { name: 'Leaf', seed: [120, 0.5, 0.42] },
  { name: 'Forest', seed: [150, 0.5, 0.3] },
  { name: 'Mint', seed: [160, 0.62, 0.62] },
  { name: 'Teal', seed: [178, 0.68, 0.42] },
  { name: 'Sky', seed: [200, 0.78, 0.58] },
  { name: 'Cobalt', seed: [220, 0.72, 0.5] },
  { name: 'Indigo', seed: [245, 0.5, 0.4] },
  { name: 'Violet', seed: [270, 0.55, 0.52] },
  { name: 'Magenta', seed: [310, 0.6, 0.52] },
  { name: 'Rose', seed: [340, 0.7, 0.68] },
  { name: 'Plum', seed: [290, 0.4, 0.32] },
  { name: 'Rust', seed: [16, 0.62, 0.38] },
  { name: 'Brown', seed: [26, 0.45, 0.3] },
  { name: 'Tan', seed: [34, 0.45, 0.62] },
  { name: 'Cream', seed: [48, 0.6, 0.86] },
  { name: 'Snow', seed: [230, 0.2, 0.9] },
  { name: 'Stone', seed: [230, 0.12, 0.62] },
  { name: 'Slate', seed: [228, 0.2, 0.36] },
  { name: 'Midnight', seed: [250, 0.36, 0.2] },
];

export interface LookColors {
  skin: number;
  hair: number;
  hair2: number;
  eye: number;
  top1: number;
  top2: number;
  bot1: number;
  bot2: number;
  shoe1: number;
  shoe2: number;
  hat1: number;
  hat2: number;
  back1: number;
  back2: number;
  acc1: number;
  acc2: number;
}

const rampCache = new Map<string, [string, string, string]>();
function r3(seed: Seed): [string, string, string] {
  const k = seed.join(',');
  let v = rampCache.get(k);
  if (!v) rampCache.set(k, (v = ramp3(...seed)));
  return v;
}

/** Skin shades stay warm and desaturated (no rash-red shadows): light / mid / dark. */
function skinRamp([h, s, l]: Seed): [string, string, string] {
  return [hslToHex(h + 4, s * 0.8, Math.min(0.93, l + 0.09)), hslToHex(h, s, l), hslToHex(h - 12, s * 0.62, l - 0.2)];
}

/** Slot -> hex palette for a color selection (indexes into the tables above). */
export function buildPalette(c: LookColors): Palette {
  const pal: Palette = { P: INK_HEX, W: WHITE_HEX };
  const put = (slot: SlotName, hex: string[]) => SLOT_CHARS[slot].split('').forEach((ch, i) => (pal[ch] = hex[i] ?? hex[hex.length - 1]));
  put('skin', skinRamp(SKIN_TONES[c.skin].seed));
  put('hair', r3(HAIR_COLORS[c.hair].seed));
  put('hair2', r3(HAIR_COLORS[c.hair2].seed));
  put('eye', ramp2(...EYE_COLORS[c.eye].seed));
  for (const s of ['top1', 'top2', 'bot1', 'bot2', 'shoe1', 'shoe2', 'hat1', 'hat2', 'back1', 'back2', 'acc1', 'acc2'] as const)
    put(s, r3(ITEM_COLORS[c[s]].seed));
  return pal;
}
