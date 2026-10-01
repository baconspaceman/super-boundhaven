// Hero key art: the real Blender-built sunset backdrop layers (parallax on scroll + pointer), real game ground tiles,
// and a row of real animated humanoids (different looks) walking, running, jumping and bouncing on a pad.
import { TILE } from '@sbh/sim';
import {
  PoseClock,
  ctx2d,
  drawBottomCenter,
  heroAnimFor,
  loadHeroSheet,
  prefersReducedMotion,
  startLoop,
  watchVisible,
  type Atlas,
} from './assets';
import { drawLayers, drawTile, loadRegion, loadTodBackdrop, type BgLayer } from './world';

const HERO_LOOKS = [0, 3, 4, 1, 5, 6, 7];
const GROUND_ROWS = 2;
const GRAV = 0.42;
const PAD_VEL = 9.2;

interface Walker {
  look: number;
  x: number;
  y: number; // feet, relative offset above ground (0 = on ground)
  vx: number;
  vy: number;
  face: number;
  mode: 'walk' | 'run' | 'idle';
  until: number; // tick when the current mode ends
  lo: number;
  hi: number;
  clock: PoseClock;
}

const rnd = (() => {
  let s = 0x5bd1e995;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
})();

export async function initHero(canvas: HTMLCanvasElement): Promise<void> {
  const host = canvas.parentElement!;
  const ctx = ctx2d(canvas);
  const reduced = prefersReducedMotion();
  const [layersRaw, region, ...sheets] = await Promise.all([
    loadTodBackdrop('sunset'),
    loadRegion('meadow_sunset'),
    ...HERO_LOOKS.map((i) => loadHeroSheet(i)),
  ]);
  const layers: BgLayer[] = layersRaw.map((l) => ({
    ...l,
    drift: l.name === 'clouds_a' ? 3 : l.name === 'clouds_b' ? 5 : 0,
    parallax: l.name === 'fore' ? 0 : l.parallax,
  }));
  const sheetAt = (i: number): Atlas => sheets[i] as Atlas;

  let W = 0;
  let H = 0;
  let scale = 4;
  let groundTop = 0;
  let ground: HTMLCanvasElement | null = null;
  let walkers: Walker[] = [];
  let padX = 0;
  let padStart = -100;
  let tick = 0;
  let mouse = 0;
  let mouseS = 0;
  const isVisible = watchVisible(host, '0px');

  const hash = (a: number, b: number) => {
    let h = (a * 374761393 + b * 668265263) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };

  const layout = () => {
    const r = host.getBoundingClientRect();
    if (r.width < 64 || r.height < 64) return; // not laid out yet (hidden pane / CSS not applied): wait for the ResizeObserver
    const cssW = r.width;
    const cssH = r.height;
    scale = Math.max(2, Math.round(cssH / 224));
    W = Math.ceil(cssW / scale);
    H = Math.ceil(cssH / scale);
    canvas.width = W;
    canvas.height = H;
    groundTop = H - GROUND_ROWS * TILE;
    // ground strip (static): grass-capped top row + dirt fill, real game tiles
    ground = document.createElement('canvas');
    ground.width = W + TILE;
    ground.height = GROUND_ROWS * TILE;
    const g = ctx2d(ground);
    for (let c = 0; c * TILE < ground.width; c++) {
      drawTile(g, region, `top${Math.floor(hash(c, 1) * 6)}`, c * TILE, 0);
      drawTile(g, region, `fill${Math.floor(hash(c, 2) * 4)}`, c * TILE, TILE);
    }
    // pad sits right of centre on wide screens, left-ish on narrow ones
    padX = Math.round(W * (W > 200 ? 0.66 : 0.55) / TILE) * TILE;
    const n = Math.max(3, Math.min(HERO_LOOKS.length, Math.floor(W / 38)));
    const left = W > 200 ? W * 0.5 : 4;
    const span = W - left - 16;
    walkers = Array.from({ length: n }, (_, i) => {
      const lane = span / n;
      const x = left + lane * (i + 0.5);
      return {
        look: i,
        x,
        y: 0,
        vx: 0,
        vy: 0,
        face: i % 2 ? -1 : 1,
        mode: 'idle',
        until: tick + 20 + Math.floor(rnd() * 120),
        lo: Math.max(14, left + lane * i - lane * 0.4),
        hi: Math.min(W - 14, left + lane * (i + 1) + lane * 0.4),
        clock: new PoseClock(),
      } as Walker;
    });
    // one walker patrols across the pad
    const w0 = walkers[Math.min(1, walkers.length - 1)];
    w0.lo = padX - 60;
    w0.hi = padX + 60;
    w0.x = padX - 40;
    if (reduced) drawFrame(0);
  };

  const step = () => {
    tick++;
    mouseS += (mouse - mouseS) * 0.06;
    for (const w of walkers) {
      if (tick >= w.until) {
        const r = rnd();
        if (r < 0.28) {
          w.mode = 'idle';
          w.until = tick + 50 + Math.floor(rnd() * 110);
        } else if (r < 0.6) {
          w.mode = 'walk';
          w.until = tick + 70 + Math.floor(rnd() * 140);
          w.face = rnd() < 0.5 ? -1 : 1;
        } else {
          w.mode = 'run';
          w.until = tick + 60 + Math.floor(rnd() * 100);
          w.face = rnd() < 0.5 ? -1 : 1;
        }
        if (w.y === 0 && rnd() < 0.3) w.vy = -5.2; // hop
      }
      const target = w.mode === 'idle' ? 0 : w.mode === 'walk' ? 1.2 : 2.4;
      const dir = target ? w.face : 0;
      w.vx += (dir * target - w.vx) * (w.y === 0 ? 0.12 : 0.04);
      w.x += w.vx;
      if (w.x < w.lo) {
        w.x = w.lo;
        w.face = 1;
      } else if (w.x > w.hi) {
        w.x = w.hi;
        w.face = -1;
      }
      // y is height above ground (positive up)
      if (w.y > 0 || w.vy !== 0) {
        w.y -= w.vy;
        w.vy += GRAV;
        if (w.y <= 0) {
          w.y = 0;
          w.vy = 0;
        }
      }
      if (w.y === 0 && w.vy === 0 && Math.abs(w.x - padX) < 7 && w.mode !== 'idle') {
        w.vy = -PAD_VEL;
        w.y = 0.01;
        padStart = tick;
      }
      const onGround = w.y === 0;
      w.clock.update(heroAnimFor({ vx: w.vx, vy: w.vy, onGround }), Math.abs(w.vx));
    }
  };

  const drawFrame = (t: number) => {
    if (!W || !ground) return;
    const scrollY = Math.min(window.scrollY, 900);
    const cam = t * 0 + mouseS * 36 + scrollY * 0.22;
    const sunX = Math.round(W * (W > 200 ? 0.7 : 0.6) - 75);
    // Bottom-anchored: art space (224px tall) ends at the canvas bottom, parallax by scroll lifts distant layers a touch.
    const bottom = H;
    drawLayers(ctx, layers.filter((l) => l.name !== 'fore'), cam, W, bottom, t / 60, 'back', { sunX });
    drawLayers(ctx, layers.filter((l) => l.name === 'fore'), 0, W, bottom, t / 60, 'back');
    if (ground) ctx.drawImage(ground, 0, groundTop);
    // bounce pad (real tile, three-frame launch animation)
    const dt = tick - padStart;
    const pid = dt < 3 ? 'bounce1' : dt < 8 ? 'bounce2' : dt < 11 ? 'bounce1' : 'bounce0';
    drawTile(ctx, region, pid, padX - 8, groundTop - TILE + 0);
    for (const w of [...walkers].sort((a, b) => a.look - b.look)) {
      ctx.fillStyle = 'rgba(30,10,50,0.3)';
      ctx.fillRect(Math.round(w.x) - 6, groundTop - 1, 12, 2);
      drawBottomCenter(ctx, sheetAt(w.look), w.clock.frame(), w.x, groundTop - w.y + 1, w.face < 0);
    }
  };

  layout();
  let rt = 0;
  // ResizeObserver also catches the late CSS/font load that changes the hero height after first paint.
  let lastBox = '';
  new ResizeObserver(() => {
    const r = host.getBoundingClientRect();
    const key = `${Math.round(r.width)}x${Math.round(r.height)}`;
    if (key === lastBox) return;
    lastBox = key;
    window.clearTimeout(rt);
    rt = window.setTimeout(() => {
      layout();
      if (!isVisible() || reduced) drawFrame(tick);
    }, 60);
  }).observe(host);
  if (reduced) {
    drawFrame(0);
    return;
  }
  window.addEventListener(
    'pointermove',
    (e) => {
      mouse = (e.clientX / window.innerWidth) * 2 - 1;
    },
    { passive: true },
  );
  startLoop(
    () => isVisible(),
    step,
    () => drawFrame(tick),
  );
  drawFrame(0);
}
