// CharacterLook: the renderer-agnostic description of a player's appearance. It is a small
// JSON-serializable struct of option ids + color ids. It does NOT depend on how frames are produced
// (hand-pixeled paper-doll today, possibly a 3D->2D pipeline later). Browser-safe.
import { EYE_COLORS, HAIR_COLORS, ITEM_COLORS, SKIN_TONES } from './palettes';

export interface CharacterLook {
  /** format version (bump if option meaning changes) */
  v: 1;
  skin: number;
  hair: number;
  hairColor: number;
  hairTint: number; // tint mode id
  hairTintColor: number;
  eyes: number;
  eyeColor: number;
  brows: number;
  mouth: number;
  top: number;
  topC1: number;
  topC2: number;
  bottom: number;
  botC1: number;
  botC2: number;
  shoes: number;
  shoeC1: number;
  shoeC2: number;
  hat: number;
  hatC1: number;
  hatC2: number;
  back: number;
  backC1: number;
  backC2: number;
  acc: number;
  accC1: number;
  accC2: number;
}

export interface OptionCategory {
  /** field on CharacterLook that holds the chosen option id */
  key: keyof CharacterLook;
  label: string;
  names: string[];
  /** color fields that belong to this option (empty = uncolorable) */
  colorKeys: (keyof CharacterLook)[];
  /** name of the color table the colorKeys index into */
  colorTable?: 'skin' | 'hair' | 'eye' | 'item';
}

export const OPTION_NAMES = {
  hair: ['Bald', 'Crop', 'Side Part', 'Spiky', 'Long', 'Ponytail', 'Top Bun', 'Braids', 'Mohawk', 'Afro', 'Bob', 'Curly', 'Pigtails', 'Pompadour', 'Messy', 'Twin Buns'],
  hairTint: ['None', 'Dip-Dye', 'Streak', 'Underlayer'],
  eyes: ['Dot', 'Round', 'Bright', 'Sleepy', 'Happy', 'Anime', 'Cat', 'Lashes'],
  brows: ['Flat', 'Thin', 'Angled', 'Arched', 'Bushy', 'Dots'],
  mouth: ['Smile', 'Tiny', 'Flat', 'Grin', 'Cat', 'Smirk'],
  top: ['Tee', 'Striped Tee', 'Tank', 'Hoodie', 'Jacket', 'Overalls', 'Tunic', 'Sweater', 'Sailor', 'Armor', 'Wrap', 'Star Tee'],
  bottom: ['Jeans', 'Shorts', 'Capris', 'Cargo', 'Track Pants', 'Skirt', 'Kilt', 'Stockings'],
  shoes: ['Sneakers', 'Boots', 'Sandals', 'Slippers', 'Hi-Tops', 'Barefoot', 'Clogs', 'Pogo Shoes'],
  hat: ['None', 'Cap', 'Beanie', 'Bucket Hat', 'Wizard Hat', 'Crown', 'Headband', 'Bandana', 'Cat Ears', 'Bunny Ears', 'Goggles', 'Helmet', 'Straw Hat', 'Flower Crown', 'Coil Antenna'],
  back: ['None', 'Short Cape', 'Long Cape', 'Backpack', 'Wings', 'Tail', 'Coil Pack'],
  acc: ['None', 'Round Glasses', 'Shades', 'Eyepatch', 'Freckles', 'Face Mask', 'Scarf', 'Bow Tie', 'Necklace', 'Earring'],
} as const;

export const CHARACTER_OPTIONS: {
  categories: OptionCategory[];
  skinTones: { name: string }[];
  hairColors: { name: string }[];
  eyeColors: { name: string }[];
  itemColors: { name: string }[];
  counts: Record<string, number>;
} = {
  categories: [
    { key: 'skin', label: 'Skin', names: SKIN_TONES.map((s) => s.name), colorKeys: [] },
    { key: 'hair', label: 'Hair Style', names: [...OPTION_NAMES.hair], colorKeys: ['hairColor'], colorTable: 'hair' },
    { key: 'hairTint', label: 'Hair Tint', names: [...OPTION_NAMES.hairTint], colorKeys: ['hairTintColor'], colorTable: 'hair' },
    { key: 'eyes', label: 'Eyes', names: [...OPTION_NAMES.eyes], colorKeys: ['eyeColor'], colorTable: 'eye' },
    { key: 'brows', label: 'Eyebrows', names: [...OPTION_NAMES.brows], colorKeys: [] },
    { key: 'mouth', label: 'Mouth', names: [...OPTION_NAMES.mouth], colorKeys: [] },
    { key: 'top', label: 'Top', names: [...OPTION_NAMES.top], colorKeys: ['topC1', 'topC2'], colorTable: 'item' },
    { key: 'bottom', label: 'Bottom', names: [...OPTION_NAMES.bottom], colorKeys: ['botC1', 'botC2'], colorTable: 'item' },
    { key: 'shoes', label: 'Footwear', names: [...OPTION_NAMES.shoes], colorKeys: ['shoeC1', 'shoeC2'], colorTable: 'item' },
    { key: 'hat', label: 'Headwear', names: [...OPTION_NAMES.hat], colorKeys: ['hatC1', 'hatC2'], colorTable: 'item' },
    { key: 'back', label: 'Back Item', names: [...OPTION_NAMES.back], colorKeys: ['backC1', 'backC2'], colorTable: 'item' },
    { key: 'acc', label: 'Accessory', names: [...OPTION_NAMES.acc], colorKeys: ['accC1', 'accC2'], colorTable: 'item' },
  ],
  skinTones: SKIN_TONES.map((c) => ({ name: c.name })),
  hairColors: HAIR_COLORS.map((c) => ({ name: c.name })),
  eyeColors: EYE_COLORS.map((c) => ({ name: c.name })),
  itemColors: ITEM_COLORS.map((c) => ({ name: c.name })),
  counts: {
    skin: SKIN_TONES.length,
    hair: OPTION_NAMES.hair.length,
    hairColor: HAIR_COLORS.length,
    hairTint: OPTION_NAMES.hairTint.length,
    hairTintColor: HAIR_COLORS.length,
    eyes: OPTION_NAMES.eyes.length,
    eyeColor: EYE_COLORS.length,
    brows: OPTION_NAMES.brows.length,
    mouth: OPTION_NAMES.mouth.length,
    top: OPTION_NAMES.top.length,
    bottom: OPTION_NAMES.bottom.length,
    shoes: OPTION_NAMES.shoes.length,
    hat: OPTION_NAMES.hat.length,
    back: OPTION_NAMES.back.length,
    acc: OPTION_NAMES.acc.length,
    topC1: ITEM_COLORS.length,
    topC2: ITEM_COLORS.length,
    botC1: ITEM_COLORS.length,
    botC2: ITEM_COLORS.length,
    shoeC1: ITEM_COLORS.length,
    shoeC2: ITEM_COLORS.length,
    hatC1: ITEM_COLORS.length,
    hatC2: ITEM_COLORS.length,
    backC1: ITEM_COLORS.length,
    backC2: ITEM_COLORS.length,
    accC1: ITEM_COLORS.length,
    accC2: ITEM_COLORS.length,
  },
};

type NumKey = Exclude<keyof CharacterLook, 'v'>;

/** Field order == bit-packing order (do not reorder without bumping CharacterLook.v). */
export const LOOK_FIELDS: NumKey[] = [
  'skin', 'hair', 'hairColor', 'hairTint', 'hairTintColor', 'eyes', 'eyeColor', 'brows', 'mouth',
  'top', 'topC1', 'topC2', 'bottom', 'botC1', 'botC2', 'shoes', 'shoeC1', 'shoeC2',
  'hat', 'hatC1', 'hatC2', 'back', 'backC1', 'backC2', 'acc', 'accC1', 'accC2',
];

export const DEFAULT_LOOK: CharacterLook = {
  v: 1,
  skin: 2, hair: 2, hairColor: 2, hairTint: 0, hairTintColor: 5,
  eyes: 1, eyeColor: 6, brows: 1, mouth: 0,
  top: 0, topC1: 10, topC2: 19,
  bottom: 0, botC1: 22, botC2: 21,
  shoes: 0, shoeC1: 0, shoeC2: 20,
  hat: 0, hatC1: 3, hatC2: 16,
  back: 0, backC1: 0, backC2: 3,
  acc: 0, accC1: 3, accC2: 16,
};

/** Returns a list of human-readable problems; empty = valid. */
export function validateLook(look: unknown): string[] {
  const problems: string[] = [];
  if (typeof look !== 'object' || look === null) return ['look must be an object'];
  const l = look as Record<string, unknown>;
  if (l.v !== 1) problems.push('v must be 1');
  for (const k of LOOK_FIELDS) {
    const v = l[k];
    const n = CHARACTER_OPTIONS.counts[k];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v >= n) problems.push(`${k} must be an integer in [0,${n - 1}]`);
  }
  return problems;
}

/** Clamp/repair an untrusted look (e.g. from the network) into a valid one. */
export function sanitizeLook(look: Partial<CharacterLook> | null | undefined): CharacterLook {
  const out = { ...DEFAULT_LOOK };
  if (!look) return out;
  for (const k of LOOK_FIELDS) {
    const v = look[k];
    const n = CHARACTER_OPTIONS.counts[k];
    if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < n) out[k] = v;
  }
  return out;
}

// mulberry32
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic random look (same seed => same look). Avoids same-color primary/secondary pairs. */
export function randomLook(seed: number): CharacterLook {
  const r = rng(seed * 2654435761 + 12345);
  const pick = (n: number) => Math.floor(r() * n);
  const out = { ...DEFAULT_LOOK } as CharacterLook;
  for (const k of LOOK_FIELDS) out[k] = pick(CHARACTER_OPTIONS.counts[k]);
  // readable pairs: secondary must differ from primary
  const pairs: [NumKey, NumKey][] = [['topC1', 'topC2'], ['botC1', 'botC2'], ['shoeC1', 'shoeC2'], ['hatC1', 'hatC2'], ['backC1', 'backC2'], ['accC1', 'accC2']];
  for (const [a, b] of pairs) if (out[a] === out[b]) out[b] = (out[b] + 7) % CHARACTER_OPTIONS.counts[b];
  if (out.hairTint === 0) out.hairTintColor = out.hairColor;
  return out;
}

// ---- compact encoding: mixed-radix packed to base64url ----
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function bitsFor(n: number): number {
  return Math.max(1, Math.ceil(Math.log2(n)));
}

/** Encodes to `v1` + 19 chars (<= 20 total). Bit-packed, stable across versions of the same `v`. */
export function encodeLook(look: CharacterLook): string {
  let acc = 0n;
  let total = 0;
  for (const k of LOOK_FIELDS) {
    const b = bitsFor(CHARACTER_OPTIONS.counts[k]);
    acc = (acc << BigInt(b)) | BigInt(look[k]);
    total += b;
  }
  const chars = Math.ceil(total / 6);
  acc <<= BigInt(chars * 6 - total);
  let s = '';
  for (let i = chars - 1; i >= 0; i--) s += B64[Number((acc >> BigInt(i * 6)) & 63n)];
  return '1' + s; // leading '1' = format version
}

/** Returns null if the string is malformed or has out-of-range values. */
export function decodeLook(s: string): CharacterLook | null {
  if (typeof s !== 'string' || s.length < 2 || s[0] !== '1') return null;
  const body = s.slice(1);
  let total = 0;
  for (const k of LOOK_FIELDS) total += bitsFor(CHARACTER_OPTIONS.counts[k]);
  if (body.length !== Math.ceil(total / 6)) return null;
  let acc = 0n;
  for (const ch of body) {
    const i = B64.indexOf(ch);
    if (i < 0) return null;
    acc = (acc << 6n) | BigInt(i);
  }
  acc >>= BigInt(body.length * 6 - total);
  const out = { ...DEFAULT_LOOK };
  for (let i = LOOK_FIELDS.length - 1; i >= 0; i--) {
    const k = LOOK_FIELDS[i];
    const b = bitsFor(CHARACTER_OPTIONS.counts[k]);
    const v = Number(acc & ((1n << BigInt(b)) - 1n));
    acc >>= BigInt(b);
    if (v >= CHARACTER_OPTIONS.counts[k]) return null;
    out[k] = v;
  }
  return out;
}

export function looksEqual(a: CharacterLook, b: CharacterLook): boolean {
  return LOOK_FIELDS.every((k) => a[k] === b[k]);
}
