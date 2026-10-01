import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BLENDER_BACKGROUNDS, BLENDER_SPRITES } from './manifest';

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../../assets/blender');
const png = (f: string) => {
  const b = readFileSync(resolve(dir, f));
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
};

describe('blender art manifest', () => {
  it('has four time-of-day scenes with ordered layers', () => {
    expect(Object.keys(BLENDER_BACKGROUNDS).sort()).toEqual(['dawn', 'day', 'night', 'sunset']);
    for (const layers of Object.values(BLENDER_BACKGROUNDS)) {
      expect(layers.length).toBeGreaterThanOrEqual(6);
      const p = layers.map((l) => l.parallax);
      expect([...p].sort((a, b) => a - b)).toEqual(p); // far -> near
    }
  });

  it('every background file exists with the declared size', () => {
    for (const layers of Object.values(BLENDER_BACKGROUNDS))
      for (const l of layers) {
        expect(existsSync(resolve(dir, l.file)), l.file).toBe(true);
        const s = png(l.file);
        expect([s.w, s.h]).toEqual([l.width, l.height]);
        expect(l.y + l.height).toBeLessThanOrEqual(224);
      }
  });

  it('sprite atlas matches the sheet and frames stay in bounds', () => {
    expect(existsSync(resolve(dir, BLENDER_SPRITES.image))).toBe(true);
    const s = png(BLENDER_SPRITES.image);
    expect([s.w, s.h]).toEqual([BLENDER_SPRITES.width, BLENDER_SPRITES.height]);
    for (const sp of Object.values(BLENDER_SPRITES.sprites))
      for (const f of sp.frames) {
        const r = BLENDER_SPRITES.atlas[f];
        expect(r, f).toBeTruthy();
        expect(r.x + r.w).toBeLessThanOrEqual(s.w);
        expect(r.y + r.h).toBeLessThanOrEqual(s.h);
      }
    expect(BLENDER_SPRITES.sprites.windmill.frames.length).toBeGreaterThanOrEqual(8);
  });
});
