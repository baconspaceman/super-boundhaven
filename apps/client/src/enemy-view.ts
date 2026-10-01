// Enemies: walker "sprout" (kind 0), flyer "zip" (kind 1), spiky "shard" (kind 2), drawn from the real
// @sbh/art enemy sheets. The server sends x/y at 20 Hz (1/8 px); positions are smoothed per frame here.
// Art faces LEFT: flip when the enemy walks right. Defeated: squash pose for a moment, then it vanishes and
// returns (poof) when the server says it is alive again.
import { Container, Rectangle, Sprite, Texture } from 'pixi.js';
import type { WorldView } from '@sbh/protocol';
import type { Level } from '@sbh/sim';
import { ENEMY_ANIMS, buildEnemyFrames, packSheet } from './art';
import { bitmapToCanvas } from './look-sheet';
import { frameAt } from './motion';
import type { FxLayer } from './sprites';
import { enemyAnimKey, smoothToward } from './scene-logic';

interface EnemyInst {
  sprite: Sprite;
  x: number;
  y: number;
  alive: boolean;
  deadMs: number; // time since it was defeated
  anim: string;
  t: number; // ms in the current anim
  seen: boolean;
}

function nearest(canvas: HTMLCanvasElement): Texture {
  const t = Texture.from(canvas);
  t.source.scaleMode = 'nearest';
  return t;
}

export class EnemyLayer {
  readonly container = new Container();
  private tex: Record<string, Texture> = {};
  private base: Texture;
  private inst = new Map<number, EnemyInst>();
  constructor(private fx: FxLayer) {
    const { sheet, atlas } = packSheet(buildEnemyFrames(), 256, 1);
    this.base = nearest(bitmapToCanvas(sheet));
    for (const [n, a] of Object.entries(atlas)) {
      this.tex[n] = new Texture({ source: this.base.source, frame: new Rectangle(a.x, a.y, a.w, a.h) });
    }
  }

  /** Forget all enemies (level change / room reset). */
  clear(): void {
    for (const e of this.inst.values()) e.sprite.destroy();
    this.inst.clear();
  }

  update(level: Level, view: WorldView, dtMs: number, camX: number, screenW: number): void {
    for (const def of level.enemies) {
      const st = view.enemies.get(def.id);
      let e = this.inst.get(def.id);
      // before the first snapshot show nothing; the server owns enemy positions
      if (!st) {
        if (e) e.sprite.visible = false;
        continue;
      }
      if (!e) {
        const sprite = new Sprite();
        sprite.anchor.set(0.5, 1);
        this.container.addChild(sprite);
        e = { sprite, x: st.x, y: st.y, alive: st.alive, deadMs: st.alive ? 0 : 1e9, anim: '', t: 0, seen: false };
        this.inst.set(def.id, e);
      }
      // smooth toward the latest 20 Hz sample; snap on a respawn / big jump
      if (Math.hypot(st.x - e.x, st.y - e.y) > 24) {
        e.x = st.x;
        e.y = st.y;
      } else {
        e.x = smoothToward(e.x, st.x, dtMs);
        e.y = smoothToward(e.y, st.y, dtMs);
      }
      if (e.seen && st.alive !== e.alive) {
        if (!st.alive) {
          e.deadMs = 0;
          if (def.kind !== 2) this.fx.spawn('stomp_star', Math.round(e.x), Math.round(e.y) - 8);
        } else {
          this.fx.spawn('poof', Math.round(st.x), Math.round(st.y) - 8);
        }
      }
      e.seen = true;
      e.alive = st.alive;
      if (!st.alive) e.deadMs += dtMs;

      const vis = e.x > camX - 32 && e.x < camX + screenW + 32 && (e.alive || e.deadMs < 600);
      e.sprite.visible = vis;
      if (!vis) continue;
      const key = enemyAnimKey(def.kind, e.alive);
      if (key !== e.anim) {
        e.anim = key;
        e.t = 0;
      }
      e.t += dtMs;
      const a = ENEMY_ANIMS[key];
      const name = a.frames[frameAt(a.ticks, a.loop, e.t)];
      e.sprite.texture = this.tex[name];
      e.sprite.scale.x = st.dir > 0 ? -1 : 1; // art faces left
      e.sprite.position.set(Math.round(e.x), Math.round(e.y));
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
    for (const t of Object.values(this.tex)) t.destroy(false);
    this.base.destroy(true);
  }
}
