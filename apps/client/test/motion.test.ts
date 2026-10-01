import { describe, expect, it } from 'vitest';
import { Motion, frameAt, TICK_MS, type MotionIn } from '../src/motion';

const S = (o: Partial<MotionIn> = {}): MotionIn => ({ x: 100, y: 100, vx: 0, vy: 0, onGround: true, facing: 1, ...o });

function run(m: Motion, states: MotionIn[], startMs = 0) {
  let now = startMs;
  return states.map((s) => m.update((now += TICK_MS), s));
}

describe('Motion', () => {
  it('idle when still, walk/run by speed, flips by facing', () => {
    const m = new Motion();
    expect(run(m, [S()]).at(-1)!.anim).toBe('idle');
    expect(run(m, [S({ vx: 1.2 })]).at(-1)!.anim).toBe('walk');
    const r = run(m, [S({ vx: 2.4 })]).at(-1)!;
    expect(r.anim).toBe('run');
    expect(run(m, [S({ vx: -2.4, facing: -1 })]).at(-1)!.flip).toBe(true);
  });

  it('air anims follow vy thresholds', () => {
    const m = new Motion();
    run(m, [S()]);
    const t = (vy: number) => run(m, [S({ onGround: false, vy })], 1000).at(-1)!.anim;
    expect(t(-3)).toBe('jump_rise');
    expect(t(0.2)).toBe('jump_apex');
    expect(t(3)).toBe('fall');
  });

  it('emits land with impact and plays the land squash', () => {
    const m = new Motion();
    run(m, [S({ onGround: false, vy: 4, y: 90 })]);
    const out = run(m, [S({ y: 100, vy: 0 })]).at(-1)!;
    expect(out.events).toContainEqual({ k: 'land', impact: 4 });
    expect(out.anim).toBe('land');
    expect(out.frame).toBe(0); // hard landing starts on the deep squash
  });

  it('soft landing starts on land_1', () => {
    const m = new Motion();
    run(m, [S({ onGround: false, vy: 1.5, y: 98 })]);
    expect(run(m, [S()]).at(-1)!.frame).toBe(1);
  });

  it('skid when reversing at speed', () => {
    const m = new Motion();
    run(m, [S({ vx: 2, facing: 1 })]);
    const out = run(m, [S({ vx: 1.6, facing: -1 })]).at(-1)!;
    expect(out.anim).toBe('skid');
    expect(out.events).toContainEqual({ k: 'skid' });
  });

  it('launch event when vy jumps upward; stomp mark shows spin until landing', () => {
    const m = new Motion();
    run(m, [S({ onGround: false, vy: 3, y: 84 })]);
    const out = run(m, [S({ onGround: false, vy: -4.6, y: 84 })]).at(-1)!;
    expect(out.events.some((e) => e.k === 'launch')).toBe(true);
    m.markStomp();
    expect(run(m, [S({ onGround: false, vy: -4, y: 80 })]).at(-1)!.anim).toBe('stomp');
    expect(run(m, [S({ onGround: true, vy: 0, y: 100 })]).at(-1)!.anim).not.toBe('stomp');
  });

  it('teleport to spawn flashes (respawn)', () => {
    const m = new Motion();
    run(m, [S({ y: 400, onGround: false, vy: 5 })]);
    const out = run(m, [S({ x: 8, y: 16, vx: 0, vy: 0, onGround: false })]).at(-1)!;
    expect(out.events).toContainEqual({ k: 'respawn' });
    expect(out.anim).toBe('respawn');
  });
});

describe('frameAt', () => {
  it('walks a tick table and loops or clamps', () => {
    const ticks = [5, 7];
    expect(frameAt(ticks, false, 0)).toBe(0);
    expect(frameAt(ticks, false, 5.5 * TICK_MS)).toBe(1);
    expect(frameAt(ticks, false, 100 * TICK_MS)).toBe(1);
    expect(frameAt(ticks, true, 12.5 * TICK_MS)).toBe(0);
  });
});
