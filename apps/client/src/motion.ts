// Sim state -> animation selection + gameplay "juice" events. Pure (no Pixi/DOM) so it is unit-testable.
// Timing is in milliseconds; HERO_ANIMS tick tables (60 Hz) are converted with TICK_MS.
import { HERO_ANIMS } from './art';

export const TICK_MS = 1000 / 60;
const WALK_MAX = 1.4; // MOVEMENT.walkMax: walk cycle plays at its authored rate at this speed
const RUN_MAX = 2.6; // MOVEMENT.runMax
const IDLE_SPEED = 0.06;
const RUN_SPEED = 1.55; // above walkMax -> run cycle
const TAKEOFF_MS = 4 * TICK_MS; // jump_anticipation pose held briefly as the launch squash
const LAND_HARD_MS = 12 * TICK_MS; // land_0 + land_1 (authored 5 + 7 ticks)
const LAND_SOFT_MS = 7 * TICK_MS; // land_1 only
const HARD_IMPACT = 3; // px/tick fall speed that earns the deep squash
const SKID_HOLD_MS = 120;
const STOMP_SPIN_MS = 420;
const HURT_MS = 360;
const RESPAWN_FLASH_MS = 900;
const TELEPORT_PX = 64;

export interface MotionIn {
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  facing: number;
}

export type MotionEvent =
  | { k: 'land'; impact: number }
  | { k: 'skid' }
  | { k: 'runstart' }
  | { k: 'launch'; vy: number; fromGround: boolean }
  | { k: 'respawn' };

export interface MotionOut {
  anim: string; // key of HERO_ANIMS
  frame: number; // index into that anim's frames
  flip: boolean; // true = face left
  flash: boolean; // respawn invulnerability blink (caller may strobe alpha)
  events: MotionEvent[];
}

const EMPTY: MotionEvent[] = [];

export class Motion {
  private anim = 'idle';
  private t = 0; // ms inside the current anim (or phase ticks for cycles)
  private phase = 0; // walk/run cycle position in frames
  private last = -1;
  private prev: MotionIn | null = null;
  private airMs = 0;
  private takeoffMs = 0;
  private landMs = 0;
  private landHard = false;
  private skidMs = 0;
  private stompMs = 0;
  private hurtMs = 0;
  private flashMs = 0;
  private running = false;
  private facing = 1;

  /** The attacker's stomp-bounce: show the spin pose. */
  markStomp(): void {
    this.stompMs = STOMP_SPIN_MS;
  }
  /** The victim of a stomp. */
  markHurt(): void {
    this.hurtMs = HURT_MS;
  }

  update(now: number, s: MotionIn): MotionOut {
    const dt = this.last < 0 ? 0 : Math.min(100, Math.max(0, now - this.last));
    this.last = now;
    const events: MotionEvent[] = [];
    const p = this.prev;
    this.facing = s.facing >= 0 ? 1 : -1;

    if (p) {
      const teleport = Math.hypot(s.x - p.x, s.y - p.y) > TELEPORT_PX && s.vy === 0 && s.vx === 0;
      if (teleport) {
        this.flashMs = RESPAWN_FLASH_MS;
        this.landMs = this.stompMs = this.hurtMs = 0;
        events.push({ k: 'respawn' });
      } else {
        if (!p.onGround && s.onGround) {
          this.landHard = p.vy >= HARD_IMPACT;
          this.landMs = this.landHard ? LAND_HARD_MS : LAND_SOFT_MS;
          this.stompMs = 0;
          events.push({ k: 'land', impact: p.vy });
        }
        if (p.vy - s.vy > 3.5 && s.vy < -3.5) {
          events.push({ k: 'launch', vy: s.vy, fromGround: p.onGround });
          this.takeoffMs = s.vy > -5.6 && p.onGround ? TAKEOFF_MS : 0;
          this.landMs = 0;
        }
        const skidding = s.onGround && Math.abs(s.vx) > 0.6 && s.vx * s.facing < 0;
        if (skidding && this.skidMs <= 0) events.push({ k: 'skid' });
        if (skidding) this.skidMs = SKID_HOLD_MS;
      }
    }
    this.prev = { ...s };

    this.skidMs = Math.max(0, this.skidMs - dt);
    this.landMs = Math.max(0, this.landMs - dt);
    this.takeoffMs = Math.max(0, this.takeoffMs - dt);
    this.stompMs = s.onGround ? 0 : Math.max(0, this.stompMs - dt);
    this.hurtMs = Math.max(0, this.hurtMs - dt);
    this.flashMs = Math.max(0, this.flashMs - dt);
    this.airMs = s.onGround ? 0 : this.airMs + dt;

    const ax = Math.abs(s.vx);
    let anim: string;
    if (this.flashMs > 0) anim = 'respawn';
    else if (this.hurtMs > 0) anim = 'hurt';
    else if (this.stompMs > 0) anim = 'stomp';
    else if (!s.onGround) {
      anim = this.takeoffMs > 0 ? 'jump_start' : s.vy < -1.2 ? 'jump_rise' : s.vy > 1.2 ? 'fall' : 'jump_apex';
    } else if (this.landMs > 0) anim = 'land';
    else if (this.skidMs > 0) anim = 'skid';
    else if (ax < IDLE_SPEED) anim = 'idle';
    else anim = ax > RUN_SPEED ? 'run' : 'walk';

    const isRun = anim === 'run';
    if (isRun && !this.running) events.push({ k: 'runstart' });
    this.running = isRun;

    const def = HERO_ANIMS[anim];
    if (anim !== this.anim) {
      // keep the stride when flipping between walk and run so legs do not snap
      const cyc = (a: string) => a === 'walk' || a === 'run';
      if (cyc(anim) && cyc(this.anim)) this.phase = (this.phase / HERO_ANIMS[this.anim].frames.length) * def.frames.length;
      else this.phase = 0;
      this.t = 0;
      if (anim === 'land' && !this.landHard) this.t = HERO_ANIMS.land.ticks[0] * TICK_MS; // soft: start on land_1
      this.anim = anim;
    }

    let frame = 0;
    if (anim === 'walk' || anim === 'run') {
      // stride rate follows real speed: authored per-frame ticks at walkMax / runMax
      const nominal = def.ticks[0] * TICK_MS;
      const rate = anim === 'walk' ? Math.max(0.45, ax / WALK_MAX) : Math.max(0.7, ax / RUN_MAX);
      this.phase = (this.phase + (dt / nominal) * rate) % def.frames.length;
      frame = Math.floor(this.phase);
    } else {
      this.t += dt;
      frame = frameAt(def.ticks, def.loop, this.t);
    }
    return { anim, frame, flip: this.facing < 0, flash: this.flashMs > 0, events: events.length ? events : EMPTY };
  }
}

/** Frame index after `ms` of playback of a per-frame tick table. */
export function frameAt(ticks: number[], loop: boolean, ms: number): number {
  const total = ticks.reduce((a, b) => a + b, 0) * TICK_MS;
  let t = loop ? ms % total : Math.min(ms, total - 0.001);
  for (let i = 0; i < ticks.length; i++) {
    t -= ticks[i] * TICK_MS;
    if (t < 0) return i;
  }
  return ticks.length - 1;
}
