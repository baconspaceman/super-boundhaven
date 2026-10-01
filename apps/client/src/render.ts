import { Application, Container, Graphics } from 'pixi.js';
import type { WorldView } from '@sbh/protocol';
import { MOVEMENT, SCREEN_H, SCREEN_W, TILE, isSemiSolid, isSlope, isSolid, slopeFloor, tileAt, type Level, type PlayerState } from '@sbh/sim';
import { SpritePlayerView, type PlayerView, type ViewCtx } from './player-view';
import { FxLayer, LookLibrary, makeArrowTexture, makeShadowTexture } from './sprites';
import type { Drawable } from './game';
import { WorldArt, type RegionId } from './world-art';
import { TodArt, type TodId } from './tod-art';
import { WorldObjects } from './world-objects';
import { EnemyLayer } from './enemy-view';
import { StatusPanel } from './status-panel';
import { DoorTracker, hudLines, type DoorEvent } from './scene-logic';

export type { PlayerView } from './player-view';

/** What the renderer needs from the game each frame (world state is server-owned; nothing here is mutated). */
export interface SceneState {
  level: Level;
  view: WorldView;
  me: PlayerState | null;
  /** connected, non-away players in the room (HUD) */
  connected: number;
}

/** One-shot things the renderer noticed that the game may want to rumble for. */
export type RenderEvent = { k: 'door'; e: DoorEvent; x: number };

const makePlayerView = (d: Drawable, ctx: ViewCtx): PlayerView => new SpritePlayerView(d, ctx);

export class Renderer {
  private app = new Application();
  private view = new Container();
  private world = new Container();
  // layer slots (bottom -> top): bg back | [world back | players | world front] | bg front
  private slotTod = new Container();
  private slotBgBack = new Container();
  private slotBgFront = new Container();
  private slotBack = new Container();
  private slotObjects = new Container();
  private slotEnemies = new Container();
  private slotPlayers = new Container();
  private slotFront = new Container();
  private players = new Map<number, PlayerView>();
  private prev = new Map<number, { x: number; y: number }>();
  private live = new Set<number>();
  private looks = new LookLibrary();
  private fx = new FxLayer();
  private ctx: ViewCtx;
  private lastDraw = 0;
  private levelW: number;
  private art: WorldArt | null = null;
  private objects: WorldObjects | null = null;
  private enemies: EnemyLayer | null = null;
  private status = new StatusPanel();
  private doorTracker = new DoorTracker();
  private scene: SceneState | null = null;
  private cam = 0;
  /** Drained by the game each frame (door open/close pulses). */
  readonly events: RenderEvent[] = [];
  private loading = 0;
  private tod: TodArt | null = null;
  private todLoading = 0;
  /** requested time of day (null = region's own backgrounds) */
  todId: TodId | null = null;
  /** Debug: force the camera x (null = follow the focus). */
  camOverride: number | null = null;
  region: RegionId;
  onRegion: ((r: RegionId) => void) | null = null;

  constructor(
    public level: Level,
    region: RegionId,
    tod: TodId | null = null,
  ) {
    this.todId = tod;
    this.levelW = level.width * TILE;
    this.region = region;
    this.ctx = {
      looks: this.looks,
      fx: this.fx,
      shadowTex: makeShadowTexture(),
      arrowTex: makeArrowTexture(),
      groundY: (x, y) => this.groundY(x, y),
    };
  }

  /** Top of the first floor at or below (x, y): solid tiles and slope surfaces. null = pit. */
  private groundY(x: number, y: number): number | null {
    const lv = this.level;
    const col = Math.floor(x / TILE);
    const r0 = Math.floor((y - 1) / TILE);
    for (let r = Math.max(0, r0); r < Math.min(lv.height, r0 + 12); r++) {
      const ch = tileAt(lv, col, r, this.scene?.view.dynamic);
      if (isSemiSolid(ch)) {
        if (r * TILE >= y - 1) return r * TILE;
        continue;
      }
      if (isSolid(ch)) return r * TILE >= y - 1 ? r * TILE : null;
      if (isSlope(ch)) {
        const f = slopeFloor(ch, col, r, x);
        if (f >= y - 1) return f;
      }
    }
    return null;
  }

  /** Test/debug hook: per-look texture cache stats. */
  get lookCacheSize(): number {
    return this.looks.size;
  }

  async init(): Promise<void> {
    await this.app.init({
      width: window.innerWidth,
      height: window.innerHeight,
      background: 0x0b0b12,
      antialias: false,
      roundPixels: true,
      resolution: 1,
    });
    document.body.prepend(this.app.canvas);
    const mask = new Graphics().rect(0, 0, SCREEN_W, SCREEN_H).fill(0xffffff);
    this.enemies = new EnemyLayer(this.fx);
    this.slotEnemies.addChild(this.enemies.container);
    this.world.addChild(this.slotBack, this.slotObjects, this.slotEnemies, this.slotPlayers, this.fx.container, this.slotFront);
    this.view.addChild(this.slotBgBack, this.slotTod, this.world, this.slotBgFront, this.status.root, mask);
    this.view.mask = mask;
    this.app.stage.addChild(this.view);
    window.addEventListener('resize', () => this.resize());
    this.resize();
    await this.setRegion(this.region);
    if (this.todId) await this.setTimeOfDay(this.todId, false);
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.app.renderer.resize(w, h);
    const k = Math.max(1, Math.floor(Math.min(w / SCREEN_W, h / SCREEN_H)));
    this.view.scale.set(k);
    this.view.x = Math.floor((w - SCREEN_W * k) / 2);
    this.view.y = Math.floor((h - SCREEN_H * k) / 2);
  }

  /** Swap tileset + parallax + props. Old textures are destroyed once the new set is ready. */
  async setRegion(id: RegionId): Promise<void> {
    const ticket = ++this.loading;
    const lvl = this.level;
    const [next, objs] = await Promise.all([
      WorldArt.create(this.app.renderer, lvl, id),
      WorldObjects.create(this.app.renderer, lvl, id, (a) => this.fx.framesOf(a)),
    ]);
    if (ticket !== this.loading) {
      next.destroy(); // a newer request superseded this one
      objs.destroy();
      return;
    }
    const old = this.art;
    const oldObjs = this.objects;
    this.slotObjects.removeChildren();
    this.slotObjects.addChild(objs.container);
    this.objects = objs;
    oldObjs?.destroy();
    this.slotBgBack.removeChildren();
    this.slotBack.removeChildren();
    this.slotFront.removeChildren();
    this.slotBgFront.removeChildren();
    this.slotBgBack.addChild(next.bgBack);
    this.slotBack.addChild(next.worldBack);
    this.slotFront.addChild(next.worldFront);
    this.slotBgFront.addChild(next.bgFront);
    this.art = next;
    this.region = id;
    next.setBackdropVisible(!this.tod);
    old?.destroy();
    this.onRegion?.(id);
  }

  /** The server named a different level in `welcome`: rebuild the playfield art for it. */
  async setLevel(level: Level): Promise<void> {
    if (level === this.level) return;
    this.level = level;
    this.levelW = level.width * TILE;
    this.enemies?.clear();
    this.doorTracker.reset();
    await this.setRegion(this.region);
    if (this.todId) await this.setTimeOfDay(this.todId, false);
  }

  /** Spawn the collect sparkle for shard `id` (local pickup). */
  spawnShardGet(id: number): void {
    this.objects?.spawnShardGet(id);
  }

  /** Screen-space (canvas px) position of a world point, for DOM overlays such as the ACTION prompt. */
  worldToScreen(x: number, y: number): { x: number; y: number } {
    return { x: this.view.x + (x - this.cam) * this.view.scale.x, y: this.view.y + y * this.view.scale.y };
  }

  /** Tileset that matches a time of day: sunset uses meadow_sunset, everything else meadow. */
  static regionFor(tod: TodId): RegionId {
    return tod === 'sunset' ? 'meadow_sunset' : 'meadow';
  }

  /** Time-of-day label for the HUD. */
  get todLabel(): string {
    return this.tod?.label ?? 'off';
  }

  /** 0..4 clock of the day/night cycle (0 dawn, 1 day, 2 sunset, 3 night); null when not cycling. */
  get todClock(): number | null {
    return this.tod && this.tod.id === 'cycle' ? this.tod.clock : null;
  }

  set todClock(v: number | null) {
    if (v !== null && this.tod?.id === 'cycle') this.tod.clock = v;
  }

  setTodPaused(p: boolean): void {
    this.tod?.setPaused(p);
  }

  /** Select a Blender time-of-day backdrop (null = the region's own parallax). `pair` also swaps to the matching tileset. */
  async setTimeOfDay(id: TodId | null, pair = true): Promise<void> {
    const ticket = ++this.todLoading;
    let next: TodArt | null = null;
    if (id) {
      next = await TodArt.create(id, this.level.width * TILE);
      if (ticket !== this.todLoading) {
        next.destroy();
        return;
      }
    }
    const old = this.tod;
    if (old) this.slotTod.removeChild(old.root);
    if (next) this.slotTod.addChild(next.root);
    this.tod = next;
    this.todId = id;
    this.art?.setBackdropVisible(!next);
    if (!next) this.art?.setTint(0xffffff);
    old?.destroy();
    if (next && pair && this.region !== 'caverns') {
      const want = Renderer.regionFor(id!);
      if (want !== this.region) await this.setRegion(want);
    }
  }

  draw(list: Drawable[], focus: { x: number } | null, scene: SceneState | null = null): void {
    this.scene = scene;
    const now = performance.now();
    const dt = this.lastDraw ? Math.min(100, now - this.lastDraw) : 0;
    this.lastDraw = now;
    const art = this.art;
    const live = this.live;
    live.clear();
    const launched: Drawable[] = [];
    for (const d of list) {
      live.add(d.id);
      let s = this.players.get(d.id);
      if (!s) {
        s = makePlayerView(d, this.ctx);
        this.players.set(d.id, s);
        this.slotPlayers.addChild(s.root);
      }
      const x = Math.round(d.x);
      const y = Math.round(d.y);
      s.root.x = x;
      s.root.y = y;
      s.update(d, now);

      // bounce pad: feet were resting on a pad top and are now rising -> launched
      const p = this.prev.get(d.id);
      let padded = false;
      if (art && p && p.y - y > 1) {
        const col = Math.floor(x / TILE);
        const top = art.padTop(col);
        if (top !== undefined && p.y >= top - 1 && p.y <= top + 1) {
          art.bounce(col, now);
          padded = true;
          this.fx.spawn('bounce_burst', x, y - 4);
        }
      }
      if (!padded && s.events.some((e) => e.k === 'launch')) launched.push(d);
      if (p) {
        p.x = x;
        p.y = y;
      } else this.prev.set(d.id, { x, y });
    }

    // stomp: a launch whose feet sit on another player's head
    for (const d of launched) {
      const launch = this.players.get(d.id)!.events.find((e) => e.k === 'launch');
      if (!launch || launch.k !== 'launch' || launch.vy > -4.3) {
        this.fx.spawn('dust', Math.round(d.x), Math.round(d.y), { ground: true });
        continue;
      }
      const victim = list.find(
        (o) => o.id !== d.id && Math.abs(o.x - d.x) < 13 && Math.abs(d.y - (o.y - (o.crouching ? MOVEMENT.crouchHeight : MOVEMENT.height))) <= 6,
      );
      if (victim) {
        this.players.get(d.id)!.markStomp();
        this.players.get(victim.id)?.markHurt();
        this.fx.spawn('stomp_star', Math.round(d.x), Math.round(d.y) - 2);
      } else this.fx.spawn('dust', Math.round(d.x), Math.round(d.y), { ground: true });
    }
    this.fx.update(dt);
    for (const [id, s] of this.players) {
      if (!live.has(id)) {
        s.destroy();
        this.players.delete(id);
        this.prev.delete(id);
      }
    }
    let cam = 0;
    if (focus) cam = Math.max(0, Math.min(this.levelW - SCREEN_W, Math.round(focus.x - SCREEN_W / 2)));
    if (this.camOverride !== null) cam = Math.max(0, Math.min(this.levelW - SCREEN_W, Math.round(this.camOverride)));
    this.world.x = -cam;
    this.cam = cam;
    art?.update(cam, now);
    if (scene && this.objects) {
      this.objects.update(
        {
          level: scene.level,
          view: scene.view,
          me: scene.me,
          doors: this.doorTracker,
          cam,
          now,
          onDoor: (e, id) => this.events.push({ k: 'door', e, x: (scene.level.doors[id]?.tiles[0]?.[0] ?? 0) * TILE }),
        },
        dt,
      );
    }
    if (scene && this.enemies) this.enemies.update(scene.level, scene.view, dt, cam, SCREEN_W);
    if (scene) this.status.set(hudLines(scene.level, scene.me, scene.connected));
    if (this.tod) {
      this.tod.update(cam, now);
      art?.setTint(this.tod.tileTint(art.region));
    }
  }
}
