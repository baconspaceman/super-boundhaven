import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PLAYGROUND, parseLevel } from '@sbh/sim';
import { describe, expect, it } from 'vitest';
import type { Bitmap } from '../src/core';
import { buildWorld } from '../scripts/build-world';
import { autotile, TILE_ANIMS } from '../src/world/autotile';
import { BACKGROUNDS } from '../src/world/backgrounds';
import { decorate } from '../src/world/decor';
import { buildCavernProps, buildMeadowProps } from '../src/world/props';
import { loadRegionAssets } from '../src/world/scene';
import { TILE_IDS, TILESETS, buildTilesetBitmap, type RegionId } from '../src/world/tileset';

const REGIONS: RegionId[] = ['meadow', 'meadow_sunset', 'caverns'];

function uniqueColors(b: Bitmap): number {
  const s = new Set<number>();
  for (let i = 0; i < b.data.length; i += 4) if (b.data[i + 3]) s.add((b.data[i] << 16) | (b.data[i + 1] << 8) | b.data[i + 2]);
  return s.size;
}
function firstOpaqueRow(b: Bitmap, x: number): number {
  for (let y = 0; y < b.h; y++) if (b.data[(y * b.w + x) * 4 + 3]) return y;
  return -1;
}
function colDiff(b: Bitmap, xa: number, xb: number): number {
  let d = 0;
  for (let y = 0; y < b.h; y++) {
    const a = (y * b.w + xa) * 4;
    const c = (y * b.w + xb) * 4;
    d += Math.abs(b.data[a] - b.data[c]) + Math.abs(b.data[a + 1] - b.data[c + 1]) + Math.abs(b.data[a + 2] - b.data[c + 2]) + Math.abs(b.data[a + 3] - b.data[c + 3]);
  }
  return d / b.h / 4;
}

describe('tilesets', () => {
  for (const region of REGIONS) {
    it(`${region}: every tile is 16x16 and the sheet uses <= 16 colors`, () => {
      const { sheet, tiles } = buildTilesetBitmap(region);
      for (const id of TILE_IDS) {
        expect(tiles[id], id).toBeDefined();
        expect([tiles[id].w, tiles[id].h], id).toEqual([16, 16]);
        expect(uniqueColors(tiles[id]), `${id} is not empty`).toBeGreaterThan(1);
      }
      expect(uniqueColors(sheet)).toBeLessThanOrEqual(16);
      expect(sheet.w).toBe(TILESETS[region].width);
      expect(sheet.h).toBe(TILESETS[region].height);
    });
  }

  it('bounce pad has 3 distinct animation frames and animation metadata', () => {
    const { tiles } = buildTilesetBitmap('meadow');
    const same = (a: Bitmap, b: Bitmap) => a.data.every((v, i) => v === b.data[i]);
    expect(same(tiles.bounce0, tiles.bounce1)).toBe(false);
    expect(same(tiles.bounce1, tiles.bounce2)).toBe(false);
    expect(TILE_ANIMS.bounce.frames.every((f) => TILE_IDS.includes(f))).toBe(true);
  });

  it('caverns is not a cheap recolor of the meadow (hand-tweaked tiles differ in shape)', () => {
    const m = buildTilesetBitmap('meadow').tiles;
    const c = buildTilesetBitmap('caverns').tiles;
    let differing = 0;
    for (const id of TILE_IDS) {
      let n = 0;
      for (let i = 3; i < m[id].data.length; i += 4) if ((m[id].data[i] > 0) !== (c[id].data[i] > 0)) n++;
      if (n > 0) differing++;
    }
    expect(differing).toBeGreaterThanOrEqual(10); // silhouettes (stalactite undersides, moss caps) differ
  });

  it('45-degree slopes join flat grass tops seamlessly', () => {
    const { tiles } = buildTilesetBitmap('meadow');
    // surface rises exactly 1px per column
    for (let x = 1; x < 16; x++) expect(firstOpaqueRow(tiles.slope_up, x)).toBe(16 - x);
    for (let x = 0; x < 15; x++) expect(firstOpaqueRow(tiles.slope_dn, x)).toBe(1 + x);
    // high end meets the flat top's outline row (y=1)
    expect(firstOpaqueRow(tiles.slope_up, 15)).toBe(1);
    expect(firstOpaqueRow(tiles.slope_dn, 0)).toBe(1);
    // flat tops: cover outline starts at row 1 (or 0 for tuft tips) at the tile borders
    for (const id of ['top0', 'top1', 'top2', 'top3', 'top4', 'top5']) {
      expect(firstOpaqueRow(tiles[id], 0)).toBeLessThanOrEqual(1);
      expect(firstOpaqueRow(tiles[id], 15)).toBeLessThanOrEqual(1);
    }
  });

  it('flat top variants share border columns (no seams between variants)', () => {
    const { tiles } = buildTilesetBitmap('meadow');
    const ids = ['top0', 'top1', 'top2', 'top3', 'top4', 'top5'];
    for (const a of ids)
      for (const b of ids) {
        // column 15 of a next to column 0 of b: both covers have a rim at the same rows (+-1)
        expect(firstOpaqueRow(tiles[a], 15) === firstOpaqueRow(tiles[b], 0) || Math.abs(firstOpaqueRow(tiles[a], 15) - firstOpaqueRow(tiles[b], 0)) <= 1).toBe(true);
      }
  });
});

describe('autotile', () => {
  it('returns a known tile for every non-empty PLAYGROUND cell and null for empty ones', () => {
    const t = autotile(PLAYGROUND);
    expect(t.length).toBe(PLAYGROUND.height);
    let solid = 0;
    for (let r = 0; r < PLAYGROUND.height; r++) {
      expect(t[r].length).toBe(PLAYGROUND.width);
      for (let c = 0; c < PLAYGROUND.width; c++) {
        const ch = PLAYGROUND.tiles[r][c];
        if (ch === '.') expect(t[r][c]).toBeNull();
        else {
          solid++;
          expect(t[r][c], `${c},${r} '${ch}'`).not.toBeNull();
          expect(TILE_IDS, `${c},${r}`).toContain(t[r][c]!.id);
        }
      }
    }
    expect(solid).toBeGreaterThan(100);
  });

  it('is deterministic', () => {
    expect(autotile(PLAYGROUND)).toEqual(autotile(PLAYGROUND));
  });

  it('picks sensible tiles: grass tops, slopes, pad, platforms, pillars', () => {
    const t = autotile(PLAYGROUND);
    expect(t[12][10]!.id).toMatch(/^top/); // open ground
    expect(t[13][10]!.id).toMatch(/^(fill|trans|deep)/); // ground body
    expect(t[11][20]!.id).toBe('slope_up');
    expect(t[8][28]!.id).toBe('slope_dn');
    expect(t[11][50]).toEqual({ id: 'bounce0', anim: 'bounce' });
    expect(t[12][50]!.id).toMatch(/^top/); // grass shows under the pad
    expect(t[4][52]!.id).toBe('plat_l');
    expect(t[4][53]!.id).toMatch(/^plat_m/);
    expect(t[4][55]!.id).toBe('plat_r');
    expect(t[12][39]!.id).toMatch(/^top_r/);
    expect(t[9][74]!.id).toMatch(/^brick/); // 1-wide wall
    expect(t[8][74]!.id).toBe('brick_cap');
  });

  it('never puts a deep/trans tile directly under a wall or pillar base', () => {
    const t = autotile(PLAYGROUND);
    for (const c of [74, 84]) for (let r = 12; r < 14; r++) expect(t[r][c]!.id, `${c},${r}`).toMatch(/^(fill|top)/);
  });

  it('bounce has launch and landing anims', () => {
    expect(TILE_ANIMS.bounce_land.frames.every((f) => TILE_IDS.includes(f))).toBe(true);
  });

  it('handles a hand-made level with every legend character', () => {
    const lvl = parseLevel('t', ['..........', '..S.......', '.../\\.....', '..#####B##', '..########']);
    const t = autotile(lvl);
    for (let r = 0; r < lvl.height; r++) for (let c = 0; c < lvl.width; c++) if (lvl.tiles[r][c] !== '.') expect(t[r][c]).not.toBeNull();
  });
});

describe('props', () => {
  for (const [name, set] of [
    ['meadow', buildMeadowProps()],
    ['caverns', buildCavernProps()],
  ] as const) {
    it(`${name}: props are non-solid, frames exist, sizes are sane`, () => {
      expect(set.defs.length).toBeGreaterThan(15);
      for (const d of set.defs) {
        expect(d.solid).toBe(false);
        for (const f of d.frames) {
          expect(set.frames[f], `${d.id}:${f}`).toBeDefined();
          expect(set.frames[f].w).toBe(d.w);
          expect(set.frames[f].h).toBe(d.h);
        }
        expect(d.w).toBeLessThanOrEqual(80);
        expect(d.h).toBeLessThanOrEqual(112);
      }
    });
  }

  it('decorate() is deterministic and only uses known props', () => {
    for (const region of REGIONS) {
      const a = decorate(PLAYGROUND, region);
      expect(a).toEqual(decorate(PLAYGROUND, region));
      const A = loadRegionAssets(region);
      for (const p of a) expect(A.propDefs[p.prop], `${region}:${p.prop}`).toBeDefined();
      expect(a.length).toBeGreaterThan(20);
    }
  });
});

describe('backgrounds', () => {
  for (const region of REGIONS) {
    it(`${region}: layers are 224px tall, typed, and tile seamlessly`, () => {
      const A = loadRegionAssets(region);
      const layers = BACKGROUNDS[region];
      expect(layers.length).toBeGreaterThanOrEqual(region === 'caverns' ? 4 : 7);
      for (const l of layers) {
        const b = A.bgs[l.name];
        expect(b.h).toBe(224);
        expect(b.w).toBe(l.w);
        expect(l.parallax).toBeGreaterThanOrEqual(0);
        expect(l.parallax).toBeLessThanOrEqual(1);
        expect(l.file).toMatch(/^world_bg_.*\.png$/);
        if (!l.tileX) continue;
        // seam continuity: the wrap-around column pair must differ no more than typical neighbouring columns
        let interior = 0;
        for (let x = 0; x < b.w - 1; x++) interior += colDiff(b, x, x + 1);
        interior /= b.w - 1;
        const seam = colDiff(b, b.w - 1, 0);
        expect(seam, `${l.name}: seam ${seam.toFixed(2)} vs interior ${interior.toFixed(2)}`).toBeLessThanOrEqual(interior * 3 + 4);
      }
    });
  }

  it('meadow manifest matches the spec shape', () => {
    for (const l of BACKGROUNDS.meadow) {
      expect(Object.keys(l)).toEqual(expect.arrayContaining(['name', 'file', 'parallax', 'y', 'tileX']));
    }
    expect(BACKGROUNDS.meadow.map((l) => l.name)).toEqual(['sky', 'sun', 'clouds_far', 'mountains', 'clouds_near', 'hills_mid', 'hills_near', 'foreground']);
    // depth order: far layers scroll slower than near layers
    const back = BACKGROUNDS.meadow.filter((l) => l.z === 'back' && l.name !== 'sun');
    for (let i = 1; i < back.length; i++) expect(back[i].parallax).toBeGreaterThanOrEqual(back[i - 1].parallax);
  });
});

describe('buildWorld', () => {
  it('writes every PNG + atlas JSON and the preview', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sbh-world-'));
    await buildWorld(dir);
    const files: string[] = [];
    for (const r of REGIONS) {
      files.push(TILESETS[r].image, TILESETS[r].atlasFile, `world_props_${r}.png`, `world_props_${r}.json`);
      for (const l of BACKGROUNDS[r]) files.push(l.file);
    }
    files.push('world_preview.png', 'world_bg_manifest.json');
    for (const f of files) expect(existsSync(join(dir, f)), f).toBe(true);
    const png = readFileSync(join(dir, 'world_bg_meadow_sky.png'));
    expect(png.readUInt32BE(16)).toBe(256);
    expect(png.readUInt32BE(20)).toBe(224);
    const atlas = JSON.parse(readFileSync(join(dir, TILESETS.meadow.atlasFile), 'utf8'));
    expect(atlas.tiles.top0).toEqual({ x: 0, y: 0, w: 16, h: 16 });
  }, 60000);
});
