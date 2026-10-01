import {
  BTN,
  COOP_ROOM,
  TILE,
  createPlayer,
  createWorld,
  isSolid,
  stepWorld,
  tileAt,
  type Level,
  type PlayerState,
  type World,
} from '../src/index';

/** Tiny scripted-input helpers for co-op room tests. Pure functions of (level, player, target): no tick-by-tick magic. */
export interface BotState {
  jump: number; // ticks of JUMP left to hold (a hop in progress)
}

export interface DriveOpts {
  targetY?: number; // feet y of the target (hop up when it is higher than us)
  run?: boolean;
  tol?: number;
}

/** Buttons that walk/run toward `targetX`, hopping spikes, walls and ledges on the way. */
export function drive(level: Level, p: PlayerState, targetX: number, st: BotState, o: DriveOpts = {}): number {
  const dx = targetX - p.x;
  const tol = o.tol ?? 6;
  const dir = dx > 0 ? 1 : -1;
  let b = 0;
  if (Math.abs(dx) > tol) {
    b |= dir > 0 ? BTN.RIGHT : BTN.LEFT;
    if ((o.run ?? true) && Math.abs(dx) > 90) b |= BTN.RUN;
  }
  if (st.jump > 0) {
    st.jump--;
    b |= BTN.JUMP;
  } else if (p.onGround && Math.abs(dx) > tol) {
    const row = Math.floor((p.y - 1) / TILE);
    let hop = false;
    for (const k of [12, 24, 36]) {
      const col = Math.floor((p.x + dir * k) / TILE);
      const ch = tileAt(level, col, row);
      if (ch === '^' || isSolid(ch) || isSolid(tileAt(level, col, row - 1))) hop = true;
    }
    if (o.targetY !== undefined && o.targetY < p.y - 8 && Math.abs(dx) < 70) hop = true;
    if (hop) {
      st.jump = 38;
      b |= BTN.JUMP;
    }
  }
  return b;
}

export class Room {
  w: World;
  level: Level;
  bots = new Map<number, BotState>();
  constructor(n: number, level: Level = COOP_ROOM) {
    this.level = level;
    this.w = createWorld(level);
    for (let i = 1; i <= n; i++) {
      this.w.players.push(createPlayer(i, level));
      this.bots.set(i, { jump: 0 });
    }
  }
  p(id: number): PlayerState {
    return this.w.players.find((q) => q.id === id)!;
  }
  bot(id: number): BotState {
    return this.bots.get(id)!;
  }
  to(id: number, x: number, o?: DriveOpts): number {
    return drive(this.level, this.p(id), x, this.bot(id), o);
  }
  /** Arrived: close to x, grounded and nearly stopped. */
  there(id: number, x: number, tol = 10): boolean {
    const p = this.p(id);
    return Math.abs(p.x - x) <= tol && p.onGround && Math.abs(p.vx) < 0.3;
  }
  step(inputs: Record<number, number> = {}): void {
    stepWorld(this.level, this.w, inputs);
  }
  /** Step until cond() holds; plan() returns this tick's inputs. Throws with positions if it never does. */
  until(plan: () => Record<number, number>, cond: () => boolean, max: number, label = ''): number {
    for (let t = 0; t < max; t++) {
      if (cond()) return t;
      this.step(plan());
    }
    if (cond()) return max;
    const where = this.w.players.map((q) => `${q.id}:(${q.x.toFixed(0)},${q.y.toFixed(0)})`).join(' ');
    throw new Error(`timeout ${label} after ${max} ticks; ${where}`);
  }
  run(n: number, plan: () => Record<number, number> = () => ({})): void {
    for (let t = 0; t < n; t++) this.step(plan());
  }
}
