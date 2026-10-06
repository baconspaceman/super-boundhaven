// Pure helpers shared by the creator: swatch colors and look edits. No DOM.
import { CHARACTER_OPTIONS, DEV_ONLY, EYE_COLORS, HAIR_COLORS, ITEM_COLORS, SKIN_TONES, hslToHex, ramp3, type CharacterLook, type NamedColor } from './art';

export type ColorTable = 'skin' | 'hair' | 'eye' | 'item';

const TABLES: Record<ColorTable, NamedColor[]> = { skin: SKIN_TONES, hair: HAIR_COLORS, eye: EYE_COLORS, item: ITEM_COLORS };

export function colorTable(t: ColorTable): { name: string; hex: string }[] {
  return TABLES[t].map((c) => ({ name: c.name, hex: t === 'skin' ? hslToHex(...c.seed) : ramp3(...c.seed)[1] }));
}

export const countOf = (key: keyof CharacterLook): number => CHARACTER_OPTIONS.counts[key];

/** Options a player can step through: developer-only pieces (the tail of hat/back/acc) only count when `dev`. */
export function optionCount(key: keyof CharacterLook, dev: boolean): number {
  const hidden = dev || (key !== 'hat' && key !== 'back' && key !== 'acc') ? 0 : (DEV_ONLY[key]?.length ?? 0);
  return CHARACTER_OPTIONS.counts[key] - hidden;
}

/** Step a numeric look field with wraparound. */
export function stepField(look: CharacterLook, key: Exclude<keyof CharacterLook, 'v'>, dir: number, dev = true): CharacterLook {
  const n = optionCount(key, dev);
  return { ...look, [key]: (((look[key] + dir) % n) + n) % n };
}
