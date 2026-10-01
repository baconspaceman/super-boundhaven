// Gameplay reel: a looping canvas replay of the REAL @sbh/sim simulation driven by scripted inputs (see clips.ts),
// drawn with the real tiles, backdrop and humanoid sprites. Nothing here is pre-rendered video.
import { PLAYGROUND, TICK_RATE } from '@sbh/sim';
import { CLIPS, clipLength, createClipWorld, stepClip, verifyClip } from './clips';
import { prefersReducedMotion, timerMode, watchVisible } from './assets';
import { SceneRenderer, VIEW_H, VIEW_W } from './world';

interface ReelState {
  clip: string;
  tick: number;
  frames: number;
  paused: boolean;
  running: boolean;
  verified: Record<string, boolean>;
  reducedMotion: boolean;
}

declare global {
  interface Window {
    __sbhReel?: ReelState;
  }
}

export async function initReel(): Promise<void> {
  const canvas = document.getElementById('reel-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  const level = PLAYGROUND;
  const scene = await SceneRenderer.create(level, 'meadow_sunset');
  const pauseBtn = document.getElementById('reel-pause') as HTMLButtonElement;
  const restartBtn = document.getElementById('reel-restart') as HTMLButtonElement;
  const chipEl = document.getElementById('reel-chip')!;
  const subEl = document.getElementById('reel-sub')!;
  const statusEl = document.getElementById('reel-status')!;
  const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-clip]'));
  const reduced = prefersReducedMotion();

  const verifications = CLIPS.map((c) => verifyClip(c, level));
  const state: ReelState = {
    clip: CLIPS[0].id,
    tick: 0,
    frames: 0,
    paused: reduced,
    running: false,
    verified: Object.fromEntries(verifications.map((v) => [v.id, v.ok])),
    reducedMotion: reduced,
  };
  window.__sbhReel = state;
  const allOk = verifications.every((v) => v.ok);

  let clipIdx = reduced ? 1 : 0; // the still poster shows the co-op stomp
  let world = createClipWorld(level, CLIPS[clipIdx]);
  let tick = 0;
  let camX = 0;
  let wall = 0; // seconds of wall-clock (cloud drift)
  const isVisible = watchVisible(canvas, '60px');

  const setPausedUi = () => {
    pauseBtn.setAttribute('aria-pressed', String(state.paused));
    pauseBtn.textContent = state.paused ? 'Play' : 'Pause';
  };

  const focusCam = (snap: boolean) => {
    const c = CLIPS[clipIdx];
    const target = Math.max(0, Math.min(scene.levelW - VIEW_W, Math.round(c.focus(world.players) - VIEW_W / 2 + 20)));
    camX = snap ? target : Math.round(camX + (target - camX) * 0.14);
  };

  const loadClip = (idx: number, toTick = 0) => {
    clipIdx = idx;
    const c = CLIPS[idx];
    world = createClipWorld(level, c);
    scene.reset();
    tick = 0;
    for (let t = 0; t < toTick; t++) {
      stepClip(level, c, world, t);
      tick++;
    }
    focusCam(true);
    state.clip = c.id;
    chipEl.textContent = c.chips[0];
    subEl.textContent = c.blurb;
    tabs.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.clip === c.id)));
    canvas.setAttribute('aria-label', `Gameplay reel, ${c.title}: a live replay of the simulation. ${c.blurb}`);
  };

  const render = () => {
    const c = CLIPS[clipIdx];
    const len = clipLength(c);
    scene.draw(ctx, camX, world.players, tick, wall);
    const ci = Math.min(c.chips.length - 1, Math.floor((tick / len) * c.chips.length));
    if (chipEl.textContent !== c.chips[ci]) chipEl.textContent = c.chips[ci];
    ctx.fillStyle = 'rgba(8,8,20,0.72)';
    ctx.fillRect(4, 4, 92, 12);
    ctx.fillStyle = '#ffd84a';
    ctx.font = '8px ui-monospace, Consolas, monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(`TICK ${String(tick).padStart(4, '0')} @${TICK_RATE}Hz`, 8, 6);
    let a = 0;
    if (tick < c.fadeTicks) a = 1 - tick / c.fadeTicks;
    else if (tick > len - c.fadeTicks) a = (tick - (len - c.fadeTicks)) / c.fadeTicks;
    if (a > 0) {
      ctx.fillStyle = `rgba(11,11,20,${Math.min(1, a).toFixed(2)})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    state.tick = tick;
    state.frames++;
  };

  const advance = () => {
    const c = CLIPS[clipIdx];
    if (tick >= clipLength(c)) {
      loadClip((clipIdx + 1) % CLIPS.length);
      return;
    }
    stepClip(level, c, world, tick);
    tick++;
    focusCam(false);
  };

  // ---- loop (rAF, or setTimeout with ?raf=timer for panes where rAF is throttled)
  let handle = 0;
  let last = 0;
  let acc = 0;
  const frame = (now: number) => {
    if (!last) last = now;
    acc += Math.min(0.25, (now - last) / 1000);
    if (!state.paused) wall += Math.min(0.25, (now - last) / 1000);
    last = now;
    let n = 0;
    while (acc >= 1 / TICK_RATE && n < 6) {
      if (!state.paused && isVisible()) advance();
      acc -= 1 / TICK_RATE;
      n++;
    }
    if (n >= 6) acc = 0;
    if (!state.paused && isVisible()) render();
    handle = timerMode ? window.setTimeout(() => frame(performance.now()), 16) : requestAnimationFrame(frame);
  };
  const start = () => {
    if (state.running) return;
    state.running = true;
    last = 0;
    handle = timerMode ? window.setTimeout(() => frame(performance.now()), 16) : requestAnimationFrame(frame);
  };
  void handle;

  pauseBtn.addEventListener('click', () => {
    state.paused = !state.paused;
    setPausedUi();
    if (!state.paused) start();
  });
  restartBtn.addEventListener('click', () => {
    loadClip(clipIdx);
    state.paused = false;
    setPausedUi();
    start();
    render();
  });
  tabs.forEach((b) =>
    b.addEventListener('click', () => {
      loadClip(CLIPS.findIndex((c) => c.id === b.dataset.clip));
      state.paused = false;
      setPausedUi();
      start();
      render();
    }),
  );
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
    state.reducedMotion = e.matches;
    if (e.matches) {
      state.paused = true;
      setPausedUi();
    }
  });

  loadClip(clipIdx, reduced ? CLIPS[clipIdx].posterTick : 0);
  setPausedUi();
  statusEl.textContent = allOk
    ? reduced
      ? 'Reduced motion is on, so the reel is paused on a still frame. Press Play to run the live simulation replay.'
      : 'Live replay of the real movement simulation. Inputs are scripted and sim-verified.'
    : 'Replay loaded, but a scripted clip failed sim verification.';
  render();
  start(); // keeps rendering; sim only advances when not paused
}

/**
 * Still frames of a clip (storyboards / film strips). `ticks[i]` is the sim tick of frame i; the crop is centred on
 * the average player x at that tick (or `focusX` if given). Draws the full real scene, then crops.
 */
export async function renderStrip(
  clipId: 'solo' | 'coop',
  ticks: number[],
  canvases: HTMLCanvasElement[],
  opts: { focusX?: number; yOff?: number } = {},
): Promise<void> {
  const level = PLAYGROUND;
  const scene = await SceneRenderer.create(level, 'meadow_sunset');
  const c = CLIPS.find((x) => x.id === clipId)!;
  const world = createClipWorld(level, c);
  let tick = 0;
  const full = document.createElement('canvas');
  full.width = VIEW_W;
  full.height = VIEW_H;
  const f = full.getContext('2d')!;
  f.imageSmoothingEnabled = false;
  ticks.forEach((target, i) => {
    while (tick < target) {
      stepClip(level, c, world, tick);
      tick++;
    }
    const cv = canvases[i];
    if (!cv) return;
    const cctx = cv.getContext('2d');
    if (!cctx) return;
    const fx = opts.focusX ?? c.focus(world.players);
    const camX = Math.max(0, Math.min(scene.levelW - VIEW_W, Math.round(fx - VIEW_W / 2)));
    scene.draw(f, camX, world.players, tick, 3 + i);
    cctx.imageSmoothingEnabled = false;
    const sx = Math.max(0, Math.min(VIEW_W - cv.width, Math.round(fx - camX - cv.width / 2)));
    const lead = Math.min(...world.players.map((p) => p.y));
    const sy = Math.max(0, Math.min(VIEW_H - cv.height, opts.yOff ?? Math.round(lead - cv.height * 0.72)));
    cctx.drawImage(full, sx, sy, cv.width, cv.height, 0, 0, cv.width, cv.height);
  });
}
