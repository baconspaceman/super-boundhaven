import { describe, expect, it } from 'vitest';
import {
  BTN,
  MOVEMENT,
  PLAYGROUND,
  TILE,
  createPlayer,
  createWorld,
  parseLevel,
  stepPlayer,
  stepWorld,
  type PlayerState,
} from '../src/index';

const L = PLAYGROUND;
const R = BTN.RIGHT;

function player(x: number, y = 192, id = 1): PlayerState {
  const p = createPlayer(id, L);
  p.x = x;
  p.y = y;
  p.prevY = y;
  return p;
}

function settle(p: PlayerState): PlayerState {
  for (let i = 0; i < 3; i++) stepPlayer(L, p, 0);
  return p;
}

describe('basics', () => {
  it('spawn settles onto the ground', () => {
    const p = createPlayer(1, L);
    stepPlayer(L, p, 0);
    expect(p.onGround).toBe(true);
    expect(p.y).toBe(192);
  });

  it('is deterministic for identical inputs', () => {
    const run = () => {
      const p = createPlayer(1, L);
      for (let t = 0; t < 600; t++) {
        stepPlayer(L, p, (t % 50 < 40 ? R : 0) | (t % 37 < 5 ? BTN.JUMP : 0) | BTN.RUN);
      }
      return JSON.stringify(p);
    };
    expect(run()).toBe(run());
  });
});

describe('horizontal movement', () => {
  it('walk and run converge on their top speeds', () => {
    const w = settle(player(60));
    for (let i = 0; i < 60; i++) stepPlayer(L, w, R);
    expect(w.vx).toBeCloseTo(MOVEMENT.walkMax, 5);

    const r = settle(player(60));
    for (let i = 0; i < 60; i++) stepPlayer(L, r, R | BTN.RUN);
    expect(r.vx).toBeCloseTo(MOVEMENT.runMax, 5);
  });

  it('skids when reversing direction', () => {
    const p = settle(player(100));
    for (let i = 0; i < 50; i++) stepPlayer(L, p, R | BTN.RUN);
    const v0 = p.vx;
    stepPlayer(L, p, BTN.LEFT | BTN.RUN);
    expect(v0 - p.vx).toBeCloseTo(MOVEMENT.skid, 5);
  });

  it('keeps momentum in the air with no input', () => {
    const p = settle(player(100));
    for (let i = 0; i < 50; i++) stepPlayer(L, p, R | BTN.RUN);
    stepPlayer(L, p, R | BTN.RUN | BTN.JUMP);
    const v = p.vx;
    for (let i = 0; i < 5; i++) stepPlayer(L, p, 0);
    expect(p.onGround).toBe(false);
    expect(p.vx).toBe(v);
  });
});

describe('jumping', () => {
  function apex(holdTicks: number): number {
    const p = settle(player(60));
    let minY = p.y;
    for (let t = 0; t < 120; t++) {
      stepPlayer(L, p, t < holdTicks ? BTN.JUMP : 0);
      minY = Math.min(minY, p.y);
    }
    return 192 - minY;
  }

  it('reaches roughly 3.8 tiles with a held standing jump', () => {
    const h = apex(60);
    expect(h).toBeGreaterThan(58);
    expect(h).toBeLessThan(64);
  });

  it('a tap jumps much lower than a hold (variable height)', () => {
    expect(apex(3)).toBeLessThan(apex(60) * 0.7);
  });

  it('buffers a jump pressed just before landing', () => {
    const p = player(60, 178);
    p.vy = 2;
    // press jump while still airborne, a few ticks before touching down
    let jumped = false;
    for (let t = 0; t < 30; t++) {
      stepPlayer(L, p, t === 2 ? BTN.JUMP : t < 6 ? BTN.JUMP : 0);
      if (p.vy < -3) jumped = true;
    }
    expect(jumped).toBe(true);
  });

  it('allows a coyote jump just after leaving a ledge', () => {
    // walk off the right edge of the ground into the pit at col 40
    const p = settle(player(40 * TILE - 4));
    let jumped = false;
    for (let t = 0; t < 12; t++) {
      stepPlayer(L, p, R | (t >= 3 ? BTN.JUMP : 0));
      if (p.vy < -3) jumped = true;
    }
    expect(jumped).toBe(true);
  });
});

describe('slopes', () => {
  it('runs up a ramp onto the plateau and back down to the ground', () => {
    const p = settle(player(17 * TILE));
    let minY = p.y;
    for (let t = 0; t < 140; t++) {
      stepPlayer(L, p, R | BTN.RUN);
      minY = Math.min(minY, p.y);
    }
    expect(minY).toBeCloseTo(128, 3); // plateau top
    expect(p.x).toBeGreaterThan(33 * TILE);
    expect(p.onGround).toBe(true);
    expect(p.y).toBe(192);
  });

  it('walks up a ramp without getting stuck', () => {
    const p = settle(player(18 * TILE));
    for (let t = 0; t < 120; t++) stepPlayer(L, p, R);
    expect(p.x).toBeGreaterThan(24 * TILE);
    expect(p.y).toBeLessThanOrEqual(128.01);
  });

  it('walks up the far ramp leftward and onto the plateau', () => {
    const p = settle(player(34 * TILE));
    let minY = p.y;
    for (let t = 0; t < 140; t++) {
      stepPlayer(L, p, BTN.LEFT);
      minY = Math.min(minY, p.y);
    }
    expect(minY).toBe(128);
    expect(p.x).toBeLessThan(28 * TILE);
    expect(p.onGround).toBe(true);
  });

  it('runs left over the plateau and back down the near ramp to the ground', () => {
    const p = settle(player(34 * TILE));
    let minY = p.y;
    for (let t = 0; t < 140; t++) {
      stepPlayer(L, p, BTN.LEFT | BTN.RUN);
      minY = Math.min(minY, p.y);
    }
    expect(minY).toBe(128);
    expect(p.x).toBeLessThan(19 * TILE);
    expect(p.onGround).toBe(true);
    expect(p.y).toBe(192);
  });

  it('stays grounded walking down the mirrored ramp', () => {
    const p = settle(player(26 * TILE, 128));
    for (let t = 0; t < 120; t++) {
      stepPlayer(L, p, R);
      if (p.x > 28 * TILE + 4 && p.y < 192) expect(p.onGround).toBe(true);
    }
    expect(p.y).toBe(192);
  });

  it('jumps off the ramp top and lands on the plateau', () => {
    for (const run of [0, BTN.RUN]) {
      const p = settle(player(18 * TILE));
      for (let t = 0; t < 200 && p.x < 23.5 * TILE; t++) stepPlayer(L, p, R | run);
      stepPlayer(L, p, R | run | BTN.JUMP);
      expect(p.onGround).toBe(false);
      expect(p.vy).toBeLessThan(0);
      for (let t = 0; t < 60 && !p.onGround; t++) stepPlayer(L, p, R | run);
      expect(p.onGround).toBe(true);
      expect(p.y).toBeLessThanOrEqual(128.01);
      expect(p.x).toBeGreaterThan(24 * TILE);
    }
  });
});

describe('skill gates', () => {
  function clearsWall(run: boolean, wallCol: number, jumpAt: number): boolean {
    const p = settle(player(wallCol * TILE - 120));
    const buttons = R | (run ? BTN.RUN : 0);
    for (let t = 0; t < 140; t++) {
      stepPlayer(L, p, buttons | (t >= jumpAt && t < jumpAt + 40 ? BTN.JUMP : 0));
    }
    return p.x > (wallCol + 1) * TILE;
  }
  const anyTiming = (run: boolean, col: number) => {
    for (let j = 0; j < 80; j++) if (clearsWall(run, col, j)) return true;
    return false;
  };

  it('4-tile wall: no walk-jump clears it, a run-jump does', () => {
    expect(anyTiming(false, 74)).toBe(false);
    expect(anyTiming(true, 74)).toBe(true);
  });

  it('6-tile wall cannot be cleared solo', () => {
    expect(anyTiming(true, 84)).toBe(false);
  });

  it('5-tile pit needs a run-jump', () => {
    const cross = (run: boolean, jumpAt: number) => {
      const p = settle(player(36 * TILE));
      for (let t = 0; t < 140; t++) {
        stepPlayer(L, p, R | (run ? BTN.RUN : 0) | (t >= jumpAt && t < jumpAt + 40 ? BTN.JUMP : 0));
      }
      return p.x > 46 * TILE && p.y === 192;
    };
    const any = (run: boolean) => {
      for (let j = 0; j < 80; j++) if (cross(run, j)) return true;
      return false;
    };
    expect(any(false)).toBe(false);
    expect(any(true)).toBe(true);
  });

  it('falling into the pit respawns the player', () => {
    const p = player(42 * TILE, 200);
    let respawned = false;
    for (let t = 0; t < 400 && !respawned; t++) {
      stepPlayer(L, p, 0);
      if (p.x === L.spawn.x && p.vy === 0 && p.y === L.spawn.y) respawned = true;
    }
    expect(respawned).toBe(true);
  });
});

describe('body size vs level geometry', () => {
  // 10-row room, floor top at row 9 (y=144), ceiling block cols 5..14 at `ceilRow`
  const room = (ceilRow: number) => {
    const rows = Array.from({ length: 11 }, () => '.'.repeat(20));
    rows[9] = '#'.repeat(20);
    rows[10] = '#'.repeat(20);
    rows[ceilRow] = '.....##########.....';
    return parseLevel('room', rows);
  };
  const floorY = 9 * TILE;
  const walkUnder = (lv: ReturnType<typeof room>) => {
    const p = createPlayer(1, lv);
    p.x = 3 * TILE;
    p.y = floorY;
    p.prevY = floorY;
    for (let t = 0; t < 240; t++) stepPlayer(lv, p, R);
    return p;
  };

  it('body is 14x28 (matches humanoid sprite)', () => {
    expect(MOVEMENT.height).toBe(28);
    expect(MOVEMENT.halfWidth).toBe(7);
  });

  it('a standing player fits under a 2-tile ceiling', () => {
    // ceiling at row 6 -> underside y=112, clearance 32 >= 28
    const p = walkUnder(room(6));
    expect(p.x).toBeGreaterThan(15 * TILE);
    expect(p.y).toBe(floorY);
  });

  it('a standing player is blocked under a 1-tile ceiling', () => {
    // ceiling at row 7 -> underside y=128, clearance 16 < 28
    const p = walkUnder(room(7));
    expect(p.x).toBeLessThan(5 * TILE - MOVEMENT.halfWidth + 0.01);
  });

  it('head bump stops the jump at the new body height', () => {
    const lv = room(6); // ceiling underside at y=112
    const p = createPlayer(1, lv);
    p.x = 10 * TILE;
    p.y = floorY;
    p.prevY = floorY;
    let minY = Infinity;
    for (let t = 0; t < 40; t++) {
      stepPlayer(lv, p, BTN.JUMP);
      minY = Math.min(minY, p.y);
    }
    // head (y - height) never passes the ceiling underside; feet apex = 112 + 28 = 140 at the lowest
    expect(minY).toBeGreaterThanOrEqual(7 * TILE + MOVEMENT.height - 0.001);
    expect(minY).toBeLessThan(floorY - 1);
  });

  it('a stomp starts at a grounded victim head, one body-height above its feet', () => {
    const w = createWorld();
    const b = settle(player(200, 192, 2));
    const a = player(200, 192 - MOVEMENT.height - 3, 1);
    a.vy = 3;
    w.players.push(a, b);
    stepWorld(L, w, {});
    expect(a.vy).toBeLessThan(0);
    expect(a.y).toBe(192 - MOVEMENT.height);
  });
});

describe('bounce pad', () => {
  function padApex(hold: boolean): number {
    const p = player(50 * TILE + 8, 11 * TILE - 2);
    p.vy = 1;
    let minY = p.y;
    for (let t = 0; t < 90; t++) {
      stepPlayer(L, p, hold ? BTN.JUMP : 0);
      minY = Math.min(minY, p.y);
    }
    return 11 * TILE - minY;
  }
  it('launches the player, higher when jump is held', () => {
    const low = padApex(false);
    const high = padApex(true);
    expect(low).toBeGreaterThan(40);
    expect(high).toBeGreaterThan(low + 60);
    expect(high).toBeGreaterThan(7 * TILE); // reaches the high platform at row 4 (y=64)
  });
});

describe('player interaction', () => {
  it('stomping a player bounces the stomper, higher when jump is held', () => {
    const apexAfterStomp = (hold: boolean) => {
      const w = createWorld();
      const a = player(200, 192 - MOVEMENT.height - 14, 1);
      a.vy = 2;
      const b = player(200, 192, 2);
      settle(b);
      w.players.push(a, b);
      let minY = Infinity;
      for (let t = 0; t < 80; t++) {
        stepWorld(L, w, { 1: hold ? BTN.JUMP : 0 });
        if (t > 3) minY = Math.min(minY, a.y);
      }
      return { rise: 192 - MOVEMENT.height - minY, bY: b.y };
    };
    const low = apexAfterStomp(false);
    const high = apexAfterStomp(true);
    expect(low.rise).toBeGreaterThan(15);
    expect(high.rise).toBeGreaterThan(low.rise + 40);
    expect(high.bY).toBe(192); // victim stays on the ground
  });

  it('a held stomp off a grounded friend lifts you over the 6-tile wall', () => {
    const w = createWorld();
    const b = settle(player(83 * TILE - 20, 192, 2));
    const a = player(b.x, 192 - MOVEMENT.height - 14, 1);
    a.vy = 2;
    w.players.push(a, b);
    let minY = Infinity;
    for (let t = 0; t < 80; t++) {
      stepWorld(L, w, { 1: BTN.JUMP });
      if (t > 3) minY = Math.min(minY, a.y);
    }
    expect(minY).toBeLessThanOrEqual(6 * TILE); // feet above the wall top (y=96)
  });

  it('overlapping players are pushed apart', () => {
    const w = createWorld();
    const a = settle(player(200, 192, 1));
    const b = settle(player(201, 192, 2));
    w.players.push(a, b);
    for (let t = 0; t < 20; t++) stepWorld(L, w, {});
    expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(2 * MOVEMENT.halfWidth - 0.01);
    expect(a.x).toBeLessThan(b.x);
  });
});
