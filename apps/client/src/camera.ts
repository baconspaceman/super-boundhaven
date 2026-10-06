// The follow camera. Pure maths (no Pixi, no DOM) so it can be tested hard. All lengths are world pixels, times in ms.
//
// Behaviour in one paragraph: the camera sits still while the player stays inside a small dead zone, then glides after
// them with a critically damped spring (no overshoot) and a slight look-ahead in the direction they run. Vertically it
// frames the GROUND, not the player: jumps do not move it; landing on a new height re-frames smoothly; falling or a very
// high bounce makes it follow. It only ever zooms OUT (never in, so characters never get bigger than the base view),
// and only to keep nearby teammates in frame, with hysteresis and a slow ease so it is steady almost all the time.
// A hard rule runs last: the local player is always inside the view.
import { UNDERGROUND_ROWS } from './viewport';

export const CAMERA = {
  deadZoneMoving: 24, // px the player may drift from the camera centre before it follows
  deadZoneStill: 4, // ... once they have stopped (the camera quietly re-centres on them)
  lookAheadMax: 28,
  lookAheadGain: 0.18, // seconds of velocity
  velTau: 0.6, // s, low-pass on the player's velocity (long: turning around does not swing the camera)
  stillTau: 0.5, // s, how quickly "moving" turns into "still"
  hSmooth: 0.2, // s, spring response, horizontal
  aimTau: 0.14, // s, the horizontal target itself is eased first (a cascade of two smooth stages: no sudden accelerations)
  hMaxSpeed: 420, // px/s
  groundFrac: 0.8, // where the ground sits on screen (fraction of the view height from the top)
  groundTau: 0.35, // s, smoothing of the ground reference when landing somewhere new
  vSmooth: 0.45, // s, spring response, vertical
  vSmoothCatchUp: 0.22, // s, when the player is outside the vertical comfort band
  vMaxSpeed: 380, // px/s
  upBand: 0.25, // of view height: feet may rise this far above the camera centre before it follows up
  downBand: 0.4, // ... or sink this far below it before it follows down
  zoomMin: 0.7,
  zoomStep: 0.05,
  zoomFill: 0.8, // teammates are kept inside this fraction of the view
  zoomPad: 28,
  zoomSmooth: 0.8, // s
  zoomHoldOut: 0.3, // s a lower zoom target must persist before it is adopted
  zoomHoldIn: 0.9, // s a higher one must persist (slower: no flip-flop)
  teamRadiusX: 260,
  teamRadiusY: 150,
  safeMargin: 24, // px of view kept around the player by the hard rule
  topLimit: -128, // the camera may show this far above the level top (open sky)
  bodyHeight: 28,
} as const;

export interface CameraInput {
  /** local player: x centre, y feet, velocity in px per tick, grounded, facing */
  px: number;
  py: number;
  vx: number;
  onGround: boolean;
  /** other players (feet position) */
  others: { x: number; y: number }[];
  levelW: number;
  levelH: number;
  viewW: number;
  viewH: number;
}

export interface CameraState {
  cx: number;
  cy: number;
  zoom: number;
}

/** Unity-style critically damped follow (no overshoot). Returns [position, velocity]. */
export function smoothDamp(cur: number, target: number, vel: number, smoothTime: number, maxSpeed: number, dt: number): [number, number] {
  const st = Math.max(0.0001, smoothTime);
  const omega = 2 / st;
  const x = omega * dt;
  const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  let change = cur - target;
  const maxChange = maxSpeed * st;
  change = Math.max(-maxChange, Math.min(maxChange, change));
  const tgt = cur - change;
  const temp = (vel + omega * change) * dt;
  let v = (vel - omega * temp) * e;
  let out = tgt + (change + temp) * e;
  if (target - cur > 0 === out > target) {
    out = target;
    v = (out - target) / dt;
  }
  return [out, v];
}

const lerpExp = (dtS: number, tau: number): number => 1 - Math.exp(-dtS / tau);

export class FollowCamera {
  cx = 0;
  cy = 0;
  zoom = 1;
  private vcx = 0;
  private aimX = 0;
  private vcy = 0;
  private vz = 0;
  private groundRef = 0;
  private vGround = 0;
  private vSm = 0; // smoothed player velocity, px/s
  private moving = 0; // 0 still .. 1 moving, smoothed
  private zTarget = 1;
  private zPending = 1;
  private zTimer = 0;
  private started = false;
  /** debug/tuning: zoom can be switched off */
  zoomEnabled = true;

  get state(): CameraState {
    return { cx: this.cx, cy: this.cy, zoom: this.zoom };
  }

  /** Jump straight to the player (first frame, respawn, teleport). */
  snap(i: CameraInput): void {
    this.cx = i.px;
    this.aimX = i.px;
    this.groundRef = i.py;
    this.cy = i.py - (CAMERA.groundFrac - 0.5) * i.viewH;
    this.vcx = this.vcy = this.vGround = this.vSm = this.moving = 0;
    this.started = true;
    this.clampAll(i);
  }

  update(dtMs: number, i: CameraInput): CameraState {
    if (!this.started) this.snap(i);
    let remaining = Math.min(dtMs, 250) / 1000;
    // far outside the view (respawn, teleport, admin /tp): do not glide across the level
    const halfW = i.viewW / (2 * this.zoom);
    const halfH = i.viewH / (2 * this.zoom);
    if (Math.abs(i.px - this.cx) > halfW * 1.8 || Math.abs(i.py - this.cy) > halfH * 1.8) {
      this.snap(i);
      return this.state;
    }
    while (remaining > 1e-6) {
      const dt = Math.min(remaining, 1 / 60);
      remaining -= dt;
      this.step(dt, i);
    }
    this.clampAll(i);
    return this.state;
  }

  private step(dt: number, i: CameraInput): void {
    const C = CAMERA;
    // smoothed velocity and "is the player moving"
    const v = i.vx * 60;
    this.vSm += (v - this.vSm) * lerpExp(dt, C.velTau);
    this.moving += ((Math.abs(v) > 8 ? 1 : 0) - this.moving) * lerpExp(dt, C.stillTau);
    const look = Math.max(-C.lookAheadMax, Math.min(C.lookAheadMax, this.vSm * C.lookAheadGain));
    const dz = C.deadZoneStill + (C.deadZoneMoving - C.deadZoneStill) * this.moving;

    // horizontal: hold inside the dead zone, otherwise glide so the player sits at its edge
    const aim = i.px + look;
    let tx = this.cx;
    if (aim - this.cx > dz) tx = aim - dz;
    else if (this.cx - aim > dz) tx = aim + dz;
    this.aimX += (tx - this.aimX) * lerpExp(dt, C.aimTau);
    [this.cx, this.vcx] = smoothDamp(this.cx, this.aimX, this.vcx, C.hSmooth, C.hMaxSpeed, dt);

    // vertical: frame the ground; follow only when the player leaves the comfort band
    const halfH = i.viewH / (2 * this.zoom);
    const H = 2 * halfH;
    if (i.onGround) [this.groundRef, this.vGround] = smoothDamp(this.groundRef, i.py, this.vGround, C.groundTau, 600, dt);
    let ty = this.groundRef - (C.groundFrac - 0.5) * H;
    let catching = false;
    if (i.py < ty - C.upBand * H) {
      ty = i.py + C.upBand * H;
      catching = true;
    } else if (i.py > ty + C.downBand * H) {
      ty = i.py - C.downBand * H;
      catching = true;
    }
    [this.cy, this.vcy] = smoothDamp(this.cy, ty, this.vcy, catching ? C.vSmoothCatchUp : C.vSmooth, C.vMaxSpeed, dt);

    // zoom: only out, only for teammates, with hysteresis
    this.updateZoom(dt, i);
  }

  private updateZoom(dt: number, i: CameraInput): void {
    const C = CAMERA;
    const zMin = Math.max(C.zoomMin, i.viewW / Math.max(1, i.levelW));
    let want = 1;
    if (this.zoomEnabled) {
      let needX = 0;
      let needY = 0;
      for (const o of i.others) {
        const dx = Math.abs(o.x - i.px);
        const dy = Math.abs(o.y - i.py);
        if (dx > C.teamRadiusX || dy > C.teamRadiusY) continue;
        needX = Math.max(needX, dx + C.zoomPad);
        needY = Math.max(needY, Math.max(Math.abs(o.y - this.cy), Math.abs(o.y - C.bodyHeight - this.cy)) + C.zoomPad);
      }
      const fitX = needX > 0 ? (i.viewW / 2) * C.zoomFill / needX : 1;
      const fitY = needY > 0 ? (i.viewH / 2) * C.zoomFill / needY : 1;
      want = Math.min(1, fitX, fitY);
      want = want >= 0.98 ? 1 : Math.floor(want / C.zoomStep) * C.zoomStep;
      want = Math.max(zMin, want);
    }
    // hysteresis: a different target must persist before it is adopted
    if (Math.abs(want - this.zTarget) >= C.zoomStep - 1e-9 || (want === 1 && this.zTarget !== 1)) {
      if (Math.abs(want - this.zPending) > 1e-9) {
        this.zPending = want;
        this.zTimer = 0;
      }
      this.zTimer += dt;
      if (this.zTimer >= (want < this.zTarget ? C.zoomHoldOut : C.zoomHoldIn)) {
        this.zTarget = want;
        this.zTimer = 0;
      }
    } else {
      this.zTimer = 0;
      this.zPending = this.zTarget;
    }
    this.zTarget = Math.max(zMin, Math.min(1, this.zTarget));
    [this.zoom, this.vz] = smoothDamp(this.zoom, this.zTarget, this.vz, C.zoomSmooth, 2, dt);
    if (this.zTarget === 1 && Math.abs(this.zoom - 1) < 0.003) {
      this.zoom = 1;
      this.vz = 0;
    }
    this.zoom = Math.max(zMin, Math.min(1, this.zoom));
  }

  /** Level bounds first, then the hard rule: the player is always inside the view. */
  private clampAll(i: CameraInput): void {
    const C = CAMERA;
    const halfW = i.viewW / (2 * this.zoom);
    const halfH = i.viewH / (2 * this.zoom);
    const bottom = i.levelH + UNDERGROUND_ROWS * 16;
    const lo = halfW;
    const hi = i.levelW - halfW;
    let cx = lo > hi ? i.levelW / 2 : Math.max(lo, Math.min(hi, this.cx));
    const top = C.topLimit + halfH;
    const bot = bottom - halfH;
    let cy = top > bot ? (C.topLimit + bottom) / 2 : Math.max(top, Math.min(bot, this.cy));
    // hard rule
    const mx = halfW - C.safeMargin;
    cx = Math.max(i.px - mx, Math.min(i.px + mx, cx));
    const my = halfH - C.safeMargin;
    cy = Math.max(i.py - my, Math.min(i.py - C.bodyHeight + my, cy));
    if (cx !== this.cx) {
      this.vcx = 0;
      this.aimX += cx - this.cx; // keep the eased target consistent with where the camera really is
    }
    if (cy !== this.cy) this.vcy = 0;
    this.cx = cx;
    this.cy = cy;
  }
}
