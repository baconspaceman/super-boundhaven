import { describe, expect, it } from 'vitest';
import { BG_FRAME_H, DEFAULT_VIEW, VIEW_H, VIEW_W, BG_SHIFT, cameraY, parseView, pickScale } from '../src/viewport';

describe('view size', () => {
  it('defaults to 16:9 480x270 and the backdrops shift down by the extra height', () => {
    expect(DEFAULT_VIEW).toEqual({ w: 480, h: 270 });
    expect(DEFAULT_VIEW.w / DEFAULT_VIEW.h).toBeCloseTo(16 / 9, 5);
    expect([VIEW_W, VIEW_H]).toEqual([480, 270]); // no ?view= in the test environment
    expect(BG_SHIFT).toBe(270 - BG_FRAME_H);
  });

  it('parses ?view=WxH, clamps it and ignores junk', () => {
    expect(parseView('576x324')).toEqual({ w: 576, h: 324 });
    expect(parseView('384X216')).toEqual({ w: 384, h: 224 }); // never shorter than the 224 px backdrops
    expect(parseView('4000x4000')).toEqual({ w: 960, h: 540 });
    expect(parseView('100x100')).toEqual({ w: 256, h: 224 });
    for (const bad of [null, undefined, '', 'big', '480', '480x', 'x270', '480x270x1']) expect(parseView(bad as string)).toEqual({ w: 480, h: 270 });
  });
});

describe('vertical camera', () => {
  it('pins a level that is shorter than the view to the bottom (open sky above)', () => {
    expect(cameraY(256, 270, 100)).toBe(-14);
    expect(cameraY(256, 270, null)).toBe(-14);
    expect(cameraY(270, 270, 10)).toBe(0);
  });

  it('follows the player in a taller level and clamps at both ends', () => {
    const level = 640;
    const view = 270;
    expect(cameraY(level, view, 0)).toBe(0); // clamps at the top
    expect(cameraY(level, view, 300)).toBe(300 - Math.round(view * 0.6));
    expect(cameraY(level, view, 9999)).toBe(level - view); // clamps at the bottom
    expect(cameraY(level, view, null)).toBe(level - view);
  });
});

describe('window scale', () => {
  const k = (w: number, h: number) => pickScale(w, h, 480, 270);
  it('uses whole numbers where they fit well', () => {
    expect(k(1920, 1080)).toBe(4);
    expect(k(2560, 1440)).toBe(5);
    expect(k(3840, 2160)).toBe(8);
    expect(k(960, 540)).toBe(2);
  });
  it('falls back to an exact fit when whole numbers waste too much of the window', () => {
    expect(k(1366, 768)).toBeCloseTo(768 / 270, 5); // 2x would leave a third empty
    expect(k(1280, 720)).toBeCloseTo(720 / 270, 5);
    expect(k(800, 600)).toBeCloseTo(800 / 480, 5);
  });
  it('shrinks below 1 for tiny windows instead of clipping', () => {
    expect(k(320, 180)).toBeCloseTo(320 / 480, 5);
  });
});
