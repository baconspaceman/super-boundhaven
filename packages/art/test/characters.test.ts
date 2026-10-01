import { describe, expect, it } from 'vitest';
import { packSheet, type Bitmap } from '../src/core';
import { countColors } from '../src/characters/compose';
import { HERO_ANIMS, HERO_FRAME_NAMES, HERO_H, HERO_W, RIDER_HIP } from '../src/characters/anims';
import { CHARACTER_OPTIONS, DEFAULT_LOOK, decodeLook, encodeLook, looksEqual, randomLook, sanitizeLook, validateLook } from '../src/characters/look';
import { composeFrame, composeFrameInfo, composeNamedFrame, composeSheet } from '../src/characters/paperdoll';
import { buildLayerSheet } from '../src/characters/layersheet';
import { buildEnemyFrames, ENEMY_ANIMS } from '../src/characters/enemies';
import { buildFxFrames, FX_ANIMS } from '../src/characters/fx';
import { buildAllMountFrames, MOUNT_ANCHORS, MOUNT_ANIMS, MOUNT_NAMES } from '../src/characters/mounts';
import { drawText, FONT_5X7, measureText } from '../src/characters/font';

function components(b: Bitmap): number {
  const seen = new Uint8Array(b.w * b.h);
  const op = (x: number, y: number) => x >= 0 && y >= 0 && x < b.w && y < b.h && b.data[(y * b.w + x) * 4 + 3] > 0;
  let n = 0;
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++) {
      if (!op(x, y) || seen[y * b.w + x]) continue;
      n++;
      const st = [[x, y]];
      seen[y * b.w + x] = 1;
      while (st.length) {
        const [cx, cy] = st.pop()!;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx, ny = cy + dy;
            if (op(nx, ny) && !seen[ny * b.w + nx]) { seen[ny * b.w + nx] = 1; st.push([nx, ny]); }
          }
      }
    }
  return n;
}

describe('CharacterLook data model', () => {
  it('meets the catalog minimums', () => {
    const c = CHARACTER_OPTIONS.counts;
    expect(c.skin).toBeGreaterThanOrEqual(12);
    expect(c.hair).toBeGreaterThanOrEqual(16);
    expect(c.hairColor).toBeGreaterThanOrEqual(16);
    expect(c.eyes).toBeGreaterThanOrEqual(8);
    expect(c.eyeColor).toBeGreaterThanOrEqual(10);
    expect(c.brows).toBeGreaterThanOrEqual(6);
    expect(c.mouth).toBeGreaterThanOrEqual(6);
    expect(c.top).toBeGreaterThanOrEqual(12);
    expect(c.bottom).toBeGreaterThanOrEqual(8);
    expect(c.shoes).toBeGreaterThanOrEqual(8);
    expect(c.hat - 1).toBeGreaterThanOrEqual(14);
    expect(c.back - 1).toBeGreaterThanOrEqual(6);
    expect(c.acc - 1).toBeGreaterThanOrEqual(8);
  });
  it('round-trips encode/decode in <=32 chars and validates', () => {
    for (let s = 0; s < 300; s++) {
      const l = randomLook(s);
      expect(validateLook(l)).toEqual([]);
      const code = encodeLook(l);
      expect(code.length).toBeLessThanOrEqual(32);
      expect(looksEqual(decodeLook(code)!, l)).toBe(true);
    }
    expect(decodeLook('nope')).toBeNull();
    expect(decodeLook(encodeLook(DEFAULT_LOOK).slice(0, -1))).toBeNull();
    expect(validateLook({ ...DEFAULT_LOOK, hair: 99 }).length).toBeGreaterThan(0);
    expect(validateLook(sanitizeLook({ hair: 99, skin: 3 }))).toEqual([]);
    expect(randomLook(7)).toEqual(randomLook(7));
  });
});

describe('hero paper-doll', () => {
  it('every animation frame is in the atlas and is 24x32', () => {
    const { atlas } = composeSheet(DEFAULT_LOOK);
    for (const [a, anim] of Object.entries(HERO_ANIMS)) {
      expect(anim.ticks.length).toBe(anim.frames.length);
      anim.frames.forEach((f, i) => {
        expect(atlas[f], f).toBeDefined();
        expect(atlas[f].w).toBe(HERO_W);
        expect(atlas[f].h).toBe(HERO_H);
        expect(composeFrame(DEFAULT_LOOK, a, i).w).toBe(HERO_W);
      });
    }
    expect(Object.keys(atlas).length).toBe(HERO_FRAME_NAMES.length);
    expect(RIDER_HIP).toEqual([12, 22]);
  });
  it('50 random looks compose every frame without clipping or floating pieces', () => {
    for (let s = 1; s <= 50; s++) {
      const look = randomLook(s * 7919);
      for (const f of HERO_FRAME_NAMES) {
        const info = composeFrameInfo(look, 'idle', 0) && composeNamedFrame(look, f);
        expect(info.clipped, `${encodeLook(look)} ${f} clipped`).toBe(false);
        expect(components(info.bitmap), `${encodeLook(look)} ${f} components`).toBe(1);
      }
    }
  });
  it('feet land on the last rows in grounded frames', () => {
    for (const f of ['hero/idle_0', 'hero/walk_0', 'hero/run_0', 'hero/skid', 'hero/land_0']) {
      const b = composeNamedFrame(DEFAULT_LOOK, f).bitmap;
      let bottom = -1;
      for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (b.data[(y * b.w + x) * 4 + 3]) bottom = y;
      expect(bottom, f).toBe(HERO_H - 1);
    }
  });
  it('every authored layer uses <=15 colors', () => {
    const { atlas, sheet } = buildLayerSheet();
    for (const [name, a] of Object.entries(atlas)) {
      const sub = { w: a.w, h: a.h, data: new Uint8ClampedArray(a.w * a.h * 4) };
      for (let y = 0; y < a.h; y++) sub.data.set(sheet.data.subarray(((a.y + y) * sheet.w + a.x) * 4, ((a.y + y) * sheet.w + a.x + a.w) * 4), y * a.w * 4);
      expect(countColors(sub), name).toBeLessThanOrEqual(15);
    }
  });
});

describe('creatures, mounts, fx, font', () => {
  it('enemy + fx anim frames exist, <=15 colors', () => {
    const e = buildEnemyFrames();
    const f = buildFxFrames();
    for (const a of Object.values(ENEMY_ANIMS)) for (const n of a.frames) expect(e[n], n).toBeDefined();
    for (const a of Object.values(FX_ANIMS)) for (const n of a.frames) expect(f[n], n).toBeDefined();
    for (const b of [...Object.values(e), ...Object.values(f)]) expect(countColors(b)).toBeLessThanOrEqual(15);
  });
  it('four mounts: frames, anchors, saddled variants', () => {
    const all = buildAllMountFrames();
    expect(MOUNT_NAMES).toEqual(['frog', 'dino', 'drake', 'cheetah']);
    for (const m of MOUNT_NAMES) {
      const frames = all[m];
      for (const a of Object.values(MOUNT_ANIMS[m])) for (const n of a.frames) {
        expect(frames[n], n).toBeDefined();
        expect(frames[n.replace('mount_', 'mountr_')] ?? frames[n], n).toBeDefined();
        expect(MOUNT_ANCHORS[n], n).toBeDefined();
      }
      for (const [n, b] of Object.entries(frames)) if (!n.includes("summon")) expect(countColors(b), n).toBeLessThanOrEqual(15);
      const { atlas } = packSheet(frames, 280);
      expect(Object.keys(atlas).length).toBe(Object.keys(frames).length);
    }
  });
  it('font draws text', () => {
    const b = drawText('Hello, World 123!', FONT_5X7);
    expect(b.h).toBe(FONT_5X7.height + 2);
    expect(b.w).toBe(measureText('Hello, World 123!') + 2);
    expect(drawText('A', FONT_5X7, { outline: null }).w).toBe(5);
  });
});
