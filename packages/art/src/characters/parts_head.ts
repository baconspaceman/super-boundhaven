// Head-space paper-doll parts. Coordinates are in the 16-wide "head cell" (skull occupies cols 2..12,
// rows 4..13). Masks use digits: 0=skin 1=primary 2=secondary (slot depends on category); letters are
// literal palette chars (P ink, W white, F hair-dark, v/w iris...). '.' is empty.
import type { MaskLayer } from './layers';

export const CELL_W = 16;
export const CELL_H = 18;
export const SKULL_X = 2;
export const SKULL_Y = 4;

/** Build a head-space layer from [x, string] row pairs starting at row y0 (x is cell col). */
function L(y0: number, rows: [number, string][]): MaskLayer {
  return { x: 0, y: y0, rows: rows.map(([x, s]) => '.'.repeat(x) + s).map((r) => r.padEnd(CELL_W, '.')) };
}
/** Same but from already-aligned 16-wide rows. */
function A(y0: number, rows: string[]): MaskLayer {
  return { x: 0, y: y0, rows: rows.map((r) => r.padEnd(CELL_W, '.')) };
}
/** Filled disc mask (for afro / buns) in cell coords. */
function disc(cx: number, cy: number, rx: number, ry: number, ch = '1'): MaskLayer {
  const x0 = Math.floor(cx - rx);
  const y0 = Math.floor(cy - ry);
  const rows: string[] = [];
  for (let y = y0; y <= Math.ceil(cy + ry); y++) {
    let r = '';
    for (let x = 0; x < CELL_W; x++) {
      const dx = (x - cx) / (rx + 0.25);
      const dy = (y - cy) / (ry + 0.25);
      r += dx * dx + dy * dy <= 1 ? ch : '.';
    }
    rows.push(r);
  }
  return { x: 0, y: y0, rows };
}
export function mergeLayers(...ls: MaskLayer[]): MaskLayer {
  const y0 = Math.min(...ls.map((l) => l.y));
  const y1 = Math.max(...ls.map((l) => l.y + l.rows.length));
  const rows: string[] = Array.from({ length: y1 - y0 }, () => '.'.repeat(CELL_W));
  for (const l of ls)
    l.rows.forEach((r, i) => {
      const t = rows[l.y - y0 + i].split('');
      for (let x = 0; x < r.length; x++) if (r[x] !== '.') t[x] = r[x];
      rows[l.y - y0 + i] = t.join('');
    });
  return { x: 0, y: y0, rows };
}

// ---------------------------------------------------------------------------------------------
// Skull (skin slot chars A light / B mid / C dark). Ear on the left, face looks right.
export const SKULL: string[] = [
  '..BBBBBBB..',
  '.BBBBBBBBB.',
  'BBBBBBBBBBB',
  'BBBBBBBBBBB',
  'BBBBBBBBBBB',
  'BCBBBBBBBBB',
  'BBBBBBBBBBB',
  'BBBAABBBBBC',
  '.BBBBBBBBCC',
  '..CCCCCCCC.',
];

// ---------------------------------------------------------------------------------------------
// Eyes: glyph rows relative to skull row `dy` (near eye at skull x=4, far eye at x=8).
export interface EyeDef {
  name: string;
  glyph: string[];
  dy: number; // skull row of first glyph row
}
export const EYES: EyeDef[] = [
  { name: 'Dot', glyph: ['P', 'P'], dy: 5 },
  { name: 'Round', glyph: ['PP', 'WP', 'Wv'], dy: 4 },
  { name: 'Bright', glyph: ['vv', 'wW', 'ww'], dy: 4 },
  { name: 'Sleepy', glyph: ['PP', 'vw'], dy: 5 },
  { name: 'Happy', glyph: ['.P.', 'P.P'], dy: 5 },
  { name: 'Anime', glyph: ['PPP', 'vWv', 'vwv', '.w.'], dy: 4 },
  { name: 'Cat', glyph: ['.vv', 'vPv', '.ww'], dy: 4 },
  { name: 'Lashes', glyph: ['PPP', 'Wv.', 'Ww.'], dy: 4 },
];

export const BROWS: { name: string; near: string[]; far: string[] }[] = [
  { name: 'Flat', near: ['FFF'], far: ['FFF'] },
  { name: 'Thin', near: ['FF.'], far: ['.FF'] },
  { name: 'Angled', near: ['FF.'], far: ['.FF'] },
  { name: 'Arched', near: ['.F.'], far: ['.F.'] },
  { name: 'Bushy', near: ['FFF'], far: ['FFF'] },
  { name: 'Dots', near: ['.F'], far: ['.F'] },
];

/** mouth glyph rows, anchored at skull col `x`, row `y`. */
export interface MouthDef {
  name: string;
  glyph: string[];
  x: number;
  y: number;
}
export const MOUTHS: MouthDef[] = [
  { name: 'Smile', glyph: ['P.P', '.P.'], x: 6, y: 8 },
  { name: 'Tiny', glyph: ['.P.'], x: 6, y: 8 },
  { name: 'Flat', glyph: ['PPP'], x: 6, y: 8 },
  { name: 'Grin', glyph: ['PPP', 'WWW'], x: 6, y: 8 },
  { name: 'Cat', glyph: ['P.P.P'], x: 5, y: 8 },
  { name: 'Smirk', glyph: ['..P', 'PP.'], x: 6, y: 8 },
];
export const MOUTH_STATES: Record<string, { glyph: string[]; x: number; y: number }> = {
  open: { glyph: ['PPP', 'PCP'], x: 6, y: 7 },
  o: { glyph: ['.P.', 'P.P'], x: 6, y: 7 },
  grit: { glyph: ['PPPPP', 'WPWPW'], x: 5, y: 7 },
  wail: { glyph: ['PPP', 'PCP'], x: 6, y: 7 },
  smile: { glyph: ['P.P', '.P.'], x: 6, y: 8 },
};

// ---------------------------------------------------------------------------------------------
// Hair: digit 1 = hair primary, 2 = hair secondary (tint), F literal = hair dark line.
export interface HairDef {
  name: string;
  back?: MaskLayer;
  front?: MaskLayer;
}

const FRINGE_CROP = L(2, [
  [6, '1111'],
  [5, '111111'],
  [3, '111111111'],
  [2, '11111111111'],
  [2, '111.11.1111'],
  [2, '111'],
  [2, '11'],
]);

export const HAIR: HairDef[] = [
  { name: 'Bald' },
  { name: 'Crop', front: FRINGE_CROP },
  {
    name: 'Side Part',
    front: L(1, [
      [5, '11111'],
      [4, '1111111'],
      [3, '111111111'],
      [3, '111111111'],
      [2, '11111111111'],
      [2, '1111111111'],
      [2, '111...1111'],
      [2, '11.....111'],
    ]),
  },
  {
    name: 'Spiky',
    front: L(0, [
      [7, '1'],
      [4, '11.11.1'],
      [3, '1111111111'],
      [3, '111111111111'],
      [3, '111111111'],
      [2, '11111111111'],
      [2, '11111111111'],
      [2, '111.1..1.1'],
      [2, '11'],
    ]),
  },
  {
    name: 'Long',
    front: L(2, [
      [6, '1111'],
      [5, '111111'],
      [3, '111111111'],
      [2, '11111111111'],
      [2, '11111111111'],
      [2, '111'],
      [2, '111'],
      [2, '11'],
    ]),
    back: L(3, [
      [4, '1111111'],
      [2, '111111111'],
      [1, '1111111111'],
      [0, '11111111'],
      [0, '1111111'],
      [0, '1111111'],
      [0, '111111'],
      [0, '111111'],
      [0, '111111'],
      [0, '11111'],
      [0, '1111'],
      [0, '1111'],
      [1, '11'],
    ]),
  },
  {
    name: 'Ponytail',
    front: FRINGE_CROP,
    back: L(5, [
      [0, '1111'],
      [0, '11111'],
      [0, '1111'],
      [0, '1111'],
      [1, '111'],
      [1, '111'],
      [1, '11'],
      [2, '11'],
    ]),
  },
  {
    name: 'Top Bun',
    front: mergeLayers(
      L(0, [
        [6, '1111'],
        [5, '111111'],
        [5, '111111'],
        [6, '1111'],
      ]),
      L(3, [
        [4, '1111111'],
        [3, '111111111'],
        [2, '11111111111'],
        [2, '11111111111'],
        [2, '11111111111'],
        [2, '111'],
        [2, '11'],
      ]),
    ),
  },
  {
    name: 'Braids',
    front: FRINGE_CROP,
    back: L(7, [
      [0, '111'],
      [0, '111'],
      [0, '111'],
      [0, '111'],
      [1, '111'],
      [1, '111'],
      [1, '111'],
      [2, '22'],
    ]),
  },
  {
    name: 'Mohawk',
    front: L(0, [
      [8, '1'],
      [5, '1.1.1.1'],
      [4, '1111111'],
      [4, '11111111'],
      [3, '111111111'],
      [3, '11111111'],
      [2, '1111'],
      [2, '111'],
      [2, '11'],
    ]),
  },
  {
    name: 'Afro',
    back: disc(7.5, 5.5, 7.5, 5.8),
    front: L(3, [
      [3, '111111111'],
      [2, '11111111111'],
      [2, '11111111111'],
      [2, '11111111111'],
      [2, '111'],
      [2, '11'],
    ]),
  },
  {
    name: 'Bob',
    front: L(2, [
      [6, '1111'],
      [5, '111111'],
      [3, '111111111'],
      [2, '11111111111'],
      [2, '11111111111'],
      [2, '111'],
      [1, '1111'],
      [1, '1111'],
    ]),
    back: L(5, [
      [0, '111111'],
      [0, '111111'],
      [0, '111111'],
      [0, '111111'],
      [0, '111111'],
      [0, '111111'],
      [1, '11111'],
      [2, '111'],
    ]),
  },
  {
    name: 'Curly',
    back: mergeLayers(disc(3, 7, 3, 3.5), disc(7, 3, 4, 2.5), disc(11, 5, 3, 3), disc(2.5, 11, 2.5, 2.5)),
    front: L(2, [
      [5, '1111111'],
      [3, '11111111111'],
      [2, '1111111111111'],
      [2, '1111111111111'],
      [2, '1.111.11.111'],
      [2, '111'],
      [1, '111'],
    ]),
  },
  {
    name: 'Pigtails',
    front: mergeLayers(
      FRINGE_CROP,
      L(6, [
        [1, '222'],
        [0, '1111'],
        [0, '1111'],
        [0, '1111'],
        [0, '1111'],
        [1, '111'],
        [1, '111'],
        [1, '11'],
      ]),
    ),
    back: L(4, [
      [0, '11'],
      [0, '111'],
      [0, '111'],
      [0, '11'],
    ]),
  },
  {
    name: 'Pompadour',
    front: L(0, [
      [8, '11111'],
      [6, '111111111'],
      [5, '11111111111'],
      [5, '111111111111'],
      [3, '111111111111'],
      [2, '11111111111'],
      [2, '11111111111'],
      [2, '111'],
      [2, '11'],
    ]),
  },
  {
    name: 'Messy',
    front: L(1, [
      [5, '1.11.1'],
      [4, '1111111'],
      [3, '111111111.1'],
      [2, '111111111111'],
      [2, '11111111111'],
      [2, '1.11.111.1'],
      [2, '111'],
      [2, '1'],
    ]),
  },
  {
    name: 'Twin Buns',
    front: mergeLayers(
      L(0, [
        [3, '1111..1111'],
        [2, '111111.111111'],
        [2, '111111.111111'],
        [3, '1111..1111'],
      ]),
      L(3, [
        [4, '1111111'],
        [3, '111111111'],
        [2, '11111111111'],
        [2, '11111111111'],
        [2, '11111111111'],
        [2, '111'],
        [2, '11'],
      ]),
    ),
  },
];

// ---------------------------------------------------------------------------------------------
// Headwear: digit 1 = hat primary, 2 = hat secondary. drawn after hair.
export interface HatDef {
  name: string;
  layer?: MaskLayer;
  back?: MaskLayer; // drawn behind the skull (e.g. knot tails)
}

export const HATS: HatDef[] = [
  { name: 'None' },
  {
    name: 'Cap',
    layer: L(1, [
      [5, '11111'],
      [4, '1111111'],
      [3, '111111111'],
      [3, '111111111'],
      [2, '11111111111'],
      [2, '2222222222222'],
      [11, '2222'],
    ]),
  },
  {
    name: 'Beanie',
    layer: L(0, [
      [6, '2222'],
      [6, '2222'],
      [5, '111111'],
      [4, '11111111'],
      [3, '111111111'],
      [3, '111111111'],
      [2, '22222222222'],
    ]),
  },
  {
    name: 'Bucket Hat',
    layer: L(1, [
      [5, '11111'],
      [4, '1111111'],
      [3, '111111111'],
      [3, '222222222'],
      [1, '1111111111111'],
      [2, '11111111111'],
    ]),
  },
  {
    name: 'Wizard Hat',
    layer: L(0, [
      [10, '11'],
      [9, '111'],
      [7, '11111'],
      [6, '1111111'],
      [5, '22222222'],
      [1, '1111111111111'],
      [2, '11111111111'],
    ]),
  },
  {
    name: 'Crown',
    layer: L(1, [
      [4, '1..1..1..1'],
      [4, '1.111.1.11'],
      [4, '1121111211'],
      [4, '2222222222'],
    ]),
  },
  {
    name: 'Headband',
    layer: L(5, [
      [2, '11111111111'],
      [2, '11111122111'],
    ]),
    back: L(6, [
      [0, '1111'],
      [0, '111'],
      [1, '11'],
    ]),
  },
  {
    name: 'Bandana',
    layer: L(3, [
      [4, '1121112'],
      [3, '112111211'],
      [2, '11121112111'],
      [2, '22222222222'],
    ]),
    back: L(5, [
      [0, '1111'],
      [0, '11211'],
      [1, '1111'],
      [2, '11'],
    ]),
  },
  {
    name: 'Cat Ears',
    layer: L(0, [
      [4, '1.....1'],
      [4, '11...11'],
      [4, '121.121'],
      [3, '1111.1111'],
    ]),
  },
  {
    name: 'Bunny Ears',
    layer: L(0, [
      [5, '11...11'],
      [5, '12...21'],
      [5, '12...21'],
      [5, '12...21'],
      [5, '11...11'],
      [5, '11...11'],
    ]),
  },
  {
    name: 'Goggles',
    layer: L(3, [
      [4, '1111.1111'],
      [2, '221W11211W11'],
      [4, '1111.1111'],
    ]),
  },
  {
    name: 'Helmet',
    layer: L(0, [
      [6, '2222'],
      [5, '111111'],
      [4, '1111111'],
      [3, '1111111111'],
      [2, '11111111111'],
      [2, '11111111111'],
      [2, '22222222222'],
      [2, '111'],
      [2, '111'],
      [2, '111'],
    ]),
  },
  {
    name: 'Straw Hat',
    layer: L(2, [
      [5, '111111'],
      [4, '1111111'],
      [4, '2222222'],
      [0, '1111111111111111'],
      [1, '11111111111111'],
    ]),
  },
  {
    name: 'Flower Crown',
    layer: L(3, [
      [3, '22.22.22.22'],
      [3, '22122122122'],
      [2, '11111111111'],
    ]),
  },
  {
    name: 'Coil Antenna',
    layer: L(0, [
      [7, '22'],
      [7, '22'],
      [8, '11'],
      [7, '11'],
      [8, '11'],
    ]),
  },
  {
    // developer only: a taller crown, five points, a floating gem (colour 2) over the centre
    name: 'Dev Crown',
    layer: L(0, [
      [7, '22'],
      [4, '1.1.22.1.1'],
      [4, '1111111111'],
      [4, '1121122111'],
      [4, '2222222222'],
    ]),
  },
];

// ---------------------------------------------------------------------------------------------
// Accessories. `kind 'head'` are head-cell layers drawn after hair, before hats; 'torso' ones live in
// torso space (see parts_body.ts) and are listed there.
export interface AccDef {
  name: string;
  head?: MaskLayer;
  headBack?: MaskLayer;
  torso?: { layers: MaskLayer[]; flow?: boolean };
}

export const ACC_HEAD: Record<string, MaskLayer | undefined> = {
  'Round Glasses': L(7, [
    [5, '1111.1111'],
    [5, '1..1.1..1'],
    [5, '1..1.1..1'],
    [5, '1111.1111'],
  ]),
  Shades: L(8, [
    [4, '111111111'],
    [4, '1111.1111'],
    [5, '111..111'],
  ]),
  Eyepatch: mergeLayers(
    L(8, [
      [10, '111'],
      [10, '111'],
      [10, '111'],
    ]),
    L(7, [[3, '22222222']]),
  ),
  Freckles: L(11, [[5, 'C.C.C'], [6, '.C.C']]),
  'Face Mask': L(10, [
    [5, '11111111'],
    [4, '111111111'],
    [4, '111111111'],
  ]),
  Earring: L(10, [
    [2, '2'],
    [2, '1'],
  ]),
};
