import { describe, expect, it } from 'vitest';
import {
  ACTION_IDS,
  BIT,
  ControlsStore,
  DEFAULT_PAD,
  STORAGE_KEY,
  bindToken,
  captureToken,
  defaultConfig,
  findConflicts,
  maskFromKeys,
  maskFromPad,
  resetAll,
  resetDevice,
  sanitizeConfig,
  systemActionsForKey,
  systemActionsForPad,
  unbindSlot,
} from '../src/bindings';
import { PadTracker, STD, normalizePad } from '../src/gamepad';
import { fakePad } from './fakepad';

const update = (p: ReturnType<typeof fakePad>, t = new PadTracker(0, p.pad.id, 'standard')) => {
  t.update(normalizePad(p.pad), 0.25, 0);
  return t;
};

describe('default bindings -> bitmask', () => {
  it('has a sane 6-bit mask', () => {
    expect([BIT.LEFT, BIT.RIGHT, BIT.JUMP, BIT.RUN, BIT.CROUCH, BIT.ACTION]).toEqual([1, 2, 4, 8, 16, 32]);
  });
  it('keyboard: arrows/WASD/space/shift/S/E', () => {
    const cfg = defaultConfig();
    expect(maskFromKeys(new Set(['ArrowLeft', 'Space']), cfg)).toBe(BIT.LEFT | BIT.JUMP);
    expect(maskFromKeys(new Set(['KeyD', 'ShiftLeft', 'KeyS']), cfg)).toBe(BIT.RIGHT | BIT.RUN | BIT.CROUCH);
    expect(maskFromKeys(new Set(['KeyE']), cfg)).toBe(BIT.ACTION);
    expect(maskFromKeys(new Set(['KeyC', 'Escape']), cfg)).toBe(0);
  });
  it('gamepad: stick/dpad move, A+B jump, X+RT run, dpad-down/stick-down/LT crouch, Y+RB action', () => {
    const cfg = defaultConfig();
    const p = fakePad();
    expect(maskFromPad(update(p), cfg)).toBe(0);
    const run = (fn: () => void) => {
      p.clear();
      fn();
      return maskFromPad(update(p), cfg);
    };
    expect(run(() => p.axes(-1, 0))).toBe(BIT.LEFT);
    expect(run(() => p.press(STD.RIGHT))).toBe(BIT.RIGHT);
    expect(run(() => p.press(STD.A))).toBe(BIT.JUMP);
    expect(run(() => p.press(STD.B))).toBe(BIT.JUMP);
    expect(run(() => p.press(STD.X))).toBe(BIT.RUN);
    expect(run(() => p.press(STD.RT, 1))).toBe(BIT.RUN);
    expect(run(() => p.press(STD.DOWN))).toBe(BIT.CROUCH);
    expect(run(() => p.axes(0, 1))).toBe(BIT.CROUCH);
    expect(run(() => p.press(STD.LT, 1))).toBe(BIT.CROUCH);
    expect(run(() => p.press(STD.Y))).toBe(BIT.ACTION);
    expect(run(() => p.press(STD.RB))).toBe(BIT.ACTION);
    expect(run(() => p.axes(1, 0).press(STD.A).press(STD.X))).toBe(BIT.RIGHT | BIT.JUMP | BIT.RUN);
  });
  it('system actions: Back = creator, Start = menu, C / Esc on keyboard', () => {
    const cfg = defaultConfig();
    const p = fakePad();
    const t = new PadTracker(0, p.pad.id, 'standard');
    p.press(STD.START);
    update(p, t);
    expect(systemActionsForPad(t, cfg)).toEqual(['menu']);
    update(p, t);
    expect(systemActionsForPad(t, cfg)).toEqual([]); // edge only
    p.clear().press(STD.BACK);
    update(p, t);
    expect(systemActionsForPad(t, cfg)).toEqual(['creator']);
    expect(systemActionsForKey('KeyC', cfg)).toEqual(['creator']);
    expect(systemActionsForKey('Escape', cfg)).toEqual(['menu']);
  });
  it('captureToken yields a button edge or a stick direction', () => {
    const p = fakePad();
    const t = new PadTracker(0, p.pad.id, 'standard');
    p.press(STD.Y);
    update(p, t);
    expect(captureToken(t)).toBe('b3');
    p.clear().axes(0, 0, 0.9, 0);
    update(p, t);
    expect(captureToken(t)).toBe('rx+');
  });
});

describe('conflicts and editing', () => {
  it('finds conflicts', () => {
    const cfg = defaultConfig();
    expect(findConflicts(cfg, 'pad', 'b0')).toEqual(['jump']);
    expect(findConflicts(cfg, 'pad', 'b0', 'jump')).toEqual([]);
    expect(findConflicts(cfg, 'kb', 'KeyZ')).toEqual(['jump']);
    expect(findConflicts(cfg, 'kb', 'KeyQ')).toEqual([]);
  });
  it('bind refuses a conflict unless swap=true, then takes it from the other action', () => {
    const cfg = defaultConfig();
    expect(bindToken(cfg, 'pad', 'run', 'b0', 'add')).toMatchObject({ ok: false, reason: 'conflict', conflicts: ['jump'] });
    const s = bindToken(cfg, 'pad', 'run', 'b0', 0, true);
    expect(s.ok && s.config.bindings.pad.run[0]).toBe('b0');
    expect(s.ok && s.config.bindings.pad.jump).toEqual(['b1']);
    expect(cfg.bindings.pad.jump).toEqual(['b0', 'b1']); // original untouched
  });
  it('replaces a slot, appends up to 3, rejects the 4th', () => {
    const r1 = bindToken(defaultConfig(), 'kb', 'jump', 'KeyQ', 0);
    expect(r1.ok && r1.config.bindings.kb.jump[0]).toBe('KeyQ');
    const cfg = defaultConfig();
    cfg.bindings.kb.creator = ['KeyC', 'KeyV'];
    const r2 = bindToken(cfg, 'kb', 'creator', 'KeyB', 'add');
    expect(r2.ok && r2.config.bindings.kb.creator).toEqual(['KeyC', 'KeyV', 'KeyB']);
    if (r2.ok) expect(bindToken(r2.config, 'kb', 'creator', 'KeyN', 'add')).toMatchObject({ ok: false, reason: 'full' });
  });
  it('rejects tokens that do not belong to the device', () => {
    expect(bindToken(defaultConfig(), 'pad', 'jump', 'KeyZ', 'add')).toMatchObject({ ok: false, reason: 'invalid' });
    expect(bindToken(defaultConfig(), 'kb', 'jump', 'b3', 'add')).toMatchObject({ ok: false, reason: 'invalid' });
  });
  it('never lets the menu lose its last binding', () => {
    const cfg = defaultConfig();
    expect(unbindSlot(cfg, 'pad', 'menu', 0)).toMatchObject({ ok: false, reason: 'last-menu' });
    expect(bindToken(cfg, 'pad', 'jump', 'b9', 0, true)).toMatchObject({ ok: false, reason: 'last-menu' });
    expect(unbindSlot(cfg, 'pad', 'run', 0).ok).toBe(true);
  });
  it('reset device / reset all', () => {
    let cfg = defaultConfig();
    const r = bindToken(cfg, 'pad', 'jump', 'b4', 0, true);
    if (r.ok) cfg = r.config;
    cfg.settings.deadzone = 0.4;
    cfg.settings.hintSeen = true;
    expect(resetDevice(cfg, 'kb').bindings.pad.jump[0]).toBe('b4');
    expect(resetDevice(cfg, 'pad').bindings.pad).toEqual(DEFAULT_PAD);
    const all = resetAll(cfg);
    expect(all.bindings.pad).toEqual(DEFAULT_PAD);
    expect(all.settings.deadzone).toBe(0.25);
    expect(all.settings.hintSeen).toBe(true);
  });
});

describe('persistence', () => {
  it('sanitizes garbage and unknown versions to defaults', () => {
    expect(sanitizeConfig(null)).toEqual(defaultConfig());
    expect(sanitizeConfig({ v: 99, bindings: { kb: { jump: ['KeyQ'] } } })).toEqual(defaultConfig());
  });
  it('keeps valid data, drops invalid tokens, clamps settings, restores an emptied menu', () => {
    const c = sanitizeConfig({
      v: 1,
      bindings: { kb: { jump: ['KeyQ', 5, '!!bad'], menu: [] }, pad: { jump: ['b2', 'zzz'], run: [] } },
      settings: { deadzone: 9, runToggle: true, rumble: 'no' },
    });
    expect(c.bindings.kb.jump).toEqual(['KeyQ']);
    expect(c.bindings.kb.menu).toEqual(['Escape']);
    expect(c.bindings.pad.jump).toEqual(['b2']);
    expect(c.bindings.pad.run).toEqual([]);
    expect(c.settings).toMatchObject({ deadzone: 0.5, runToggle: true, rumble: true });
    for (const a of ACTION_IDS) expect(Array.isArray(c.bindings.kb[a])).toBe(true);
  });
  it('store round-trips through storage and survives broken/absent storage', () => {
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    const s = new ControlsStore(storage);
    s.patchSettings({ runToggle: true, deadzone: 0.3 });
    expect(JSON.parse(mem.get(STORAGE_KEY)!).v).toBe(1);
    expect(new ControlsStore(storage).cfg.settings).toMatchObject({ runToggle: true, deadzone: 0.3 });
    mem.set(STORAGE_KEY, '{not json');
    expect(new ControlsStore(storage).cfg).toEqual(defaultConfig());
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const s3 = new ControlsStore(throwing);
    expect(() => s3.patchSettings({ rumble: false })).not.toThrow();
    expect(s3.cfg.settings.rumble).toBe(false);
    expect(new ControlsStore(null).cfg).toEqual(defaultConfig());
  });
  it('notifies subscribers', () => {
    const s = new ControlsStore(null);
    let n = 0;
    const off = s.subscribe(() => n++);
    s.patchSettings({ rumble: false });
    off();
    s.patchSettings({ rumble: true });
    expect(n).toBe(1);
  });
});
