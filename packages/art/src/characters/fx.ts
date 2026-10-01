// Pickups + effects. Signature collectible = the Bound Shard (spinning crystal, 6 frames), powerup orb,
// dust puff, landing ring, bounce-pad star burst, sparkle, stomp star, respawn poof.
import type { Bitmap } from '../core';
import { linePoints } from './compose';
import { outlineFor, palFrom, Sprite } from './kit';
import { shadedEllipse } from './shape';

export const FX_PAL = palFrom({}, { ABC: [184, 0.72, 0.5], GHI: [46, 0.93, 0.56], STU: [280, 0.6, 0.52], DEF: [38, 0.42, 0.78] });
const OUT = outlineFor(['ABC', 'GHI', 'STU', 'DEF'], { W: ['P', 'P'] });

function px(s: Sprite, x: number, y: number, ch: string) {
  if (x >= 0 && y >= 0 && x < s.w && y < s.h) s.c[y][x] = ch;
}

const HALF = [1, 3, 4, 5, 5, 5, 5, 5, 4, 4, 3, 2, 1];
function gem(frame: number): Bitmap {
  const f = [1, 0.75, 0.45, 0.16, 0.45, 0.75][frame];
  const mirror = frame >= 4;
  const s = new Sprite(14, 15);
  const cx = 6.5;
  HALF.forEach((hw, y) => {
    const half = f < 0.2 ? (hw > 3 ? 1 : 0) : Math.max(0, Math.round(hw * f));
    for (let x = -half; x <= half; x++) {
      const t = half === 0 ? 0 : x / half;
      let ch = Math.abs(t) < 0.34 ? 'B' : t < 0 ? 'A' : 'C';
      if (mirror && ch !== 'B') ch = ch === 'A' ? 'C' : 'A';
      if (y < 3 && Math.abs(t) < 0.34) ch = 'A';
      if (y > 8 && ch === 'B') ch = 'C';
      px(s, Math.round(cx + x), y + 1, ch);
    }
  });
  if (frame === 0 || frame === 1) px(s, 5 - (frame ? 1 : 0), 3, 'W');
  return s.bitmap(OUT, FX_PAL);
}

function orb(frame: number): Bitmap {
  const s = new Sprite(18, 18);
  s.put(shadedEllipse(12, 12, ['S', 'T', 'U']), 3, 3);
  s.put(['.W.', 'WWW', '.W.'], 8, 8);
  s.put(['WW', 'W.'], 5, 5);
  if (frame === 1) {
    s.put(['.G.', 'GGG', '.G.'], 14, 0);
    s.put(['G', 'G'], 0, 12);
    s.put(['GG'], 0, 14);
  } else {
    s.put(['G.', '.G'], 15, 1);
  }
  return s.bitmap(OUT, FX_PAL);
}

function dust(frame: number): Bitmap {
  const s = new Sprite(26, 14);
  const puffs: [number, number, number][][] = [
    [[8, 6, 6]],
    [[4, 6, 6], [11, 4, 7]],
    [[1, 6, 6], [8, 3, 8], [17, 6, 6]],
    [[0, 5, 5], [18, 6, 5], [9, 1, 6]],
  ];
  for (const [x, y, d] of puffs[frame]) s.put(shadedEllipse(d, Math.max(3, d - 1), ['D', 'E', 'F']), x, y);
  return s.bitmap(OUT, FX_PAL);
}

function landRing(frame: number): Bitmap {
  const w = [14, 22, 28][frame];
  const h = [5, 6, 7][frame];
  const s = new Sprite(30, 10);
  const ox = Math.floor((30 - w) / 2);
  for (let i = 0; i < 80; i++) {
    const a = (i / 80) * Math.PI * 2;
    if (frame === 2 && Math.floor(i / 5) % 2) continue;
    for (const [r, ch] of [[0.5, Math.sin(a) < 0 ? 'W' : 'D'], [1.5, 'E']] as const) {
      const x = Math.round(ox + w / 2 + Math.cos(a) * (w / 2 - r));
      const y = Math.round(2 + h / 2 + Math.sin(a) * (h / 2 - r * 0.6));
      if (r === 1.5 && frame === 2) continue;
      px(s, x, y, ch);
    }
  }
  return s.bitmap(OUT, FX_PAL);
}

function burst(frame: number): Bitmap {
  const n = 25;
  const s = new Sprite(n, n);
  const len = [4, 8, 11, 8][frame];
  const c = 12;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + (frame % 2 ? Math.PI / 8 : 0);
    const L = k % 2 ? len * 0.7 : len;
    for (const [x, y] of linePoints(c, c, Math.round(c + Math.cos(a) * L), Math.round(c + Math.sin(a) * L))) {
      px(s, x, y, 'G');
      px(s, x + 1, y, 'G');
      px(s, x, y + 1, 'G');
    }
  }
  s.put(['.W.', 'WWW', '.W.'], c - 1, c - 1);
  return s.bitmap(OUT, FX_PAL);
}

function sparkle(frame: number): Bitmap {
  const r = [1, 2, 3, 2][frame];
  const s = new Sprite(9, 9);
  for (let i = -r; i <= r; i++) {
    px(s, 4 + i, 4, 'G');
    px(s, 4, 4 + i, 'G');
  }
  px(s, 4, 4, 'W');
  if (r >= 2) px(s, 4, 3, 'W');
  return s.bitmap(OUT, FX_PAL);
}

function star4(s: Sprite, cx: number, cy: number, r: number, ch: string) {
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++) if (Math.abs(x * y) <= r * 0.45 && Math.abs(x) + Math.abs(y) <= r + 1) px(s, cx + x, cy + y, ch);
}

function stompStar(frame: number): Bitmap {
  const s = new Sprite(18, 18);
  if (frame === 0) star4(s, 9, 9, 4, 'G');
  else if (frame === 1) star4(s, 9, 9, 7, 'G');
  else {
    star4(s, 3, 3, 2, 'G');
    star4(s, 14, 4, 2, 'G');
    star4(s, 4, 14, 2, 'G');
    star4(s, 14, 14, 2, 'G');
  }
  px(s, 9, 9, frame === 2 ? '.' : 'W');
  return s.bitmap(OUT, FX_PAL);
}

function poof(frame: number): Bitmap {
  const n = 30;
  const s = new Sprite(n, n);
  const r = [3, 7, 10, 12, 13][frame];
  const d = [8, 8, 7, 6, 4][frame];
  const count = frame < 2 ? 6 : 8;
  for (let k = 0; k < count; k++) {
    const a = (k / count) * Math.PI * 2;
    s.put(shadedEllipse(d, d, ['D', 'E', 'F']), Math.round(15 + Math.cos(a) * r - d / 2), Math.round(15 + Math.sin(a) * r - d / 2));
  }
  if (frame >= 1 && frame <= 3) star4(s, 15, 15, frame === 2 ? 5 : 3, 'G');
  if (frame >= 3) {
    star4(s, 4, 5, 2, 'G');
    star4(s, 26, 24, 2, 'G');
  }
  return s.bitmap(OUT, FX_PAL);
}

export const FX_ANIMS: Record<string, { frames: string[]; fps: number; loop: boolean; ticks: number[] }> = {
  shard_spin: { frames: [0, 1, 2, 3, 4, 5].map((i) => `fx/shard_${i}`), fps: 10, loop: true, ticks: [6, 6, 6, 6, 6, 6] },
  orb: { frames: ['fx/orb_0', 'fx/orb_1'], fps: 4, loop: true, ticks: [15, 15] },
  dust: { frames: [0, 1, 2, 3].map((i) => `fx/dust_${i}`), fps: 15, loop: false, ticks: [4, 4, 4, 4] },
  land_ring: { frames: [0, 1, 2].map((i) => `fx/ring_${i}`), fps: 15, loop: false, ticks: [4, 4, 4] },
  bounce_burst: { frames: [0, 1, 2, 3].map((i) => `fx/burst_${i}`), fps: 20, loop: false, ticks: [3, 3, 3, 3] },
  sparkle: { frames: [0, 1, 2, 3].map((i) => `fx/sparkle_${i}`), fps: 15, loop: true, ticks: [4, 4, 4, 4] },
  stomp_star: { frames: [0, 1, 2].map((i) => `fx/stomp_${i}`), fps: 20, loop: false, ticks: [3, 3, 3] },
  poof: { frames: [0, 1, 2, 3, 4].map((i) => `fx/poof_${i}`), fps: 15, loop: false, ticks: [4, 4, 4, 4, 4] },
};

export function buildFxFrames(): Record<string, Bitmap> {
  const out: Record<string, Bitmap> = {};
  for (let i = 0; i < 6; i++) out[`fx/shard_${i}`] = gem(i);
  for (let i = 0; i < 2; i++) out[`fx/orb_${i}`] = orb(i);
  for (let i = 0; i < 4; i++) {
    out[`fx/dust_${i}`] = dust(i);
    out[`fx/burst_${i}`] = burst(i);
    out[`fx/sparkle_${i}`] = sparkle(i);
  }
  for (let i = 0; i < 3; i++) {
    out[`fx/ring_${i}`] = landRing(i);
    out[`fx/stomp_${i}`] = stompStar(i);
  }
  for (let i = 0; i < 5; i++) out[`fx/poof_${i}`] = poof(i);
  return out;
}
