// dev/preview helper: a gallery of every option (one frame each) on the default look.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Bitmap } from '../src/core';
import { encodePNG } from '../src/png';
import { composeNamedFrame } from '../src/characters/paperdoll';
import { CHARACTER_OPTIONS, DEFAULT_LOOK, type CharacterLook } from '../src/characters/look';
import { contactSheet, type PreviewGroup } from './preview';

export function optionGroups(frame = 'hero/idle_0', only?: string[], base: CharacterLook = DEFAULT_LOOK): PreviewGroup[] {
  const groups: PreviewGroup[] = [];
  for (const cat of CHARACTER_OPTIONS.categories) {
    if (only && !only.includes(cat.key as string)) continue;
    const frames: [string, Bitmap][] = cat.names.map((n, i) => {
      const look = { ...base, [cat.key]: i } as CharacterLook;
      // make sure the thing is visible: pick contrasting colors
      return [`${i}_${n}`, composeNamedFrame(look, frame).bitmap];
    });
    groups.push({ title: cat.label, frames });
  }
  return groups;
}

export function writeGallery(outDir: string, name: string, groups: PreviewGroup[], cols = 14, scale = 4) {
  writeFileSync(join(outDir, name), encodePNG(contactSheet(groups, scale, cols)));
}
