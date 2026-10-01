// Autotiler: Level legend -> tile ids. Pure + deterministic (variants come from a col/row hash).
// Legend: '#' solid, 'B' bounce pad, '/' and '\' 45deg slopes, '.' empty.
import { isSlope, tileAt, type Level } from '@sbh/sim';
import { hash2 } from './paint';

export interface TileRef {
  /** atlas key, present in every tileset (see TILE_IDS) */
  id: string;
  /** key into TILE_ANIMS when the tile is animated */
  anim?: string;
}

export { TILE_ANIMS } from './tileset';

/** Variant index in [0,n) from the cell position; never equals the raw candidate of the left/upper neighbour. */
function pick(c: number, r: number, n: number, salt: number): number {
  const raw = (cc: number, rr: number) => Math.floor(hash2(cc, rr, salt) * n) % n;
  let v = raw(c, r);
  if (n > 1 && (v === raw(c - 1, r) || v === raw(c, r - 1))) v = (v + 1 + Math.floor(hash2(c, r, salt + 99) * (n - 1))) % n;
  return v;
}

function fillTone(c: number, r: number): number {
  const h = hash2(c, r, 31);
  if (h < 0.2) return 0;
  if (h < 0.4) return 1;
  if (h < 0.6) return 2;
  if (h < 0.75) return 3;
  if (h < 0.82) return 4;
  if (h < 0.91) return 5;
  return 6;
}

/** Weighted fill variant: three clod layouts dominate, detail tiles are sparse and never touch a twin. */
function pickFill(c: number, r: number): number {
  const v = fillTone(c, r);
  const vl = fillTone(c - 1, r);
  const vu = fillTone(c, r - 1);
  if (v === vl || v === vu) return (v + 1 + ((c * 7 + r * 3) % 2)) % 4; // fall back to a neighbouring plain layout
  return v;
}

/**
 * Choose a tile for every non-empty cell. Returns [row][col]; empty ('.') cells are `null`.
 * Neighbour rules: slopes count as solid on their full sides, 'B' never covers a neighbour
 * (the grass cap shows under a pad), the level bottom edge counts as solid ground.
 */
export function autotile(level: Level): (TileRef | null)[][] {
  const H = level.height;
  const at = (c: number, r: number) => tileAt(level, c, r);
  const out: (TileRef | null)[][] = [];
  for (let r = 0; r < H; r++) {
    const row: (TileRef | null)[] = [];
    for (let c = 0; c < level.width; c++) {
      const ch = at(c, r);
      if (ch === '.') row.push(null);
      else if (ch === 'B') row.push({ id: 'bounce0', anim: 'bounce' });
      else if (ch === '/') row.push({ id: 'slope_up' });
      else if (ch === '\\') row.push({ id: 'slope_dn' });
      else row.push({ id: groundId(level, c, r) });
    }
    out.push(row);
  }
  return out;
}

function groundId(level: Level, c: number, r: number): string {
  const at = (cc: number, rr: number) => tileAt(level, cc, rr);
  const N = at(c, r - 1);
  const Wc = at(c - 1, r);
  const Ec = at(c + 1, r);
  const nExp = !(N === '#' || isSlope(N));
  const wExp = !(Wc === '#' || Wc === '/');
  const eExp = !(Ec === '#' || Ec === '\\');
  const sExp = r + 1 < level.height && !(at(c, r + 1) === '#' || at(c, r + 1) === 'B');

  if (nExp && sExp) {
    if (wExp && eExp) return 'plat_s';
    if (wExp) return 'plat_l';
    if (eExp) return 'plat_r';
    return `plat_m${pick(c, r, 2, 5)}`;
  }
  if (nExp) {
    if (wExp && eExp) return 'brick_cap';
    if (wExp) return `top_l${pick(c, r, 2, 3)}`;
    if (eExp) return `top_r${pick(c, r, 2, 4)}`;
    return `top${pick(c, r, 6, 1)}`;
  }
  if (sExp) {
    if (wExp && eExp) return 'bot_lr';
    if (wExp) return 'bot_l';
    if (eExp) return 'bot_r';
    return `bot${pick(c, r, 2, 9)}`;
  }
  if (wExp && eExp) return `brick${pick(c, r, 2, 6)}`;
  if (wExp) return at(c - 1, r + 1) === '#' ? 'wall_l_foot' : `wall_l${pick(c, r, 2, 7)}`;
  if (eExp) return at(c + 1, r + 1) === '#' ? 'wall_r_foot' : `wall_r${pick(c, r, 2, 8)}`;
  if (N === '/') return 'under_up';
  if (N === '\\') return 'under_dn';
  let up = 0;
  // thickness counts only along a wide ground mass: a pillar/wall rising above the floor is not dirt depth
  while (up < 6) {
    const rr = r - 1 - up;
    const l = at(c - 1, rr);
    const e = at(c + 1, rr);
    if (at(c, rr) !== '#' || !(l === '#' || l === '/') || !(e === '#' || e === '\\')) break;
    up++;
  }
  if (up === 3) return `trans${pick(c, r, 2, 12)}`;
  if (up >= 4) return `deep${pick(c, r, 2, 11)}`;
  return `fill${pickFill(c, r)}`;
}
