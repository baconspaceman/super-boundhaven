// Time-of-day backdrops built from the Blender-rendered scenes (packages/art/assets/blender).
// One TodArt = one backdrop: a fixed id (dawn|day|sunset|night) or `cycle` (all four, crossfaded).
// Nearest-neighbour, integer-pixel layers like world-art.ts; animated decor + critters come from the
// pre-rendered sprite atlas. Built once, `update()` is allocation-free, `destroy()` frees every texture.
import { Assets, Container, Rectangle, Sprite, Texture, TilingSprite } from 'pixi.js';
import { SCREEN_W } from '@sbh/sim';
import {
  BLENDER_BACKGROUNDS,
  BLENDER_SPRITES,
  type BlenderLayer,
  type BlenderTod,
} from '../../../packages/art/src/blender/manifest';

export type TodId = BlenderTod | 'cycle';
export const TODS: BlenderTod[] = ['dawn', 'day', 'sunset', 'night'];
/** order for the `,` / `.` keys; null = region's own backgrounds */
export const TOD_ORDER: (TodId | null)[] = [null, 'dawn', 'day', 'sunset', 'night', 'cycle'];
export const isTod = (s: string | null | undefined): s is TodId => !!s && (s === 'cycle' || (TODS as string[]).includes(s));

const urlGlob = import.meta.glob('../../../packages/art/assets/blender/*.png', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const URLS: Record<string, string> = {};
for (const k in urlGlob) URLS[k.slice(k.lastIndexOf('/') + 1)] = urlGlob[k];

/** full cycle length (s) and how much of each quarter is a held scene before the crossfade starts */
export const CYCLE_SECONDS = 120;
const SEG = CYCLE_SECONDS / 4;
const HOLD = 0.6;
const PERIOD = 768; // tileable layer width = decor wrap period
/** the non-tiling sun frame may only shift this many px over the whole level (it is a fixed 256 frame) */
const SUN_SHIFT = 6;
const DRIFT: Record<string, number> = { clouds_a: 3, clouds_b: 5 };

/** Tile/prop tint (multiply) per scene, applied to the playfield so ground matches the sky. */
const TILE_TINT: Record<BlenderTod, [number, number, number]> = {
  dawn: [255, 236, 224],
  day: [255, 255, 255],
  sunset: [255, 205, 170], // on the meadow tileset (cycle mode)
  night: [140, 154, 205],
};
/** sunset with the dedicated `meadow_sunset` tileset is already warm: only a hint */
const SUNSET_NATIVE: [number, number, number] = [255, 240, 230];
/** far-plane decor tint: pulls Blender sprites toward the backdrop so tiles/players keep the contrast */
const PROP_TINT: Record<BlenderTod, number> = { dawn: 0xe4cfdc, day: 0xd4e0ee, sunset: 0xf0b8a0, night: 0x6c78b4 };

const rgb = (c: [number, number, number]) => (c[0] << 16) | (c[1] << 8) | c[2];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (a: [number, number, number], b: [number, number, number], t: number) =>
  rgb([Math.round(lerp(a[0], b[0], t)), Math.round(lerp(a[1], b[1], t)), Math.round(lerp(a[2], b[2], t))]);
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const mod = (a: number, n: number) => ((a % n) + n) % n;

/** Assets caches by URL, so an old and a new TodArt can share files: unload only when the last user lets go. */
const refs = new Map<string, number>();
const acquire = (u: string) => refs.set(u, (refs.get(u) ?? 0) + 1);
function release(u: string): void {
  const n = (refs.get(u) ?? 1) - 1;
  if (n > 0) refs.set(u, n);
  else {
    refs.delete(u);
    void Assets.unload(u);
  }
}

async function loadTex(url: string): Promise<Texture> {
  const t = await Assets.load<Texture>({ src: url, data: { scaleMode: 'nearest' } });
  t.source.scaleMode = 'nearest';
  t.source.autoGenerateMipmaps = false;
  return t;
}

interface LayerNode {
  layer: BlenderLayer;
  node: TilingSprite | Sprite;
}
type DecorKind = 'plane' | 'fly' | 'bird';
interface Decor {
  kind: DecorKind;
  sprite: Sprite;
  frames: Texture[];
  fps: number;
  phase: number;
  idx: number;
  ax: number; // anchor x
  ay: number; // anchor y
  w: number;
  baseX: number;
  baseY: number;
  parallax: number;
  period: number;
  speed: number; // birds: px/s
}
interface Stack {
  tod: BlenderTod;
  root: Container;
  layers: LayerNode[];
  decor: Decor[];
}

export class TodArt {
  readonly root = new Container();
  private stacks: Stack[] = [];
  private owned: Texture[] = [];
  private urls: string[] = [];
  private spriteBase!: Texture;
  private atlasTex: Record<string, Texture> = {};
  private maxCam: number;
  private offset = 0; // cycle: seconds added to now
  private frozen: number | null = null; // cycle: clock (quarters) held fixed
  private lastSeg = -1;
  private tint = 0xffffff;
  private a = 0;
  private b = 0;
  private f = 0;

  private constructor(
    readonly id: TodId,
    levelPx: number,
  ) {
    this.maxCam = Math.max(1, levelPx - SCREEN_W);
  }

  static async create(id: TodId, levelPx: number): Promise<TodArt> {
    const t = new TodArt(id, levelPx);
    try {
      await t.build();
    } catch (e) {
      t.destroy();
      throw e;
    }
    return t;
  }

  /** 0..4: 0 dawn, 1 day, 2 sunset, 3 night (cycle mode only; fixed scenes return their index). */
  get clock(): number {
    return this.cur;
  }
  private cur = 0;

  set clock(v: number) {
    this.offset = (mod(v, 4) * SEG) - performance.now() / 1000;
    if (this.frozen !== null) this.frozen = mod(v, 4);
  }

  /** hold the cycle at its current clock (screenshots/tests); false resumes. */
  setPaused(p: boolean): void {
    this.frozen = p ? this.cur : null;
    if (!p) this.offset = this.cur * SEG - performance.now() / 1000;
  }

  /** Multiply-tint for the tile/prop containers, given the active tileset. */
  tileTint(region: string): number {
    return region === 'meadow_sunset' && this.id === 'sunset' ? rgb(SUNSET_NATIVE) : this.tint;
  }

  private async build(): Promise<void> {
    const tods = this.id === 'cycle' ? TODS : [this.id as BlenderTod];
    const need = (name: string): string => {
      const u = URLS[name];
      if (!u) throw new Error(`missing blender asset ${name}`);
      this.urls.push(u);
      acquire(u);
      return u;
    };
    this.spriteBase = await loadTex(need(BLENDER_SPRITES.image));
    for (const k in BLENDER_SPRITES.atlas) {
      const f = BLENDER_SPRITES.atlas[k];
      const t = new Texture({ source: this.spriteBase.source, frame: new Rectangle(f.x, f.y, f.w, f.h) });
      this.owned.push(t);
      this.atlasTex[k] = t;
    }
    for (const tod of tods) {
      const defs = BLENDER_BACKGROUNDS[tod];
      const texs = await Promise.all(defs.map((d) => loadTex(need(d.file))));
      this.stacks.push(this.buildStack(tod, defs, texs));
    }
    if (this.id === 'cycle') {
      this.offset = 0; // starts at dawn
      for (const s of this.stacks) this.root.addChild(s.root);
    } else this.root.addChild(this.stacks[0].root);
  }

  private mkDecor(
    kind: DecorKind,
    name: string,
    baseX: number,
    baseY: number,
    parallax: number,
    phase = 0,
    period = PERIOD,
    speed = 0,
  ): Decor {
    const meta = BLENDER_SPRITES.sprites[name];
    const frames = meta.frames.map((f) => this.atlasTex[f]);
    return {
      kind,
      sprite: new Sprite(frames[0]),
      frames,
      fps: frames.length > 1 ? meta.fps : 0,
      phase,
      idx: 0,
      ax: meta.anchor[0],
      ay: meta.anchor[1],
      w: meta.size[0],
      baseX,
      baseY,
      parallax,
      period,
      speed,
    };
  }

  private buildStack(tod: BlenderTod, defs: BlenderLayer[], texs: Texture[]): Stack {
    const root = new Container();
    const stack: Stack = { tod, root, layers: [], decor: [] };
    const pt = PROP_TINT[tod];
    const place = (d: Decor, _kind?: DecorKind, glow = false): void => {
      d.sprite.tint = glow ? 0xffffff : pt; // lights stay lit
      root.addChild(d.sprite);
      stack.decor.push(d);
    };
    const day = tod === 'day' || tod === 'dawn';
    const lit = tod === 'sunset' || tod === 'night';
    // after-layer decor, in z order. (x,y) are in the 768-wide layer space; hill tops measured from the art.
    const after: Record<string, () => void> = {
      clouds_b: () => {
        if (tod === 'night') return;
        const flocks = tod === 'dawn' ? 1 : 2;
        for (let i = 0; i < flocks; i++) place(this.mkDecor('bird', 'bird_flock', i * 190, 46 + i * 24, 0.12, i * 2, 420, 6 + i * 2), 'bird');
      },
      ridges: () => place(this.mkDecor('plane', 'windmill', 456, 168, 0.5, 0), 'plane'),
      hills: () => {
        if (lit) {
          for (const [x, y, n] of [[144, 162, 'lantern'], [600, 178, 'lantern']] as const)
            place(this.mkDecor('plane', n, x, y, 0.5, x), 'plane', true);
        }
        if (day) {
          place(this.mkDecor('plane', 'flower_daisy', 72, 185, 0.5), 'plane');
          place(this.mkDecor('plane', 'flower_tulip', 288, 191, 0.5), 'plane');
          place(this.mkDecor('plane', 'flower_daisy', 624, 189, 0.5), 'plane');
        }
        if (tod !== 'night') {
          place(this.mkDecor('plane', 'bush', 120, 190, 0.5), 'plane');
          place(this.mkDecor('plane', 'bush', 648, 186, 0.5), 'plane');
        }
      },
      fore: () => {
        if (!day) return;
        const n = tod === 'dawn' ? 1 : 3;
        for (let i = 0; i < n; i++) place(this.mkDecor('fly', 'butterfly', 70 + i * 128, 118 + (i % 2) * 14, 0.8, i * 3, 512), 'fly');
      },
    };
    defs.forEach((layer, i) => {
      const tex = texs[i];
      const node: TilingSprite | Sprite = layer.tileX
        ? new TilingSprite({ texture: tex, width: SCREEN_W, height: layer.height })
        : new Sprite(tex);
      node.y = layer.y;
      root.addChild(node);
      stack.layers.push({ layer, node });
      after[layer.name]?.();
    });
    return stack;
  }

  /** Per-frame. camX integer; now in ms. No allocation. */
  update(camX: number, now: number): void {
    const sec = now / 1000;
    let a: Stack;
    let b: Stack | null = null;
    let f = 0;
    if (this.id === 'cycle') {
      const c = this.frozen ?? mod((sec + this.offset) / SEG, 4);
      this.cur = c;
      const seg = Math.floor(c) % 4;
      f = smooth((c - Math.floor(c) - HOLD) / (1 - HOLD));
      a = this.stacks[seg];
      b = f > 0 ? this.stacks[(seg + 1) % 4] : null;
      if (seg !== this.lastSeg) {
        this.lastSeg = seg;
        this.root.addChildAt(this.stacks[seg].root, 0);
        this.root.addChildAt(this.stacks[(seg + 1) % 4].root, 1);
        for (const s of this.stacks) s.root.visible = false;
        this.a = seg;
        this.b = (seg + 1) % 4;
      }
      for (const s of this.stacks) s.root.visible = false;
      a.root.visible = true;
      if (b) b.root.visible = true;
      this.f = f;
      const ta = TILE_TINT[TODS[this.a]];
      this.tint = mix(ta, TILE_TINT[TODS[this.b]], f);
    } else {
      a = this.stacks[0];
      this.cur = TODS.indexOf(a.tod);
      this.tint = rgb(TILE_TINT[a.tod]);
    }
    this.drawStack(a, camX, sec, 1);
    if (b) this.drawStack(b, camX, sec, f);
  }

  private drawStack(s: Stack, camX: number, sec: number, alpha: number): void {
    const sunK = Math.round((camX / this.maxCam) * SUN_SHIFT);
    for (const l of s.layers) {
      const n = l.node;
      n.alpha = alpha;
      if (l.layer.tileX) {
        const off = Math.floor(camX * l.layer.parallax + (DRIFT[l.layer.name] ?? 0) * sec);
        (n as TilingSprite).tilePosition.x = -off;
      } else n.x = l.layer.parallax > 0 ? -sunK : 0;
    }
    for (const d of s.decor) {
      const sp = d.sprite;
      sp.alpha = alpha;
      if (d.fps > 0) {
        const i = (Math.floor(sec * d.fps) + d.phase) % d.frames.length;
        if (i !== d.idx) {
          d.idx = i;
          sp.texture = d.frames[i];
        }
      }
      let x: number;
      let y = d.baseY;
      if (d.kind === 'bird') {
        x = mod(d.baseX + sec * d.speed - Math.floor(camX * d.parallax), d.period) - 90;
        y += Math.floor(3 * Math.sin(sec * 0.8 + d.phase));
      } else {
        const off = Math.floor(camX * d.parallax);
        x = mod(d.baseX - off, d.period);
        if (x > SCREEN_W + 64) x -= d.period;
        if (d.kind === 'fly') {
          x += Math.floor(20 * Math.sin(sec * 0.7 + d.phase * 1.7));
          y += Math.floor(9 * Math.sin(sec * 1.3 + d.phase));
        }
      }
      const px = Math.round(x - d.ax);
      sp.x = px;
      sp.y = Math.round(y - d.ay);
      sp.visible = px + d.w > 0 && px < SCREEN_W;
    }
  }

  get label(): string {
    return this.id === 'cycle' ? `cycle ${this.cur.toFixed(2)} (${TODS[Math.floor(this.cur) % 4]}->${TODS[(Math.floor(this.cur) + 1) % 4]})` : this.id;
  }

  destroy(): void {
    this.root.destroy({ children: true });
    for (const t of this.owned) t.destroy(false);
    for (const u of this.urls) release(u);
    this.urls.length = 0;
    this.owned.length = 0;
    this.stacks.length = 0;
  }
}
