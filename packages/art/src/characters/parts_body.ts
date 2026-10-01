// Torso-space paper-doll parts. Torso origin = top-left of the 8-wide chest at frame (8,14) in the neutral
// pose. Rows 0..6 are chest/waist, rows 7..8 the hips. Digits: 0=skin 1=primary 2=secondary.
import type { MaskLayer } from './layers';

export type SleeveKind = 0 | 1 | 2; // none, short, long

export interface TopDef {
  name: string;
  rows: string[]; // 8 wide, rows 0..6 (longer tops add rows 7+)
  sleeve: SleeveKind;
  /** extra flared layer drawn over the legs (tunic hem etc.) in torso coords */
  over?: MaskLayer;
}

const T = (rows: string[]): string[] => rows;

export const TOPS: TopDef[] = [
  {
    name: 'Tee',
    sleeve: 1,
    rows: T(['11111111', '11200211', '11111111', '11111111', '11111111', '11111111', '11111111']),
  },
  {
    name: 'Striped Tee',
    sleeve: 1,
    rows: T(['11111111', '11200211', '22222222', '11111111', '22222222', '11111111', '22222222']),
  },
  {
    name: 'Tank',
    sleeve: 0,
    rows: T(['00000000', '01100110', '01111110', '11111111', '11111111', '11111111', '11111111']),
  },
  {
    name: 'Hoodie',
    sleeve: 2,
    rows: T(['11111111', '12200221', '11111111', '11111111', '12222221', '11111111', '22222222']),
  },
  {
    name: 'Jacket',
    sleeve: 2,
    rows: T(['11111111', '11222211', '11122111', '11122111', '11122111', '11122111', '11111111']),
  },
  {
    name: 'Overalls',
    sleeve: 1,
    rows: T(['22222222', '22200222', '21122112', '21111112', '21122112', '21111112', '11111111']),
  },
  {
    name: 'Tunic',
    sleeve: 1,
    rows: T(['11111111', '11200211', '11111111', '11111111', '22222222', '11111111', '11111111', '11111111']),
    over: { x: -1, y: 8, rows: ['1111111111', '1111111111', '2222222222'] },
  },
  {
    name: 'Sweater',
    sleeve: 2,
    rows: T(['11111111', '12222221', '11211211', '12112112', '11211211', '12112112', '22222222']),
  },
  {
    name: 'Sailor',
    sleeve: 1,
    rows: T(['11111111', '22200222', '12222221', '11222211', '11122111', '11111111', '11111111']),
  },
  {
    name: 'Armor',
    sleeve: 1,
    rows: T(['22222222', '21100112', '21111112', '21122112', '21111112', '21111112', '22222222']),
  },
  {
    name: 'Wrap',
    sleeve: 2,
    rows: T(['11111111', '12200221', '12211111', '11221111', '11122111', '22222222', '22222222']),
  },
  {
    name: 'Star Tee',
    sleeve: 1,
    rows: T(['11111111', '11200211', '11111111', '11122111', '11222211', '11122111', '11111111']),
  },
];

export type LegPattern = 'plain' | 'cuff' | 'stripe' | 'stockings' | 'pocket';

export interface BottomDef {
  name: string;
  /** torso rows 7..8 (8 wide) */
  hip: string[];
  /** number of leg-path points colored as pants (99 = entire leg); 0 = bare legs */
  legLen: number;
  pattern: LegPattern;
  over?: MaskLayer;
}

export const BOTTOMS: BottomDef[] = [
  { name: 'Jeans', hip: ['22222222', '11111111'], legLen: 99, pattern: 'plain' },
  { name: 'Shorts', hip: ['22222222', '11111111'], legLen: 2, pattern: 'plain' },
  { name: 'Capris', hip: ['22222222', '11111111'], legLen: 3, pattern: 'cuff' },
  { name: 'Cargo', hip: ['22222222', '11111111'], legLen: 4, pattern: 'pocket' },
  { name: 'Track Pants', hip: ['22222222', '11111111'], legLen: 99, pattern: 'stripe' },
  {
    name: 'Skirt',
    hip: ['22222222', '11111111'],
    legLen: 0,
    pattern: 'plain',
    over: { x: -1, y: 8, rows: ['1111111111', '1111111111', '2222222222'] },
  },
  {
    name: 'Kilt',
    hip: ['22222222', '12121212'],
    legLen: 0,
    pattern: 'plain',
    over: { x: -1, y: 8, rows: ['1212121212', '2121212121', '2222222222'] },
  },
  { name: 'Stockings', hip: ['22222222', '11111111'], legLen: 99, pattern: 'stockings' },
];

export interface ShoeDef {
  name: string;
  rows: string[]; // toe points right; row0 = ankle row (leg enters at cols 1..2)
  shaft: number; // leg-path points colored as shoe primary above the ankle
}

export const SHOES: ShoeDef[] = [
  { name: 'Sneakers', rows: ['.11...', '111122', '222222'], shaft: 0 },
  { name: 'Boots', rows: ['.11...', '111111', '222222'], shaft: 2 },
  { name: 'Sandals', rows: ['.00...', '002200', '111111'], shaft: 0 },
  { name: 'Slippers', rows: ['.11...', '111111', '.2222.'], shaft: 0 },
  { name: 'Hi-Tops', rows: ['.11...', '112211', '222222'], shaft: 1 },
  { name: 'Barefoot', rows: ['.00...', '000000', '.00000'], shaft: 0 },
  { name: 'Clogs', rows: ['.00...', '002000', '2.22.2'], shaft: 0 },
  { name: 'Pogo Shoes', rows: ['.11...', '111111', '222222', '.2.2.2'], shaft: 0 },
];

// ---------------------------------------------------------------------------------------------
// Back items (torso coords; torso left edge is col 0, so negative x sits behind the body).
export interface BackDef {
  name: string;
  kind: 'none' | 'cape' | 'rigid' | 'wings' | 'tail';
  layer?: MaskLayer; // cape/rigid/tail base
  wings?: MaskLayer[]; // [down, mid, up]
}

export const BACKS: BackDef[] = [
  { name: 'None', kind: 'none' },
  {
    name: 'Short Cape',
    kind: 'cape',
    layer: { x: -3, y: 1, rows: ['..11', '.111', '.111', '1111', '1111', '1111', '2222'] },
  },
  {
    name: 'Long Cape',
    kind: 'cape',
    layer: { x: -3, y: 1, rows: ['..11', '.111', '.111', '1111', '1111', '1111', '1111', '1111', '1111', '2222'] },
  },
  {
    name: 'Backpack',
    kind: 'rigid',
    layer: { x: -4, y: 2, rows: ['1111', '1111', '2222', '1111', '1111', '1111', '2222'] },
  },
  {
    name: 'Wings',
    kind: 'wings',
    wings: [
      { x: -5, y: 1, rows: ['..11', '.111', '.1211', '.1221', '..121', '...11', '....1'] },
      { x: -6, y: 0, rows: ['....11', '..1111', '.11211', '11122.', '.1222.', '..22..', '...1..'] },
      { x: -6, y: -4, rows: ['.1', '.11', '.111', '.1211', '..1211', '..12211', '...12221', '....1111', '.....11'] },
    ],
  },
  {
    name: 'Tail',
    kind: 'tail',
    layer: { x: -5, y: 5, rows: ['..11', '.111', '1111', '.222', '..22'] },
  },
  {
    name: 'Coil Pack',
    kind: 'rigid',
    layer: { x: -5, y: 2, rows: ['.22.', '1111', '.22.', '1111', '.22.', '1111', '2222'] },
  },
];

// torso-space accessories (digits 1=acc primary, 2=acc secondary)
export const ACC_TORSO: Record<string, { layers: MaskLayer[]; tail?: MaskLayer }> = {
  Scarf: {
    layers: [{ x: 1, y: 0, rows: ['111111', '112211'] }],
    tail: { x: -1, y: 1, rows: ['11', '11', '12', '12', '22'] },
  },
  'Bow Tie': { layers: [{ x: 2, y: 1, rows: ['1.2.1', '11211', '1.2.1'] }] },
  Necklace: {
    layers: [
      { x: 2, y: 2, rows: ['1...1', '.111.'] },
      { x: 3, y: 4, rows: ['22'] },
    ],
  },
};
