// Region palettes + per-region style data for the shared 16x16 tile layout.
// Tileset rule (SNES-style): <= 16 colors per tileset. Every tile pixel is one of these 16 slots.
//
// Slot legend (same in every region so the authored tile logic is reusable):
//   1 2 3 4   surface cover ramp, light -> dark   (meadow: grass,  caverns: glow-moss)
//   a b c d   earth ramp, light -> dark            (meadow: loam,   caverns: violet rock)
//   x y z     stone ramp, light -> dark
//   p q       timber light / mid   (timber dark = slot c)
//   r s t     accents: r warm/hot, s bright, t near-white
import type { Palette } from '../core';
import { tintSunset } from './paint';

export type Stamp = [x: number, y: number, rows: string[]];

export interface RegionStyle {
  id: 'meadow' | 'caverns' | 'meadow_sunset';
  pal: Palette;
  /** lower-edge profile of the surface cover per top variant (row index of last cover pixel) */
  capB: number[][];
  /** bottom-edge profiles for exposed undersides */
  botProfiles: number[][];
  /** shallow fill variants (stamps over base 'b') */
  fills: Stamp[][];
  /** deep fill variants (stamps over base 'b', remapped darker later) */
  deepFills: Stamp[][];
  /** nail / rivet ink on timber */
  nail: string;
  /** glow ink for lamp-ish accents */
  glow: string;
  topVariants: number;
  /** optional per-region left/right face jitter profiles (inset px per row, pinned to 0 at rows 0 and 15) */
  edgeW?: number[][];
  edgeE?: number[][];
  /** cave-like: darker outlines vs a dark bg, glowing accents */
  cave: boolean;
}

// ---------- shared stamps (chunky, flat-shaded: big clear shapes, no speckle) ----------
const CLOD: string[] = ['.aaaa.', 'aabbbc', 'abbbcc', '.cccc.'];
const CLOD_S: string[] = ['.aa.', 'abbc', '.cc.'];
const STONE_L: string[] = ['..ccc..', '.cxxyc.', 'cxxyyzc', 'cxyyzzc', '.czzzc.', '..ccc..'];
const STONE_S: string[] = ['.cc.', 'cxyc', 'cyzc', '.cc.'];
const ROOT_A: string[] = ['aaa.........', 'cccc..aaa...', '.ccccccccc..', '.....ccc.cc.'];
const ROOT_B: string[] = ['aa......', 'ccc..aa.', '.cccccc.', '...cc...'];
const SHELL: string[] = ['.ccc.', 'cxxyc', 'cxczc', 'cyyzc', '.ccc.'];
const BONE: string[] = ['.x.x.x..', 'xxxxxxxy', '.z.z.z..'];
const SHARD_A: string[] = ['.t..', 'tss.', 'tssr', 'sssr', '.ssr', '..rr'];
const SHARD_B: string[] = ['..t', '.ts', 'tss', 'sss', 'rsr', '.rr'];
const SHARD_C: string[] = ['.s.', 'sts', 'sss', 'rss', '.rr'];

/** A 2px seam across the tile with gaps (light line over a dark line). */
function strata(y: number, pat: string): Stamp[] {
  const out: Stamp[] = [];
  for (let x = 0; x < 16; x++) {
    if (pat[x] === 'a') {
      out.push([x, y, ['a']]);
      out.push([x, y + 1, ['c']]);
    }
  }
  return out;
}

// ---------- meadow: Sunny Haven Meadows ----------
export const MEADOW: RegionStyle = {
  id: 'meadow',
  cave: false,
  topVariants: 6,
  nail: 's',
  glow: 's',
  pal: {
    '1': '#dcf56c', // sun-kissed grass lip (warm yellow)
    '2': '#7ed648',
    '3': '#34a04c',
    '4': '#1c5a58', // grass shadow / outline, pushed to teal
    a: '#eaa870', // loam, sunlit
    b: '#bc7448',
    c: '#7c4850',
    d: '#472f52', // deep, pushed to purple
    x: '#dcdcf0',
    y: '#9a9ec8',
    z: '#5e6298',
    p: '#fbd77c', // timber light
    q: '#d68a40', // timber mid
    r: '#e84a62', // flowers / pad / coral
    s: '#ffe44a',
    t: '#fff6ea',
  },
  capB: [
    [5, 5, 6, 6, 5, 5, 6, 7, 6, 5, 5, 4, 5, 6, 5, 5],
    [5, 6, 6, 5, 5, 4, 5, 5, 6, 6, 7, 6, 5, 5, 5, 5],
    [5, 5, 5, 4, 5, 6, 7, 7, 6, 5, 5, 6, 6, 5, 5, 5],
  ],
  botProfiles: [
    [0, 1, 1, 2, 2, 1, 1, 2, 3, 2, 1, 1, 2, 1, 0, 0],
    [0, 0, 1, 2, 3, 2, 1, 1, 1, 2, 2, 3, 2, 1, 1, 0],
  ],
  fills: [
    // 0-2: three clod layouts (so the plain dirt never reads as a grid), 3: nearly plain
    [
      [2, 3, CLOD],
      [9, 10, CLOD_S],
    ],
    [
      [8, 2, CLOD],
      [2, 10, CLOD_S],
    ],
    [
      [4, 9, CLOD],
      [11, 3, CLOD_S],
    ],
    [[13, 12, CLOD_S]],
    // 4: stones
    [
      [2, 2, STONE_L],
      [10, 9, STONE_S],
      [1, 12, ['aa.', 'ccc']],
    ],
    // 5: roots
    [
      [2, 4, ROOT_A],
      [5, 11, ROOT_B],
    ],
    // 6: strata + shell
    [...strata(3, 'aaaaaaa..aaaaaaa'), ...strata(12, '.aaaaa..aaaaaaa.'), [5, 6, SHELL]],
  ],
  deepFills: [
    [
      [2, 2, CLOD],
      [9, 8, CLOD],
      [11, 1, CLOD_S],
    ],
    [
      [4, 2, STONE_L],
      [1, 11, BONE],
      [11, 10, STONE_S],
    ],
  ],
};

// ---------- caverns: Crystal Caverns ----------
export const CAVERNS: RegionStyle = {
  id: 'caverns',
  cave: true,
  // rougher, chipped rock faces than the soft meadow loam
  edgeW: [
    [0, 1, 2, 2, 1, 0, 1, 2, 1, 0, 0, 2, 1, 0, 0, 0],
    [0, 0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 1, 0, 0],
  ],
  edgeE: [
    [0, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 1, 2, 1, 0, 0],
    [0, 1, 0, 0, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 0],
  ],
  topVariants: 6,
  nail: 'r',
  glow: 's',
  pal: {
    '1': '#b6ffd0', // luminous moss lip
    '2': '#4ed89c',
    '3': '#1f8a84',
    '4': '#0e3a5c',
    a: '#a690e8', // rock, crystal-lit
    b: '#7260b8',
    c: '#483a88',
    d: '#140e3a',
    x: '#c4d2f0',
    y: '#8090c4',
    z: '#4c5690',
    p: '#b89484', // old timber, desaturated
    q: '#846058',
    r: '#ff5cc6', // magenta crystal
    s: '#52eaf4', // cyan crystal
    t: '#f8f2ff',
  },
  capB: [
    [4, 4, 5, 6, 5, 4, 4, 5, 7, 5, 4, 4, 5, 5, 4, 4],
    [4, 5, 5, 4, 4, 5, 6, 8, 6, 4, 4, 4, 5, 6, 5, 4],
    [4, 4, 4, 5, 6, 5, 4, 4, 5, 5, 7, 6, 4, 4, 4, 4],
  ],
  botProfiles: [
    // stalactite teeth
    [0, 1, 3, 6, 3, 1, 0, 2, 4, 2, 0, 1, 5, 3, 1, 0],
    [0, 2, 4, 2, 0, 0, 3, 7, 4, 1, 0, 2, 3, 1, 0, 0],
  ],
  fills: [
    [
      [2, 3, CLOD],
      [9, 10, CLOD_S],
    ],
    [
      [8, 2, CLOD],
      [2, 10, CLOD_S],
    ],
    [
      [4, 9, CLOD],
      [11, 3, CLOD_S],
    ],
    [[13, 12, CLOD_S]],
    // 4: crystal vein
    [
      [3, 3, SHARD_A],
      [10, 7, SHARD_B],
      [1, 12, CLOD_S],
    ],
    // 5: stones
    [
      [2, 2, STONE_L],
      [10, 9, STONE_S],
    ],
    // 6: strata + glow seam
    [...strata(3, 'aaaaaaa..aaaaaaa'), ...strata(12, '.aaaaa..aaaaaaa.'), [9, 6, SHARD_C]],
  ],
  deepFills: [
    [
      [2, 2, CLOD],
      [9, 8, CLOD],
      [11, 1, CLOD_S],
    ],
    [
      [4, 2, SHARD_B],
      [10, 8, SHARD_A],
      [1, 11, CLOD_S],
    ],
  ],
};

/** Time-of-day variant: same tiles, warm sunset grade applied to each palette slot. */
export const MEADOW_SUNSET: RegionStyle = {
  ...MEADOW,
  id: 'meadow_sunset',
  pal: Object.fromEntries(Object.entries(MEADOW.pal).map(([k, v]) => [k, v ? tintSunset(v) : v])),
};

export const STYLES = { meadow: MEADOW, caverns: CAVERNS, meadow_sunset: MEADOW_SUNSET } as const;
