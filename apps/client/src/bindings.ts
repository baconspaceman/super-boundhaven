// Control bindings + settings: pure data/logic (no DOM) so it is unit-testable. Persisted via ControlsStore.
import { BTN } from '@sbh/sim';
import type { PadTracker } from './gamepad';

const B = BTN as unknown as Record<string, number | undefined>;
/** The 6-bit input mask the sim understands. CROUCH/ACTION fall back to local values until @sbh/sim defines them. */
export const BIT = {
  LEFT: BTN.LEFT,
  RIGHT: BTN.RIGHT,
  JUMP: BTN.JUMP,
  RUN: BTN.RUN,
  CROUCH: B.CROUCH ?? 16, // matches @sbh/sim BTN once merged
  ACTION: B.ACTION ?? 32, // matches @sbh/sim BTN once merged
} as const;

export type ActionId = 'left' | 'right' | 'jump' | 'run' | 'crouch' | 'action' | 'creator' | 'menu';
export type Device = 'kb' | 'pad';

export interface ActionDef {
  id: ActionId;
  label: string;
  /** Bit in the sim input mask (game actions). System actions (creator/menu) have none. */
  bit?: number;
  system?: boolean;
}

export const ACTIONS: readonly ActionDef[] = [
  { id: 'left', label: 'Move Left', bit: BIT.LEFT },
  { id: 'right', label: 'Move Right', bit: BIT.RIGHT },
  { id: 'jump', label: 'Jump', bit: BIT.JUMP },
  { id: 'run', label: 'Run', bit: BIT.RUN },
  { id: 'crouch', label: 'Crouch / Drop', bit: BIT.CROUCH },
  { id: 'action', label: 'Action', bit: BIT.ACTION },
  { id: 'creator', label: 'Character Creator', system: true },
  { id: 'menu', label: 'Pause Menu', system: true },
];
export const ACTION_IDS: readonly ActionId[] = ACTIONS.map((a) => a.id);
export const actionLabel = (id: ActionId): string => ACTIONS.find((a) => a.id === id)?.label ?? id;

/** Gamepad tokens: "b0".."b16" = standard button index, "lx-" "lx+" "ly-" "ly+" "rx-" "rx+" "ry-" "ry+" = stick directions. */
const PAD_TOKEN = /^(b(1[0-6]|[0-9])|[lr][xy][+-])$/;
export const isPadToken = (t: string): boolean => PAD_TOKEN.test(t);
export const isKeyToken = (t: string): boolean => /^[A-Z][A-Za-z0-9]{0,23}$/.test(t);

export type BindMap = Record<ActionId, string[]>;
export interface Bindings {
  kb: BindMap;
  pad: BindMap;
}

export interface Settings {
  /** Radial stick deadzone, 0.10..0.50. */
  deadzone: number;
  /** Run is a toggle (press to start/stop) instead of hold. */
  runToggle: boolean;
  rumble: boolean;
  /** The first-join "controls" hint has been shown once. */
  hintSeen: boolean;
}

export interface ControlsConfig {
  v: 1;
  bindings: Bindings;
  settings: Settings;
}

export const SCHEMA_VERSION = 1 as const;
export const STORAGE_KEY = 'sbh.controls';
export const MAX_SLOTS = 3;
export const DEADZONE_MIN = 0.1;
export const DEADZONE_MAX = 0.5;
export const DEADZONE_STEP = 0.05;

export const DEFAULT_KB: BindMap = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  jump: ['Space', 'KeyZ', 'KeyK', 'ArrowUp', 'KeyW'],
  run: ['ShiftLeft', 'ShiftRight', 'KeyX', 'KeyJ'],
  crouch: ['ArrowDown', 'KeyS'],
  action: ['KeyE', 'KeyF', 'Enter'],
  creator: ['KeyC'],
  menu: ['Escape'],
};

// SMW-spirit: A jumps, X runs, D-pad/stick move, Y acts. b0=A b1=B b2=X b3=Y b4=LB b5=RB b6=LT b7=RT b8=Back b9=Start
export const DEFAULT_PAD: BindMap = {
  left: ['b14', 'lx-'],
  right: ['b15', 'lx+'],
  jump: ['b0', 'b1'],
  run: ['b2', 'b7'],
  crouch: ['b13', 'ly+', 'b6'],
  action: ['b3', 'b5'],
  creator: ['b8'],
  menu: ['b9'],
};

export const DEFAULT_SETTINGS: Settings = { deadzone: 0.25, runToggle: false, rumble: true, hintSeen: false };

const cloneMap = (m: BindMap): BindMap => Object.fromEntries(ACTION_IDS.map((a) => [a, [...m[a]]])) as BindMap;

export function defaultConfig(): ControlsConfig {
  return { v: SCHEMA_VERSION, bindings: { kb: cloneMap(DEFAULT_KB), pad: cloneMap(DEFAULT_PAD) }, settings: { ...DEFAULT_SETTINGS } };
}

export const cloneConfig = (c: ControlsConfig): ControlsConfig => ({
  v: SCHEMA_VERSION,
  bindings: { kb: cloneMap(c.bindings.kb), pad: cloneMap(c.bindings.pad) },
  settings: { ...c.settings },
});

export const clampDeadzone = (v: number): number =>
  Math.round(Math.min(DEADZONE_MAX, Math.max(DEADZONE_MIN, Number.isFinite(v) ? v : DEFAULT_SETTINGS.deadzone)) / 0.01) * 0.01;

function sanitizeMap(raw: unknown, dev: Device): BindMap {
  const def = dev === 'kb' ? DEFAULT_KB : DEFAULT_PAD;
  const ok = dev === 'kb' ? isKeyToken : isPadToken;
  const out = cloneMap(def);
  if (!raw || typeof raw !== 'object') return out;
  for (const a of ACTION_IDS) {
    const v = (raw as Record<string, unknown>)[a];
    if (!Array.isArray(v)) continue;
    const list = [...new Set(v.filter((t): t is string => typeof t === 'string' && ok(t)))].slice(0, MAX_SLOTS + 2);
    // an action may be left empty by the user, except the menu (otherwise you could never reopen it)
    out[a] = list.length || a !== 'menu' ? list : [...def[a]];
  }
  return out;
}

/** Validate untrusted stored data into a full config. Unknown versions fall back to defaults. */
export function sanitizeConfig(raw: unknown): ControlsConfig {
  const d = defaultConfig();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  if (r.v !== SCHEMA_VERSION) return d;
  const b = (r.bindings ?? {}) as Record<string, unknown>;
  const s = (r.settings ?? {}) as Record<string, unknown>;
  return {
    v: SCHEMA_VERSION,
    bindings: { kb: sanitizeMap(b.kb, 'kb'), pad: sanitizeMap(b.pad, 'pad') },
    settings: {
      deadzone: clampDeadzone(typeof s.deadzone === 'number' ? s.deadzone : DEFAULT_SETTINGS.deadzone),
      runToggle: typeof s.runToggle === 'boolean' ? s.runToggle : DEFAULT_SETTINGS.runToggle,
      rumble: typeof s.rumble === 'boolean' ? s.rumble : DEFAULT_SETTINGS.rumble,
      hintSeen: typeof s.hintSeen === 'boolean' ? s.hintSeen : DEFAULT_SETTINGS.hintSeen,
    },
  };
}

// ---- editing: conflict detection, bind, unbind, reset ------------------------------------------------

/** Actions (other than `except`) already using `token` on `dev`. */
export function findConflicts(cfg: ControlsConfig, dev: Device, token: string, except?: ActionId): ActionId[] {
  const map = cfg.bindings[dev];
  return ACTION_IDS.filter((a) => a !== except && map[a].includes(token));
}

export type BindResult =
  | { ok: true; config: ControlsConfig; displaced: ActionId[] }
  | { ok: false; reason: 'conflict'; conflicts: ActionId[] }
  | { ok: false; reason: 'invalid' | 'last-menu' | 'full' };

/**
 * Bind `token` to `action` on `dev`. `slot` is an index to replace, or `'add'` to append (max MAX_SLOTS).
 * If another action already uses the token, the call fails with `conflict` unless `swap` is true, in which case the
 * token is taken from the other action(s). The menu action can never be left without a binding on a device.
 */
export function bindToken(cfg: ControlsConfig, dev: Device, action: ActionId, token: string, slot: number | 'add', swap = false): BindResult {
  if (!(dev === 'kb' ? isKeyToken(token) : isPadToken(token))) return { ok: false, reason: 'invalid' };
  const conflicts = findConflicts(cfg, dev, token, action);
  if (conflicts.length && !swap) return { ok: false, reason: 'conflict', conflicts };
  const next = cloneConfig(cfg);
  const map = next.bindings[dev];
  for (const c of conflicts) {
    const rest = map[c].filter((t) => t !== token);
    if (c === 'menu' && rest.length === 0) return { ok: false, reason: 'last-menu' };
    map[c] = rest;
  }
  const list = map[action];
  const had = list.indexOf(token);
  if (slot === 'add') {
    if (had < 0) {
      if (list.length >= MAX_SLOTS) return { ok: false, reason: 'full' };
      list.push(token);
    }
  } else {
    let at = slot;
    if (had >= 0 && had !== slot) {
      list.splice(had, 1);
      if (had < slot) at--;
    }
    if (at < list.length) list[at] = token;
    else list.push(token);
  }
  map[action] = [...new Set(list)];
  return { ok: true, config: next, displaced: conflicts };
}

export function unbindSlot(cfg: ControlsConfig, dev: Device, action: ActionId, slot: number): BindResult {
  const next = cloneConfig(cfg);
  const list = next.bindings[dev][action];
  if (slot < 0 || slot >= list.length) return { ok: false, reason: 'invalid' };
  if (action === 'menu' && list.length === 1) return { ok: false, reason: 'last-menu' };
  list.splice(slot, 1);
  return { ok: true, config: next, displaced: [] };
}

export function resetDevice(cfg: ControlsConfig, dev: Device): ControlsConfig {
  const next = cloneConfig(cfg);
  next.bindings[dev] = cloneMap(dev === 'kb' ? DEFAULT_KB : DEFAULT_PAD);
  return next;
}

/** Bindings + settings back to defaults (keeps `hintSeen` so the first-join hint doesn't return). */
export function resetAll(cfg: ControlsConfig): ControlsConfig {
  const d = defaultConfig();
  d.settings.hintSeen = cfg.settings.hintSeen;
  return d;
}

// ---- evaluation: devices -> bitmask ---------------------------------------------------------------

/** Bit lookup per keyboard code, for actions that are in the sim mask. */
export function keyBitTable(cfg: ControlsConfig): Map<string, number> {
  const t = new Map<string, number>();
  for (const a of ACTIONS) {
    if (a.bit === undefined) continue;
    for (const code of cfg.bindings.kb[a.id]) t.set(code, (t.get(code) ?? 0) | a.bit);
  }
  return t;
}

export function maskFromKeys(keys: ReadonlySet<string>, cfg: ControlsConfig): number {
  let m = 0;
  for (const a of ACTIONS) {
    if (a.bit === undefined) continue;
    for (const code of cfg.bindings.kb[a.id]) if (keys.has(code)) m |= a.bit;
  }
  return m;
}

export function tokenDown(t: PadTracker, token: string): boolean {
  if (token[0] === 'b') return t.isDown(Number(token.slice(1)));
  return t.dirs[token as keyof PadTracker['dirs']] === true;
}

export function maskFromPad(t: PadTracker | null, cfg: ControlsConfig): number {
  if (!t) return 0;
  let m = 0;
  for (const a of ACTIONS) {
    if (a.bit === undefined) continue;
    for (const tok of cfg.bindings.pad[a.id]) {
      if (tokenDown(t, tok)) {
        m |= a.bit;
        break;
      }
    }
  }
  return m;
}

/** System actions fired by a key press / pad edge. */
export function systemActionsForKey(code: string, cfg: ControlsConfig): ActionId[] {
  return ACTIONS.filter((a) => a.system && cfg.bindings.kb[a.id].includes(code)).map((a) => a.id);
}
export function systemActionsForPad(t: PadTracker, cfg: ControlsConfig): ActionId[] {
  const out: ActionId[] = [];
  for (const a of ACTIONS) {
    if (!a.system) continue;
    for (const tok of cfg.bindings.pad[a.id]) {
      const fired = tok[0] === 'b' ? t.justPressed(Number(tok.slice(1))) : t.dirEdges.includes(tok as never);
      if (fired) {
        out.push(a.id);
        break;
      }
    }
  }
  return out;
}

/** Token for the first fresh input on a pad (button edge, else stick direction edge), for "press to bind". */
export function captureToken(t: PadTracker): string | null {
  for (const i of t.pressedEdges) {
    if (i !== 16) return `b${i}`; // Home/Guide is usually intercepted by the OS; don't offer it
  }
  const d = t.dirEdges[0];
  return d ?? null;
}

// ---- persistence --------------------------------------------------------------------------------

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/** Holds the live config; loads/saves with try/catch so it works with storage blocked. */
export class ControlsStore {
  cfg: ControlsConfig = defaultConfig();
  private listeners = new Set<(c: ControlsConfig) => void>();

  constructor(private storage: StorageLike | null = defaultStorage()) {
    this.load();
  }

  load(): void {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      this.cfg = raw ? sanitizeConfig(JSON.parse(raw)) : defaultConfig();
    } catch {
      this.cfg = defaultConfig();
    }
  }

  set(cfg: ControlsConfig): void {
    this.cfg = sanitizeConfig(cfg);
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.cfg));
    } catch {
      /* storage unavailable: settings last for this session only */
    }
    for (const fn of this.listeners) fn(this.cfg);
  }

  patchSettings(p: Partial<Settings>): void {
    const next = cloneConfig(this.cfg);
    Object.assign(next.settings, p);
    this.set(next);
  }

  subscribe(fn: (c: ControlsConfig) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
