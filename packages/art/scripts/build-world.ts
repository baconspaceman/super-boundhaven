// Builds every world asset (tilesets, props, parallax backgrounds, previews) into `outDir`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { COOP_ROOM, PLAYGROUND, parseLevel, type Level } from '@sbh/sim';
import { createBitmap, packSheet, type Bitmap } from '../src/core';
import { encodePNG } from '../src/png';
import { BACKGROUNDS } from '../src/world/backgrounds';
import { buildObjectFrames, OBJECTS, OBJECT_ANIMS, buildObjectSheet, type ObjectRegion } from '../src/world/objects';
import { blitBitmap } from '../src/world/paint';
import { buildCavernProps, buildMeadowProps, buildSunsetProps, canvasesToBitmaps } from '../src/world/props';
import { loadRegionAssets, renderScene, scaleBitmap } from '../src/world/scene';
import { buildTilesetBitmap, TILESETS, type RegionId } from '../src/world/tileset';

const REGIONS: RegionId[] = ['meadow', 'meadow_sunset', 'caverns'];

function fill(b: Bitmap, r: number, g: number, bl: number): void {
  for (let i = 0; i < b.data.length; i += 4) {
    b.data[i] = r;
    b.data[i + 1] = g;
    b.data[i + 2] = bl;
    b.data[i + 3] = 255;
  }
}

function put(dir: string, name: string, bm: Bitmap): void {
  writeFileSync(join(dir, name), encodePNG(bm));
}

export async function buildWorld(outDir: string): Promise<void> {
  mkdirSync(outDir, { recursive: true });
  const previewParts: Bitmap[] = [];
  const bgStripe = (region: RegionId): [number, number, number] => (region === 'meadow' ? [118, 176, 232] : region === 'meadow_sunset' ? [150, 90, 140] : [44, 38, 82]);

  for (const region of REGIONS) {
    // ---- tileset ----
    const { sheet } = buildTilesetBitmap(region);
    const info = TILESETS[region];
    put(outDir, info.image, sheet);
    writeFileSync(join(outDir, info.atlasFile), JSON.stringify({ ...info }, null, 2));
    const tp = createBitmap(sheet.w * 4, sheet.h * 4);
    fill(tp, ...bgStripe(region));
    blitBitmap(tp, scaleBitmap(sheet, 4), 0, 0);
    previewParts.push(tp);

    // ---- props ----
    const set = region === 'meadow' ? buildMeadowProps() : region === 'caverns' ? buildCavernProps() : buildSunsetProps();
    const packed = packSheet(canvasesToBitmaps(set), 384, 1);
    put(outDir, `world_props_${region}.png`, packed.sheet);
    writeFileSync(
      join(outDir, `world_props_${region}.json`),
      JSON.stringify({ image: `world_props_${region}.png`, width: packed.sheet.w, height: packed.sheet.h, frames: packed.atlas, props: set.defs }, null, 2),
    );
    const pp = createBitmap(packed.sheet.w * 3, packed.sheet.h * 3);
    fill(pp, ...bgStripe(region));
    blitBitmap(pp, scaleBitmap(packed.sheet, 3), 0, 0);
    previewParts.push(pp);

    // ---- backgrounds ----
    const A = loadRegionAssets(region);
    for (const l of BACKGROUNDS[region]) put(outDir, l.file, A.bgs[l.name]);
  }
  writeFileSync(join(outDir, 'world_bg_manifest.json'), JSON.stringify(BACKGROUNDS, null, 2));

  // ---- scene previews (real PLAYGROUND, 256x224 @3x) ----
  const scenes: Bitmap[] = [];
  const cams = [288, 560, 1100];
  for (const region of REGIONS)
    for (const cam of cams) scenes.push(scaleBitmap(renderScene({ region, level: PLAYGROUND, camX: cam, tick: 10 }), 3));
  // individual scene files for close review
  scenes.forEach((s, i) => put(outDir, `world_preview_scene_${REGIONS[Math.floor(i / cams.length)]}_${i % cams.length}.png`, s));

  const colW = 768;
  const gap = 8;
  const totalW = colW * 2 + gap;
  const rowsH: number[] = [];
  const sceneRows = Math.ceil(scenes.length / 2);
  let totalH = 0;
  for (const p of previewParts) totalH += p.h + gap;
  for (let i = 0; i < sceneRows; i++) {
    rowsH.push(672);
    totalH += 672 + gap;
  }
  const big = createBitmap(Math.max(totalW, 1024), totalH);
  fill(big, 24, 22, 34);
  let y = 0;
  for (const p of previewParts) {
    blitBitmap(big, p, 0, y);
    y += p.h + gap;
  }
  scenes.forEach((s, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    blitBitmap(big, s, col * (colW + gap), y + row * (672 + gap));
  });
  put(outDir, 'world_preview.png', big);
  buildObjects(outDir);
}

// ---------------------------------------------------------------- gameplay objects (atlases + preview)
const OBJ_REGIONS: ObjectRegion[] = ['meadow', 'meadow_sunset', 'caverns'];

/** Objects drawn over the autotiled terrain exactly like the client should (anchors: tile top-left; flag = bottom-center). */
function drawObjects(out: Bitmap, region: ObjectRegion, level: Level, camX: number, tick: number, state: { openDoors: number[]; pressed: number[]; activeFlags: number[] }): void {
  const F = buildObjectFrames(region);
  const at = (c: number, r: number) => level.tiles[r]?.[c] ?? '.';
  const put1 = (name: string, x: number, y: number) => blitBitmap(out, F[name], Math.round(x - camX), Math.round(y));
  // one-way platforms + spikes come from the tile grid
  for (let r = 0; r < level.height; r++)
    for (let c = 0; c < level.width; c++) {
      const ch = at(c, r);
      if (ch === '-') {
        const l = at(c - 1, r) === '-';
        const rr = at(c + 1, r) === '-';
        put1(l && rr ? 'obj/oneway_m' : !l && rr ? 'obj/oneway_l' : l && !rr ? 'obj/oneway_r' : 'obj/oneway_m', c * 16, r * 16);
      } else if (ch === '^') put1(Math.floor(tick / 20) % 4 === 3 ? 'obj/spike_1' : 'obj/spike', c * 16, r * 16);
    }
  for (const d of level.doors) {
    const open = state.openDoors.includes(d.id);
    d.tiles.forEach(([c, r], i) => {
      if (open) {
        if (i === 0) put1(`obj/door_open_${Math.floor((tick * 6) / 60) % 4}`, c * 16, r * 16);
      } else put1(i === 0 ? 'obj/door_cap' : i === d.tiles.length - 1 ? 'obj/door_base' : 'obj/door_mid', c * 16, r * 16);
    });
  }
  for (const p of level.plates) {
    const down = state.pressed.includes(p.id);
    put1(down ? 'obj/plate_down' : 'obj/plate_up', p.col * 16, p.row * 16);
    if (down) put1(`obj/plate_glow_${Math.floor((tick * 9) / 60) % 4}`, p.col * 16, p.row * 16);
  }
  for (const lv of level.levers) {
    if (lv.reset) put1('obj/lever_reset', lv.col * 16, lv.row * 16);
    else if (lv.ticks > 0) {
      put1('obj/lever_on', lv.col * 16, lv.row * 16);
      put1('obj/lever_timer_2', lv.col * 16, lv.row * 16);
    } else put1(lv.id % 2 === 0 ? 'obj/lever_off' : 'obj/lever_on', lv.col * 16, lv.row * 16);
  }
  level.checkpoints.forEach((cp, i) => {
    const a = state.activeFlags.includes(i);
    put1(`obj/flag_${a ? 'active' : 'idle'}_${Math.floor((tick * (a ? 8 : 6)) / 60) % 4}`, cp.x - 8, cp.y - 32);
  });
  for (const sh of level.shards) put1(`obj/shard_pickup_${Math.floor((tick * 10) / 60) % 6}`, sh.x - 8, sh.y - 8);
}

function objectsScene(region: ObjectRegion, camX: number, tick: number, state: Parameters<typeof drawObjects>[5]): Bitmap {
  // the autotiler treats every non-'.' glyph as ground, so strip the gameplay glyphs before tiling
  const stripped = parseLevel('coopRoom_terrain', COOP_ROOM.tiles.map((row) => row.replace(/[-^D]/g, '.')));
  const out = renderScene({ region, level: stripped, camX, width: 256, height: 256, tick });
  drawObjects(out, region, COOP_ROOM, camX, tick, state);
  return out;
}

function contactSheet(region: ObjectRegion): Bitmap {
  const { frames } = buildObjectSheet(region);
  const names = Object.keys(frames);
  const perRow = 14;
  const k = 4;
  const cellW = 16 * k + 8;
  const rows = Math.ceil(names.length / perRow);
  const rowH: number[] = [];
  for (let r = 0; r < rows; r++) rowH.push(Math.max(...names.slice(r * perRow, (r + 1) * perRow).map((n) => frames[n].h)) * k + 8);
  const sheet = createBitmap(perRow * cellW, rowH.reduce((a, b) => a + b, 0));
  fill(sheet, ...((region === 'meadow' ? [118, 176, 232] : region === 'meadow_sunset' ? [150, 90, 140] : [44, 38, 82]) as [number, number, number]));
  let y = 0;
  for (let r = 0; r < rows; r++) {
    names.slice(r * perRow, (r + 1) * perRow).forEach((n, i) => blitBitmap(sheet, scaleBitmap(frames[n], k), i * cellW + 4, y + 4));
    y += rowH[r];
  }
  return sheet;
}

export function buildObjects(outDir: string): void {
  const scenes: Bitmap[] = [];
  const cams = [128, 560, 1664, 1900, 2260, 2640]; // stairs+plate A / gate0+timed lever / corridor door+latch / ledge+door2 / final plates / goal
  const states = [
    { openDoors: [], pressed: [0], activeFlags: [] },
    { openDoors: [0], pressed: [], activeFlags: [0] },
    { openDoors: [], pressed: [], activeFlags: [0, 1] },
    { openDoors: [1], pressed: [], activeFlags: [1] },
    { openDoors: [], pressed: [2, 3], activeFlags: [2] },
    { openDoors: [3], pressed: [], activeFlags: [2] },
  ];
  const sheets: Bitmap[] = [];
  for (const region of OBJ_REGIONS) {
    const set = OBJECTS[region];
    const { sheet, frames } = buildObjectSheet(region);
    put(outDir, set.file, sheet);
    writeFileSync(join(outDir, set.atlas), JSON.stringify({ image: set.file, width: sheet.w, height: sheet.h, frames: set.frames, anims: OBJECT_ANIMS }, null, 2));
    void frames;
    sheets.push(contactSheet(region));
    cams.forEach((cam, i) => {
      const sc = scaleBitmap(objectsScene(region, cam, 14, states[i]), 3);
      put(outDir, `world_objects_scene_${region}_${i}.png`, sc);
      scenes.push(scaleBitmap(objectsScene(region, cam, 14, states[i]), 2));
    });
  }
  const gap = 8;
  const W = Math.max(...sheets.map((s) => s.w), 3 * 512 + 2 * gap);
  let H = 0;
  for (const s of sheets) H += s.h + gap;
  H += 6 * (512 + gap);
  const big = createBitmap(W, H);
  fill(big, 24, 22, 34);
  let y = 0;
  for (const s of sheets) {
    blitBitmap(big, s, 0, y);
    y += s.h + gap;
  }
  scenes.forEach((s, i) => {
    const reg = Math.floor(i / 6);
    const j = i % 6;
    blitBitmap(big, s, (j % 3) * (512 + gap), y + (reg * 2 + Math.floor(j / 3)) * (512 + gap));
  });
  put(outDir, 'world_objects_preview.png', big);
}
