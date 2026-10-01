// Art showcases built on the real sprite sheets: character creator teaser, mounts, enemies + effects, time-of-day.
import { TILE } from '@sbh/sim';
import {
  CHAR,
  LOOKS,
  RIDER_HIP,
  ctx2d,
  drawBottomCenter,
  drawTopLeft,
  frameAt,
  loadEnemies,
  loadFx,
  loadHeroSheet,
  loadMount,
  prefersReducedMotion,
  startLoop,
  watchVisible,
} from './assets';
import { SUN_CX, drawLayers, drawTile, loadRegion, loadTodBackdrop, type BgLayer, type TodId } from './world';

const $ = <T extends HTMLElement>(id: string): T | null => document.getElementById(id) as T | null;

// ================================================================ character creator teaser

const CREATOR_ANIMS: { id: string; label: string; anim: string }[] = [
  { id: 'idle', label: 'Idle', anim: 'idle' },
  { id: 'walk', label: 'Walk', anim: 'walk' },
  { id: 'run', label: 'Run', anim: 'run' },
  { id: 'skid', label: 'Skid', anim: 'skid' },
  { id: 'jump', label: 'Jump', anim: 'jump_rise' },
  { id: 'stomp', label: 'Stomp', anim: 'stomp' },
  { id: 'hurt', label: 'Hurt', anim: 'hurt' },
];

export async function initCreator(): Promise<void> {
  const canvas = $<HTMLCanvasElement>('cc-canvas');
  if (!canvas) return;
  const ctx = ctx2d(canvas);
  const reduced = prefersReducedMotion();
  const sheets = await Promise.all(LOOKS.map((_, i) => loadHeroSheet(i)));
  const nameEl = $('cc-name')!;
  const codeEl = $('cc-code')!;
  const strip = $('cc-looks')!;
  const animBox = $('cc-anims')!;
  const cats = $('cc-cats')!;
  const total = $('cc-total')!;

  let look = 0;
  let anim = 'idle';
  let t = 0;
  let flip = false;
  const visible = watchVisible(canvas);

  // option categories (real counts from the shipped character data)
  const categories = CHAR.CHARACTER_OPTIONS.categories;
  cats.innerHTML = categories.map((c) => `<li><span>${c.label}</span><b>${c.names.length}</b></li>`).join('');
  total.textContent = `${categories.length} categories`;

  // look thumbnails
  strip.innerHTML = LOOKS.map(
    (l, i) =>
      `<li><button type="button" data-look="${i}" aria-pressed="${i === 0}" aria-label="Look ${i + 1}: ${l.name}"><canvas width="24" height="32" aria-hidden="true"></canvas></button></li>`,
  ).join('');
  strip.querySelectorAll<HTMLCanvasElement>('canvas').forEach((cv, i) => {
    const c = ctx2d(cv);
    drawBottomCenter(c, sheets[i], 'hero/idle_1', 12, 32);
  });
  animBox.innerHTML = CREATOR_ANIMS.map(
    (a) => `<button type="button" class="chipbtn" data-anim="${a.id}" aria-pressed="${a.id === 'idle'}">${a.label}</button>`,
  ).join('');

  const render = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(canvas.width / 2 - 8, canvas.height - 3, 16, 2);
    const def = CHAR.HERO_ANIMS[anim];
    const name = frameAt(def, reduced ? 0 : t);
    drawBottomCenter(ctx, sheets[look], name, canvas.width / 2, canvas.height - 1, flip);
  };
  const select = (i: number) => {
    look = (i + LOOKS.length) % LOOKS.length;
    nameEl.textContent = LOOKS[look].name;
    codeEl.textContent = LOOKS[look].code;
    strip.querySelectorAll('button').forEach((b, k) => b.setAttribute('aria-pressed', String(k === look)));
    canvas.setAttribute(
      'aria-label',
      `Character preview: the "${LOOKS[look].name}" sample look, playing the ${anim} animation.`,
    );
    render();
  };
  strip.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-look]');
    if (b) select(Number(b.dataset.look));
  });
  animBox.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-anim]');
    if (!b) return;
    anim = CREATOR_ANIMS.find((a) => a.id === b.dataset.anim)!.anim;
    t = 0;
    animBox.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    select(look);
  });
  $('cc-prev')!.addEventListener('click', () => select(look - 1));
  $('cc-next')!.addEventListener('click', () => select(look + 1));
  $('cc-shuffle')!.addEventListener('click', () => {
    let n = look;
    while (n === look) n = Math.floor(Math.random() * LOOKS.length);
    select(n);
  });
  $('cc-flip')!.addEventListener('click', () => {
    flip = !flip;
    render();
  });
  select(0);
  if (!reduced) {
    // auto-showcase: advance the look every few seconds until the visitor interacts
    let idle = 0;
    let auto = true;
    document.getElementById('creator')?.addEventListener('pointerdown', () => (auto = false));
    document.getElementById('creator')?.addEventListener('keydown', () => (auto = false));
    startLoop(
      () => visible(),
      () => {
        t++;
        if (auto && ++idle > 60 * 4) {
          idle = 0;
          select(look + 1);
        }
      },
      render,
    );
  }
}

// ================================================================ mounts

interface Step {
  anim: string;
  min: number; // ticks
  label: string;
  rider?: boolean;
  arc?: number; // jump arc height px
}

const MOUNT_SCRIPTS: Record<string, Step[]> = {
  frog: [
    { anim: 'summon_in', min: 15, label: 'Summoned', rider: false },
    { anim: 'idle', min: 90, label: 'Idle' },
    { anim: 'hop', min: 84, label: 'Hop' },
    { anim: 'charge', min: 48, label: 'Charging a super-hop' },
    { anim: 'superjump', min: 40, label: 'Super-hop', arc: 26 },
    { anim: 'land', min: 12, label: 'Landing' },
    { anim: 'summon_out', min: 15, label: 'Dismissed', rider: false },
  ],
  dino: [
    { anim: 'summon_in', min: 15, label: 'Summoned', rider: false },
    { anim: 'idle', min: 90, label: 'Idle' },
    { anim: 'trot', min: 84, label: 'Trot' },
    { anim: 'charge', min: 48, label: 'Charging a ground-pound' },
    { anim: 'jump', min: 22, label: 'Leap', arc: 14 },
    { anim: 'pound', min: 32, label: 'Ground-pound' },
    { anim: 'summon_out', min: 15, label: 'Dismissed', rider: false },
  ],
  drake: [
    { anim: 'summon_in', min: 15, label: 'Summoned', rider: false },
    { anim: 'idle', min: 90, label: 'Idle' },
    { anim: 'flap', min: 72, label: 'Flap', arc: 10 },
    { anim: 'glide', min: 90, label: 'Glide', arc: 6 },
    { anim: 'land', min: 12, label: 'Landing' },
    { anim: 'summon_out', min: 15, label: 'Dismissed', rider: false },
  ],
  cheetah: [
    { anim: 'summon_in', min: 15, label: 'Summoned', rider: false },
    { anim: 'idle', min: 90, label: 'Idle' },
    { anim: 'gallop', min: 80, label: 'Gallop' },
    { anim: 'dash', min: 56, label: 'Sprint dash' },
    { anim: 'jump', min: 26, label: 'Long leap', arc: 16 },
    { anim: 'land', min: 12, label: 'Landing' },
    { anim: 'summon_out', min: 15, label: 'Dismissed', rider: false },
  ],
};

const RIDER_LOOK: Record<string, number> = { frog: 0, dino: 5, drake: 4, cheetah: 3 };

export async function initMounts(): Promise<void> {
  const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-mount]'));
  if (!cards.length) return;
  const reduced = prefersReducedMotion();
  const region = await loadRegion('meadow_sunset');
  const loaded = await Promise.all(
    cards.map(async (card) => {
      const m = card.dataset.mount!;
      const [mount, hero] = await Promise.all([loadMount(m), loadHeroSheet(RIDER_LOOK[m])]);
      const cv = card.querySelector<HTMLCanvasElement>('canvas')!;
      const label = card.querySelector<HTMLElement>('[data-now]')!;
      return { m, mount, hero, cv, ctx: ctx2d(cv), label, step: 0, t: 0, visible: watchVisible(cv) };
    }),
  );
  const anchors = CHAR.MOUNT_ANCHORS;
  const draw = (o: (typeof loaded)[number]) => {
    const { ctx, cv } = o;
    const script = MOUNT_SCRIPTS[o.m];
    const st = script[o.step];
    ctx.clearRect(0, 0, cv.width, cv.height);
    // ground: two grass tiles wide strip
    const gy = cv.height - 12;
    for (let x = -4; x < cv.width; x += TILE) drawTile(ctx, region, 'top1', x, gy);
    for (let x = -4; x < cv.width; x += TILE) drawTile(ctx, region, 'fill0', x, gy + TILE);
    const anim = CHAR.MOUNT_ANIMS[o.m][st.anim];
    const bare = frameAt(anim, reduced ? 0 : o.t);
    const arc = st.arc ? Math.sin(Math.min(1, o.t / st.min) * Math.PI) * st.arc : 0;
    const withRider = st.rider !== false;
    const name = withRider ? bare.replace('mount_', 'mountr_') : bare;
    const cx = Math.round(cv.width / 2);
    const f = drawBottomCenter(ctx, o.mount, o.mount.frames[name] ? name : bare, cx, gy - arc);
    if (f && withRider) {
      const a = anchors[name] ?? anchors[bare];
      if (a) {
        const mx = cx - f.w / 2;
        const my = gy - arc - f.h;
        const pose = a.rider === 'lean' ? 'hero/ride_lean' : a.rider === 'grip' ? 'hero/ride_grip' : 'hero/ride_sit';
        drawTopLeft(ctx, o.hero, pose, mx + a.seat[0] - RIDER_HIP[0], my + a.seat[1] - RIDER_HIP[1]);
      }
    }
    if (o.label.textContent !== st.label) o.label.textContent = st.label;
  };
  const advance = (o: (typeof loaded)[number]) => {
    const script = MOUNT_SCRIPTS[o.m];
    o.t++;
    if (o.t >= script[o.step].min) {
      o.step = (o.step + 1) % script.length;
      o.t = 0;
    }
  };
  loaded.forEach((o) => {
    // start each card on a calm pose
    o.step = 1;
    draw(o);
  });
  if (reduced) return;
  startLoop(
    () => loaded.some((o) => o.visible()),
    () => loaded.forEach((o) => o.visible() && advance(o)),
    () => loaded.forEach((o) => o.visible() && draw(o)),
  );
}

// ================================================================ enemies, pickups, effects

interface Mob {
  anim: string;
  x: number;
  y: number;
  dir: number;
  speed: number;
  lo: number;
  hi: number;
  fly?: boolean;
  t: number;
}

export async function initCreatures(): Promise<void> {
  const cv = $<HTMLCanvasElement>('creatures-canvas');
  const fxList = $('fx-list');
  if (!cv) return;
  const ctx = ctx2d(cv);
  const reduced = prefersReducedMotion();
  const [en, fx, region] = await Promise.all([loadEnemies(), loadFx(), loadRegion('meadow_sunset')]);
  const [layers] = await Promise.all([loadTodBackdrop('day')]);
  const W = cv.width;
  const H = cv.height;
  const gy = H - TILE;
  const mobs: Mob[] = [
    { anim: 'sprout_walk', x: 40, y: gy, dir: 1, speed: 0.35, lo: 18, hi: 100, t: 0 },
    { anim: 'zip_fly', x: 150, y: gy - 44, dir: -1, speed: 0.7, lo: 110, hi: 210, fly: true, t: 0 },
    { anim: 'shard_walk', x: 250, y: gy, dir: -1, speed: 0.3, lo: 200, hi: 290, t: 0 },
  ];
  let tick = 0;
  const shardPos = [64, 128, 192, 256];
  const render = () => {
    drawLayers(ctx, layers, 0, W, H, 0, 'back', { sunX: Math.round(W * 0.8 - SUN_CX.day) });
    for (let x = 0; x < W; x += TILE) {
      drawTile(ctx, region, `top${(x / TILE) % 6}`, x, gy);
    }
    // bound shards
    for (let i = 0; i < shardPos.length; i++) {
      const bob = Math.round(Math.sin((tick + i * 20) / 18) * 3);
      drawBottomCenter(ctx, fx, frameAt(CHAR.FX_ANIMS.shard_spin, Math.floor(tick / 2) + i * 6), shardPos[i], gy - 52 + bob);
    }
    for (const m of mobs) {
      const def = CHAR.ENEMY_ANIMS[m.anim];
      const bob = m.fly ? Math.round(Math.sin(tick / 14) * 5) : 0;
      // enemy frames face left: flip when heading right
      drawBottomCenter(ctx, en, frameAt(def, Math.floor(m.t)), m.x, m.y + bob + 1, m.dir > 0);
    }
  };
  const step = () => {
    tick++;
    for (const m of mobs) {
      m.x += m.dir * m.speed;
      m.t += 1;
      if (m.x < m.lo) m.dir = 1;
      if (m.x > m.hi) m.dir = -1;
    }
  };
  render();
  if (!reduced) {
    const vis = watchVisible(cv);
    startLoop(() => vis(), step, render);
  }

  // effects / pickups grid: each cell is a tiny canvas playing a real animation
  if (fxList) {
    const cells: { cv: HTMLCanvasElement; kind: 'fx' | 'pad'; key: string; loop: boolean }[] = [];
    const defs: [string, string, 'fx' | 'pad', string][] = [
      ['Bound Shard', 'Collectible. Placeholder name.', 'fx', 'shard_spin'],
      ['Bounce pad', 'Launches higher if you hold jump.', 'pad', 'bounce'],
      ['Stomp star', 'Lands on a stomp.', 'fx', 'stomp_star'],
      ['Bounce burst', 'Pad launch sparkle.', 'fx', 'bounce_burst'],
      ['Dust puff', 'Run, skid, land.', 'fx', 'dust'],
      ['Landing ring', 'Hard landings.', 'fx', 'land_ring'],
      ['Summon poof', 'For mount summons.', 'fx', 'poof'],
      ['Pickup orb', 'Art only; no use decided.', 'fx', 'orb'],
    ];
    fxList.innerHTML = defs
      .map(
        ([n, d], i) =>
          `<li><canvas width="32" height="32" data-fx="${i}" role="img" aria-label="${n} animation"></canvas><span><b>${n}</b>${d}</span></li>`,
      )
      .join('');
    fxList.querySelectorAll<HTMLCanvasElement>('canvas').forEach((c, i) => {
      cells.push({ cv: c, kind: defs[i][2], key: defs[i][3], loop: true });
    });
    const fv = watchVisible(fxList);
    const drawCells = (tt: number) => {
      for (const cell of cells) {
        const c = ctx2d(cell.cv);
        c.clearRect(0, 0, 32, 32);
        if (cell.kind === 'pad') {
          const seq = ['bounce0', 'bounce1', 'bounce2', 'bounce2', 'bounce1', 'bounce0', 'bounce0', 'bounce0'];
          drawTile(c, region, seq[Math.floor(tt / 5) % seq.length], 8, 12);
        } else {
          const a = CHAR.FX_ANIMS[cell.key];
          const total = a.ticks.reduce((x, y) => x + y, 0);
          const k = a.loop ? tt : tt % (total + 24); // one-shots pause briefly on the last frame, then replay
          drawBottomCenter(c, fx, frameAt(a, k), 16, 28);
        }
      }
    };
    drawCells(0);
    if (!reduced) {
      let tt = 0;
      startLoop(
        () => fv(),
        () => tt++,
        () => drawCells(tt),
      );
    }
  }
}

// ================================================================ time-of-day scene

export async function initTod(): Promise<void> {
  const cv = $<HTMLCanvasElement>('tod-canvas');
  if (!cv) return;
  const reduced = prefersReducedMotion();
  const ctx = ctx2d(cv);
  const region = await loadRegion('meadow_sunset');
  const sets = new Map<TodId, BgLayer[]>();
  const getSet = async (t: TodId): Promise<BgLayer[]> => {
    let s = sets.get(t);
    if (!s) {
      s = (await loadTodBackdrop(t)).map((l) => ({
        ...l,
        drift: l.name === 'clouds_a' ? 3 : l.name === 'clouds_b' ? 5 : 0,
      }));
      sets.set(t, s);
    }
    return s;
  };
  let tod: TodId = 'sunset';
  let layers = await getSet(tod);
  let tick = 0;
  let mouse = 0;
  let mouseS = 0;
  const W = cv.width;
  const H = cv.height;
  const gy = H - 2 * TILE;
  const ground = document.createElement('canvas');
  ground.width = W;
  ground.height = 2 * TILE;
  const g = ctx2d(ground);
  for (let c = 0; c * TILE < W; c++) {
    drawTile(g, region, `top${(c * 7 + 3) % 6}`, c * TILE, 0);
    drawTile(g, region, `fill${(c * 5 + 1) % 4}`, c * TILE, TILE);
  }
  const render = () => {
    const cam = mouseS * 40 + tick * 0.05;
    drawLayers(ctx, layers, cam, W, H, tick / 60, 'back', { sunX: Math.round(W * 0.7 - SUN_CX[tod]) });
    ctx.drawImage(ground, 0, gy);
  };
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-tod]'));
  buttons.forEach((b) =>
    b.addEventListener('click', async () => {
      const next = b.dataset.tod as TodId;
      buttons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      layers = await getSet(next);
      tod = next;
      cv.setAttribute('aria-label', `Time-of-day backdrop (${tod}): layered pixel-art mountains, hills, lake and clouds under a ${tod} sky.`);
      render();
    }),
  );
  cv.addEventListener(
    'pointermove',
    (e) => {
      const r = cv.getBoundingClientRect();
      mouse = ((e.clientX - r.left) / r.width) * 2 - 1;
    },
    { passive: true },
  );
  render();
  if (!reduced) {
    const vis = watchVisible(cv);
    startLoop(
      () => vis(),
      () => {
        tick++;
        mouseS += (mouse - mouseS) * 0.08;
      },
      render,
    );
  }
}

