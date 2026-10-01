// Exports every authored paper-doll layer (shaded with the default look's colors) as a packed sheet +
// atlas so a human artist can open/edit them in Pixelorama. Atlas entries carry the layer's local-space
// offset (head cell / torso space) so edits can be round-tripped into the source arrays.
import { fromRows, packSheet, type AtlasEntry, type Bitmap } from '../core';
import { shadeMask, type MaskLayer, type SlotMap } from './layers';
import { buildPalette } from './palettes';
import { DEFAULT_LOOK } from './look';
import { ACC_HEAD, BROWS, EYES, HAIR, HATS, MOUTHS, SKULL } from './parts_head';
import { ACC_TORSO, BACKS, BOTTOMS, SHOES, TOPS } from './parts_body';

const pal = buildPalette({
  skin: DEFAULT_LOOK.skin, hair: DEFAULT_LOOK.hairColor, hair2: DEFAULT_LOOK.hairColor, eye: DEFAULT_LOOK.eyeColor,
  top1: 10, top2: 19, bot1: 22, bot2: 21, shoe1: 0, shoe2: 20, hat1: 3, hat2: 16, back1: 12, back2: 3, acc1: 3, acc2: 16,
});

const M = (h: string, s: string, t = ''): SlotMap => ({ '0': 'skin', '1': h, '2': s, ...(t ? {} : {}) }) as SlotMap;
const HAIRM = M('hair', 'hair2');
const HATM = M('hat1', 'hat2');
const TOPM = M('top1', 'top2');
const BOTM = M('bot1', 'bot2');
const SHOEM = M('shoe1', 'shoe2');
const BACKM = M('back1', 'back2');
const ACCM = M('acc1', 'acc2');

export interface LayerMeta extends AtlasEntry {
  space: 'head' | 'torso' | 'skull' | 'glyph' | 'foot';
  /** local-space position of the layer's top-left */
  lx: number;
  ly: number;
}

export function buildLayerSheet(): { sheet: Bitmap; atlas: Record<string, LayerMeta> } {
  const frames: Record<string, Bitmap> = {};
  const meta: Record<string, { space: LayerMeta['space']; lx: number; ly: number }> = {};
  const add = (name: string, rows: string[], space: LayerMeta['space'], lx: number, ly: number, m?: SlotMap) => {
    const shaded = m ? shadeMask(rows, m) : rows;
    const w = Math.max(...shaded.map((r) => r.length));
    frames[name] = fromRows(shaded.map((r) => r.padEnd(w, '.')), pal);
    meta[name] = { space, lx, ly };
  };
  const lay = (name: string, l: MaskLayer | undefined, space: LayerMeta['space'], m: SlotMap) => l && add(name, l.rows, space, l.x, l.y, m);
  add('layer/skull', SKULL, 'skull', 2, 4);
  EYES.forEach((e, i) => add(`layer/eyes/${i}_${e.name}`, e.glyph, 'glyph', 0, e.dy));
  BROWS.forEach((b, i) => add(`layer/brows/${i}_${b.name}`, b.near, 'glyph', 0, 3));
  MOUTHS.forEach((mo, i) => add(`layer/mouth/${i}_${mo.name}`, mo.glyph, 'glyph', mo.x, mo.y));
  HAIR.forEach((h, i) => {
    lay(`layer/hair/${i}_${h.name}/front`, h.front, 'head', HAIRM);
    lay(`layer/hair/${i}_${h.name}/back`, h.back, 'head', HAIRM);
  });
  HATS.forEach((h, i) => {
    lay(`layer/hat/${i}_${h.name}/front`, h.layer, 'head', HATM);
    lay(`layer/hat/${i}_${h.name}/back`, h.back, 'head', HATM);
  });
  Object.entries(ACC_HEAD).forEach(([n, l]) => lay(`layer/acc/${n}`, l, 'head', ACCM));
  Object.entries(ACC_TORSO).forEach(([n, a]) => {
    a.layers.forEach((l, i) => lay(`layer/acc/${n}/${i}`, l, 'torso', ACCM));
    lay(`layer/acc/${n}/tail`, a.tail, 'torso', ACCM);
  });
  TOPS.forEach((t, i) => {
    add(`layer/top/${i}_${t.name}`, t.rows, 'torso', 0, 0, TOPM);
    lay(`layer/top/${i}_${t.name}/over`, t.over, 'torso', TOPM);
  });
  BOTTOMS.forEach((b, i) => {
    add(`layer/bottom/${i}_${b.name}/hip`, b.hip, 'torso', 0, 7, BOTM);
    lay(`layer/bottom/${i}_${b.name}/over`, b.over, 'torso', BOTM);
  });
  SHOES.forEach((s, i) => add(`layer/shoes/${i}_${s.name}`, s.rows, 'foot', 0, 0, SHOEM));
  BACKS.forEach((b, i) => {
    lay(`layer/back/${i}_${b.name}`, b.layer, 'torso', BACKM);
    b.wings?.forEach((w, k) => lay(`layer/back/${i}_${b.name}/wing${k}`, w, 'torso', BACKM));
  });
  const { sheet, atlas } = packSheet(frames, 400, 2);
  const out: Record<string, LayerMeta> = {};
  for (const [k, a] of Object.entries(atlas)) out[k] = { ...a, ...meta[k] };
  return { sheet, atlas: out };
}
