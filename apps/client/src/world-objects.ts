// Gameplay objects of a level, drawn from the region's object atlas (@sbh/art world_objects_<region>.png/.json,
// frame names `obj/...`). Until that atlas exists (or for any missing frame) a clean primitive fallback is used so
// everything works. One-way platforms, spikes, doors, pressure plates, levers, checkpoint flags and per-player
// shards are all derived from level data + the synced WorldView; nothing here is authoritative.
import { Container, Rectangle, Sprite, Texture, type Renderer as PixiRenderer } from 'pixi.js';
import type { WorldView } from '@sbh/protocol';
import { SCREEN_W, TILE, hasShard, type Level, type PlayerState } from '@sbh/sim';
import { ObjectAtlas } from './object-atlas';
import {
  DoorTracker,
  type DoorEvent,
  doorOpenness,
  doorPhase,
  flagActive,
  leverTimerFrame,
  leverVisual,
} from './scene-logic';
import type { RegionId } from './world-art';

export interface ObjScene {
  level: Level;
  view: WorldView;
  me: PlayerState | null;
  doors: DoorTracker;
  cam: number;
  now: number;
  onDoor?: (e: DoorEvent, id: number) => void;
}

interface Cull {
  sprite: Sprite;
  x0: number;
  x1: number;
}

interface DoorTile {
  closed: Sprite;
  open: Sprite;
  cap: boolean;
  row: number;
  cull: Cull;
}

interface OneShot {
  sprite: Sprite;
  frames: Texture[];
  t: number;
  fps: number;
}

const GLOW_FPS = 8;
const FLAG_FPS = 6;
const SHARD_FPS = 10;
const SHIMMER_FPS = 8;
const GET_FPS = 14;

const frameIdx = (now: number, fps: number, n: number, phase = 0): number => (Math.floor((now / 1000) * fps) + phase) % n;

export class WorldObjects {
  readonly container = new Container();
  private atlas: ObjectAtlas;
  private culls: Cull[] = [];
  private doors = new Map<number, DoorTile[]>();
  private plates: { id: number; sprite: Sprite; glow: Sprite }[] = [];
  private buttons: { id: number; sprite: Sprite; litSince: number }[] = [];
  private levers: { id: number; sprite: Sprite; ring: Sprite; cull: Cull }[] = [];
  private flags: { idx: number; sprite: Sprite; cull: Cull }[] = [];
  private shards: { id: number; sprite: Sprite; cull: Cull; phase: number }[] = [];
  private oneShots: OneShot[] = [];
  private shardFrames: Texture[];
  private shardGetFrames: Texture[];
  private idleFlag: Texture[];
  private activeFlag: Texture[];
  private shimmer: Texture[];
  private glow: Texture[];
  private timer: Texture[];
  private buttonLit: Texture[];

  private constructor(
    private level: Level,
    atlas: ObjectAtlas,
    private fxFrames: (anim: string) => Texture[],
  ) {
    this.atlas = atlas;
    const a = atlas;
    this.shardFrames = a.seq('obj/shard_pickup_', 6, () => this.fxFrames('shard_spin'));
    this.shardGetFrames = a.seq('obj/shard_get_', 4, () => this.fxFrames('sparkle'));
    this.idleFlag = a.seq('obj/flag_idle_', 4);
    this.activeFlag = a.seq('obj/flag_active_', 4);
    this.shimmer = a.seq('obj/door_open_', 4);
    this.glow = a.seq('obj/plate_glow_', 4);
    this.timer = a.seq('obj/lever_timer_', 6);
    this.buttonLit = a.seq('obj/button_lit_', 6);
    this.build(level);
  }

  /** Loads the region's atlas (if it exists) and builds every sprite. `fx` supplies fallback shard/sparkle frames. */
  static async create(
    _renderer: PixiRenderer,
    level: Level,
    region: RegionId,
    fxFrames: (anim: string) => Texture[],
  ): Promise<WorldObjects> {
    const atlas = await ObjectAtlas.load(region);
    return new WorldObjects(level, atlas, fxFrames);
  }

  /** True when the real art atlas is in use (false = primitive fallbacks). */
  get hasArt(): boolean {
    return this.atlas.real;
  }

  private place(s: Sprite, x: number, y: number, w = TILE): Cull {
    s.position.set(x, y);
    this.container.addChild(s);
    const c = { sprite: s, x0: x - w, x1: x + w * 2 };
    this.culls.push(c);
    return c;
  }

  private build(level: Level): void {
    const a = this.atlas;
    const T = level.tiles;
    const at = (c: number, r: number): string => (r >= 0 && r < level.height && c >= 0 && c < level.width ? T[r][c] : '.');

    // one-way platforms and spikes: static tile art
    for (let r = 0; r < level.height; r++) {
      for (let c = 0; c < level.width; c++) {
        const ch = T[r][c];
        if (ch === '-') {
          const l = at(c - 1, r) === '-';
          const rt = at(c + 1, r) === '-';
          const name = !l && rt ? 'obj/oneway_l' : l && !rt ? 'obj/oneway_r' : 'obj/oneway_m';
          this.place(new Sprite(a.get(name)), c * TILE, r * TILE);
        } else if (ch === '^') {
          const name = (c * 7 + r * 3) % 5 === 0 && a.has('obj/spike_1') ? 'obj/spike_1' : 'obj/spike';
          this.place(new Sprite(a.get(name)), c * TILE, r * TILE);
        }
      }
    }

    // pressure plates (bottom-center on the tile floor)
    for (const p of level.plates) {
      const s = new Sprite(a.get('obj/plate_up'));
      s.anchor.set(0.5, 1);
      const g = new Sprite(this.glow[0]);
      g.anchor.set(0.5, 1);
      g.visible = false;
      this.place(s, p.col * TILE + TILE / 2, (p.row + 1) * TILE);
      this.place(g, p.col * TILE + TILE / 2, (p.row + 1) * TILE);
      this.plates.push({ id: p.id, sprite: s, glow: g });
    }

    // big buttons (ground-pound them): art is 2 tiles wide, stretched for other widths
    for (const b of level.buttons) {
      const s = new Sprite(a.get('obj/button_up'));
      s.anchor.set(0.5, 1);
      s.scale.x = (b.w * TILE) / 32;
      this.place(s, (b.col + b.w / 2) * TILE, (b.row + 1) * TILE, b.w * TILE);
      this.buttons.push({ id: b.id, sprite: s, litSince: -1 });
    }

    // levers
    for (const l of level.levers) {
      const s = new Sprite(a.get(l.reset ? 'obj/lever_reset' : 'obj/lever_off'));
      s.anchor.set(0.5, 1);
      const cull = this.place(s, l.col * TILE + TILE / 2, (l.row + 1) * TILE);
      const ring = new Sprite(this.timer[0]);
      ring.anchor.set(0.5, 1);
      ring.visible = false;
      this.place(ring, l.col * TILE + TILE / 2, (l.row + 1) * TILE);
      this.levers.push({ id: l.id, sprite: s, ring, cull });
    }

    // checkpoint flags: 16x32, bottom-center on the feet point
    level.checkpoints.forEach((cp, idx) => {
      const s = new Sprite(this.idleFlag[0]);
      s.anchor.set(0.5, 1);
      const cull = this.place(s, cp.x, cp.y);
      this.flags.push({ idx, sprite: s, cull });
    });

    // doors: a closed sprite and an open (ghost/shimmer) sprite per tile
    for (const d of level.doors) {
      const set = new Set(d.tiles.map(([c, r]) => `${c},${r}`));
      const tiles: DoorTile[] = [];
      for (const [c, r] of d.tiles) {
        const above = set.has(`${c},${r - 1}`);
        const below = set.has(`${c},${r + 1}`);
        const cap = !above;
        const closed = new Sprite(a.get(cap ? 'obj/door_cap' : below ? 'obj/door_mid' : 'obj/door_base'));
        const open = new Sprite(cap ? a.get('obj/door_open_cap') : this.shimmer[0]);
        open.visible = false;
        const cull = this.place(closed, c * TILE, r * TILE);
        this.place(open, c * TILE, r * TILE);
        tiles.push({ closed, open, cap, row: r, cull });
      }
      this.doors.set(d.id, tiles);
    }

    // shards: one sprite each; visibility is per local player
    level.shards.forEach((p, id) => {
      const s = new Sprite(this.shardFrames[0]);
      s.anchor.set(0.5, 0.5);
      const cull = this.place(s, Math.round(p.x), Math.round(p.y), 12);
      this.shards.push({ id, sprite: s, cull, phase: (id * 5) % 6 });
    });
  }

  /** One-shot effect at a world position (collect sparkle). */
  spawnShardGet(id: number): void {
    const p = this.level.shards[id];
    if (!p) return;
    const s = new Sprite(this.shardGetFrames[0]);
    s.anchor.set(0.5, 0.5);
    s.position.set(Math.round(p.x), Math.round(p.y));
    this.container.addChild(s);
    this.oneShots.push({ sprite: s, frames: this.shardGetFrames, t: 0, fps: GET_FPS });
  }

  update(sc: ObjScene, dtMs: number): void {
    const { view, me, now, cam } = sc;
    const l = cam - 24;
    const r = cam + SCREEN_W + 24;
    for (const c of this.culls) c.sprite.visible = c.x1 > l && c.x0 < r;

    // doors
    for (const [id, tiles] of this.doors) {
      const isOpen = view.dynamic[id] === true;
      const ev = sc.doors.observe(id, isOpen, now);
      if (ev) sc.onDoor?.(ev, id);
      const since = sc.doors.sinceOf(id);
      const phase = doorPhase(isOpen, since, now);
      const k = doorOpenness(phase, since, now);
      for (const t of tiles) {
        const inView = t.cull.x1 > l && t.cull.x0 < r;
        t.closed.visible = inView && k < 1;
        t.open.visible = inView && k > 0;
        if (!inView) continue;
        t.closed.alpha = phase === 'closed' ? 1 : 1 - k;
        t.open.alpha = phase === 'open' ? 1 : k;
        if (!t.cap) t.open.texture = this.shimmer[frameIdx(now, SHIMMER_FPS, this.shimmer.length, t.row)];
      }
    }

    // plates
    for (const p of this.plates) {
      const pressed = view.plates[p.id] === true;
      p.sprite.texture = this.atlas.get(pressed ? 'obj/plate_down' : 'obj/plate_up');
      p.glow.visible = pressed && p.sprite.visible;
      if (pressed) p.glow.texture = this.glow[frameIdx(now, GLOW_FPS, this.glow.length)];
    }

    // big buttons: gold while waiting; cyan and pressed flat while lit, with a bar that drains over the lit window
    for (const b of this.buttons) {
      const lit = view.buttons[b.id] === true;
      if (!lit) {
        b.litSince = -1;
        b.sprite.texture = this.atlas.get('obj/button_up');
        continue;
      }
      if (b.litSince < 0) b.litSince = now;
      const total = (this.level.buttons[b.id].ticks * 1000) / 60;
      const k = Math.min(this.buttonLit.length - 1, Math.floor(((now - b.litSince) / total) * this.buttonLit.length));
      b.sprite.texture = this.buttonLit[Math.max(0, k)];
    }

    // levers
    for (const lv of this.levers) {
      const def = this.level.levers[lv.id];
      const st = view.levers.get(lv.id);
      const on = st?.on ?? false;
      const t = st?.t ?? 0;
      const vis = leverVisual(def, on, t);
      let tex: Texture;
      if (vis === 'reset') tex = this.atlas.get('obj/lever_reset');
      else if (vis === 'timer') tex = this.atlas.get('obj/lever_on');
      else tex = this.atlas.get(vis === 'on' ? 'obj/lever_on' : 'obj/lever_off');
      lv.sprite.texture = tex;
      lv.ring.visible = vis === 'timer' && lv.sprite.visible;
      if (vis === 'timer') lv.ring.texture = this.timer[Math.min(this.timer.length - 1, leverTimerFrame(t, def.ticks))];
    }

    // flags
    for (const f of this.flags) {
      const active = flagActive(f.idx, me?.checkpoint ?? -1);
      const set = active ? this.activeFlag : this.idleFlag;
      f.sprite.texture = set[frameIdx(now, FLAG_FPS, set.length, f.idx)];
    }

    // shards: only the ones the local player has not collected
    for (const s of this.shards) {
      const have = me ? hasShard(me, s.id) : false;
      if (have) {
        s.sprite.visible = false;
        continue;
      }
      if (!s.sprite.visible) continue;
      s.sprite.texture = this.shardFrames[frameIdx(now, SHARD_FPS, this.shardFrames.length, s.phase)];
    }

    // one-shots
    for (let i = this.oneShots.length - 1; i >= 0; i--) {
      const o = this.oneShots[i];
      o.t += dtMs;
      const f = Math.floor((o.t / 1000) * o.fps);
      if (f >= o.frames.length) {
        o.sprite.destroy();
        this.oneShots.splice(i, 1);
      } else o.sprite.texture = o.frames[f];
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
    this.atlas.destroy();
  }
}
