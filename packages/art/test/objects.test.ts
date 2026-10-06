import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Bitmap } from '../src/core';
import { OBJECT_ANIMS, OBJECT_FRAME_NAMES, OBJECTS, buildObjectFrames, type ObjectRegion } from '../src/world/objects';

const REGIONS: ObjectRegion[] = ['meadow', 'meadow_sunset', 'caverns'];
const ASSETS = join(dirname(fileURLToPath(import.meta.url)), '../assets');

function colors(b: Bitmap): number {
  const s = new Set<number>();
  for (let i = 0; i < b.data.length; i += 4) if (b.data[i + 3]) s.add((b.data[i] << 16) | (b.data[i + 1] << 8) | b.data[i + 2]);
  return s.size;
}
function sizeOf(name: string): [number, number] {
  if (name.startsWith('obj/flag_')) return [16, 32];
  if (name.startsWith('obj/link_dot')) return [4, 4];
  if (name.startsWith('obj/button_')) return [32, 16];
  return [16, 16];
}

describe('gameplay objects', () => {
  for (const region of REGIONS) {
    it(`${region}: frame sizes, <=15 colors, non-empty, in atlas`, () => {
      const frames = buildObjectFrames(region);
      for (const n of OBJECT_FRAME_NAMES) {
        const f = frames[n];
        expect(f, n).toBeDefined();
        expect([f.w, f.h], n).toEqual(sizeOf(n));
        expect(colors(f), n).toBeLessThanOrEqual(15);
        expect(colors(f), n).toBeGreaterThan(0);
        const a = OBJECTS[region].frames[n];
        expect(a, `atlas ${n}`).toBeDefined();
        expect([a.w, a.h]).toEqual(sizeOf(n));
      }
    });
    it(`${region}: anim frames exist`, () => {
      for (const [name, a] of Object.entries(OBJECT_ANIMS)) for (const fr of a.frames) expect(OBJECTS[region].frames[fr], `${name}:${fr}`).toBeDefined();
      expect(OBJECTS[region].anims).toBe(OBJECT_ANIMS);
    });
    it(`${region}: built json atlas matches registry`, () => {
      const p = join(ASSETS, OBJECTS[region].atlas);
      if (!existsSync(p)) return;
      expect(JSON.parse(readFileSync(p, 'utf8')).frames).toEqual(OBJECTS[region].frames);
    });
  }
  it('spike glint differs and open frames shimmer', () => {
    const f = buildObjectFrames('meadow');
    const same = (a: Bitmap, b: Bitmap) => a.data.every((v, i) => v === b.data[i]);
    expect(same(f['obj/spike'], f['obj/spike_1'])).toBe(false);
    expect(same(f['obj/door_open_0'], f['obj/door_open_1'])).toBe(false);
  });
});
