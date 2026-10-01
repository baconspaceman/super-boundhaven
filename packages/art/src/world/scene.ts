// Reference compositor: draws a level window (parallax bg + tiles + props) into a bitmap.
// Used by the preview build and tests; the real client can mirror the same layer order.
import { TILE, type Level } from '@sbh/sim';
import { createBitmap, type Bitmap } from '../core';
import { autotile } from './autotile';
import { BACKGROUNDS, buildBackgroundBitmap } from './backgrounds';
import { decorate } from './decor';
import { blitBitmap } from './paint';
import { buildCavernProps, buildMeadowProps, buildSunsetProps, canvasesToBitmaps, type PropDef } from './props';
import { buildTilesetBitmap, TILE_ANIMS, type RegionId } from './tileset';

export interface RegionAssets {
  tiles: Record<string, Bitmap>;
  props: Record<string, Bitmap>;
  propDefs: Record<string, PropDef>;
  bgs: Record<string, Bitmap>;
}

const cache = new Map<RegionId, RegionAssets>();

export function loadRegionAssets(region: RegionId): RegionAssets {
  const hit = cache.get(region);
  if (hit) return hit;
  const { tiles } = buildTilesetBitmap(region);
  const set = region === 'meadow' ? buildMeadowProps() : region === 'caverns' ? buildCavernProps() : buildSunsetProps();
  const propDefs: Record<string, PropDef> = {};
  for (const d of set.defs) propDefs[d.id] = d;
  const bgs: Record<string, Bitmap> = {};
  for (const l of BACKGROUNDS[region]) bgs[l.name] = buildBackgroundBitmap(region, l);
  const a = { tiles, props: canvasesToBitmaps(set), propDefs, bgs };
  cache.set(region, a);
  return a;
}

function drawLayer(out: Bitmap, layer: Bitmap, def: (typeof BACKGROUNDS)['meadow'][number], camX: number, tick: number): void {
  const off = Math.floor(camX * def.parallax + (def.drift * tick) / 60);
  if (!def.tileX) {
    blitBitmap(out, layer, -off, def.y);
    return;
  }
  const start = -(((off % layer.w) + layer.w) % layer.w);
  for (let x = start; x < out.w; x += layer.w) blitBitmap(out, layer, x, def.y);
}

export interface SceneOpts {
  region: RegionId;
  level: Level;
  camX: number;
  width?: number;
  height?: number;
  tick?: number;
  /** include props (default true) */
  props?: boolean;
}

export function renderScene(o: SceneOpts): Bitmap {
  const w = o.width ?? 256;
  const h = o.height ?? 224;
  const tick = o.tick ?? 0;
  const A = loadRegionAssets(o.region);
  const out = createBitmap(w, h);
  const camX = Math.round(o.camX);
  const layers = BACKGROUNDS[o.region];
  for (const l of layers.filter((l) => l.z === 'back')) drawLayer(out, A.bgs[l.name], l, camX, tick);
  const placements = o.props === false ? [] : decorate(o.level, o.region);
  const drawProp = (p: (typeof placements)[number]) => {
    const d = A.propDefs[p.prop];
    if (!d) return;
    const f = d.fps > 0 ? (Math.floor((tick * d.fps) / 60) + p.phase) % d.frames.length : p.phase % d.frames.length;
    const bm = A.props[d.frames[d.frames.length === 1 ? 0 : f]];
    const px = Math.round(p.x - d.anchor.x - camX);
    const py = Math.round(p.y - d.anchor.y);
    if (px + bm.w < 0 || px > w) return;
    blitBitmap(out, bm, px, py);
  };
  for (const p of placements) if (p.layer === 'back' && !(A.propDefs[p.prop]?.placement === 'water')) drawProp(p);
  const tiles = autotile(o.level);
  const c0 = Math.max(0, Math.floor(camX / TILE));
  const c1 = Math.min(o.level.width - 1, Math.floor((camX + w) / TILE));
  for (let r = 0; r < o.level.height; r++)
    for (let c = c0; c <= c1; c++) {
      const t = tiles[r][c];
      if (!t) continue;
      const id = t.anim ? TILE_ANIMS[t.anim].frames[0] : t.id;
      blitBitmap(out, A.tiles[id], c * TILE - camX, r * TILE);
    }
  for (const p of placements) if (p.layer === 'front' || A.propDefs[p.prop]?.placement === 'water') drawProp(p);
  for (const l of layers.filter((l) => l.z === 'front')) drawLayer(out, A.bgs[l.name], l, camX, tick);
  return out;
}

/** Nearest-neighbour integer upscale. */
export function scaleBitmap(b: Bitmap, k: number): Bitmap {
  const o = createBitmap(b.w * k, b.h * k);
  for (let y = 0; y < o.h; y++)
    for (let x = 0; x < o.w; x++) {
      const s = ((Math.floor(y / k) * b.w) + Math.floor(x / k)) * 4;
      o.data.set(b.data.subarray(s, s + 4), (y * o.w + x) * 4);
    }
  return o;
}
