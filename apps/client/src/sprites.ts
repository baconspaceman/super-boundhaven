// Pixi-side sprite services: per-look texture sets (ref-counted LRU), FX sprites, name labels, shadow.
import { Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { FONT_5X7, FX_ANIMS, buildFxFrames, drawText, packSheet, type Bitmap } from './art';
import { bitmapToCanvas, getLookSheet } from './look-sheet';
import { TICK_MS } from './motion';

const MAX_LOOKS = 64;

function nearest(canvas: HTMLCanvasElement): Texture {
  const t = Texture.from(canvas);
  t.source.scaleMode = 'nearest';
  return t;
}

export interface LookTextures {
  code: string;
  frames: Record<string, Texture>; // by hero frame name, e.g. 'hero/run_3'
  refs: number;
  base: Texture;
}

/** Texture sets per look code. Sets in use (refs > 0) are never evicted; idle ones are LRU-bounded. */
export class LookLibrary {
  private sets = new Map<string, LookTextures>(); // insertion order = LRU order

  acquire(code: string): LookTextures {
    let e = this.sets.get(code);
    if (e) {
      this.sets.delete(code); // refresh LRU position
    } else {
      const sheet = getLookSheet(code);
      const base = nearest(sheet.canvas);
      const frames: Record<string, Texture> = {};
      for (const [name, a] of Object.entries(sheet.atlas)) {
        frames[name] = new Texture({ source: base.source, frame: new Rectangle(a.x, a.y, a.w, a.h) });
      }
      e = { code, frames, refs: 0, base };
    }
    this.sets.set(code, e);
    e.refs++;
    this.evict();
    return e;
  }

  release(code: string): void {
    const e = this.sets.get(code);
    if (e && e.refs > 0) e.refs--;
    this.evict();
  }

  get size(): number {
    return this.sets.size;
  }

  private evict(): void {
    if (this.sets.size <= MAX_LOOKS) return;
    for (const [code, e] of [...this.sets]) {
      if (this.sets.size <= MAX_LOOKS) break;
      if (e.refs > 0) continue;
      this.destroyEntry(e);
      this.sets.delete(code);
    }
  }

  private destroyEntry(e: LookTextures): void {
    for (const t of Object.values(e.frames)) t.destroy(false);
    e.base.destroy(true);
  }

  destroy(): void {
    for (const e of this.sets.values()) this.destroyEntry(e);
    this.sets.clear();
  }
}

// ---- name labels -------------------------------------------------------------------------------
export interface Label {
  tex: Texture;
  w: number;
  h: number;
}
/** Pixel-font name tag (from @sbh/art's FONT_5X7) baked into a nearest-neighbour texture. */
export function makeLabel(text: string, color: string): Label {
  const b = drawText(text || '?', FONT_5X7, { color, outline: '#2b2350' });
  return { tex: nearest(bitmapToCanvas(b)), w: b.w, h: b.h };
}

// ---- tiny generated bitmaps ----------------------------------------------------------------------
type RGBA = [number, number, number, number];
function bitmapFromRows(rows: string[], colors: Record<string, RGBA>): Bitmap {
  const h = rows.length;
  const w = rows[0].length;
  const data = new Uint8ClampedArray(w * h * 4);
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const c = colors[ch];
      if (c) data.set(c, (y * w + x) * 4);
    }),
  );
  return { w, h, data };
}

/** Pixel-art blob shadow (translucent ellipse, deep-violet ink so it matches the world palette). */
export function makeShadowTexture(): Texture {
  return nearest(
    bitmapToCanvas(
      bitmapFromRows(['...ddddddd...', '.ddddddddddd.', 'ddddddddddddd', '.ddddddddddd.', '...ddddddd...'], {
        d: [43, 35, 80, 110],
      }),
    ),
  );
}

/** Down-pointing "this is you" marker. */
export function makeArrowTexture(): Texture {
  return nearest(
    bitmapToCanvas(
      bitmapFromRows(['pppppppp', '.pyyyyp.', '..pyyp..', '...pp...'], {
        p: [43, 35, 80, 255],
        y: [255, 216, 74, 255],
      }),
    ),
  );
}

// ---- effects -------------------------------------------------------------------------------------
interface FxItem {
  sprite: Sprite;
  anim: string;
  t: number;
}

/** Pooled one-shot effect sprites from FX_ANIMS. `container` lives in world space. */
export class FxLayer {
  readonly container = new Container();
  private tex: Record<string, Texture> = {};
  private base: Texture;
  private pool: FxItem[] = [];
  private active: FxItem[] = [];

  constructor() {
    const { sheet, atlas } = packSheet(buildFxFrames(), 256, 1);
    this.base = nearest(bitmapToCanvas(sheet));
    for (const [n, a] of Object.entries(atlas)) {
      this.tex[n] = new Texture({ source: this.base.source, frame: new Rectangle(a.x, a.y, a.w, a.h) });
    }
  }

  /** The frame textures of an FX animation (shared with fallbacks for object art). */
  framesOf(anim: string): Texture[] {
    const d = FX_ANIMS[anim];
    return d ? d.frames.map((n) => this.tex[n]) : [];
  }

  /** Spawn at world (x, y). Anchor is bottom-center when `ground`, else centered. */
  spawn(anim: string, x: number, y: number, opts: { ground?: boolean; flipX?: boolean } = {}): void {
    const def = FX_ANIMS[anim];
    if (!def) return;
    let it = this.pool.pop();
    if (!it) {
      const sprite = new Sprite();
      this.container.addChild(sprite);
      it = { sprite, anim, t: 0 };
    }
    it.anim = anim;
    it.t = 0;
    it.sprite.visible = true;
    it.sprite.anchor.set(0.5, opts.ground ? 1 : 0.5);
    it.sprite.scale.x = opts.flipX ? -1 : 1;
    it.sprite.position.set(Math.round(x), Math.round(y));
    it.sprite.texture = this.tex[def.frames[0]];
    this.active.push(it);
  }

  update(dtMs: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const it = this.active[i];
      const def = FX_ANIMS[it.anim];
      it.t += dtMs;
      let t = it.t;
      let frame = -1;
      for (let f = 0; f < def.ticks.length; f++) {
        t -= def.ticks[f] * TICK_MS;
        if (t < 0) {
          frame = f;
          break;
        }
      }
      if (frame < 0) {
        it.sprite.visible = false;
        this.active.splice(i, 1);
        this.pool.push(it);
      } else it.sprite.texture = this.tex[def.frames[frame]];
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
    for (const t of Object.values(this.tex)) t.destroy(false);
    this.base.destroy(true);
  }
}
