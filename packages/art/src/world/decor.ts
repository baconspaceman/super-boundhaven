// Deterministic decoration placement: turns a Level into prop placements (non-colliding scenery).
import { TILE, type Level } from '@sbh/sim';
import { autotile } from './autotile';
import { hash2 } from './paint';
import type { RegionId } from './tileset';

export interface PropPlacement {
  prop: string;
  /** world px of the prop's anchor point */
  x: number;
  y: number;
  layer: 'back' | 'front';
  /** animation phase offset in frames */
  phase: number;
}

/** footprint widths (px) of larger ground props, used to check they sit on a flat run */
const FOOT: Record<string, number> = {
  tree_l: 34,
  tree_s: 22,
  bush_l: 32,
  bush_s: 18,
  rock_l: 26,
  rock_m: 16,
  mush_cluster: 22,
  mush_violet: 12,
  log_mossy: 34,
  signpost: 16,
  fence_m: 16,
  crystal_l: 40,
  crystal_m: 26,
  crystal_s: 14,
  stalagmite_l: 14,
  stalagmite_m: 10,
  lamp_l: 20,
  lamp_s: 12,
};

export function decorate(level: Level, region: RegionId): PropPlacement[] {
  const tiles = autotile(level);
  const out: PropPlacement[] = [];
  const H = level.height;
  const W = level.width;
  const isFlatTop = (c: number, r: number) => {
    const t = tiles[r]?.[c];
    return !!t && /^top[0-5]$/.test(t.id);
  };
  // columns claimed by big props so they don't overlap
  const claimed = new Set<number>();
  const free = (c0: number, c1: number) => {
    for (let c = c0; c <= c1; c++) if (claimed.has(c)) return false;
    return true;
  };
  const claim = (c0: number, c1: number) => {
    for (let c = c0; c <= c1; c++) claimed.add(c);
  };
  const surfaceRow = (c: number): number => {
    for (let r = 0; r < H; r++) if (isFlatTop(c, r)) return r;
    return -1;
  };

  // spawn signpost (meadow only)
  if (region !== 'caverns') {
    const sc = Math.floor(level.spawn.x / TILE) + 2;
    const r = surfaceRow(sc);
    if (r >= 0 && isFlatTop(sc, r)) {
      out.push({ prop: 'signpost', x: sc * TILE + 8, y: r * TILE + 3, layer: 'back', phase: 0 });
      claim(sc - 1, sc + 1);
    }
  }

  for (let c = 0; c < W; c++) {
    for (let r = 0; r < H; r++) {
      if (!isFlatTop(c, r)) continue;
      const h = hash2(c, r, 501);
      const cx = c * TILE + 8;
      const gy = r * TILE + 3; // contact sits just inside the grass cap
      const big =
        region !== 'caverns'
          ? (['tree_l', 'bush_l', 'tree_s', 'rock_m', 'mush_cluster', 'bush_s', 'log_mossy', 'rock_l', 'mush_violet', 'rock_s'] as const)
          : (['crystal_l', 'crystal_m', 'lamp_l', 'stalagmite_l', 'crystal_s', 'lamp_s', 'stalagmite_m', 'mush_cluster', 'rock_m'] as const);
      if (h < 0.17) {
        const id = big[Math.floor(hash2(c, r, 502) * big.length)];
        const fw = FOOT[id] ?? 16;
        const span = Math.ceil(fw / TILE);
        const c0 = c - Math.floor((span - 1) / 2);
        const c1 = c0 + span - 1;
        let ok = free(c0, c1);
        for (let k = c0; k <= c1 && ok; k++) if (!isFlatTop(k, r)) ok = false;
        if (ok) {
          out.push({ prop: id, x: cx, y: gy, layer: 'back', phase: Math.floor(hash2(c, r, 503) * 4) });
          claim(c0 - 1, c1 + 1);
          continue;
        }
      }
      if (!claimed.has(c) || h > 0.6) {
        // small flora / fillers
        const k = hash2(c, r, 504);
        const jx = Math.floor((hash2(c, r, 505) - 0.5) * 8);
        if (region !== 'caverns') {
          if (k < 0.3) out.push({ prop: `tuft_${Math.floor(hash2(c, r, 506) * 3)}`, x: cx + jx, y: gy + 1, layer: 'front', phase: Math.floor(hash2(c, r, 507) * 2) });
          else if (k < 0.45) out.push({ prop: ['flower_red', 'flower_yellow', 'flower_blue'][Math.floor(hash2(c, r, 508) * 3)], x: cx + jx, y: gy, layer: 'back', phase: Math.floor(hash2(c, r, 509) * 2) });
          else if (k < 0.53) out.push({ prop: 'tall_grass', x: cx + jx, y: gy + 1, layer: 'front', phase: Math.floor(hash2(c, r, 510) * 2) });
        } else {
          if (k < 0.22) out.push({ prop: 'crystal_s', x: cx + jx, y: gy, layer: 'back', phase: Math.floor(hash2(c, r, 511) * 2) });
          else if (k < 0.34) out.push({ prop: 'mush_teal', x: cx + jx, y: gy, layer: 'back', phase: 0 });
        }
      }
    }
  }

  // fences along long flat runs (meadow)
  if (region !== 'caverns') {
    for (let c = 2; c < W - 3; c++) {
      const r = surfaceRow(c);
      if (r < 0) continue;
      let run = 0;
      while (isFlatTop(c + run, r) && run < 8) run++;
      if (run >= 3 && hash2(c, r, 520) < 0.06 && free(c, c + 2)) {
        const ids = ['fence_l', 'fence_m', 'fence_r'];
        for (let i = 0; i < 3; i++) out.push({ prop: ids[i], x: (c + i) * TILE + 8, y: r * TILE + 3, layer: 'back', phase: 0 });
        claim(c, c + 2);
      }
    }
  }

  // things under floating platforms
  for (let r = 0; r < H; r++)
    for (let c = 0; c < W; c++) {
      const t = tiles[r][c];
      if (!t || !t.id.startsWith('plat_')) continue;
      const above = tiles[r - 1]?.[c];
      if (above) continue;
      if (region !== 'caverns') {
        if (hash2(c, r, 530) < 0.45) {
          const len = 1 + Math.floor(hash2(c, r, 531) * 3);
          out.push({ prop: 'vine_top', x: c * TILE + 8, y: (r + 1) * TILE - 2, layer: 'front', phase: Math.floor(hash2(c, r, 532) * 2) });
          for (let i = 1; i <= len; i++) {
            if (tiles[r + i]?.[c]) break;
            out.push({ prop: i === len ? 'vine_end' : 'vine_mid', x: c * TILE + 8, y: (r + 1 + i) * TILE - 2, layer: 'front', phase: Math.floor(hash2(c, r + i, 533) * 2) });
          }
        } else if (hash2(c, r, 534) < 0.35) {
          out.push({ prop: 'tuft_1', x: c * TILE + 8, y: r * TILE + 3, layer: 'front', phase: c & 1 });
        }
      } else if (hash2(c, r, 535) < 0.3) {
        out.push({ prop: 'stalactite_s', x: c * TILE + 8, y: (r + 1) * TILE - 1, layer: 'back', phase: 0 });
      }
    }

  // pit water (decor only; sits below the ground line)
  const pitCols: number[] = [];
  for (let c = 0; c < W; c++) {
    const a = level.tiles[H - 1][c];
    const b = level.tiles[H - 2][c];
    if (a === '.' && b === '.' && (level.tiles[H - 3]?.[c] ?? '.') === '.') pitCols.push(c);
  }
  for (const c of pitCols) {
    out.push({ prop: 'water_top', x: c * TILE + 8, y: (H - 2) * TILE + 5, layer: 'front', phase: c % 4 });
    out.push({ prop: 'water_body', x: c * TILE + 8, y: (H - 1) * TILE + 5, layer: 'front', phase: c % 4 });
  }
  if (region !== 'caverns' && pitCols.length >= 3) {
    const m = pitCols[Math.floor(pitCols.length / 2)];
    out.push({ prop: 'lily', x: m * TILE + 8, y: (H - 2) * TILE + 4, layer: 'front', phase: 0 });
    out.push({ prop: 'lily', x: pitCols[0] * TILE + 6, y: (H - 2) * TILE + 6, layer: 'front', phase: 1 });
  }

  // cavern ceiling: stalactites + drips along the top edge
  if (region === 'caverns') {
    for (let c = 0; c < W; c += 1) {
      const h = hash2(c, 0, 540);
      if (h < 0.42) {
        const id = h < 0.1 ? 'stalactite_l' : h < 0.26 ? 'stalactite_m' : 'stalactite_s';
        out.push({ prop: id, x: c * TILE + 8 + Math.floor((hash2(c, 1, 541) - 0.5) * 8), y: 0, layer: 'back', phase: 0 });
        if (id !== 'stalactite_s' && hash2(c, 2, 542) < 0.5) {
          const len = id === 'stalactite_l' ? 40 : 24;
          out.push({ prop: 'drip', x: c * TILE + 8, y: len - 2, layer: 'front', phase: Math.floor(hash2(c, 3, 543) * 4) });
        }
      }
    }
  }

  return out;
}
