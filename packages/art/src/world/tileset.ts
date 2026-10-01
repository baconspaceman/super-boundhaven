// Tileset assembly: generates every tile id for a region, packs a fixed-grid atlas, exposes the TILESETS registry.
import { createBitmap, type AtlasEntry, type Bitmap } from '../core';
import { blitBitmap, type Canvas } from './paint';
import { STYLES, type RegionStyle } from './styles';
import { T, genBounce, genBrick, genGround, genPlat, genSlope, type GroundMask } from './tiles';

export type RegionId = 'meadow' | 'caverns' | 'meadow_sunset';

/** Ordered list of every tile id in every tileset (atlas layout is the index order, 16 tiles per row). */
export const TILE_IDS: string[] = [
  ...[0, 1, 2, 3, 4, 5].map((v) => `top${v}`),
  'top_l0',
  'top_l1',
  'top_r0',
  'top_r1',
  'wall_l0',
  'wall_l1',
  'wall_r0',
  'wall_r1',
  'wall_l_foot',
  'wall_r_foot',
  ...[0, 1, 2, 3, 4, 5, 6].map((v) => `fill${v}`),
  'trans0',
  'trans1',
  'deep0',
  'deep1',
  'bot0',
  'bot1',
  'bot_l',
  'bot_r',
  'bot_lr',
  'under_up',
  'under_dn',
  'slope_up',
  'slope_dn',
  'plat_l',
  'plat_m0',
  'plat_m1',
  'plat_r',
  'plat_s',
  'brick0',
  'brick1',
  'brick_cap',
  'bounce0',
  'bounce1',
  'bounce2',
];

export const ATLAS_COLS = 16;

export function tileAtlas(): Record<string, AtlasEntry> {
  const a: Record<string, AtlasEntry> = {};
  TILE_IDS.forEach((id, i) => {
    a[id] = { x: (i % ATLAS_COLS) * T, y: Math.floor(i / ATLAS_COLS) * T, w: T, h: T };
  });
  return a;
}

export interface TileAnim {
  frames: string[];
  fps: number;
  /** 'loop': free-running. 'trigger': rests on frames[0], plays once when the game fires it. */
  mode: 'loop' | 'trigger';
  /** for trigger anims: ticks (60Hz) each frame is held while playing */
  holdTicks?: number[];
  note?: string;
}

export const TILE_ANIMS: Record<string, TileAnim> = {
  bounce: {
    frames: ['bounce0', 'bounce1', 'bounce2', 'bounce0'],
    fps: 0,
    mode: 'trigger',
    holdTicks: [0, 3, 5, 3],
    note: 'rest -> compress (3t) -> release/stretch (5t) -> settle (3t) -> rest',
  },
  bounce_land: {
    frames: ['bounce0', 'bounce1'],
    fps: 0,
    mode: 'trigger',
    holdTicks: [0, 3],
    note: 'play on landing: rest -> compress (3t) and HOLD frames[1] until the launch anim `bounce` fires',
  },
};

export interface TilesetInfo {
  id: RegionId;
  name: string;
  /** PNG file name inside packages/art/assets */
  image: string;
  /** atlas JSON file name */
  atlasFile: string;
  tileSize: number;
  width: number;
  height: number;
  /** unique colors used by the sheet, '#rrggbb' */
  colors: number;
  tiles: Record<string, AtlasEntry>;
  anims: Record<string, TileAnim>;
}

const sheetW = ATLAS_COLS * T;
const sheetH = Math.ceil(TILE_IDS.length / ATLAS_COLS) * T;

function info(id: RegionId, name: string): TilesetInfo {
  return {
    id,
    name,
    image: `world_tiles_${id}.png`,
    atlasFile: `world_tiles_${id}.json`,
    tileSize: T,
    width: sheetW,
    height: sheetH,
    colors: 16,
    tiles: tileAtlas(),
    anims: TILE_ANIMS,
  };
}

export const TILESETS: Record<RegionId, TilesetInfo> = {
  meadow: info('meadow', 'Sunny Haven Meadows'),
  caverns: info('caverns', 'Crystal Caverns'),
  meadow_sunset: info('meadow_sunset', 'Sunny Haven Meadows (Sunset)'),
};

// ---------- generation ----------
const base = (v: number, tv: number, extra: Partial<GroundMask> = {}): GroundMask => ({
  n: false,
  s: false,
  e: false,
  w: false,
  v,
  tv,
  ...extra,
});

export function generateTileCanvases(st: RegionStyle): Record<string, Canvas> {
  const out: Record<string, Canvas> = {};
  for (let v = 0; v < 6; v++) out[`top${v}`] = genGround(st, base(v, v % 4, { n: true }));
  for (let v = 0; v < 2; v++) {
    out[`top_l${v}`] = genGround(st, base(v, (v + 1) % 4, { n: true, w: true }));
    out[`top_r${v}`] = genGround(st, base(v, (v + 2) % 4, { n: true, e: true }));
    out[`wall_l${v}`] = genGround(st, base(v, v, { w: true }));
    out[`wall_r${v}`] = genGround(st, base(v, v + 2, { e: true }));
    out[`bot${v}`] = genGround(st, base(v, v + 1, { s: true }));
  }
  out.wall_l_foot = genGround(st, base(0, 0, { w: true, footW: true }));
  out.wall_r_foot = genGround(st, base(1, 1, { e: true, footE: true }));
  for (let v = 0; v < 7; v++) out[`fill${v}`] = genGround(st, base(v, v));
  for (let v = 0; v < 2; v++) {
    out[`trans${v}`] = genGround(st, base(v, v, { depth: 'trans' }));
    out[`deep${v}`] = genGround(st, base(v, v, { depth: 'deep' }));
  }
  out.bot_l = genGround(st, base(0, 2, { s: true, w: true }));
  out.bot_r = genGround(st, base(1, 3, { s: true, e: true }));
  out.bot_lr = genGround(st, base(0, 1, { s: true, w: true, e: true }));
  out.under_up = genGround(st, base(0, 1, { underSlope: 'up' }));
  out.under_dn = genGround(st, base(0, 1, { underSlope: 'dn' }));
  const up = genSlope(st, 'up');
  const dn = genSlope(st, 'dn');
  out.slope_up = up.slope;
  out.slope_dn = dn.slope;
  out.plat_l = genPlat(st, 'l');
  out.plat_m0 = genPlat(st, 'm0');
  out.plat_m1 = genPlat(st, 'm1');
  out.plat_r = genPlat(st, 'r');
  out.plat_s = genPlat(st, 's');
  out.brick0 = genBrick(st, 'body0');
  out.brick1 = genBrick(st, 'body1');
  out.brick_cap = genBrick(st, 'cap');
  out.bounce0 = genBounce(st, 0);
  out.bounce1 = genBounce(st, 1);
  out.bounce2 = genBounce(st, 2);
  return out;
}

export function buildTilesetBitmap(region: RegionId): { sheet: Bitmap; tiles: Record<string, Bitmap> } {
  const st = STYLES[region];
  const canv = generateTileCanvases(st);
  const atlas = tileAtlas();
  const sheet = createBitmap(sheetW, sheetH);
  const tiles: Record<string, Bitmap> = {};
  for (const id of TILE_IDS) {
    const c = canv[id];
    if (!c) throw new Error(`missing tile ${id}`);
    const bm = c.toBitmap();
    tiles[id] = bm;
    blitBitmap(sheet, bm, atlas[id].x, atlas[id].y);
  }
  return { sheet, tiles };
}
