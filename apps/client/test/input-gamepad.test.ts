import { describe, expect, it } from 'vitest';
import { Gamepads, PadTracker, STD, StickFilter, decodeHat, friendlyPadName, normalizePad, padKind, parsePadId, type PadLike } from '../src/gamepad';
import { fakePad } from './fakepad';

describe('pad identification', () => {
  it('parses Chrome and Firefox ids', () => {
    expect(parsePadId('Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)')).toMatchObject({ vendor: '045e', product: '028e' });
    expect(parsePadId('054c-09cc-Wireless Controller')).toMatchObject({ vendor: '054c', product: '09cc', name: 'Wireless Controller' });
    expect(parsePadId('Mystery Pad').vendor).toBeNull();
  });
  it('classifies controller families', () => {
    expect(padKind('Xbox 360 Controller (XInput STANDARD GAMEPAD)')).toBe('xbox');
    expect(padKind('Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)')).toBe('playstation');
    expect(padKind('057e-2009-Pro Controller')).toBe('switch');
    expect(padKind('Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)')).toBe('switch');
    expect(padKind('USB Gamepad  (Vendor: 0079 Product: 0011)')).toBe('generic');
  });
  it('gives friendly names', () => {
    expect(friendlyPadName('Xbox 360 Controller (XInput STANDARD GAMEPAD)')).toBe('Xbox Controller');
    expect(friendlyPadName('Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)')).toBe('DualSense Controller');
    expect(friendlyPadName('054c-09cc-Wireless Controller')).toBe('DualShock 4 Controller');
    expect(friendlyPadName('Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)')).toBe('Switch Pro Controller');
  });
});

describe('normalizePad', () => {
  it('passes standard mapping through, triggers analog', () => {
    const p = fakePad().press(STD.A).press(STD.RT, 0.7).axes(0.5, -0.2, 0, 1);
    const f = normalizePad(p.pad);
    expect(f.pressed[STD.A]).toBe(true);
    expect(f.value[STD.RT]).toBeCloseTo(0.7);
    expect(f.pressed[STD.RT]).toBe(true);
    expect([f.lx, f.ly, f.rx, f.ry]).toEqual([0.5, -0.2, 0, 1]);
  });
  it('decodes hat axis values', () => {
    expect(decodeHat(-1).up).toBe(true);
    expect(decodeHat(-0.4286)).toMatchObject({ right: true, up: false });
    expect(decodeHat(0.1429).down).toBe(true);
    expect(decodeHat(0.7143).left).toBe(true);
    expect(decodeHat(1.2857)).toEqual({ up: false, down: false, left: false, right: false });
  });
  it('maps a legacy DualShock 4 (Firefox raw layout) onto standard positions', () => {
    // raw: 0 square, 1 cross, 2 circle, 3 triangle
    const p = fakePad({ id: '054c-05c4-Wireless Controller', mapping: '', nButtons: 14, nAxes: 10 });
    p.press(1); // cross -> A
    p.axes(0, 0, 0, 0, 0, 0, 0, 0, 0, -1); // hat up
    const f = normalizePad(p.pad);
    expect(f.profile).toBe('ps-legacy');
    expect(f.pressed[STD.A]).toBe(true);
    expect(f.pressed[STD.UP]).toBe(true);
    p.clear().press(0); // square -> X
    expect(normalizePad(p.pad).pressed[STD.X]).toBe(true);
  });
  it('maps legacy Xbox 360 triggers on axes and dpad buttons', () => {
    const p = fakePad({ id: '045e-028e-Microsoft X-Box 360 pad', mapping: '', nButtons: 15, nAxes: 6 });
    p.axes(0, 0, 1, 0, 0, -1); // LT full, RT rest
    p.press(14); // dpad right
    const f = normalizePad(p.pad);
    expect(f.profile).toBe('xbox-legacy');
    expect(f.value[STD.LT]).toBeCloseTo(1);
    expect(f.value[STD.RT]).toBeCloseTo(0);
    expect(f.pressed[STD.RIGHT]).toBe(true);
  });
  it('falls back to a standard-ish guess for unknown legacy pads', () => {
    const p = fakePad({ id: '0079-0011-USB Gamepad', mapping: '', nButtons: 12, nAxes: 4 });
    p.press(0).axes(-1, 0);
    const f = normalizePad(p.pad);
    expect(f.profile).toBe('generic-legacy');
    expect(f.pressed[STD.A]).toBe(true);
    expect(f.lx).toBe(-1);
  });
});

describe('deadzone + hysteresis', () => {
  it('zeroes inside the deadzone, rescales outside', () => {
    const s = new StickFilter();
    expect(s.apply(0.2, 0, 0.25)).toMatchObject({ x: 0, y: 0, mag: 0 });
    expect(s.apply(1, 0, 0.25).x).toBeCloseTo(1);
    expect(new StickFilter().apply(0.625, 0, 0.25).mag).toBeCloseTo(0.5);
  });
  it('is radial (diagonal 0.2,0.2 has magnitude 0.28 so it engages)', () => {
    expect(new StickFilter().apply(0.2, 0.2, 0.25).mag).toBeGreaterThan(0);
  });
  it('hysteresis: stays engaged slightly below the deadzone, then releases', () => {
    const s = new StickFilter();
    s.apply(0.5, 0, 0.25);
    s.apply(0.23, 0, 0.25);
    expect(s.gx).toBe(0.23); // still gated-in: 0.23 > 0.25 * 0.85 (rescaled output is ~0 here by design)
    s.apply(0.2, 0, 0.25);
    expect(s.gx).toBe(0);
    s.apply(0.24, 0, 0.25);
    expect(s.gx).toBe(0); // must exceed 0.25 again
  });
});

describe('PadTracker', () => {
  const run = (t: PadTracker, p: ReturnType<typeof fakePad>, now = 0) => t.update(normalizePad(p.pad), 0.25, now);
  it('left/right threshold with hysteresis, D-pad overrides move', () => {
    const p = fakePad();
    const t = new PadTracker(0, p.pad.id, 'standard');
    p.axes(0.3, 0);
    run(t, p);
    expect(t.dirs['lx+']).toBe(false); // 0.3 < 0.35
    p.axes(0.4, 0);
    run(t, p);
    expect(t.dirs['lx+']).toBe(true);
    p.axes(0.3, 0);
    run(t, p);
    expect(t.dirs['lx+']).toBe(true); // hysteresis: off only below 0.28
    p.axes(0.27, 0);
    run(t, p);
    expect(t.dirs['lx+']).toBe(false);
    p.axes(0, 0).press(STD.LEFT);
    run(t, p);
    expect(t.move.x).toBe(-1);
  });
  it('down needs a firmer push than sideways', () => {
    const p = fakePad();
    const t = new PadTracker(0, p.pad.id, 'standard');
    p.axes(0, 0.4);
    run(t, p);
    expect(t.dirs['ly+']).toBe(false);
    p.axes(0, 0.6);
    run(t, p);
    expect(t.dirs['ly+']).toBe(true);
  });
  it('triggers press at 0.5 and release below 0.35', () => {
    const p = fakePad();
    const t = new PadTracker(0, p.pad.id, 'standard');
    p.press(STD.RT, 0.4);
    run(t, p);
    expect(t.isDown(STD.RT)).toBe(false);
    p.press(STD.RT, 0.6);
    run(t, p);
    expect(t.isDown(STD.RT)).toBe(true);
    expect(t.justPressed(STD.RT)).toBe(true);
    p.press(STD.RT, 0.4);
    run(t, p);
    expect(t.isDown(STD.RT)).toBe(true);
    p.press(STD.RT, 0.3);
    run(t, p);
    expect(t.isDown(STD.RT)).toBe(false);
  });
  it('suppressHeld ignores held inputs until released', () => {
    const p = fakePad();
    const t = new PadTracker(0, p.pad.id, 'standard');
    p.press(STD.B);
    run(t, p);
    t.suppressHeld();
    run(t, p);
    expect(t.isDown(STD.B)).toBe(false);
    p.release(STD.B);
    run(t, p);
    p.press(STD.B);
    run(t, p);
    expect(t.isDown(STD.B)).toBe(true);
  });
});

describe('Gamepads manager', () => {
  it('detects connect/disconnect by polling and picks the pad that last had input', () => {
    const a = fakePad({ index: 0, id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)' });
    const b = fakePad({ index: 1, id: 'Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)' });
    let list: (PadLike | null)[] = [a.pad];
    const g = new Gamepads(() => list);
    const log: string[] = [];
    g.onConnect = (p) => log.push(`+${p.name}`);
    g.onDisconnect = (p) => log.push(`-${p.name}`);
    g.poll(0);
    expect(g.active?.index).toBe(0);
    list = [a.pad, b.pad];
    g.poll(16);
    expect(log).toEqual(['+Xbox Controller', '+DualShock 4 Controller']);
    expect(g.active?.index).toBe(0);
    b.press(STD.A);
    g.poll(32);
    expect(g.active?.index).toBe(1);
    expect(g.active?.kind).toBe('playstation');
    b.release(STD.A);
    a.press(STD.X);
    g.poll(48);
    expect(g.active?.index).toBe(0);
    list = [null, b.pad];
    g.poll(64);
    expect(log.at(-1)).toBe('-Xbox Controller');
    expect(g.active?.index).toBe(1);
    list = [];
    g.poll(80);
    expect(g.active).toBeNull();
  });
  it('never throws when getGamepads throws or returns junk', () => {
    const g = new Gamepads(() => {
      throw new Error('nope');
    });
    expect(() => g.poll(0)).not.toThrow();
    const g2 = new Gamepads(() => [undefined, null]);
    expect(() => g2.poll(0)).not.toThrow();
  });
});
