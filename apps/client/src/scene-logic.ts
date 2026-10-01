// Pure (no Pixi/DOM) gameplay-view logic: state-transition detection, door/lever/checkpoint render state,
// the ACTION prompt reach test, flicker. Unit-tested in test/scene-logic.test.ts.
import { RULES, TILE, bodyHeight, hasShard, type Level, type LeverDef, type PlayerState } from '@sbh/sim';

/** Door open/close transition length (ms). */
export const DOOR_ANIM_MS = 320;
/** Lever timer ring frames (obj/lever_timer_0..5). */
export const LEVER_TIMER_FRAMES = 6;

// ---- local-player transition watcher ----------------------------------------------------------------

export interface LocalEvents {
  /** the respawn counter went up (hurt or pit): poof + rumble */
  respawned: boolean;
  /** shard ids collected for the first time since the watcher was reset */
  shards: number[];
  /** the local player's checkpoint index went up to a new value */
  checkpoint: boolean;
}

/**
 * Watches the local player's authoritative+predicted state once per frame. Counters are monotonic ("max
 * seen"), so a reconcile that momentarily rewinds `deaths`/`got` to older server state and then replays the
 * pending inputs cannot fire an effect twice.
 */
export class LocalWatch {
  private deaths = -1;
  private seen = new Set<number>();
  private cp = -2;
  private primed = false;

  reset(): void {
    this.deaths = -1;
    this.seen.clear();
    this.cp = -2;
    this.primed = false;
  }

  observe(me: PlayerState | null, level: Level): LocalEvents {
    const out: LocalEvents = { respawned: false, shards: [], checkpoint: false };
    if (!me) return out;
    if (!this.primed) {
      // first sight (join / reconnect): adopt silently
      this.primed = true;
      this.deaths = me.deaths;
      this.cp = me.checkpoint;
      for (let i = 0; i < level.shards.length; i++) if (hasShard(me, i)) this.seen.add(i);
      return out;
    }
    if (me.deaths > this.deaths) {
      this.deaths = me.deaths;
      out.respawned = true;
    }
    if (me.checkpoint > this.cp) {
      this.cp = me.checkpoint;
      out.checkpoint = true;
    } else if (me.checkpoint >= 0 && this.cp < 0) this.cp = me.checkpoint;
    for (let i = 0; i < level.shards.length; i++) {
      if (!this.seen.has(i) && hasShard(me, i)) {
        this.seen.add(i);
        out.shards.push(i);
      }
    }
    return out;
  }
}

/** Per-player respawn detector for the view (remote players): true when `deaths` increased. */
export function deathsIncreased(prev: number | undefined, cur: number): boolean {
  return prev !== undefined && cur > prev;
}

// ---- invulnerability flicker -----------------------------------------------------------------------

/** True on the "dim" half of the flicker (about 14 Hz strobe) while `invuln > 0`. */
export function flickerDim(invuln: number, nowMs: number): boolean {
  return invuln > 0 && Math.floor(nowMs / 70) % 2 === 0;
}

// ---- doors ---------------------------------------------------------------------------------------

export type DoorPhase = 'closed' | 'opening' | 'open' | 'closing';

/** Phase of a door given its open state and when that state last changed (ms; -Infinity = long ago). */
export function doorPhase(isOpen: boolean, sinceMs: number, nowMs: number): DoorPhase {
  const settled = nowMs - sinceMs >= DOOR_ANIM_MS;
  if (isOpen) return settled ? 'open' : 'opening';
  return settled ? 'closed' : 'closing';
}

/** 0 (fully closed) .. 1 (fully open) openness used to animate the shimmer / ghost fade. */
export function doorOpenness(phase: DoorPhase, sinceMs: number, nowMs: number): number {
  const k = Math.min(1, Math.max(0, (nowMs - sinceMs) / DOOR_ANIM_MS));
  if (phase === 'open') return 1;
  if (phase === 'closed') return 0;
  return phase === 'opening' ? k : 1 - k;
}

export type DoorEvent = 'opened' | 'closed';

/** Tracks when each door last flipped; reports the flip once so effects (rumble) can fire. */
export class DoorTracker {
  private open = new Map<number, boolean>();
  private since = new Map<number, number>();

  reset(): void {
    this.open.clear();
    this.since.clear();
  }

  /** Call once per frame per door. First sight is adopted silently (no animation, no event). */
  observe(id: number, isOpen: boolean, nowMs: number): DoorEvent | null {
    const prev = this.open.get(id);
    if (prev === undefined) {
      this.open.set(id, isOpen);
      this.since.set(id, -Infinity);
      return null;
    }
    if (prev === isOpen) return null;
    this.open.set(id, isOpen);
    this.since.set(id, nowMs);
    return isOpen ? 'opened' : 'closed';
  }

  sinceOf(id: number): number {
    return this.since.get(id) ?? -Infinity;
  }
}

// ---- levers / plates / checkpoints -----------------------------------------------------------------

/** Frame of the timed-lever ring: 0 = just pulled (full ring) ... LEVER_TIMER_FRAMES-1 = about to expire. */
export function leverTimerFrame(ticksLeft: number, ticks: number): number {
  if (ticks <= 0) return 0;
  const spent = 1 - Math.min(1, Math.max(0, ticksLeft / ticks));
  return Math.min(LEVER_TIMER_FRAMES - 1, Math.floor(spent * LEVER_TIMER_FRAMES));
}

export type LeverVisual = 'off' | 'on' | 'timer' | 'reset';

export function leverVisual(def: LeverDef, on: boolean, ticksLeft: number): LeverVisual {
  if (def.reset) return 'reset';
  if (def.ticks > 0 && on && ticksLeft > 0) return 'timer';
  return on ? 'on' : 'off';
}

/** Flag state for the local player: active once they touched this flag or one further along (index <= checkpoint). */
export function flagActive(index: number, myCheckpoint: number): boolean {
  return index <= myCheckpoint;
}

/** Nearest lever the ACTION button would pull right now (same reach test as the sim), or null. */
export function leverInReach(level: Level, me: PlayerState | null): LeverDef | null {
  if (!me || me.away) return null;
  const cy = me.y - bodyHeight(me) / 2;
  let best: LeverDef | null = null;
  let bestD = Infinity;
  for (const def of level.levers) {
    const lx = def.col * TILE + TILE / 2;
    const ly = def.row * TILE + TILE / 2;
    const dx = Math.abs(me.x - lx);
    const dy = Math.abs(cy - ly);
    if (dx > RULES.actionReachX || dy > RULES.actionReachY) continue;
    const d = dx + dy;
    if (d < bestD) {
      best = def;
      bestD = d;
    }
  }
  return best;
}

// ---- HUD text ---------------------------------------------------------------------------------------

export interface RoomStatus {
  connected: number;
  min: number;
  text: string; // '' when nothing to say
}

/** "Needs N players" while the room has a minimum above 1 that is not met. */
export function roomStatus(level: Level, connected: number): RoomStatus {
  const min = level.room.minPlayers;
  const text = min > 1 && connected < min ? `NEEDS ${min} PLAYERS` : '';
  return { connected, min, text };
}

/** Compact HUD lines for the pixel-font panel. */
export function hudLines(level: Level, me: PlayerState | null, connected: number): string[] {
  const lines: string[] = [];
  if (level.shards.length > 0) lines.push(`SHARDS ${me?.shards ?? 0}/${level.shards.length}`);
  if (level.checkpoints.length > 0 && (me?.checkpoint ?? -1) >= 0) lines.push(`FLAG ${(me?.checkpoint ?? -1) + 1}/${level.checkpoints.length}`);
  if ((me?.deaths ?? 0) > 0) lines.push(`DEATHS ${me!.deaths}`);
  const st = roomStatus(level, connected);
  if (st.text) lines.push(`!${st.text}`);
  else if (level.room.minPlayers > 1 || connected > 1) lines.push(`PLAYERS ${connected}`);
  return lines;
}

// ---- enemies ----------------------------------------------------------------------------------------

/** ENEMY_ANIMS key for an enemy kind (0 walker, 1 flyer, 2 spiky) and alive state. */
export function enemyAnimKey(kind: number, alive: boolean): string {
  if (kind === 1) return alive ? 'zip_fly' : 'zip_down';
  if (kind === 2) return alive ? 'shard_walk' : 'shard_defeat';
  return alive ? 'sprout_walk' : 'sprout_squash';
}

/** Exponential smoothing of a 20 Hz sample toward the render position (frame-rate independent). */
export function smoothToward(cur: number, target: number, dtMs: number, tauMs = 55): number {
  const k = 1 - Math.exp(-Math.max(0, dtMs) / tauMs);
  const v = cur + (target - cur) * k;
  return Math.abs(target - v) < 0.05 ? target : v;
}
