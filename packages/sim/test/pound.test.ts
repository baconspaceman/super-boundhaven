import { describe, expect, it } from 'vitest';
import { BTN, POUND_IDS, POUND_ROOM, RULES, TILE, createPlayer, createWorld, parseLevel, stepPlayer, stepWorld } from '../src/index';
import { Room } from './bots';

const L = POUND_ROOM;
const ID = POUND_IDS;
const FLOOR_Y = 13 * TILE;
const room = (n: number) => new Room(n, L);
const btnCenter = (name: keyof typeof ID.button) => {
  const b = L.buttons[ID.button[name]];
  return (b.col + b.w / 2) * TILE;
};
const isOpen = (r: Room, name: keyof typeof ID.door) => r.w.dynamic[ID.door[name]] === true;
const lit = (r: Room, name: keyof typeof ID.button) => r.w.buttons[ID.button[name]] > 0;

function put(r: Room, id: number, x: number): void {
  const p = r.p(id);
  p.x = x;
  p.y = FLOOR_Y;
  p.prevY = p.y;
  p.vx = 0;
  p.vy = 0;
}

/** Scripted slam: hop (JUMP for 10 ticks), then a fresh DOWN press in the air held until the slam lands. */
const slamInput = (t: number) => (t < 10 ? BTN.JUMP : BTN.CROUCH);

/** Slam each listed player starting `delay` ticks after the first tick; runs until everyone has landed their slam. */
function slams(r: Room, plan: [id: number, delay: number][]): void {
  const done = new Set<number>();
  for (let t = 0; t < 400 && done.size < plan.length; t++) {
    const inputs: Record<number, number> = {};
    for (const [id, delay] of plan) if (t >= delay && !done.has(id)) inputs[id] = slamInput(t - delay);
    r.step(inputs);
    for (const [id, delay] of plan) if (t >= delay && r.p(id).slam > 0) done.add(id);
  }
  expect(done.size).toBe(plan.length);
}

describe('ground pound: movement', () => {
  const flat = () => parseLevel('flat', ['..........', '..........', '..........', '..........', '##########']);
  const start = (lv = flat()) => {
    const p = createPlayer(1, lv);
    p.x = 40;
    p.y = 4 * TILE;
    p.prevY = p.y;
    stepPlayer(lv, p, 0);
    stepPlayer(lv, p, 0); // land
    return { lv, p };
  };

  it('DOWN pressed in the air hangs, then dives straight down and slams on landing', () => {
    const lv = parseLevel('tall', ['..........', '..........', '..........', '..........', '..........', '..........', '..........', '##########']);
    const { p } = start(lv);
    for (let i = 0; i < 8; i++) stepPlayer(lv, p, BTN.JUMP | BTN.RIGHT);
    expect(p.onGround).toBe(false);
    const x0 = p.x;
    stepPlayer(lv, p, BTN.CROUCH | BTN.RIGHT);
    expect(p.pound).toBeGreaterThan(0);
    expect(p.vy).toBe(0); // hanging
    const y = p.y;
    let hung = 0;
    while (p.pound < RULES.poundWindup) {
      stepPlayer(lv, p, BTN.CROUCH | BTN.RIGHT);
      expect(p.y).toBe(y); // no drift while hanging
      hung++;
    }
    expect(hung).toBeGreaterThanOrEqual(3);
    stepPlayer(lv, p, BTN.CROUCH | BTN.RIGHT);
    expect(p.vy).toBe(RULES.poundVel);
    expect(p.x).toBeCloseTo(x0, 5); // never carried sideways once the pound began
    let landed = -1;
    for (let i = 0; i < 60 && landed < 0; i++) {
      stepPlayer(lv, p, BTN.CROUCH | BTN.RIGHT);
      if (p.onGround) landed = i;
    }
    expect(landed).toBeGreaterThanOrEqual(0);
    expect(p.slam).toBe(RULES.slamTicks);
    expect(p.pound).toBe(0);
  });

  it('holding DOWN from the ground into a jump does not pound, and a slam recovery blocks walking briefly', () => {
    const { lv, p } = start();
    for (let i = 0; i < 20; i++) stepPlayer(lv, p, BTN.JUMP | BTN.CROUCH);
    expect(p.pound).toBe(0);
  });

  it('a stomp bounce or a bounce pad cancels the pound', () => {
    const lv = parseLevel('pad', ['..........', '..........', '..........', '..........', '..........', '..........', '..B.......', '##########']);
    const p = createPlayer(1, lv);
    p.x = 2 * TILE + 8;
    p.y = 3 * TILE;
    p.prevY = p.y;
    p.onGround = false;
    stepPlayer(lv, p, 0);
    stepPlayer(lv, p, BTN.CROUCH); // press in the air
    expect(p.pound).toBeGreaterThan(0);
    for (let i = 0; i < 60 && p.vy >= 0; i++) stepPlayer(lv, p, BTN.CROUCH);
    expect(p.vy).toBeLessThan(0); // launched by the pad
    expect(p.pound).toBe(0);
    expect(p.slam).toBe(0);
  });
});

describe('big buttons', () => {
  it('parse as one 2-tile-wide button per run of M', () => {
    expect(L.buttons).toHaveLength(6);
    for (const b of L.buttons) expect(b.w).toBe(2);
    expect(L.buttons[0].ticks).toBe(RULES.buttonTicks);
  });

  it('light on a slam but not when walked on or landed on without a pound', () => {
    const r = room(2);
    put(r, 1, btnCenter('A'));
    put(r, 2, btnCenter('A') + 4);
    r.run(30);
    expect(lit(r, 'A')).toBe(false); // standing on it does nothing
    // plain jump landing
    for (let t = 0; t < 40; t++) r.step({ 1: t < 10 ? BTN.JUMP : 0 });
    expect(lit(r, 'A')).toBe(false);
    slams(r, [[1, 0]]);
    expect(lit(r, 'A')).toBe(true);
  });

  it('a slam beside the button does nothing; the timer runs out', () => {
    const r = room(2);
    put(r, 1, btnCenter('A') - 40);
    slams(r, [[1, 0]]);
    expect(lit(r, 'A')).toBe(false);
    put(r, 1, btnCenter('A'));
    r.run(30);
    slams(r, [[1, 0]]);
    expect(lit(r, 'A')).toBe(true);
    r.run(RULES.buttonTicks - 20);
    expect(lit(r, 'A')).toBe(true);
    r.run(40);
    expect(lit(r, 'A')).toBe(false);
  });
});

describe('Slam Dunk: gates', () => {
  it('gate 0 opens for a solo player who learns the pound', () => {
    const r = room(1);
    put(r, 1, btnCenter('A'));
    r.run(5);
    expect(isOpen(r, 'gate0')).toBe(false);
    slams(r, [[1, 0]]);
    expect(isOpen(r, 'gate0')).toBe(true);
  });

  it('gate 1: partners may be about 2.5 s apart, not exact (leniency), but not much more', () => {
    for (const [delay, opens] of [[0, true], [60, true], [110, true], [260, false]] as const) {
      const r = room(2);
      put(r, 1, btnCenter('B1'));
      put(r, 2, btnCenter('B2'));
      r.run(5);
      slams(r, [[1, 0], [2, delay]]);
      r.run(20);
      expect(isOpen(r, 'gate1'), `delay ${delay}`).toBe(opens);
    }
  });

  it('gate 1 cannot be done alone: running between the buttons takes longer than the lit window (3 s)', () => {
    const r = room(1);
    put(r, 1, btnCenter('B1'));
    r.run(5);
    slams(r, [[1, 0]]);
    expect(lit(r, 'B1')).toBe(true);
    r.until(() => ({ 1: r.to(1, btnCenter('B2')) }), () => r.there(1, btnCenter('B2'), 6), 600, 'run to B2');
    slams(r, [[1, 0]]);
    r.run(30);
    expect(lit(r, 'B2')).toBe(true);
    expect(lit(r, 'B1')).toBe(false); // the first one went dark on the way
    expect(isOpen(r, 'gate1')).toBe(false);
  });

  it('gate 2: three buttons; two players do it by slamming the ends and then running to the middle', () => {
    const r = room(2);
    put(r, 1, btnCenter('C1'));
    put(r, 2, btnCenter('C3'));
    r.run(5);
    slams(r, [[1, 0], [2, 0]]);
    expect(isOpen(r, 'gate2')).toBe(false);
    r.until(() => ({ 1: r.to(1, btnCenter('C2')) }), () => r.there(1, btnCenter('C2'), 6), 400, 'to the middle');
    slams(r, [[1, 0]]);
    r.run(10);
    expect(lit(r, 'C1') && lit(r, 'C2') && lit(r, 'C3')).toBe(true);
    expect(isOpen(r, 'gate2')).toBe(true);
  });

  it('gate 2 with three players at once', () => {
    const r = room(3);
    put(r, 1, btnCenter('C1'));
    put(r, 2, btnCenter('C2'));
    put(r, 3, btnCenter('C3'));
    r.run(5);
    slams(r, [[1, 0], [2, 20], [3, 45]]); // roughly together
    r.run(5);
    expect(isOpen(r, 'gate2')).toBe(true);
  });

  it('the gate stays open (linger) after the buttons go dark, and a reset lever closes it', () => {
    const r = room(1);
    put(r, 1, btnCenter('A'));
    r.run(5);
    slams(r, [[1, 0]]);
    r.run(RULES.buttonTicks + 30);
    expect(lit(r, 'A')).toBe(false);
    expect(isOpen(r, 'gate0')).toBe(true);
  });
});

describe('ground pound: determinism', () => {
  it('a long scripted run with random inputs (including DOWN presses) reproduces bit for bit', () => {
    const run = () => {
      const w = createWorld(L);
      for (let i = 1; i <= 4; i++) w.players.push(createPlayer(i, L));
      let s = 4242;
      const rnd = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
      const held: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
      for (let t = 0; t < 5000; t++) {
        for (let id = 1; id <= 4; id++) if (rnd() < 0.08) held[id] = Math.floor(rnd() * 64) | (rnd() < 0.5 ? BTN.RIGHT : 0);
        stepWorld(L, w, held);
      }
      return JSON.stringify(w);
    };
    expect(run()).toBe(run());
  });
});
