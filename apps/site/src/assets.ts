// Real game art, bundled by Vite from ./assets (copied from packages/art/assets so the site builds standalone).
// Everything is same-origin: no external requests. All drawing uses nearest-neighbour (no smoothing).

const urlGlob = import.meta.glob('./assets/*.png', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const jsonGlob = import.meta.glob('./assets/*.json', { import: 'default', eager: true }) as Record<string, unknown>;

const byName = <T>(g: Record<string, T>): Record<string, T> => {
  const o: Record<string, T> = {};
  for (const k in g) o[k.slice(k.lastIndexOf('/') + 1)] = g[k];
  return o;
};
const URLS = byName(urlGlob);
const JSONS = byName(jsonGlob);

export const assetUrl = (name: string): string => {
  const u = URLS[name];
  if (!u) throw new Error(`missing art asset ${name}`);
  return u;
};
export const assetJson = <T>(name: string): T => {
  const j = JSONS[name];
  if (!j) throw new Error(`missing art json ${name}`);
  return j as T;
};

const imgCache = new Map<string, Promise<HTMLImageElement>>();
export function loadImage(name: string): Promise<HTMLImageElement> {
  let p = imgCache.get(name);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error(`failed to load ${name}`));
      im.src = assetUrl(name);
    });
    imgCache.set(name, p);
  }
  return p;
}

export type Ctx = CanvasRenderingContext2D;

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function ctx2d(c: HTMLCanvasElement): Ctx {
  const x = c.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  return x;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ---------------------------------------------------------------- characters

interface AnimDef {
  frames: string[];
  fps: number;
  loop: boolean;
  ticks: number[];
  stompable?: boolean;
}
interface CharData {
  HERO_ANIMS: Record<string, AnimDef>;
  ENEMY_ANIMS: Record<string, AnimDef>;
  FX_ANIMS: Record<string, AnimDef>;
  MOUNT_ANIMS: Record<string, Record<string, AnimDef>>;
  MOUNT_ANCHORS: Record<string, { seat: [number, number]; rider: string }>;
  CHARACTER_OPTIONS: { categories: { key: string; label: string; names: string[]; colorKeys: string[] }[] };
  sampleLooks: { name: string; code: string }[];
}
export const CHAR = assetJson<CharData>('characters_data.json');
export type { AnimDef };

export const HERO_FRAMES = assetJson<{ frames: Record<string, Rect> }>('characters_hero_0.json').frames;
export const HERO_W = 24;
export const HERO_H = 32;
/** Hero frame-space hip pixel: lands on a mount's `seat` anchor when riding. */
export const RIDER_HIP: [number, number] = [12, 22];

/** The 12 shipped sample looks (sheet index === sampleLooks index). */
export const LOOKS = CHAR.sampleLooks.map((l, i) => ({ ...l, sheet: `characters_hero_${i}.png` }));

export interface Atlas {
  img: HTMLImageElement;
  frames: Record<string, Rect>;
}

const atlasCache = new Map<string, Promise<Atlas>>();
export function loadAtlas(png: string, json: string): Promise<Atlas> {
  const key = png;
  let p = atlasCache.get(key);
  if (!p) {
    p = loadImage(png).then((img) => ({ img, frames: assetJson<{ frames: Record<string, Rect> }>(json).frames }));
    atlasCache.set(key, p);
  }
  return p;
}

export const loadHeroSheet = (i: number): Promise<Atlas> =>
  loadImage(`characters_hero_${i}.png`).then((img) => ({ img, frames: HERO_FRAMES }));
export const loadMount = (m: string): Promise<Atlas> => loadAtlas(`characters_mount_${m}.png`, `characters_mount_${m}.json`);
export const loadEnemies = (): Promise<Atlas> => loadAtlas('characters_enemies.png', 'characters_enemies.json');
export const loadFx = (): Promise<Atlas> => loadAtlas('characters_fx.png', 'characters_fx.json');

/** Frame index for an anim at a given time in 60 Hz ticks. */
export function frameAt(anim: AnimDef, tick: number): string {
  const total = anim.ticks.reduce((a, b) => a + b, 0);
  let t = anim.loop ? tick % total : Math.min(tick, total - 1);
  for (let i = 0; i < anim.frames.length; i++) {
    if (t < anim.ticks[i]) return anim.frames[i];
    t -= anim.ticks[i];
  }
  return anim.frames[anim.frames.length - 1];
}

/** Draw a frame with its bottom-centre at (x, y). Integer-snapped. */
export function drawBottomCenter(c: Ctx, atlas: Atlas, name: string, x: number, y: number, flip = false): Rect | null {
  const f = atlas.frames[name];
  if (!f) return null;
  const dx = Math.round(x - f.w / 2);
  const dy = Math.round(y - f.h);
  if (flip) {
    c.save();
    c.translate(dx + f.w, dy);
    c.scale(-1, 1);
    c.drawImage(atlas.img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    c.restore();
  } else {
    c.drawImage(atlas.img, f.x, f.y, f.w, f.h, dx, dy, f.w, f.h);
  }
  return f;
}

/** Draw a frame with its top-left at (x, y). */
export function drawTopLeft(c: Ctx, atlas: Atlas, name: string, x: number, y: number, flip = false, w?: number): void {
  const f = atlas.frames[name];
  if (!f) return;
  const dx = Math.round(x);
  const dy = Math.round(y);
  if (flip) {
    c.save();
    c.translate(dx + (w ?? f.w), dy);
    c.scale(-1, 1);
    c.drawImage(atlas.img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    c.restore();
  } else c.drawImage(atlas.img, f.x, f.y, f.w, f.h, dx, dy, f.w, f.h);
}

export interface Motion {
  vx: number;
  vy: number;
  onGround: boolean;
}

/** Pick a hero animation name from physics state (mirrors the real client's motion rules, simplified). */
export function heroAnimFor(m: Motion): string {
  if (!m.onGround) {
    if (m.vy < -1.2) return 'jump_rise';
    if (m.vy > 1.2) return 'fall';
    return 'jump_apex';
  }
  const s = Math.abs(m.vx);
  if (s > 1.55) return 'run';
  if (s > 0.15) return 'walk';
  return 'idle';
}

/** Per-character animation clock: resets when the anim changes, stride scales with speed. */
export class PoseClock {
  anim = 'idle';
  t = 0;
  update(next: string, speed: number): void {
    if (next !== this.anim) {
      this.anim = next;
      this.t = 0;
    }
    const rate = next === 'walk' ? 0.6 + speed * 0.5 : next === 'run' ? 0.7 + speed * 0.3 : 1;
    this.t += rate;
  }
  frame(): string {
    return frameAt(CHAR.HERO_ANIMS[this.anim], Math.floor(this.t));
  }
}

export const prefersReducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Run a callback when an element is near the viewport; returns a visibility getter. */
export function watchVisible(el: Element, margin = '120px'): () => boolean {
  let vis = true;
  if ('IntersectionObserver' in window) {
    vis = false;
    new IntersectionObserver((es) => (vis = es[es.length - 1].isIntersecting), { rootMargin: margin }).observe(el);
  }
  return () => vis && !document.hidden;
}

export const timerMode = new URLSearchParams(location.search).get('raf') === 'timer';

/** Fixed-step 60 Hz loop; steps only while isActive() is true. ?raf=timer uses setTimeout for panes where rAF is throttled. */
export function startLoop(isActive: () => boolean, step: () => void, render: () => void): { stop: () => void } {
  let handle = 0;
  let stopped = false;
  let last = 0;
  let acc = 0;
  const loop = (now: number) => {
    if (stopped) return;
    handle = timerMode ? window.setTimeout(() => loop(performance.now()), 16) : requestAnimationFrame(loop);
    if (!last) last = now;
    acc += Math.min(0.25, (now - last) / 1000);
    last = now;
    if (!isActive()) {
      acc = 0;
      return;
    }
    let n = 0;
    while (acc >= 1 / 60 && n < 6) {
      step();
      acc -= 1 / 60;
      n++;
    }
    if (n) render();
  };
  handle = timerMode ? window.setTimeout(() => loop(performance.now()), 16) : requestAnimationFrame(loop);
  return {
    stop: () => {
      stopped = true;
      if (timerMode) clearTimeout(handle);
      else cancelAnimationFrame(handle);
    },
  };
}
