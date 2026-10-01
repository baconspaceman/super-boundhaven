// Builds every world asset (tilesets, props, parallax backgrounds, previews) into `outDir`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PLAYGROUND } from '@sbh/sim';
import { createBitmap, packSheet, type Bitmap } from '../src/core';
import { encodePNG } from '../src/png';
import { BACKGROUNDS } from '../src/world/backgrounds';
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
}
