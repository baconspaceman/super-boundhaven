import { describe, expect, it } from 'vitest';
import { keyLabel, padGlyph, padTokenName } from '../src/glyphs';
import { Repeater, pickNext, type Rect } from '../src/ui-nav';
import { EventDeriver, GameEvents, Rumble, deriveEvents } from '../src/rumble';
import { fakePad } from './fakepad';

const R = (l: number, t: number, w = 80, h = 30): Rect => ({ left: l, top: t, right: l + w, bottom: t + h });

describe('glyph selection', () => {
  it('face buttons per family (Switch letters are positionally swapped)', () => {
    expect(padGlyph('xbox', 'b0')).toMatchObject({ label: 'A', color: '#6cc04a' });
    expect(padGlyph('playstation', 'b0')).toMatchObject({ shape: 'cross', label: 'Cross' });
    expect(padGlyph('playstation', 'b1').shape).toBe('circle');
    expect(padGlyph('playstation', 'b2').shape).toBe('square');
    expect(padGlyph('playstation', 'b3').shape).toBe('triangle');
    expect(padGlyph('switch', 'b0').label).toBe('B');
    expect(padGlyph('switch', 'b1').label).toBe('A');
    expect(padGlyph('switch', 'b3').label).toBe('X');
  });
  it('other buttons', () => {
    expect(padGlyph('xbox', 'b7').label).toBe('RT');
    expect(padGlyph('playstation', 'b7').label).toBe('R2');
    expect(padGlyph('switch', 'b7').label).toBe('ZR');
    expect(padGlyph('xbox', 'b9').label).toBe('Menu');
    expect(padGlyph('playstation', 'b9').label).toBe('Options');
    expect(padGlyph('switch', 'b9').label).toBe('+');
    expect(padGlyph('xbox', 'b13').label).toBe('D↓');
    expect(padGlyph('xbox', 'lx-').label).toBe('L←');
    expect(padTokenName('xbox', 'ly+')).toBe('Left stick down');
    expect(padTokenName('xbox', 'b14')).toBe('D-pad left');
  });
  it('keycaps', () => {
    expect(keyLabel('KeyA')).toBe('A');
    expect(keyLabel('ArrowLeft')).toBe('←');
    expect(keyLabel('Space')).toBe('Space');
    expect(keyLabel('ShiftLeft')).toBe('Shift');
    expect(keyLabel('Digit3')).toBe('3');
    expect(keyLabel('Escape')).toBe('Esc');
  });
});

describe('spatial navigation', () => {
  // 2 columns x 3 rows grid
  const grid = [R(0, 0), R(100, 0), R(0, 50), R(100, 50), R(0, 100), R(100, 100)];
  it('moves in a grid', () => {
    expect(pickNext(grid, 0, 'right')).toBe(1);
    expect(pickNext(grid, 0, 'down')).toBe(2);
    expect(pickNext(grid, 3, 'left')).toBe(2);
    expect(pickNext(grid, 3, 'up')).toBe(1);
    expect(pickNext(grid, 5, 'down')).toBe(-1);
    expect(pickNext(grid, 0, 'left')).toBe(-1);
    expect(pickNext(grid, 0, 'up')).toBe(-1);
  });
  it('prefers aligned neighbors over nearer misaligned ones', () => {
    const rs = [R(0, 0, 100), R(10, 40, 100), R(300, 40, 100), R(0, 120, 100)];
    expect(pickNext(rs, 0, 'down')).toBe(1);
    const row = [R(0, 0, 40), R(60, 0, 40), R(0, 60, 200)];
    expect(pickNext(row, 0, 'right')).toBe(1); // same row beats the wide row below
  });
  it('starts at 0 when nothing focused', () => {
    expect(pickNext(grid, -1, 'down')).toBe(0);
    expect(pickNext([], -1, 'down')).toBe(-1);
  });
});

describe('Repeater', () => {
  it('fires on press, waits the delay, then repeats', () => {
    const r = new Repeater(300, 100);
    expect(r.step(true, 0)).toBe(true);
    expect(r.step(true, 100)).toBe(false);
    expect(r.step(true, 300)).toBe(true);
    expect(r.step(true, 350)).toBe(false);
    expect(r.step(true, 400)).toBe(true);
    r.step(false, 410);
    expect(r.step(true, 420)).toBe(true);
  });
});

describe('game event derivation + rumble', () => {
  const S = (o: Partial<{ x: number; y: number; vy: number; onGround: boolean }> = {}) => ({ x: 0, y: 0, vy: 0, onGround: true, ...o });
  it('hard landing only when falling fast', () => {
    expect(deriveEvents(S({ vy: 5.5, onGround: false }), S())).toEqual(['land']);
    expect(deriveEvents(S({ vy: 2, onGround: false }), S())).toEqual([]);
    expect(deriveEvents(S({ vy: 5.2, onGround: false }), S())).toEqual([]); // ordinary jump landing
  });
  it('bounce pad vs stomp vs normal jump', () => {
    expect(deriveEvents(S({ vy: 5, onGround: false }), S({ vy: -6.6, onGround: false }))).toEqual(['bounce']);
    expect(deriveEvents(S({ vy: 3, onGround: false }), S({ vy: -4.6, onGround: false }))).toEqual(['stomp']);
    expect(deriveEvents(S({ vy: 0, onGround: true }), S({ vy: -5.2, onGround: false }))).toEqual([]); // jump off ground
  });
  it('teleport = respawn', () => {
    expect(deriveEvents(S(), S({ x: 200 }))).toEqual(['respawn']);
  });
  it('deriver emits on the bus', () => {
    const bus = new GameEvents();
    const got: string[] = [];
    bus.on('*', (n) => got.push(n));
    const d = new EventDeriver(bus);
    d.observe(S({ vy: 5.5, onGround: false }));
    d.observe(S());
    expect(got).toEqual(['land']);
  });
  it('rumble: feature-detects, honors the setting, never throws', () => {
    const calls: unknown[][] = [];
    const p = fakePad();
    (p.pad as unknown as { vibrationActuator: unknown }).vibrationActuator = {
      playEffect: (t: string, params: unknown) => {
        calls.push([t, params]);
        return Promise.resolve('complete');
      },
    };
    let on = true;
    const r = new Rumble(
      () => p.pad,
      () => on,
    );
    expect(r.supported).toBe(true);
    expect(r.pulse('bounce')).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe('dual-rumble');
    on = false;
    expect(new Rumble(() => p.pad, () => on).pulse('hurt')).toBe(false);
    expect(new Rumble(() => null, () => true).pulse('hurt')).toBe(false);
    const throwing = {
      ...p.pad,
      vibrationActuator: {
        playEffect: () => {
          throw new Error('x');
        },
      },
    };
    expect(() => new Rumble(() => throwing, () => true).pulse('land')).not.toThrow();
    const none = new Rumble(() => fakePad().pad, () => true);
    expect(none.supported).toBe(false);
    expect(none.pulse('land')).toBe(false);
  });
});
