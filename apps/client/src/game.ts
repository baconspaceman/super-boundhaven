import { applyNetWorld, createWorldView, defaultLookCode, type NetPlayer, type NetWorld, type WorldView } from '@sbh/protocol';
import { DEFAULT_LEVEL, clonePlayer, getLevel, stepPlayer, type Level, type PlayerState } from '@sbh/sim';

export const INTERP_DELAY_MS = 100;
export const MAX_PENDING = 120;
export const SNAP_ERR_PX = 64;

interface Sample {
  t: number;
  x: number;
  y: number;
  facing: number;
  vx: number;
  vy: number;
  onGround: boolean;
  crouching: boolean;
  invuln: number;
  away: boolean;
  deaths: number;
}

export interface Remote {
  id: number;
  name: string;
  connected: boolean;
  buf: Sample[];
}

export interface Drawable {
  id: number;
  name: string;
  x: number;
  y: number;
  facing: number;
  vx: number;
  vy: number;
  onGround: boolean;
  local: boolean;
  connected: boolean;
  look: string; // encodeLook code (never empty)
  crouching: boolean;
  invuln: number; // >0 => respawn flicker
  away: boolean; // disconnected-but-held ghost
  deaths: number; // respawn counter: a change means a respawn happened (poof fx)
}

/** Client-side game state: prediction, reconciliation, remote interpolation. No DOM/Pixi here. */
export class Game {
  /** The level named by the server's `welcome` (default until then). Everything renders/predicts against this. */
  level: Level = getLevel(DEFAULT_LEVEL)!;
  levelName = DEFAULT_LEVEL;
  /** Dynamic world state (doors, plates, levers, enemies) from snapshots. `view.dynamic` feeds stepPlayer. */
  readonly view: WorldView = createWorldView();
  myId = -1;
  myName = '';
  me: PlayerState | null = null;
  seq = 0;
  pending: { seq: number; buttons: number }[] = [];
  errX = 0;
  errY = 0;
  corrections = 0;
  /** corrections big enough that the smoothing was skipped (error > SNAP_ERR_PX) */
  snaps = 0;
  serverTick = 0;
  playerCount = 0;
  remotes = new Map<number, Remote>();
  /** player id -> encodeLook code (from `look` messages, welcome, and 1 Hz snapshot fallback) */
  looks = new Map<number, string>();

  private resetWorld(): void {
    const v = this.view;
    v.epoch = 0;
    for (const k of Object.keys(v.dynamic)) delete v.dynamic[Number(k)];
    for (const k of Object.keys(v.plates)) delete v.plates[Number(k)];
    v.levers.clear();
    v.enemies.clear();
  }

  /**
   * Reset when the assigned identity changes so a new player starts clean. `levelName` is the server's level;
   * returns true when the active level changed (the renderer must rebuild its art).
   */
  welcome(id: number, levelName: string = this.levelName): boolean {
    let levelChanged = false;
    const lv = getLevel(levelName);
    if (lv && lv !== this.level) {
      this.level = lv;
      this.levelName = levelName;
      this.me = null;
      this.pending = [];
      this.errX = this.errY = 0;
      this.remotes.clear();
      levelChanged = true;
    }
    if (levelChanged || id !== this.myId) this.resetWorld();
    if (id !== this.myId) {
      this.me = null;
      this.seq = 0;
      this.pending = [];
      this.errX = this.errY = 0;
      this.remotes.clear();
      this.looks.clear();
    }
    this.myId = id;
    return levelChanged;
  }

  setLook(id: number, code: string): void {
    this.looks.set(id, code);
  }

  lookOf(id: number): string {
    return this.looks.get(id) ?? defaultLookCode(id);
  }

  /** One fixed 1/60 s prediction tick. Returns the seq used, or null if not spawned yet. */
  tick(buttons: number): number | null {
    const me = this.me;
    if (!me) return null;
    const seq = ++this.seq;
    this.pending.push({ seq, buttons });
    if (this.pending.length > MAX_PENDING) this.pending.shift();
    stepPlayer(this.level, me, buttons, undefined, this.view.dynamic);
    this.errX *= 0.9;
    this.errY *= 0.9;
    if (Math.abs(this.errX) < 0.01) this.errX = 0;
    if (Math.abs(this.errY) < 0.01) this.errY = 0;
    return seq;
  }

  onSnapshot(tick: number, players: NetPlayer[], now: number, world?: NetWorld): void {
    if (world) applyNetWorld(this.view, world);
    this.serverTick = tick;
    this.playerCount = players.length;
    const seen = new Set<number>();
    for (const np of players) {
      seen.add(np.id);
      if (np.look) this.looks.set(np.id, np.look);
      if (np.id === this.myId) {
        this.myName = np.name;
        this.reconcile(np);
        continue;
      }
      let r = this.remotes.get(np.id);
      if (!r) {
        r = { id: np.id, name: np.name, connected: np.connected, buf: [] };
        this.remotes.set(np.id, r);
      }
      r.name = np.name;
      r.connected = np.connected;
      r.buf.push({
        t: now,
        x: np.state.x,
        y: np.state.y,
        facing: np.state.facing,
        vx: np.state.vx,
        vy: np.state.vy,
        onGround: np.state.onGround,
        crouching: np.state.crouching,
        invuln: np.state.invuln,
        away: np.state.away,
        deaths: np.state.deaths,
      });
      if (r.buf.length > 40) r.buf.shift();
    }
    for (const id of [...this.remotes.keys()]) if (!seen.has(id)) this.remotes.delete(id);
    for (const id of [...this.looks.keys()]) if (id !== this.myId && !seen.has(id)) this.looks.delete(id);
  }

  private reconcile(np: NetPlayer): void {
    if (!this.me) {
      this.me = clonePlayer(np.state);
      this.pending = [];
      return;
    }
    const oldX = this.me.x + this.errX;
    const oldY = this.me.y + this.errY;
    const prevX = this.me.x;
    const prevY = this.me.y;

    const me = clonePlayer(np.state);
    this.pending = this.pending.filter((p) => p.seq > np.ack);
    for (const p of this.pending) stepPlayer(this.level, me, p.buttons, undefined, this.view.dynamic);
    this.me = me;

    if (Math.hypot(me.x - prevX, me.y - prevY) > 0.5) this.corrections++;
    const ex = oldX - me.x;
    const ey = oldY - me.y;
    if (Math.hypot(ex, ey) > SNAP_ERR_PX) {
      this.errX = 0;
      this.errY = 0;
      this.snaps++;
    } else {
      this.errX = ex;
      this.errY = ey;
    }
  }

  /** Players currently in the room: connected and not `away` (includes the local player once spawned). */
  connectedCount(): number {
    let n = this.me ? 1 : 0;
    for (const r of this.remotes.values()) if (r.connected && !r.buf[r.buf.length - 1]?.away) n++;
    return n;
  }

  /** Everything to draw this frame (local with error offset, remotes interpolated). */
  drawables(now: number): Drawable[] {
    const out: Drawable[] = [];
    const target = now - INTERP_DELAY_MS;
    for (const r of this.remotes.values()) {
      const b = r.buf;
      if (b.length === 0) continue;
      while (b.length > 2 && b[1].t <= target) b.shift();
      let x: number, y: number, facing: number;
      let st = b[0];
      if (target <= b[0].t || b.length === 1) {
        x = b[0].x;
        y = b[0].y;
        facing = b[0].facing;
      } else if (target >= b[1].t) {
        st = b[1];
        x = b[1].x;
        y = b[1].y;
        facing = b[1].facing;
      } else {
        st = b[1];
        const a = b[0];
        const c = b[1];
        if (Math.hypot(c.x - a.x, c.y - a.y) > SNAP_ERR_PX) {
          x = c.x;
          y = c.y;
        } else {
          const f = (target - a.t) / (c.t - a.t);
          x = a.x + (c.x - a.x) * f;
          y = a.y + (c.y - a.y) * f;
        }
        facing = c.facing;
      }
      out.push({
        id: r.id,
        name: r.name,
        x,
        y,
        facing,
        vx: st.vx,
        vy: st.vy,
        onGround: st.onGround,
        local: false,
        connected: r.connected,
        look: this.lookOf(r.id),
        crouching: st.crouching,
        invuln: st.invuln,
        away: st.away,
        deaths: st.deaths,
      });
    }
    if (this.me) {
      out.push({
        id: this.myId,
        name: this.myName,
        x: this.me.x + this.errX,
        y: this.me.y + this.errY,
        facing: this.me.facing,
        vx: this.me.vx,
        vy: this.me.vy,
        onGround: this.me.onGround,
        local: true,
        connected: true,
        look: this.lookOf(this.myId),
        crouching: this.me.crouching,
        invuln: this.me.invuln,
        away: this.me.away,
        deaths: this.me.deaths,
      });
    }
    return out;
  }
}
