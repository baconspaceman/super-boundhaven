// Per-look hero sheets, composed with the same paper-doll code path the game uses (composeSheet).
// The creator preview and the in-game sprite views share this cache (canvas form); Pixi textures are
// layered on top in sprites.ts.
import { DEFAULT_LOOK, composeSheet, decodeLook, type AtlasEntry, type Bitmap, type CharacterLook } from './art';

export interface LookSheet {
  code: string;
  look: CharacterLook;
  canvas: HTMLCanvasElement;
  atlas: Record<string, AtlasEntry>;
}

export function bitmapToCanvas(b: Bitmap): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, b.w);
  c.height = Math.max(1, b.h);
  const img = new ImageData(new Uint8ClampedArray(b.data), b.w, b.h);
  c.getContext('2d')!.putImageData(img, 0, 0);
  return c;
}

const MAX_SHEETS = 64;
const cache = new Map<string, LookSheet>(); // insertion order = LRU order

/** Sheet for an encodeLook code (invalid codes render DEFAULT_LOOK). Cached, bounded. */
export function getLookSheet(code: string): LookSheet {
  const hit = cache.get(code);
  if (hit) {
    cache.delete(code);
    cache.set(code, hit);
    return hit;
  }
  const look = decodeLook(code) ?? DEFAULT_LOOK;
  const { sheet, atlas } = composeSheet(look);
  const made: LookSheet = { code, look, canvas: bitmapToCanvas(sheet), atlas };
  cache.set(code, made);
  while (cache.size > MAX_SHEETS) cache.delete(cache.keys().next().value as string);
  return made;
}
