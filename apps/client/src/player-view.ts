// In-game player as a layered-humanoid sprite: anim state machine -> texture, flip by facing, shadow,
// pixel-font name tag, "you" marker, run/land/skid dust. Anchor = bottom-center of the 24x32 frame on the
// sim feet position (frame pixel row 31 is the ground row; verified against the composed bitmaps).
import { Container, Sprite, type Texture } from 'pixi.js';
import { HERO_ANIMS, HERO_H } from './art';
import type { Drawable } from './game';
import { Motion, type MotionEvent } from './motion';
import { makeLabel, type FxLayer, type Label, type LookLibrary, type LookTextures } from './sprites';

/** One on-screen player. Swap `makePlayerView` (render.ts) to plug in another renderer. */
export interface PlayerView {
  root: Container;
  /** motion events produced by the last update() (land, launch, skid...); cleared each update */
  events: MotionEvent[];
  /** called every frame after root.x/y (feet position) are set */
  update(d: Drawable, now: number): void;
  /** this player just stomped someone (show the spin) */
  markStomp(): void;
  /** this player was stomped */
  markHurt(): void;
  /** release textures and remove from the scene */
  destroy(): void;
}

export interface ViewCtx {
  looks: LookLibrary;
  fx: FxLayer;
  shadowTex: Texture;
  arrowTex: Texture;
  /** feet-y of the first floor below (x, y) or null; used to place the blob shadow */
  groundY(x: number, y: number): number | null;
}

const LABEL_GAP = 2; // px between the head top and the name tag
const HEAD_TOP = 1; // first opaque sprite row; the tag sits above it
const NAME_COLOR = '#f6f3ff';
const SELF_COLOR = '#ffd84a';

export class SpritePlayerView implements PlayerView {
  root = new Container();
  events: MotionEvent[] = [];
  private shadow: Sprite;
  private body = new Sprite();
  private label = new Sprite();
  private arrow: Sprite | null = null;
  private motion = new Motion();
  private set: LookTextures;
  private lookCode: string;
  private labelName = '';
  private labelData: Label | null = null;

  constructor(
    d: Drawable,
    private ctx: ViewCtx,
  ) {
    this.lookCode = d.look;
    this.set = ctx.looks.acquire(d.look);
    this.shadow = new Sprite(ctx.shadowTex);
    this.shadow.anchor.set(0.5, 0.5);
    this.body.anchor.set(0.5, 1);
    this.label.anchor.set(0.5, 1);
    this.label.y = -(HERO_H - HEAD_TOP + LABEL_GAP);
    this.root.addChild(this.shadow, this.body, this.label);
    if (d.local) {
      this.arrow = new Sprite(ctx.arrowTex);
      this.arrow.anchor.set(0.5, 1);
      this.root.addChild(this.arrow);
    }
    this.setLabel(d.name, d.local);
    this.body.texture = this.set.frames['hero/idle_0'];
  }

  private setLabel(name: string, local: boolean): void {
    if (name === this.labelName && this.labelData) return;
    this.labelData?.tex.destroy(true);
    this.labelName = name;
    this.labelData = makeLabel(name, local ? SELF_COLOR : NAME_COLOR);
    this.label.texture = this.labelData.tex;
    if (this.arrow) this.arrow.y = this.label.y - this.labelData.h + 1;
  }

  destroy(): void {
    this.ctx.looks.release(this.lookCode);
    this.labelData?.tex.destroy(true);
    this.labelData = null;
    this.root.destroy({ children: true });
  }

  markStomp(): void {
    this.motion.markStomp();
  }
  markHurt(): void {
    this.motion.markHurt();
  }

  update(d: Drawable, now: number): void {
    if (d.look !== this.lookCode) {
      const next = this.ctx.looks.acquire(d.look);
      this.ctx.looks.release(this.lookCode);
      this.set = next;
      this.lookCode = d.look;
    }
    this.setLabel(d.name, d.local);

    const out = this.motion.update(now, d);
    this.events = out.events;
    const name = HERO_ANIMS[out.anim].frames[out.frame];
    this.body.texture = this.set.frames[name] ?? this.set.frames['hero/idle_0'];
    this.body.scale.x = out.flip ? -1 : 1;

    const x = this.root.x;
    const y = this.root.y;
    const dir = d.facing >= 0 ? 1 : -1;
    for (const e of this.events) {
      if (e.k === 'land') {
        if (e.impact >= 3) this.ctx.fx.spawn('land_ring', x, y, { ground: true });
        else if (e.impact >= 1.2) this.ctx.fx.spawn('dust', x, y, { ground: true });
      } else if (e.k === 'skid') this.ctx.fx.spawn('dust', x - dir * 5, y, { ground: true, flipX: dir > 0 });
      else if (e.k === 'runstart') this.ctx.fx.spawn('dust', x - dir * 6, y, { ground: true, flipX: dir > 0 });
      else if (e.k === 'respawn') this.ctx.fx.spawn('poof', x, y - 12);
    }

    // blob shadow on the floor below; shrinks and fades with height
    const gy = this.ctx.groundY(d.x, d.y);
    if (gy === null) this.shadow.visible = false;
    else {
      const h = Math.max(0, gy - d.y);
      const k = Math.max(0.45, 1 - h / 96);
      this.shadow.visible = true;
      this.shadow.position.set(0, Math.round(gy - y) - 1);
      this.shadow.scale.set(k, 1);
      this.shadow.alpha = 0.85 * k;
    }

    // dim when offline; respawn flash strobes
    let alpha = d.connected ? 1 : 0.4;
    if (out.flash && Math.floor(now / 70) % 2 === 0) alpha *= 0.55;
    this.root.alpha = alpha;
  }
}
