// Haptics + a tiny game-event hook. Rumble is feature-detected and never throws.
//
// Event hook: `window.__sbh.events.emit('stomp')` (or `gameEvents.emit`) from any game/render code triggers rumble.
// Until the client emits real hurt/stomp events, `EventDeriver` infers land / bounce / stomp / respawn from the local
// player's state transitions (heuristics tuned to MOVEMENT in @sbh/sim: jumpVel 5.2, stompVel 4.6, padVel 6.6).
import type { PadLike } from './gamepad';

export type GameEventName = 'land' | 'stomp' | 'bounce' | 'hurt' | 'respawn' | 'shard' | 'door';

export class GameEvents {
  private subs = new Map<string, Set<(name: GameEventName, detail?: unknown) => void>>();
  /** Subscribe to one event name or '*'. Returns an unsubscribe function. */
  on(name: GameEventName | '*', fn: (name: GameEventName, detail?: unknown) => void): () => void {
    let set = this.subs.get(name);
    if (!set) this.subs.set(name, (set = new Set()));
    set.add(fn);
    return () => set.delete(fn);
  }
  emit(name: GameEventName, detail?: unknown): void {
    for (const key of [name, '*']) {
      for (const fn of this.subs.get(key) ?? []) {
        try {
          fn(name, detail);
        } catch {
          /* a bad listener must not break the game loop */
        }
      }
    }
  }
}
export const gameEvents = new GameEvents();

export interface Snap {
  x: number;
  y: number;
  vy: number;
  onGround: boolean;
}

export const HARD_LAND_VY = 5.49; // ~terminal velocity (maxFall 5.5): a normal jump lands at <= 5.46, so only real drops rumble
export const BOUNCE_VY = -6.5; // upward launch faster than any jump (pad = -6.6 / -8.2)
export const STOMP_MIN_VY = -4.4; // stomp launch is -4.6 (held: -6.2), from a falling, airborne state
export const TELEPORT_PX = 48;

/** Pure: which events does the transition prev -> cur imply? */
export function deriveEvents(prev: Snap | null, cur: Snap): GameEventName[] {
  if (!prev) return [];
  const out: GameEventName[] = [];
  if (Math.hypot(cur.x - prev.x, cur.y - prev.y) > TELEPORT_PX) return ['respawn'];
  if (!prev.onGround && cur.onGround && prev.vy >= HARD_LAND_VY) out.push('land');
  if (cur.vy <= BOUNCE_VY && prev.vy > BOUNCE_VY) out.push('bounce');
  else if (!prev.onGround && prev.vy >= 0 && cur.vy <= STOMP_MIN_VY && cur.vy > BOUNCE_VY) out.push('stomp');
  return out;
}

/** Stateful wrapper: call `observe` once per local tick with the post-step player state. */
export class EventDeriver {
  private prev: Snap | null = null;
  constructor(private events: GameEvents = gameEvents) {}
  observe(cur: Snap | null): GameEventName[] {
    if (!cur) {
      this.prev = null;
      return [];
    }
    const evs = deriveEvents(this.prev, cur);
    this.prev = { x: cur.x, y: cur.y, vy: cur.vy, onGround: cur.onGround };
    for (const e of evs) this.events.emit(e);
    return evs;
  }
}

export interface RumblePreset {
  duration: number; // ms
  weak: number; // 0..1 high-frequency motor
  strong: number; // 0..1 low-frequency motor
}
export const PRESETS: Record<GameEventName, RumblePreset> = {
  land: { duration: 70, weak: 0.25, strong: 0.45 },
  stomp: { duration: 90, weak: 0.5, strong: 0.35 },
  bounce: { duration: 110, weak: 0.6, strong: 0.5 },
  hurt: { duration: 260, weak: 0.7, strong: 0.9 },
  respawn: { duration: 160, weak: 0.3, strong: 0.5 },
  shard: { duration: 40, weak: 0.3, strong: 0.1 }, // tiny tick on pickup
  door: { duration: 130, weak: 0.15, strong: 0.3 }, // soft thump when a gate opens
};

interface Actuator {
  playEffect?: (type: string, params: Record<string, number>) => Promise<unknown>;
  pulse?: (value: number, duration: number) => Promise<unknown>;
}

export class Rumble {
  private lastAt = 0;
  /** Count of successfully dispatched pulses (diagnostics / tests). */
  fired = 0;
  constructor(
    private activePad: () => PadLike | null,
    private enabled: () => boolean,
  ) {}

  /** True if the active pad exposes any haptics API. */
  get supported(): boolean {
    const p = this.activePad();
    return !!p && (!!(p.vibrationActuator as Actuator | undefined)?.playEffect || !!(p.hapticActuators as Actuator[] | undefined)?.[0]?.pulse);
  }

  pulse(name: GameEventName): boolean {
    try {
      if (!this.enabled()) return false;
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (now - this.lastAt < 60) return false; // never stack pulses on the same tick burst
      const pad = this.activePad();
      if (!pad) return false;
      const p = PRESETS[name];
      const va = pad.vibrationActuator as Actuator | undefined;
      if (va?.playEffect) {
        void va
          .playEffect('dual-rumble', { startDelay: 0, duration: p.duration, weakMagnitude: p.weak, strongMagnitude: p.strong })
          ?.catch?.(() => {});
      } else {
        const ha = (pad.hapticActuators as Actuator[] | undefined)?.[0];
        if (!ha?.pulse) return false;
        void ha.pulse(Math.max(p.weak, p.strong), p.duration)?.catch?.(() => {});
      }
      this.lastAt = now;
      this.fired++;
      return true;
    } catch {
      return false;
    }
  }

  /** Subscribe to a GameEvents bus; returns unsubscribe. */
  attach(events: GameEvents = gameEvents): () => void {
    return events.on('*', (name) => void this.pulse(name));
  }
}
