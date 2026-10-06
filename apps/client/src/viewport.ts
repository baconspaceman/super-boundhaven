// The game's internal view: how much world is on screen, in native pixels. Everything is drawn at this size and then
// scaled up to the window, so a bigger view means a bigger-looking world and smaller-looking characters (the hero
// sprite is always 24x32). Default 480x270 = 16:9, 30 x 16.9 tiles; try ?view=576x324 or ?view=384x216.
//
// The backdrops were authored for a 224 px tall frame; BG_SHIFT is how far they move down so the landscape stays on
// the ground line and the extra height becomes sky.
export const DEFAULT_VIEW = { w: 480, h: 270 } as const;
export const BG_FRAME_H = 224;

/** "480x270" -> {w:480,h:270}, clamped to sane limits; anything else -> the default. */
export function parseView(raw: string | null | undefined): { w: number; h: number } {
  const m = /^(\d{2,4})x(\d{2,4})$/i.exec(raw ?? '');
  if (!m) return { ...DEFAULT_VIEW };
  const w = Math.max(256, Math.min(960, Number(m[1])));
  const h = Math.max(224, Math.min(540, Number(m[2])));
  return { w, h };
}

const fromUrl = (): string | null => {
  try {
    return new URLSearchParams(location.search).get('view');
  } catch {
    return null;
  }
};

const v = parseView(fromUrl());
export const VIEW_W = v.w;
export const VIEW_H = v.h;
/** px the 224-tall backdrop layers move down (>= 0; a view shorter than 224 cannot happen: clamped). */
export const BG_SHIFT = VIEW_H - BG_FRAME_H;

/**
 * Vertical camera (world y shown at the top of the screen).
 * A level no taller than the view is pinned to the bottom (the extra height is open sky above it);
 * a taller level follows the player, keeping them ~60% down the screen, clamped to the level.
 */
export function cameraY(levelPx: number, viewH: number, focusY: number | null): number {
  const bottom = levelPx - viewH;
  if (bottom <= 0 || focusY === null) return bottom;
  return Math.max(0, Math.min(bottom, Math.round(focusY - viewH * 0.6)));
}

/**
 * Scale from view pixels to window pixels: whole numbers when they fit well (crisp pixels), otherwise the exact fit
 * (e.g. a 1366x768 laptop, where 2x would leave a third of the window empty).
 */
export function pickScale(winW: number, winH: number, viewW: number, viewH: number): number {
  const fit = Math.min(winW / viewW, winH / viewH);
  if (fit < 1) return fit;
  const k = Math.floor(fit);
  return fit / k > 1.25 ? fit : k;
}
