// Object atlas for gameplay objects (`obj/...` frames from @sbh/art world_objects_<region>.png/.json) with a clean
// primitive fallback for every frame the art does not provide (or while the atlas does not exist yet).
import { Assets, Rectangle, Texture } from 'pixi.js';
import { parseFrames, type AtlasFrame as Frame } from './atlas-json';
import type { RegionId } from './world-art';

export { parseFrames };


// Optional: the atlas files may not exist yet; the glob simply matches nothing then.
const urlGlob = import.meta.glob('../../../packages/art/assets/world_objects_*.png', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const jsonGlob = import.meta.glob('../../../packages/art/assets/world_objects_*.json', { import: 'default', eager: true }) as Record<string, unknown>;
const byName = <T>(g: Record<string, T>): Record<string, T> => {
  const o: Record<string, T> = {};
  for (const k in g) o[k.slice(k.lastIndexOf('/') + 1)] = g[k];
  return o;
};
const URLS = byName(urlGlob);
/** Assets caches by URL: an old instance must not unload a file a newer one (same region) still shows. */
const refs = new Map<string, number>();
const JSONS = byName(jsonGlob);

// ---- primitive fallbacks ---------------------------------------------------------------------------
const INK = '#2b2350';

function canvasTex(w: number, h: number, paint: (g: CanvasRenderingContext2D) => void): Texture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  paint(g);
  const t = Texture.from(c);
  t.source.scaleMode = 'nearest';
  return t;
}

const rect = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string): void => {
  g.fillStyle = col;
  g.fillRect(x, y, w, h);
};

function paintFallback(name: string): Texture {
  const base = name.replace(/^obj\//, '');
  const m = /^(.*?)(?:_(\d+))?$/.exec(base)!;
  const stem = m[1];
  const idx = m[2] === undefined ? 0 : Number(m[2]);
  switch (stem) {
    case 'oneway_l':
    case 'oneway_m':
    case 'oneway_r':
      return canvasTex(16, 16, (g) => {
        const l = stem === 'oneway_l' ? 1 : 0;
        const r = stem === 'oneway_r' ? 1 : 0;
        rect(g, l, 0, 16 - l - r, 6, INK);
        rect(g, l, 1, 16 - l - r, 3, '#f2c94c');
        rect(g, l, 4, 16 - l - r, 1, '#b8862e');
        rect(g, l ? 1 : 0, 1, 1, 4, l ? '#f2c94c' : '#f2c94c');
        rect(g, 2, 6, 2, 3, INK);
        rect(g, 12, 6, 2, 3, INK);
      });
    case 'spike':
      return canvasTex(16, 16, (g) => {
        for (const x0 of [1, 8]) {
          g.fillStyle = INK;
          g.beginPath();
          g.moveTo(x0, 16);
          g.lineTo(x0 + 3.5, 5);
          g.lineTo(x0 + 7, 16);
          g.fill();
          g.fillStyle = '#d7def2';
          g.beginPath();
          g.moveTo(x0 + 1.5, 16);
          g.lineTo(x0 + 3.5, 8);
          g.lineTo(x0 + 5.5, 16);
          g.fill();
        }
        rect(g, 0, 14, 16, 2, INK);
      });
    case 'door_cap':
    case 'door_mid':
    case 'door_base':
      return canvasTex(16, 16, (g) => {
        rect(g, 2, 0, 12, 16, INK);
        rect(g, 3, 0, 10, 16, '#7a5cc7');
        rect(g, 3, 0, 3, 16, '#9d84e8');
        rect(g, 10, 0, 3, 16, '#5a3fa0');
        if (stem === 'door_cap') {
          rect(g, 1, 0, 14, 4, INK);
          rect(g, 2, 1, 12, 2, '#b9a6f0');
        }
        if (stem === 'door_base') {
          rect(g, 1, 12, 14, 4, INK);
          rect(g, 2, 13, 12, 2, '#5a3fa0');
        }
        if (stem === 'door_mid') rect(g, 6, 7, 4, 2, '#f2c94c');
      });
    case 'door_open_cap':
      return canvasTex(16, 16, (g) => {
        g.globalAlpha = 0.55;
        rect(g, 1, 0, 14, 3, INK);
        rect(g, 2, 1, 12, 1, '#b9a6f0');
        rect(g, 2, 3, 1, 13, '#9d84e8');
        rect(g, 13, 3, 1, 13, '#9d84e8');
      });
    case 'door_open':
      return canvasTex(16, 16, (g) => {
        g.globalAlpha = 0.4;
        rect(g, 2, 0, 1, 16, '#9d84e8');
        rect(g, 13, 0, 1, 16, '#9d84e8');
        g.globalAlpha = 0.85;
        rect(g, 4 + (idx % 2) * 6, (idx * 5) % 14, 2, 2, '#f6f3ff');
        rect(g, 9 - (idx % 2) * 3, (idx * 5 + 7) % 14, 2, 2, '#b9a6f0');
      });
    case 'plate_up':
    case 'plate_down': {
      const up = stem === 'plate_up';
      return canvasTex(16, 16, (g) => {
        rect(g, 1, 14, 14, 2, INK);
        rect(g, 2, up ? 10 : 12, 12, up ? 4 : 2, INK);
        rect(g, 3, up ? 11 : 12, 10, up ? 3 : 1, up ? '#f2c94c' : '#6cc04a');
        if (up) rect(g, 3, 11, 10, 1, '#fff2a8');
      });
    }
    case 'plate_glow':
      return canvasTex(16, 16, (g) => {
        g.globalAlpha = idx % 2 ? 0.5 : 0.8;
        rect(g, 2, 8, 12, 2, '#fff2a8');
        g.globalAlpha = idx % 2 ? 0.25 : 0.4;
        rect(g, 4, 4, 8, 4, '#fff2a8');
      });
    case 'lever_off':
    case 'lever_on':
    case 'lever_reset':
    case 'lever_timer': {
      return canvasTex(16, 16, (g) => {
        rect(g, 3, 12, 10, 4, INK);
        rect(g, 4, 13, 8, 2, '#7a5cc7');
        const dir = stem === 'lever_off' ? -1 : stem === 'lever_reset' ? 0 : 1;
        const knob = stem === 'lever_reset' ? '#ff9f43' : dir < 0 ? '#e0443e' : '#6cc04a';
        g.strokeStyle = INK;
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(8, 13);
        g.lineTo(8 + dir * 4, 5);
        g.stroke();
        rect(g, 8 + dir * 4 - 2, 3, 4, 4, INK);
        rect(g, 8 + dir * 4 - 1, 4, 2, 2, knob);
        if (stem === 'lever_timer') {
          // shrinking ring segments: idx 0 = full ... 5 = nearly gone
          const left = 1 - idx / 6;
          g.strokeStyle = '#ffd84a';
          g.lineWidth = 1;
          g.beginPath();
          g.arc(8, 6, 7.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
          g.stroke();
        }
        if (stem === 'lever_reset') rect(g, 7, 7, 2, 1, INK);
      });
    }
    case 'flag_idle':
    case 'flag_active': {
      const active = stem === 'flag_active';
      return canvasTex(16, 32, (g) => {
        rect(g, 7, 4, 2, 28, INK);
        rect(g, 8, 4, 1, 28, '#e8e2f8');
        rect(g, 4, 29, 8, 3, INK);
        const wave = idx % 2;
        g.fillStyle = INK;
        g.beginPath();
        g.moveTo(9, 3);
        g.lineTo(15, 7 + wave);
        g.lineTo(9, 13);
        g.fill();
        g.fillStyle = active ? '#ffd84a' : '#8f8aaa';
        g.beginPath();
        g.moveTo(9, 5);
        g.lineTo(13, 8 + wave);
        g.lineTo(9, 11);
        g.fill();
      });
    }
    case 'shard_pickup':
    case 'shard_get':
      return canvasTex(14, 15, (g) => {
        rect(g, 4, 3, 6, 9, INK);
        rect(g, 5, 4, 4, 7, '#3bc9d6');
      });
    default:
      return canvasTex(4, 4, (g) => rect(g, 0, 0, 4, 4, '#ff00ff'));
  }
}

export class ObjectAtlas {
  /** True when a real atlas image was loaded. */
  real = false;
  private frames: Record<string, Frame> = {};
  private base: Texture | null = null;
  private url = '';
  private tex = new Map<string, Texture>();
  private subs: Texture[] = [];
  private canvases: Texture[] = [];

  static async load(region: RegionId): Promise<ObjectAtlas> {
    const a = new ObjectAtlas();
    const url = URLS[`world_objects_${region}.png`];
    const json = JSONS[`world_objects_${region}.json`];
    if (url && json) {
      try {
        const t = await Assets.load<Texture>({ src: url, data: { scaleMode: 'nearest' } });
        t.source.scaleMode = 'nearest';
        t.source.autoGenerateMipmaps = false;
        a.base = t;
        a.url = url;
        refs.set(url, (refs.get(url) ?? 0) + 1);
        a.frames = parseFrames(json);
        a.real = Object.keys(a.frames).length > 0;
      } catch {
        a.real = false;
      }
    }
    return a;
  }

  private key(name: string): string | undefined {
    if (name in this.frames) return name;
    const bare = name.replace(/^obj\//, '');
    if (bare in this.frames) return bare;
    if (`obj/${bare}` in this.frames) return `obj/${bare}`;
    return undefined;
  }

  /** True when the real atlas has this frame. */
  has(name: string): boolean {
    return this.base !== null && this.key(name) !== undefined;
  }

  /** The frame texture, or a primitive fallback. */
  get(name: string): Texture {
    let t = this.tex.get(name);
    if (t) return t;
    const k = this.base ? this.key(name) : undefined;
    if (k && this.base) {
      const f = this.frames[k];
      t = new Texture({ source: this.base.source, frame: new Rectangle(f.x, f.y, f.w, f.h) });
      this.subs.push(t);
    } else {
      t = paintFallback(name);
      this.canvases.push(t);
    }
    this.tex.set(name, t);
    return t;
  }

  /** Frames `${prefix}0..n-1` that exist in the art (stops at the first gap); fallback frames otherwise. */
  seq(prefix: string, n: number, fallback?: () => Texture[]): Texture[] {
    const real: Texture[] = [];
    for (let i = 0; i < n; i++) {
      if (this.has(`${prefix}${i}`)) real.push(this.get(`${prefix}${i}`));
      else break;
    }
    if (real.length) return real;
    if (fallback) return fallback();
    const count = prefix.includes('timer') ? n : 2;
    const out: Texture[] = [];
    for (let i = 0; i < count; i++) out.push(this.get(`${prefix}${i}`));
    return out;
  }

  destroy(): void {
    for (const t of this.subs) t.destroy(false);
    for (const t of this.canvases) t.destroy(true);
    this.subs.length = 0;
    this.canvases.length = 0;
    this.tex.clear();
    if (this.url) {
      const n = (refs.get(this.url) ?? 1) - 1;
      if (n > 0) refs.set(this.url, n);
      else {
        refs.delete(this.url);
        void Assets.unload(this.url);
      }
      this.url = '';
    }
    this.base = null;
  }
}
