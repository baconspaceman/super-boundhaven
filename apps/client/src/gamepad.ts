// Gamepad layer: Web Gamepad API -> a normalized "standard layout" frame -> debounced/hysteresis'd state.
//
// Everything here is DOM-free except `Gamepads.start()` (window events) so the logic is unit-testable:
// tests inject `getPads` with fake pads. See docs/CONTROLS.md for the supported-controller matrix.

/** Indices of the W3C "standard" gamepad layout (positional: STD.A is the bottom/south face button). */
export const STD = {
  A: 0, // south  (Xbox A, PS cross, Switch B)
  B: 1, // east   (Xbox B, PS circle, Switch A)
  X: 2, // west   (Xbox X, PS square, Switch Y)
  Y: 3, // north  (Xbox Y, PS triangle, Switch X)
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  BACK: 8, // View / Share-Create / Minus
  START: 9, // Menu / Options / Plus
  L3: 10,
  R3: 11,
  UP: 12,
  DOWN: 13,
  LEFT: 14,
  RIGHT: 15,
  HOME: 16,
} as const;
export const STD_COUNT = 17;

export type PadKind = 'xbox' | 'playstation' | 'switch' | 'generic';

export interface PadButtonLike {
  pressed: boolean;
  value: number;
}
/** Structural subset of the DOM `Gamepad` so tests can pass plain objects. */
export interface PadLike {
  id: string;
  index: number;
  connected: boolean;
  mapping: string;
  buttons: ReadonlyArray<PadButtonLike>;
  axes: ReadonlyArray<number>;
  vibrationActuator?: unknown;
  hapticActuators?: unknown;
}

// ---- identification ------------------------------------------------------------------------------

export interface PadIdInfo {
  vendor: string | null; // 4 hex digits, lowercase
  product: string | null;
  name: string;
}

/** Chrome: "Name (STANDARD GAMEPAD Vendor: 054c Product: 09cc)" / "Name (Vendor: 045e Product: 028e)".
 *  Firefox: "054c-09cc-Wireless Controller". Safari: "Name (STANDARD GAMEPAD Vendor: ..)". */
export function parsePadId(id: string): PadIdInfo {
  const chrome = /Vendor:\s*([0-9a-f]{4})\s*Product:\s*([0-9a-f]{4})/i.exec(id);
  if (chrome) {
    return {
      vendor: chrome[1].toLowerCase(),
      product: chrome[2].toLowerCase(),
      name: id.replace(/\s*\(.*\)\s*$/, '').trim(),
    };
  }
  const ff = /^([0-9a-f]{4})-([0-9a-f]{4})-(.*)$/i.exec(id);
  if (ff) return { vendor: ff[1].toLowerCase(), product: ff[2].toLowerCase(), name: ff[3].trim() };
  return { vendor: null, product: null, name: id.replace(/\s*\(.*\)\s*$/, '').trim() };
}

const VENDOR_KIND: Record<string, PadKind> = {
  '045e': 'xbox', // Microsoft
  '054c': 'playstation', // Sony
  '057e': 'switch', // Nintendo
};

export function padKind(id: string): PadKind {
  const { vendor, name } = parsePadId(id);
  if (vendor && VENDOR_KIND[vendor]) return VENDOR_KIND[vendor];
  const s = `${id} ${name}`.toLowerCase();
  if (/xbox|xinput|x-box|microsoft/.test(s)) return 'xbox';
  if (/dualshock|dualsense|playstation|\bps[345]\b|sony|wireless controller/.test(s)) return 'playstation';
  if (/nintendo|switch|joy-?con|pro controller/.test(s)) return 'switch';
  return 'generic';
}

/** Human name for toasts: "Xbox Controller", "DualSense Controller", ... */
export function friendlyPadName(id: string): string {
  const { product, name } = parsePadId(id);
  const kind = padKind(id);
  if (kind === 'xbox') return 'Xbox Controller';
  if (kind === 'playstation') {
    if (product === '0ce6' || product === '0df2' || /dualsense/i.test(id)) return 'DualSense Controller';
    if (product && ['05c4', '09cc', '0ba0'].includes(product)) return 'DualShock 4 Controller';
    if (/dualshock/i.test(id)) return 'DualShock Controller';
    return 'PlayStation Controller';
  }
  if (kind === 'switch') return product === '2009' ? 'Switch Pro Controller' : 'Switch Controller';
  return name && !/^unknown/i.test(name) ? name : 'Controller';
}

// ---- normalization to the standard layout -------------------------------------------------------

/** One poll of one pad, in standard-layout terms. Sticks are raw (not deadzoned). */
export interface StdFrame {
  pressed: boolean[]; // length STD_COUNT
  value: number[]; // length STD_COUNT, 0..1
  lx: number;
  ly: number;
  rx: number;
  ry: number;
  profile: string; // which normalization path was used (debug)
}

/** Decode a "hat switch" axis (the 9-position encoding Chrome/Firefox use on non-standard pads). */
export function decodeHat(v: number): { up: boolean; down: boolean; left: boolean; right: boolean } {
  const none = { up: false, down: false, left: false, right: false };
  if (!Number.isFinite(v) || v > 1.1 || v < -1.1) return none; // ~1.286 = neutral
  // 8 positions at -1, -5/7, -3/7, -1/7, 1/7, 3/7, 5/7, 1 : N, NE, E, SE, S, SW, W, NW
  const i = Math.round((v + 1) * 3.5);
  switch (i) {
    case 0:
      return { ...none, up: true };
    case 1:
      return { ...none, up: true, right: true };
    case 2:
      return { ...none, right: true };
    case 3:
      return { ...none, down: true, right: true };
    case 4:
      return { ...none, down: true };
    case 5:
      return { ...none, down: true, left: true };
    case 6:
      return { ...none, left: true };
    case 7:
      return { ...none, up: true, left: true };
    default:
      return none;
  }
}

const emptyFrame = (profile: string): StdFrame => ({
  pressed: new Array<boolean>(STD_COUNT).fill(false),
  value: new Array<number>(STD_COUNT).fill(0),
  lx: 0,
  ly: 0,
  rx: 0,
  ry: 0,
  profile,
});

function setBtn(f: StdFrame, i: number, pressed: boolean, value = pressed ? 1 : 0): void {
  f.pressed[i] = pressed;
  f.value[i] = value;
}

const clampAxis = (v: number | undefined) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0);

/** Legacy ("mapping === ''") layouts, keyed by vendor. Best-effort: see docs/CONTROLS.md. */
function normalizeLegacy(pad: PadLike, f: StdFrame, vendor: string | null): StdFrame {
  const b = pad.buttons;
  const a = pad.axes;
  const raw = (i: number) => b[i];
  const copy = (std: number, rawI: number) => {
    const r = raw(rawI);
    if (r) setBtn(f, std, r.pressed || r.value > 0.5, r.value > 0 ? r.value : r.pressed ? 1 : 0);
  };

  if (vendor === '054c') {
    // DualShock 4 / DualSense raw order (Firefox, old Chrome): square, cross, circle, triangle, L1, R1, L2, R2,
    // share, options, L3, R3, PS, touchpad. Sticks 0,1 / 2,(3 or 5). D-pad is hat axis 9 when present.
    f.profile = 'ps-legacy';
    copy(STD.X, 0);
    copy(STD.A, 1);
    copy(STD.B, 2);
    copy(STD.Y, 3);
    copy(STD.LB, 4);
    copy(STD.RB, 5);
    copy(STD.LT, 6);
    copy(STD.RT, 7);
    copy(STD.BACK, 8);
    copy(STD.START, 9);
    copy(STD.L3, 10);
    copy(STD.R3, 11);
    copy(STD.HOME, 12);
    f.lx = clampAxis(a[0]);
    f.ly = clampAxis(a[1]);
    f.rx = clampAxis(a[2]);
    f.ry = clampAxis(a.length >= 10 ? a[5] : a[3]);
    if (a.length >= 10) applyHat(f, a[9]);
    else if (b.length >= 16) for (let i = 12; i <= 15; i++) copy(i, i);
    return f;
  }

  if (vendor === '045e') {
    // Xbox 360/One in non-standard mode (Firefox Linux, some Chrome builds): A B X Y LB RB Back Start Guide L3 R3,
    // D-pad as buttons 11-14 or axes 6/7, triggers as axes 2 and 5 in -1..1.
    f.profile = 'xbox-legacy';
    for (let i = 0; i <= 5; i++) copy(i, i);
    copy(STD.BACK, 6);
    copy(STD.START, 7);
    copy(STD.HOME, 8);
    copy(STD.L3, 9);
    copy(STD.R3, 10);
    f.lx = clampAxis(a[0]);
    f.ly = clampAxis(a[1]);
    f.rx = clampAxis(a[3]);
    f.ry = clampAxis(a[4]);
    const trig = (v: number | undefined) => Math.max(0, Math.min(1, ((typeof v === 'number' ? v : -1) + 1) / 2));
    if (a.length >= 6) {
      const l = trig(a[2]);
      const r = trig(a[5]);
      setBtn(f, STD.LT, l > 0.5, l);
      setBtn(f, STD.RT, r > 0.5, r);
    }
    if (b.length >= 15) {
      copy(STD.UP, 11);
      copy(STD.DOWN, 12);
      copy(STD.LEFT, 13);
      copy(STD.RIGHT, 14);
    } else if (a.length >= 8) {
      setBtn(f, STD.LEFT, a[6] < -0.5);
      setBtn(f, STD.RIGHT, a[6] > 0.5);
      setBtn(f, STD.UP, a[7] < -0.5);
      setBtn(f, STD.DOWN, a[7] > 0.5);
    }
    return f;
  }

  if (vendor === '057e') {
    // Switch Pro / Joy-Con grip in non-standard mode: positional face buttons, L R ZL ZR, - +, L3 R3, Home, Capture,
    // D-pad as hat axis 9.
    f.profile = 'switch-legacy';
    for (let i = 0; i <= 7; i++) copy(i, i);
    copy(STD.BACK, 8);
    copy(STD.START, 9);
    copy(STD.L3, 10);
    copy(STD.R3, 11);
    copy(STD.HOME, 12);
    f.lx = clampAxis(a[0]);
    f.ly = clampAxis(a[1]);
    f.rx = clampAxis(a[2]);
    f.ry = clampAxis(a[3]);
    if (a.length >= 10) applyHat(f, a[9]);
    else if (b.length >= 16) for (let i = 12; i <= 15; i++) copy(i, i);
    return f;
  }

  // Unknown vendor, unknown layout: assume it is *close* to standard (face = 0..3, shoulders 4..7, sticks 0..3).
  f.profile = 'generic-legacy';
  const n = Math.min(b.length, 12);
  for (let i = 0; i < n; i++) copy(i, i);
  if (b.length >= 16) for (let i = 12; i <= 15; i++) copy(i, i);
  else if (a.length >= 10) applyHat(f, a[9]);
  f.lx = clampAxis(a[0]);
  f.ly = clampAxis(a[1]);
  f.rx = clampAxis(a[2]);
  f.ry = clampAxis(a[3]);
  return f;
}

function applyHat(f: StdFrame, v: number): void {
  const h = decodeHat(v);
  setBtn(f, STD.UP, h.up);
  setBtn(f, STD.DOWN, h.down);
  setBtn(f, STD.LEFT, h.left);
  setBtn(f, STD.RIGHT, h.right);
}

/** Convert whatever the browser reports into a StdFrame. `mapping === 'standard'` is trusted as-is. */
export function normalizePad(pad: PadLike): StdFrame {
  const f = emptyFrame('standard');
  if (pad.mapping === 'standard') {
    for (let i = 0; i < STD_COUNT; i++) {
      const bt = pad.buttons[i];
      if (!bt) continue;
      setBtn(f, i, !!bt.pressed || bt.value > 0.5, Number.isFinite(bt.value) ? bt.value : bt.pressed ? 1 : 0);
    }
    f.lx = clampAxis(pad.axes[0]);
    f.ly = clampAxis(pad.axes[1]);
    f.rx = clampAxis(pad.axes[2]);
    f.ry = clampAxis(pad.axes[3]);
    return f;
  }
  return normalizeLegacy(pad, f, parsePadId(pad.id).vendor);
}

// ---- deadzone / hysteresis ---------------------------------------------------------------------

export interface AnalogMove {
  /** -1..1 after radial deadzone + rescale (0 inside the deadzone). Y is positive DOWN (browser convention). */
  x: number;
  y: number;
  /** 0..1 magnitude after rescale. */
  mag: number;
}

export const DEFAULT_DEADZONE = 0.25;
export const MOVE_ON = 0.35;
export const MOVE_OFF = 0.28;
export const VERT_ON = 0.5;
export const VERT_OFF = 0.42;
export const TRIGGER_ON = 0.5;
export const TRIGGER_OFF = 0.35;
/** Release the deadzone gate only once the stick falls below this fraction of the deadzone. */
export const DEADZONE_RELEASE = 0.85;

/** Radial deadzone with hysteresis: engages above `dz`, disengages below `dz * DEADZONE_RELEASE`. */
export class StickFilter {
  private engaged = false;
  /** Gated, unscaled stick (what digital thresholds look at). */
  gx = 0;
  gy = 0;
  analog: AnalogMove = { x: 0, y: 0, mag: 0 };

  apply(x: number, y: number, dz: number): AnalogMove {
    const mag = Math.hypot(x, y);
    this.engaged = this.engaged ? mag > dz * DEADZONE_RELEASE : mag > dz;
    if (!this.engaged || mag === 0) {
      this.gx = this.gy = 0;
      this.analog = { x: 0, y: 0, mag: 0 };
      return this.analog;
    }
    this.gx = x;
    this.gy = y;
    const m = Math.min(1, mag);
    const scaled = Math.max(0, (m - dz) / (1 - dz));
    this.analog = { x: (x / mag) * scaled, y: (y / mag) * scaled, mag: scaled };
    return this.analog;
  }
}

/** Schmitt trigger helper. */
export const hyst = (was: boolean, v: number, on: number, off: number): boolean => (was ? v > off : v > on);

/** Names of the 8 stick directions, matching bindings tokens ("ax0-" == STICK_DIRS[0]). */
export const STICK_DIRS = ['lx-', 'lx+', 'ly-', 'ly+', 'rx-', 'rx+', 'ry-', 'ry+'] as const;
export type StickDir = (typeof STICK_DIRS)[number];

/** Per-pad debounced state, updated once per poll. */
export class PadTracker {
  readonly stickL = new StickFilter();
  readonly stickR = new StickFilter();
  down: boolean[] = new Array<boolean>(STD_COUNT).fill(false);
  prev: boolean[] = new Array<boolean>(STD_COUNT).fill(false);
  value: number[] = new Array<number>(STD_COUNT).fill(0);
  dirs: Record<StickDir, boolean> = { 'lx-': false, 'lx+': false, 'ly-': false, 'ly+': false, 'rx-': false, 'rx+': false, 'ry-': false, 'ry+': false };
  prevDirs: Record<StickDir, boolean> = { ...this.dirs };
  /** Std button indices that went down on the latest update. */
  pressedEdges: number[] = [];
  /** Stick directions that newly crossed the threshold on the latest update. */
  dirEdges: StickDir[] = [];
  lastInputAt = 0;
  profile = '';
  frame: StdFrame | null = null;
  /** True once this pad has produced real input (Chrome withholds pads until the first press). */
  hadInput = false;
  /** Inputs held when an overlay closed; ignored until released so a closing B/A press can't also jump. */
  private sup = new Set<string>();

  constructor(
    public index: number,
    public id: string,
    public mapping: string,
  ) {}

  get kind(): PadKind {
    return padKind(this.id);
  }
  get name(): string {
    return friendlyPadName(this.id);
  }
  get move(): AnalogMove {
    // D-pad overrides the stick (full deflection) so it always works as digital input.
    const dx = (this.down[STD.RIGHT] ? 1 : 0) - (this.down[STD.LEFT] ? 1 : 0);
    const dy = (this.down[STD.DOWN] ? 1 : 0) - (this.down[STD.UP] ? 1 : 0);
    if (dx || dy) {
      const m = Math.hypot(dx, dy);
      return { x: dx / m, y: dy / m, mag: 1 };
    }
    return this.stickL.analog;
  }
  get anyDown(): boolean {
    return this.down.some(Boolean) || Object.values(this.dirs).some(Boolean);
  }

  update(frame: StdFrame, deadzone: number, now: number): void {
    this.frame = frame;
    this.profile = frame.profile;
    this.prev = this.down;
    this.prevDirs = this.dirs;
    const down = new Array<boolean>(STD_COUNT).fill(false);
    this.pressedEdges = [];
    this.dirEdges = [];
    let activity = false;
    for (let i = 0; i < STD_COUNT; i++) {
      const v = frame.value[i] ?? 0;
      this.value[i] = v;
      const analogBtn = i === STD.LT || i === STD.RT;
      const was = this.prev[i];
      let d = analogBtn ? hyst(was, v, TRIGGER_ON, TRIGGER_OFF) || (frame.pressed[i] && v === 0) : frame.pressed[i];
      if (this.sup.has(`b${i}`)) {
        if (!d) this.sup.delete(`b${i}`);
        d = false;
      }
      down[i] = d;
      if (down[i] && !was) {
        this.pressedEdges.push(i);
        activity = true;
      }
    }
    this.down = down;

    this.stickL.apply(frame.lx, frame.ly, deadzone);
    this.stickR.apply(frame.rx, frame.ry, deadzone);
    const d = { ...this.dirs } as Record<StickDir, boolean>;
    const set = (k: StickDir, v: number, on: number, off: number) => {
      d[k] = hyst(this.prevDirs[k], v, on, off);
      if (this.sup.has(k)) {
        if (!d[k]) this.sup.delete(k);
        d[k] = false;
      }
      if (d[k] && !this.prevDirs[k]) this.dirEdges.push(k);
    };
    set('lx-', -this.stickL.gx, MOVE_ON, MOVE_OFF);
    set('lx+', this.stickL.gx, MOVE_ON, MOVE_OFF);
    set('ly-', -this.stickL.gy, VERT_ON, VERT_OFF);
    set('ly+', this.stickL.gy, VERT_ON, VERT_OFF);
    set('rx-', -this.stickR.gx, MOVE_ON, MOVE_OFF);
    set('rx+', this.stickR.gx, MOVE_ON, MOVE_OFF);
    set('ry-', -this.stickR.gy, VERT_ON, VERT_OFF);
    set('ry+', this.stickR.gy, VERT_ON, VERT_OFF);
    this.dirs = d;
    if (this.dirEdges.length) activity = true;

    if (activity) {
      this.lastInputAt = now;
      this.hadInput = true;
    }
  }

  isDown(i: number): boolean {
    return this.down[i] === true;
  }
  justPressed(i: number): boolean {
    return this.down[i] === true && this.prev[i] !== true;
  }
  /** Ignore everything currently held until it is released (call when an overlay closes). */
  suppressHeld(): void {
    this.down.forEach((v, i) => v && this.sup.add(`b${i}`));
    for (const k of STICK_DIRS) if (this.dirs[k]) this.sup.add(k);
    this.clear();
  }
  /** Release everything (used on disconnect / overlay open so nothing sticks). */
  clear(): void {
    this.down = new Array<boolean>(STD_COUNT).fill(false);
    this.prev = this.down;
    this.dirs = { 'lx-': false, 'lx+': false, 'ly-': false, 'ly+': false, 'rx-': false, 'rx+': false, 'ry-': false, 'ry+': false };
    this.prevDirs = this.dirs;
    this.pressedEdges = [];
    this.dirEdges = [];
    // note: `sup` is deliberately kept across clear()
  }
}

// ---- manager ---------------------------------------------------------------------------------------

export interface PadInfo {
  index: number;
  id: string;
  name: string;
  kind: PadKind;
  mapping: string;
}

export type GetPads = () => ArrayLike<PadLike | null | undefined>;

/** Polls every connected pad each call to `poll()`; exposes the pad that last had input as `active`. */
export class Gamepads {
  deadzone = DEFAULT_DEADZONE;
  private trackers = new Map<number, PadTracker>();
  private raws = new Map<number, PadLike>();
  private activeIdx = -1;
  onConnect: (p: PadInfo) => void = () => {};
  onDisconnect: (p: PadInfo) => void = () => {};
  onActiveChange: (p: PadInfo | null) => void = () => {};

  constructor(private getPads: GetPads = () => (typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [])) {}

  /** Hot-plug events just trigger an immediate poll; polling itself is what detects connect/disconnect. */
  start(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('gamepadconnected', () => this.poll(performance.now()));
    window.addEventListener('gamepaddisconnected', () => this.poll(performance.now()));
  }

  get active(): PadTracker | null {
    return this.trackers.get(this.activeIdx) ?? null;
  }
  get activeRaw(): PadLike | null {
    return this.raws.get(this.activeIdx) ?? null;
  }
  get connectedCount(): number {
    return this.trackers.size;
  }
  list(): { tracker: PadTracker; raw: PadLike }[] {
    return [...this.trackers.entries()].map(([i, tracker]) => ({ tracker, raw: this.raws.get(i)! }));
  }

  private info(t: PadTracker): PadInfo {
    return { index: t.index, id: t.id, name: t.name, kind: t.kind, mapping: t.mapping };
  }

  /** Poll all pads. Call once per fixed tick (and again per frame is harmless). Never throws. */
  poll(now: number): PadTracker | null {
    let list: ArrayLike<PadLike | null | undefined>;
    try {
      list = this.getPads();
    } catch {
      list = [];
    }
    const seen = new Set<number>();
    for (let n = 0; n < list.length; n++) {
      const pad = list[n];
      if (!pad || !pad.connected) continue;
      const idx = pad.index ?? n;
      seen.add(idx);
      this.raws.set(idx, pad);
      let t = this.trackers.get(idx);
      if (t && t.id !== pad.id) {
        this.drop(idx);
        t = undefined;
      }
      if (!t) {
        t = new PadTracker(idx, pad.id, pad.mapping);
        this.trackers.set(idx, t);
        if (this.activeIdx < 0) {
          this.activeIdx = idx;
          this.onActiveChange(this.info(t));
        }
        this.onConnect(this.info(t));
      }
      t.mapping = pad.mapping;
      t.update(normalizePad(pad), this.deadzone, now);
    }
    for (const idx of [...this.trackers.keys()]) if (!seen.has(idx)) this.drop(idx);

    // active pad = the one that most recently had a press / stick move
    let best = this.trackers.get(this.activeIdx) ?? null;
    for (const t of this.trackers.values()) {
      if (t.hadInput && (!best || t.lastInputAt > best.lastInputAt)) best = t;
    }
    if (best && best.index !== this.activeIdx) {
      this.activeIdx = best.index;
      this.onActiveChange(this.info(best));
    } else if (!best && this.activeIdx !== -1) {
      this.activeIdx = -1;
      this.onActiveChange(null);
    }
    return this.active;
  }

  private drop(idx: number): void {
    const t = this.trackers.get(idx);
    this.trackers.delete(idx);
    this.raws.delete(idx);
    if (!t) return;
    t.clear();
    const info = this.info(t);
    this.onDisconnect(info);
    if (this.activeIdx === idx) {
      const next = [...this.trackers.values()][0];
      this.activeIdx = next ? next.index : -1;
      this.onActiveChange(next ? this.info(next) : null);
    }
  }

  /** See PadTracker.suppressHeld. */
  suppressHeld(): void {
    for (const t of this.trackers.values()) t.suppressHeld();
  }

  /** Clear edge/held state on every pad (e.g. when an overlay takes over, so a held button can't leak). */
  releaseAll(): void {
    for (const t of this.trackers.values()) t.clear();
  }
}
