// Real world art: tilesets, parallax backdrops (hand-pixeled regions + Blender time-of-day), props, and a
// scene renderer that draws a @sbh/sim level with real tiles and real humanoid sprites.
// Tile choice (autotile) and prop scatter (decorate) are the SAME pure functions the game client uses.
import { TILE, type Level, type PlayerState } from '@sbh/sim';
import { autotile } from '../../../packages/art/src/world/autotile';
import { decorate } from '../../../packages/art/src/world/decor';
import {
  PoseClock,
  assetJson,
  ctx2d,
  drawBottomCenter,
  heroAnimFor,
  loadHeroSheet,
  loadImage,
  makeCanvas,
  type Atlas,
  type Ctx,
  type Rect,
} from './assets';

export type RegionId = 'meadow' | 'meadow_sunset' | 'caverns';
export type TodId = 'dawn' | 'day' | 'sunset' | 'night';
/** x of the sun/moon centre inside each backdrop's 256px sun layer. */
export const SUN_CX: Record<TodId, number> = { dawn: 185, day: 190, sunset: 75, night: 190 };

export interface BgLayer {
  name: string;
  file: string;
  parallax: number;
  y: number;
  tileX: boolean;
  w: number;
  h: number;
  drift: number;
  z: 'back' | 'front';
  img: HTMLImageElement;
}

interface RawLayer {
  name: string;
  file: string;
  parallax: number;
  y: number;
  tileX: boolean;
  w?: number;
  h?: number;
  width?: number;
  height?: number;
  drift?: number;
  z?: 'back' | 'front';
}

async function toLayers(raw: RawLayer[]): Promise<BgLayer[]> {
  return Promise.all(
    raw.map(async (l) => {
      const img = await loadImage(l.file);
      return {
        name: l.name,
        file: l.file,
        parallax: l.parallax,
        y: l.y,
        tileX: l.tileX,
        w: l.w ?? l.width ?? img.width,
        h: l.h ?? l.height ?? img.height,
        drift: l.drift ?? 0,
        z: l.z ?? 'back',
        img,
      };
    }),
  );
}

export const loadRegionBackdrop = (r: RegionId): Promise<BgLayer[]> =>
  toLayers(assetJson<Record<string, RawLayer[]>>('world_bg_manifest.json')[r]);
export const loadTodBackdrop = (t: TodId): Promise<BgLayer[]> =>
  toLayers(assetJson<Record<string, RawLayer[]>>('bg_manifest.json')[t]);

const sunCache = new WeakMap<HTMLImageElement, HTMLCanvasElement>();
function fadedSun(l: BgLayer): HTMLCanvasElement {
  let cv = sunCache.get(l.img);
  if (cv) return cv;
  cv = makeCanvas(l.w, l.h);
  const c = ctx2d(cv);
  c.drawImage(l.img, 0, 0);
  const g = c.createLinearGradient(0, 0, l.w, 0);
  const f = 44 / l.w;
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(f, 'rgba(0,0,0,1)');
  g.addColorStop(1 - f, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.globalCompositeOperation = 'destination-in';
  c.fillStyle = g;
  c.fillRect(0, 0, l.w, l.h);
  sunCache.set(l.img, cv);
  return cv;
}

/**
 * Draw backdrop layers. camX in world px, `bottom` = canvas y where the 224px-tall art space ends
 * (so a taller/shorter canvas stays anchored to the ground), t = seconds (cloud drift).
 */
export function drawLayers(
  c: Ctx,
  layers: BgLayer[],
  camX: number,
  viewW: number,
  bottom: number,
  t: number,
  z: 'back' | 'front' | 'all' = 'back',
  opts: { sunX?: number } = {},
): void {
  const top = bottom - 224;
  for (const l of layers) {
    if (z !== 'all' && l.z !== z) continue;
    const y = top + l.y;
    if (l.name === 'sun' && !l.tileX) {
      // single sun/moon sprite (edges faded so rays do not end in a hard line on wide canvases)
      const sx = Math.round(opts.sunX ?? 0);
      c.drawImage(opts.sunX === undefined ? l.img : fadedSun(l), sx, y);
      continue;
    }
    if (l.name === 'sky') {
      // sky has a horizontal light gradient: alternate mirrored tiles so wide canvases stay seamless.
      // Anchored at sunX so the sky's lit side stays under the sun sprite.
      const ax = Math.round(opts.sunX ?? 0);
      const k0 = Math.floor((0 - ax) / l.w);
      for (let k = k0; ax + k * l.w < viewW; k++) {
        const x = ax + k * l.w;
        const flip = ((k % 2) + 2) % 2 === 1;
        c.save();
        if (flip) {
          c.translate(x + l.w, 0);
          c.scale(-1, 1);
        } else c.translate(x, 0);
        if (top > 0) c.drawImage(l.img, 0, 0, l.w, 1, 0, 0, l.w, top + 1);
        c.drawImage(l.img, 0, top);
        c.restore();
      }
      continue;
    }
    if (l.tileX) {
      const off = (((camX * l.parallax + l.drift * t) % l.w) + l.w) % l.w;
      for (let x = -off; x < viewW; x += l.w) c.drawImage(l.img, Math.round(x), y);
    } else {
      c.drawImage(l.img, Math.round(-camX * l.parallax), y);
    }
  }
}

// ---------------------------------------------------------------- tilesets / props

interface TilesJson {
  tiles: Record<string, Rect>;
}
interface PropsJson {
  frames: Record<string, Rect>;
  props: { id: string; frames: string[]; fps: number; anchor: { x: number; y: number } }[];
}

export interface RegionArt {
  region: RegionId;
  tilesImg: HTMLImageElement;
  tiles: Record<string, Rect>;
  propsImg: HTMLImageElement;
  props: PropsJson;
  layers: BgLayer[];
}

const regionCache = new Map<RegionId, Promise<RegionArt>>();
export function loadRegion(region: RegionId): Promise<RegionArt> {
  let p = regionCache.get(region);
  if (!p) {
    p = (async () => {
      const [tilesImg, propsImg, layers] = await Promise.all([
        loadImage(`world_tiles_${region}.png`),
        loadImage(`world_props_${region}.png`),
        loadRegionBackdrop(region),
      ]);
      return {
        region,
        tilesImg,
        tiles: assetJson<TilesJson>(`world_tiles_${region}.json`).tiles,
        propsImg,
        props: assetJson<PropsJson>(`world_props_${region}.json`),
        layers,
      };
    })();
    regionCache.set(region, p);
  }
  return p;
}

export function drawTile(c: Ctx, art: RegionArt, id: string, x: number, y: number): void {
  const f = art.tiles[id];
  if (f) c.drawImage(art.tilesImg, f.x, f.y, f.w, f.h, x, y, f.w, f.h);
}

// ---------------------------------------------------------------- scene

export const VIEW_W = 320;
export const VIEW_H = 224;

/** Which sample look each sim player id wears in the reel (all distinct, diverse). */
export const REEL_LOOKS = [0, 3, 4, 1, 5, 6, 7, 8, 9, 10, 11, 2];
export const lookIndexFor = (id: number): number => REEL_LOOKS[(id - 1 + REEL_LOOKS.length) % REEL_LOOKS.length];

interface PlacedProp {
  frames: string[];
  fps: number;
  x: number;
  y: number;
  front: boolean;
  phase: number;
}

export class SceneRenderer {
  readonly levelW: number;
  readonly levelH: number;
  private tilesCv: HTMLCanvasElement;
  private pads: { col: number; top: number }[] = [];
  private padStart = new Map<number, number>();
  private props: PlacedProp[] = [];
  private clocks = new Map<number, PoseClock>();
  private sheets: Atlas[] = [];

  static async create(level: Level, region: RegionId = 'meadow_sunset'): Promise<SceneRenderer> {
    const art = await loadRegion(region);
    const sheets = await Promise.all(LOOK_SHEETS_NEEDED.map((i) => loadHeroSheet(i)));
    return new SceneRenderer(level, art, sheets);
  }

  private constructor(
    private level: Level,
    private art: RegionArt,
    sheets: Atlas[],
  ) {
    this.levelW = level.width * TILE;
    this.levelH = level.height * TILE;
    LOOK_SHEETS_NEEDED.forEach((idx, i) => (this.sheets[idx] = sheets[i]));
    this.tilesCv = makeCanvas(this.levelW, this.levelH);
    const c = ctx2d(this.tilesCv);
    const grid = autotile(level);
    for (let r = 0; r < level.height; r++)
      for (let col = 0; col < level.width; col++) {
        const t = grid[r][col];
        if (!t) continue;
        if (t.anim === 'bounce') {
          this.pads.push({ col, top: r * TILE });
          continue;
        }
        drawTile(c, art, t.id, col * TILE, r * TILE);
      }
    const defs = new Map(art.props.props.map((d) => [d.id, d]));
    for (const p of decorate(level, art.region)) {
      const d = defs.get(p.prop);
      if (!d) continue;
      this.props.push({
        frames: d.frames,
        fps: d.fps,
        x: Math.round(p.x - d.anchor.x),
        y: Math.round(p.y - d.anchor.y),
        front: p.layer === 'front',
        phase: p.phase,
      });
    }
  }

  private drawProps(c: Ctx, camX: number, front: boolean, t: number): void {
    for (const p of this.props) {
      if (p.front !== front) continue;
      const idx = p.frames.length > 1 && p.fps > 0 ? (Math.floor(t * p.fps) + p.phase) % p.frames.length : p.phase % p.frames.length;
      const f = this.art.props.frames[p.frames[idx]];
      if (!f) continue;
      const x = p.x - camX;
      if (x > VIEW_W || x + f.w < 0) continue;
      c.drawImage(this.art.propsImg, f.x, f.y, f.w, f.h, x, p.y, f.w, f.h);
    }
  }

  private drawPlayer(c: Ctx, p: PlayerState, camX: number): void {
    let clock = this.clocks.get(p.id);
    if (!clock) this.clocks.set(p.id, (clock = new PoseClock()));
    clock.update(heroAnimFor(p), Math.abs(p.vx));
    const sheet = this.sheets[lookIndexFor(p.id)];
    const x = Math.round(p.x) - camX;
    const y = Math.round(p.y);
    // soft contact shadow
    c.fillStyle = 'rgba(30,10,50,0.28)';
    c.fillRect(x - 6, y - 1, 12, 2);
    drawBottomCenter(c, sheet, clock.frame(), x, y, p.facing < 0);
  }

  /** Draw the world. camX is the integer world-pixel offset of the view's left edge. */
  draw(c: Ctx, camX: number, players: PlayerState[], tick: number, t: number): void {
    c.imageSmoothingEnabled = false;
    drawLayers(c, this.art.layers, camX, VIEW_W, VIEW_H, t, 'back');
    this.drawProps(c, camX, false, t);
    c.drawImage(this.tilesCv, camX, 0, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);
    for (const pad of this.pads) {
      const x = pad.col * TILE - camX;
      if (x < -TILE || x > VIEW_W) continue;
      const s = this.padStart.get(pad.col);
      let id = 'bounce0';
      if (s !== undefined) {
        const dt = tick - s;
        if (dt < 3) id = 'bounce1';
        else if (dt < 8) id = 'bounce2';
        else if (dt < 11) id = 'bounce1';
      }
      drawTile(c, this.art, id, x, pad.top);
    }
    for (const p of players) {
      if (p.vy < -7.5) {
        const col = Math.floor(p.x / TILE);
        if (this.pads.some((pp) => pp.col === col) && !this.padStart.has(col)) this.padStart.set(col, tick);
      }
    }
    for (const [col, s] of this.padStart) if (tick - s > 20) this.padStart.delete(col);
    for (const p of players) this.drawPlayer(c, p, camX);
    this.drawProps(c, camX, true, t);
    drawLayers(c, this.art.layers, camX, VIEW_W, VIEW_H, t, 'front');
  }

  /** Reset per-clip state (animation clocks, pad flashes). */
  reset(): void {
    this.clocks.clear();
    this.padStart.clear();
  }
}

const LOOK_SHEETS_NEEDED = [...new Set(REEL_LOOKS.slice(0, 4))];
