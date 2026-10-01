// World art for the playfield: atlas tiles (baked into chunk textures), animated tiles, decor props
// and parallax backgrounds, all sourced from @sbh/art's exported PNG/JSON assets.
// Built once per region; `update()` is allocation-free. `destroy()` frees every texture it made.
import { Assets, Container, Rectangle, RenderTexture, Sprite, Texture, TilingSprite, type Renderer as PixiRenderer } from 'pixi.js';
import { SCREEN_W, TILE, type Level } from '@sbh/sim';
// Relative imports: the @sbh/art package.json `exports` map only exposes the package root.
import { autotile } from '../../../packages/art/src/world/autotile';
import { decorate } from '../../../packages/art/src/world/decor';

export type RegionId = 'meadow' | 'meadow_sunset' | 'caverns';
export const REGIONS: RegionId[] = ['meadow', 'meadow_sunset', 'caverns'];
export const isRegion = (s: string | null | undefined): s is RegionId => !!s && (REGIONS as string[]).includes(s);

interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface BgLayerDef {
  name: string;
  file: string;
  parallax: number;
  y: number;
  tileX: boolean;
  w: number;
  h: number;
  drift: number;
  z: 'back' | 'front';
}
interface PropDefJson {
  id: string;
  frames: string[];
  fps: number;
  anchor: { x: number; y: number };
  placement: 'ground' | 'ceiling' | 'water' | 'free';
  layer: 'back' | 'front';
}

// Vite-resolved asset URLs / JSON, keyed by file name.
const urlGlob = import.meta.glob('../../../packages/art/assets/world_*.png', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const jsonGlob = import.meta.glob('../../../packages/art/assets/world_*.json', { import: 'default', eager: true }) as Record<string, unknown>;
const byName = <T>(g: Record<string, T>): Record<string, T> => {
  const o: Record<string, T> = {};
  for (const k in g) o[k.slice(k.lastIndexOf('/') + 1)] = g[k];
  return o;
};
const URLS = byName(urlGlob);
const JSONS = byName(jsonGlob);

const CHUNK_COLS = 16;

/** Tiles the terrain tileset knows. One-way platforms, spikes and doors are drawn by WorldObjects instead. */
const TERRAIN = new Set(['#', 'B', '/', '\\']);

/** A level view containing only terrain tiles, so the autotiler/decorator never turn '-', '^' or 'D' into ground. */
export function terrainLevel(level: Level): Level {
  return { ...level, tiles: level.tiles.map((row) => Array.from(row, (ch) => (TERRAIN.has(ch) ? ch : '.')).join('')) };
}
/** bounce pad: [frame, duration ms] then rest (TILE_ANIMS.bounce @60Hz: compress 3t, release 5t, settle 3t) */
const BOUNCE_SEQ: [string, number][] = [
  ['bounce1', 50],
  ['bounce2', 84],
];

interface BgLayer {
  def: BgLayerDef;
  node: TilingSprite | Sprite;
}
interface PropInst {
  sprite: Sprite;
  frames: Texture[];
  fps: number;
  phase: number;
  idx: number;
  x0: number;
  x1: number;
}
interface Pad {
  col: number;
  top: number;
  sprite: Sprite;
  start: number; // ms, <0 = idle
  idle: boolean;
}

/** Assets caches by URL; re-requesting the active region must not unload files the old instance still shows. */
const refs = new Map<string, number>();
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

export class WorldArt {
  readonly bgBack = new Container();
  readonly bgFront = new Container();
  readonly worldBack = new Container();
  readonly worldFront = new Container();

  private urls: string[] = [];
  private owned: Texture[] = [];
  private bgs: BgLayer[] = [];
  private chunks: { sprite: Sprite; x0: number; x1: number }[] = [];
  private props: PropInst[] = [];
  private pads: Pad[] = [];
  private padByCol = new Map<number, Pad>();
  private bounceTex: Record<string, Texture> = {};
  private restTex!: Texture;

  private constructor(readonly region: RegionId) {}

  static async create(renderer: PixiRenderer, level: Level, region: RegionId): Promise<WorldArt> {
    const a = new WorldArt(region);
    await a.build(renderer, level);
    return a;
  }

  private sub(base: Texture, f: Frame): Texture {
    const t = new Texture({ source: base.source, frame: new Rectangle(f.x, f.y, f.w, f.h) });
    this.owned.push(t);
    return t;
  }

  private async build(renderer: PixiRenderer, level: Level): Promise<void> {
    const region = this.region;
    const need = (name: string): string => {
      const u = URLS[name];
      if (!u) throw new Error(`missing art asset ${name}`);
      this.urls.push(u);
      refs.set(u, (refs.get(u) ?? 0) + 1);
      return u;
    };

    // ---- load everything for this region ----
    const tilesJson = JSONS[`world_tiles_${region}.json`] as { tiles: Record<string, Frame> };
    const propsJson = JSONS[`world_props_${region}.json`] as { frames: Record<string, Frame>; props: PropDefJson[] };
    const bgDefs = (JSONS['world_bg_manifest.json'] as Record<string, BgLayerDef[]>)[region];
    const [tilesTex, propsTex, ...bgTex] = await Promise.all([
      loadTex(need(`world_tiles_${region}.png`)),
      loadTex(need(`world_props_${region}.png`)),
      ...bgDefs.map((d) => loadTex(need(d.file))),
    ]);

    // ---- parallax layers ----
    bgDefs.forEach((def, i) => {
      const tex = bgTex[i];
      const node: TilingSprite | Sprite = def.tileX
        ? new TilingSprite({ texture: tex, width: SCREEN_W, height: def.h })
        : new Sprite(tex);
      node.y = def.y;
      (def.z === 'front' ? this.bgFront : this.bgBack).addChild(node);
      this.bgs.push({ def, node });
    });

    // ---- tiles: bake 16-column chunks; animated tiles stay live sprites ----
    const terrain = terrainLevel(level);
    const grid = autotile(terrain);
    const atlas: Record<string, Texture> = {};
    for (const id in tilesJson.tiles) atlas[id] = this.sub(tilesTex, tilesJson.tiles[id]);
    for (const id of ['bounce0', 'bounce1', 'bounce2']) this.bounceTex[id] = atlas[id];
    this.restTex = atlas.bounce0;
    const H = level.height * TILE;
    for (let c0 = 0; c0 < level.width; c0 += CHUNK_COLS) {
      const c1 = Math.min(level.width, c0 + CHUNK_COLS);
      const tmp = new Container();
      for (let r = 0; r < level.height; r++)
        for (let c = c0; c < c1; c++) {
          const t = grid[r][c];
          if (!t) continue;
          if (t.anim === 'bounce') {
            const s = new Sprite(atlas.bounce0);
            s.position.set(c * TILE, r * TILE);
            const pad: Pad = { col: c, top: r * TILE, sprite: s, start: -1, idle: true };
            this.pads.push(pad);
            this.padByCol.set(c, pad);
            this.worldBack.addChild(s); // added after chunks below via ordering pass
            continue;
          }
          const s = new Sprite(atlas[t.id]);
          s.position.set((c - c0) * TILE, r * TILE);
          tmp.addChild(s);
        }
      const rt = RenderTexture.create({ width: (c1 - c0) * TILE, height: H, resolution: 1, scaleMode: 'nearest' });
      renderer.render({ container: tmp, target: rt, clear: true, clearColor: [0, 0, 0, 0] });
      tmp.destroy({ children: true });
      this.owned.push(rt);
      const cs = new Sprite(rt);
      cs.position.set(c0 * TILE, 0);
      this.chunks.push({ sprite: cs, x0: c0 * TILE, x1: c1 * TILE });
    }

    // ---- props ----
    const defs: Record<string, PropDefJson> = {};
    for (const d of propsJson.props) defs[d.id] = d;
    const ftex: Record<string, Texture> = {};
    const frameTex = (k: string) => (ftex[k] ??= this.sub(propsTex, propsJson.frames[k]));
    const back: PropInst[] = [];
    const frontWater: PropInst[] = [];
    const front: PropInst[] = [];
    for (const p of decorate(terrain, region)) {
      const d = defs[p.prop];
      if (!d) continue;
      const frames = d.frames.map(frameTex);
      const s = new Sprite(frames[0]);
      s.position.set(Math.round(p.x - d.anchor.x), Math.round(p.y - d.anchor.y));
      const inst: PropInst = {
        sprite: s,
        frames,
        fps: frames.length > 1 ? d.fps : 0,
        phase: p.phase,
        idx: 0,
        x0: s.x,
        x1: s.x + frames[0].width,
      };
      if (frames.length === 1 || d.fps === 0) s.texture = frames[p.phase % frames.length];
      (d.placement === 'water' ? frontWater : p.layer === 'front' ? front : back).push(inst);
    }
    // back props behind tiles; water then other front props in front of the playfield
    for (const i of back) this.worldBack.addChildAt(i.sprite, 0);
    for (const c of this.chunks) this.worldBack.addChild(c.sprite);
    for (const pad of this.pads) this.worldBack.addChild(pad.sprite); // pads above chunks
    for (const i of [...frontWater, ...front]) this.worldFront.addChild(i.sprite);
    this.props = [...back, ...frontWater, ...front];
  }

  /** Launch (or landing squash) animation on the pad in this column, if any. */
  bounce(col: number, now: number): void {
    const p = this.padByCol.get(col);
    if (p) {
      p.start = now;
      p.idle = false;
    }
  }

  /** Multiply-tint the playfield art (tiles, pads, props); players are not in these containers. */
  setTint(rgb: number): void {
    if (this.worldBack.tint !== rgb) this.worldBack.tint = rgb;
    if (this.worldFront.tint !== rgb) this.worldFront.tint = rgb;
  }

  /** Hide/show the region's own parallax layers (a time-of-day backdrop replaces them). */
  setBackdropVisible(v: boolean): void {
    this.bgBack.visible = v;
    this.bgFront.visible = v;
  }

  padTop(col: number): number | undefined {
    return this.padByCol.get(col)?.top;
  }

  /** Per-frame: parallax, culling, animation. camX is an integer; now in ms. No allocation. */
  update(camX: number, now: number): void {
    const sec = now / 1000;
    for (const b of this.bgs) {
      const off = Math.floor(camX * b.def.parallax + b.def.drift * sec);
      if (b.def.tileX) (b.node as TilingSprite).tilePosition.x = -off;
      else b.node.x = -off;
    }
    const l = camX - 32;
    const r = camX + SCREEN_W + 32;
    for (const c of this.chunks) c.sprite.visible = c.x1 > l && c.x0 < r;
    for (const p of this.props) {
      const vis = p.x1 > l && p.x0 < r;
      p.sprite.visible = vis;
      if (!vis || p.fps <= 0) continue;
      const i = (Math.floor(sec * p.fps) + p.phase) % p.frames.length;
      if (i !== p.idx) {
        p.idx = i;
        p.sprite.texture = p.frames[i];
      }
    }
    for (const pad of this.pads) {
      if (pad.idle) continue;
      const e = now - pad.start;
      let tex = this.restTex;
      if (e < BOUNCE_SEQ[0][1]) tex = this.bounceTex[BOUNCE_SEQ[0][0]];
      else if (e < BOUNCE_SEQ[0][1] + BOUNCE_SEQ[1][1]) tex = this.bounceTex[BOUNCE_SEQ[1][0]];
      else pad.idle = true;
      pad.sprite.texture = tex;
    }
  }

  destroy(): void {
    for (const c of [this.bgBack, this.bgFront, this.worldBack, this.worldFront]) c.destroy({ children: true });
    for (const t of this.owned) t.destroy(t instanceof RenderTexture);
    for (const u of this.urls) release(u);
    this.urls.length = 0;
    this.owned.length = 0;
  }
}
